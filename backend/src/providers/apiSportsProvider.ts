import type {
  ApiSportsResponse,
  EventStatus,
  SportsEvent,
  Sport,
} from "../types/sports";

const API_KEY = process.env.SPORTS_API_KEY;

const BASE_URLS: Record<Sport, string> = {
  football: "https://v3.football.api-sports.io",
  basketball: "https://v1.basketball.api-sports.io",
  formula1: "https://v1.formula-1.api-sports.io",
};

if (!API_KEY) {
  console.warn("SPORTS_API_KEY is not configured. API requests will fail.");
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 502,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

function providerErrorMessage(errors: unknown): string {
  if (!errors) return "Sports provider returned an unknown error";
  if (typeof errors === "string") return errors;
  if (Array.isArray(errors)) return errors.map(String).join(", ");
  if (typeof errors === "object") {
    return Object.values(errors as Record<string, unknown>)
      .map(String)
      .join(", ");
  }
  return String(errors);
}

async function requestProvider(
  sport: Sport,
  path: string,
  params: Record<string, string>,
): Promise<ApiSportsResponse> {
  if (!API_KEY) throw new ProviderError("SPORTS_API_KEY is missing", 500);

  const url = new URL(path, BASE_URLS[sport]);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "x-apisports-key": API_KEY,
      },
    });
  } catch {
    throw new ProviderError("Unable to reach API-Sports", 503);
  }

  let payload: ApiSportsResponse;
  try {
    payload = (await response.json()) as ApiSportsResponse;
  } catch {
    throw new ProviderError("API-Sports returned invalid JSON", 502);
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ProviderError(
        "API-Sports rejected the key or access to this product",
        response.status,
      );
    }
    if (response.status === 429) {
      throw new ProviderError("API-Sports request limit reached", 429);
    }
    throw new ProviderError(`API-Sports returned HTTP ${response.status}`, 502);
  }

  if (payload.errors && providerErrorMessage(payload.errors) !== "") {
    throw new ProviderError(providerErrorMessage(payload.errors), 502);
  }

  return payload;
}

function statusFromProvider(
  shortStatus: unknown,
  startTime: string,
): EventStatus {
  const status = String(shortStatus ?? "").toUpperCase();
  if (["1H", "HT", "2H", "ET", "BT", "P", "LIVE", "Q1", "Q2", "Q3", "Q4"].includes(status)) return "live";
  if (["FT", "AET", "PEN", "FINAL", "FINISHED"].includes(status)) return "finished";
  if (["PST", "POSTPONED"].includes(status)) return "postponed";
  if (["CANC", "CANCELLED"].includes(status)) return "cancelled";
  return new Date(startTime).getTime() < Date.now() ? "finished" : "scheduled";
}

function mapFootballEvent(item: any, updatedAt: string): SportsEvent {
  const startTime = String(item.fixture?.date ?? new Date().toISOString());
  return {
    id: `football-${item.fixture?.id ?? startTime}`,
    sport: "football",
    league: String(item.league?.name ?? "Football"),
    startTime,
    status: statusFromProvider(item.fixture?.status?.short, startTime),
    homeParticipant: String(item.teams?.home?.name ?? "Home team"),
    awayParticipant: String(item.teams?.away?.name ?? "Away team"),
    homeScore: typeof item.goals?.home === "number" ? item.goals.home : undefined,
    awayScore: typeof item.goals?.away === "number" ? item.goals.away : undefined,
    period: item.fixture?.status?.elapsed != null ? `${item.fixture.status.elapsed}'` : item.fixture?.status?.short,
    venue: item.fixture?.venue?.name,
    updatedAt,
  };
}

function mapBasketballEvent(item: any, updatedAt: string): SportsEvent {
  const startTime = String(item.date ?? new Date().toISOString());
  return {
    id: `basketball-${item.id ?? startTime}`,
    sport: "basketball",
    league: String(item.league?.name ?? "Basketball"),
    startTime,
    status: statusFromProvider(item.status?.short ?? item.status?.long, startTime),
    homeParticipant: String(item.teams?.home?.name ?? "Home team"),
    awayParticipant: String(item.teams?.away?.name ?? "Away team"),
    homeScore: typeof item.scores?.home?.total === "number" ? item.scores.home.total : undefined,
    awayScore: typeof item.scores?.away?.total === "number" ? item.scores.away.total : undefined,
    period: item.status?.long,
    venue: item.arena?.name ?? item.venue?.name,
    updatedAt,
  };
}

function mapFormulaOneRace(item: any, updatedAt: string): SportsEvent {
  const startTime = String(item.date ?? new Date().toISOString());
  const raceName = String(item.competition?.name ?? item.name ?? "Formula 1 Grand Prix");
  return {
    id: `formula1-${item.id ?? startTime}`,
    sport: "formula1",
    league: "Formula 1",
    startTime,
    status: statusFromProvider(item.status, startTime),
    homeParticipant: raceName,
    awayParticipant: "Grand Prix",
    period: item.season ? `Season ${item.season}` : undefined,
    venue: item.circuit?.name,
    updatedAt,
  };
}

export async function getEvents(sport: Sport, date: string): Promise<SportsEvent[]> {
  const updatedAt = new Date().toISOString();
  let payload: ApiSportsResponse;

  if (sport === "football") {
    payload = await requestProvider(sport, "/fixtures", { date, timezone: "Asia/Novosibirsk" });
    return (payload.response ?? []).map((item) => mapFootballEvent(item, updatedAt));
  }
  if (sport === "basketball") {
    payload = await requestProvider(sport, "/games", { date });
    return (payload.response ?? []).map((item) => mapBasketballEvent(item, updatedAt));
  }

  payload = await requestProvider(sport, "/races", { date });
  return (payload.response ?? []).map((item) => mapFormulaOneRace(item, updatedAt));
}
