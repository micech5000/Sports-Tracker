# Sports Tracker

Windows desktop application for live, upcoming and finished sports events.

## Current stage

The application uses API-Sports through a backend proxy. If the backend is temporarily unavailable, the desktop application shows demo data instead of a blank screen.

## Structure

- `desktop/` — Electron + React + TypeScript application.
- `backend/` — Express backend proxy for API-Sports.
- `docs/` — architecture notes.

## Local development

Install Node.js LTS, then run:

```bash
pnpm install
```

In the first PowerShell window:

```bash
cd backend
pnpm dev
```

In the second PowerShell window:

```bash
cd desktop
pnpm dev
```

Backend endpoints:

- `GET /health`
- `GET /api/events?sport=all&date=YYYY-MM-DD`

The API key is stored only in `backend/.env`. It must not be committed to GitHub.

## Windows build

The desktop build compiles and embeds the backend, so the installed application can start with one shortcut and does not require a separate backend terminal:

```bash
pnpm --filter sports-tracker-desktop build
pnpm --dir desktop package
```

The installer is created in `desktop/release/`. For a public GitHub release, do not commit the installer to the repository. Attach it as a GitHub Release asset instead.

For private/local distribution, the installer can include the API configuration. Do not publish that installer publicly while it contains a provider key; use a remote backend or a first-run key setup for a public release.

Formula 1 events are shown only when API-Sports returns a race for the selected date. Access to the current season depends on the API-Sports plan.

## Checks

```bash
pnpm --filter sports-tracker-desktop typecheck
pnpm --filter sports-tracker-backend typecheck
pnpm --filter sports-tracker-desktop lint
```
Версия для Windows x64 Sports Tracker Setup 0.2.0 
