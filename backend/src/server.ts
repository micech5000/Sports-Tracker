import "dotenv/config";
import cors from "cors";
import express from "express";
import type { Request, Response } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { getCached, setCached } from "./cache";
import { getEvents, ProviderError } from "./providers/apiSportsProvider";
import type { SportsEvent, Sport } from "./types/sports";

const app = express();
const port = Number(process.env.PORT ?? 3000);
const allowedSports: Sport[] = ["football", "basketball", "formula1"];
const configuredOrigin = process.env.FRONTEND_ORIGIN;

app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      const isDesktopOrigin = origin === "null" || origin === "file://";
      const isAllowed =
        !origin ||
        !configuredOrigin ||
        origin === configuredOrigin ||
        isDesktopOrigin;

      callback(null, isAllowed);
    },
  }),
);
app.use(express.json());
app.use(
  "/api",
  rateLimit({
    windowMs: 60_000,
    limit: 60,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  }),
);

app.get("/health", (_request: Request, response: Response) => {
  response.json({ ok: true, service: "sports-tracker-backend" });
});

function isSport(value: string): value is Sport {
  return allowedSports.includes(value as Sport);
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

async function loadSportEvents(sport: Sport, date: string): Promise<SportsEvent[]> {
  const cacheKey = `${sport}:${date}`;
  const cached = getCached<SportsEvent[]>(cacheKey);
  if (cached) return cached;

  const events = await getEvents(sport, date);
  setCached(cacheKey, events, sport === "formula1" ? 5 * 60_000 : 30_000);
  return events;
}

app.get("/api/events", async (request: Request, response: Response) => {
  const requestedSport = String(request.query.sport ?? "all");
  const date = String(request.query.date ?? todayUtc());

  if (requestedSport !== "all" && !isSport(requestedSport)) {
    response.status(400).json({
      error: "Unsupported sport",
      allowedSports: ["all", ...allowedSports],
    });
    return;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    response.status(400).json({ error: "Date must use YYYY-MM-DD format" });
    return;
  }

  const sports: Sport[] =
    requestedSport === "all" ? allowedSports : [requestedSport as Sport];
  const results = await Promise.allSettled(
    sports.map((sport) => loadSportEvents(sport, date)),
  );

  const events: SportsEvent[] = [];
  const warnings: string[] = [];

  results.forEach((result, index) => {
    const sport = sports[index];
    if (result.status === "fulfilled") {
      events.push(...result.value);
      return;
    }

    const reason = result.reason;
    const message =
      reason instanceof ProviderError
        ? reason.message
        : "Unable to load this sport";
    warnings.push(`${sport}: ${message}`);
  });

  if (events.length === 0 && warnings.length === sports.length) {
    const rejected = results.find(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    const statusCode = rejected?.reason?.statusCode;
    response.status(typeof statusCode === "number" ? statusCode : 502).json({
      error: "Sports data is unavailable",
      warnings,
    });
    return;
  }

  response.json({
    source: "api-sports",
    date,
    events,
    warnings,
    updatedAt: new Date().toISOString(),
  });
});

app.listen(port, () => {
  console.log(`Sports Tracker backend listening on port ${port}`);
});
