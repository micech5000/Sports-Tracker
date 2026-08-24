import {
  app,
  BrowserWindow,
  Menu,
  nativeImage,
  Notification,
  Tray,
  ipcMain,
} from "electron";
import path from "node:path";
import fs from "node:fs";

type EventStatus = "scheduled" | "live" | "finished" | "postponed" | "cancelled";

interface SportsEvent {
  id: string;
  sport: "football" | "basketball" | "formula1";
  league: string;
  startTime: string;
  status: EventStatus;
  homeParticipant: string;
  awayParticipant: string;
  homeScore?: number;
  awayScore?: number;
  period?: string;
}

interface EventsResponse {
  events: SportsEvent[];
}

interface AppSettings {
  notificationsEnabled: boolean;
  startWithWindows: boolean;
}

const isDevelopment = !app.isPackaged;
const backendUrl = process.env.VITE_BACKEND_URL ?? "http://127.0.0.1:3000";
const pollingIntervalMs = 60_000;
const settingsPath = (): string => path.join(app.getPath("userData"), "settings.json");

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let pollingTimer: NodeJS.Timeout | null = null;
let pollInProgress = false;
let isQuitting = false;
let previousEvents = new Map<string, SportsEvent>();
let settings: AppSettings = {
  notificationsEnabled: true,
  startWithWindows: false,
};

function localDate(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function loadSettings(): void {
  try {
    const fs = require("node:fs") as typeof import("node:fs");
    const saved = JSON.parse(fs.readFileSync(settingsPath(), "utf8")) as Partial<AppSettings>;
    settings = {
      notificationsEnabled: saved.notificationsEnabled !== false,
      startWithWindows: saved.startWithWindows === true,
    };
  } catch {
    // First launch: use defaults.
  }
}

function saveSettings(): void {
  const fs = require("node:fs") as typeof import("node:fs");
  fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
  fs.writeFileSync(settingsPath(), JSON.stringify(settings, null, 2), "utf8");
}

function applyStartWithWindows(): void {
  if (process.platform !== "win32") return;

  app.setLoginItemSettings({
    openAtLogin: settings.startWithWindows,
    path: process.execPath,
    args: isDevelopment ? [app.getAppPath()] : [],
  });
}

function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return;

  const contents = fs.readFileSync(filePath, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function startEmbeddedBackend(): void {
  if (isDevelopment) return;

  const packagedConfigPath = path.join(process.resourcesPath, "backend", ".env");
  const packagedBackendPath = path.join(app.getAppPath(), "backend", "server.js");
  loadEnvFile(packagedConfigPath);
  process.env.PORT ??= "3000";
  process.env.FRONTEND_ORIGIN = "file://";

  try {
    require(packagedBackendPath);
    console.log("Embedded sports backend started");
  } catch (error) {
    console.error("Failed to start embedded sports backend:", packagedBackendPath, error);
  }
}

function createTrayIcon(): Electron.NativeImage {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <rect width="32" height="32" rx="8" fill="#14b8a6"/>
      <path d="M7 9h4.2l3.2 9.7L17.6 9H22l-5.5 14h-4.1L7 9Z" fill="#06111f"/>
      <circle cx="24.5" cy="23.5" r="2.5" fill="#f8fafc"/>
    </svg>`;
  return nativeImage.createFromDataURL(
    `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
  );
}

function showWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    return;
  }

  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function hideWindow(): void {
  mainWindow?.hide();
}

function notify(title: string, body: string): void {
  if (!settings.notificationsEnabled || !Notification.isSupported()) return;

  const notification = new Notification({ title, body, silent: false });
  notification.on("click", showWindow);
  notification.show();
}

function eventScore(event: SportsEvent): string {
  return `${event.homeScore ?? "-"}:${event.awayScore ?? "-"}`;
}

function eventLabel(event: SportsEvent): string {
  return `${event.homeParticipant} ${event.homeScore ?? "-"} : ${event.awayScore ?? "-"} ${event.awayParticipant}`;
}

function checkForChanges(events: SportsEvent[]): void {
  if (previousEvents.size === 0) {
    previousEvents = new Map(events.map((event) => [event.id, event]));
    return;
  }

  for (const event of events) {
    const previous = previousEvents.get(event.id);
    if (!previous) continue;

    if (previous.status !== "live" && event.status === "live") {
      notify("Матч начался", `${event.homeParticipant} — ${event.awayParticipant}`);
    } else if (event.status === "live" && eventScore(previous) !== eventScore(event)) {
      notify("Изменение счёта", eventLabel(event));
    } else if (previous.status === "live" && event.status === "finished") {
      notify("Матч завершён", eventLabel(event));
    }
  }

  previousEvents = new Map(events.map((event) => [event.id, event]));
}

async function pollEvents(notifyChanges = true): Promise<void> {
  if (pollInProgress) return;
  pollInProgress = true;

  try {
    const url = new URL("/api/events", backendUrl);
    url.searchParams.set("sport", "all");
    url.searchParams.set("date", localDate());

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Backend returned ${response.status}`);
    const payload = (await response.json()) as EventsResponse;
    const events = Array.isArray(payload.events) ? payload.events : [];

    if (notifyChanges) checkForChanges(events);
    mainWindow?.webContents.send("events-updated");
  } catch (error) {
    console.warn("Background sports update failed:", error);
  } finally {
    pollInProgress = false;
  }
}

function startBackgroundPolling(): void {
  void pollEvents(false);
  pollingTimer = setInterval(() => void pollEvents(true), pollingIntervalMs);
}

function createTray(): void {
  tray = new Tray(createTrayIcon());
  tray.setToolTip("Sports Tracker");
  tray.on("double-click", showWindow);
  tray.on("click", showWindow);
  updateTrayMenu();
}

function updateTrayMenu(): void {
  if (!tray) return;

  const menu = Menu.buildFromTemplate([
    { label: "Открыть Sports Tracker", click: showWindow },
    { label: "Обновить сейчас", click: () => void pollEvents(false) },
    { type: "separator" },
    {
      label: "Уведомления",
      type: "checkbox",
      checked: settings.notificationsEnabled,
      click: (item) => {
        settings.notificationsEnabled = item.checked;
        saveSettings();
        updateTrayMenu();
      },
    },
    {
      label: "Запускать вместе с Windows",
      type: "checkbox",
      checked: settings.startWithWindows,
      click: (item) => {
        settings.startWithWindows = item.checked;
        saveSettings();
        applyStartWithWindows();
        updateTrayMenu();
      },
    },
    { type: "separator" },
    {
      label: "Выйти",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(menu);
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1040,
    height: 760,
    minWidth: 760,
    minHeight: 560,
    backgroundColor: "#0f172a",
    title: "Sports Tracker",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      hideWindow();
    }
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  if (isDevelopment) {
    void mainWindow.loadURL("http://127.0.0.1:5173");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    const rendererPath = path.join(app.getAppPath(), "dist", "index.html");
    void mainWindow.loadFile(rendererPath).catch((error: unknown) => {
      console.error("Failed to load renderer:", rendererPath, error);
    });
  }
}

app.whenReady().then(() => {
  loadSettings();
  applyStartWithWindows();
  startEmbeddedBackend();
  createWindow();
  createTray();
  startBackgroundPolling();

  ipcMain.handle("events:update-now", () => pollEvents(false));
  ipcMain.handle("settings:get", () => settings);
  ipcMain.handle("settings:set", (_event, next: Partial<AppSettings>) => {
    settings = { ...settings, ...next };
    saveSettings();
    applyStartWithWindows();
    updateTrayMenu();
    return settings;
  });

  app.on("activate", () => showWindow());
});

app.on("before-quit", () => {
  isQuitting = true;
  if (pollingTimer) clearInterval(pollingTimer);
});

app.on("window-all-closed", () => {
  // On Windows the app stays alive in the system tray.
});
