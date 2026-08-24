import { mockEvents } from "../data/mockEvents";
import type {
  EventStatus,
  SportFilter,
  SportsEvent,
  StatusFilter,
} from "../types/sports";

export interface BackendEventsResponse {
  source: string;
  date: string;
  events: SportsEvent[];
  warnings: string[];
  updatedAt: string;
}

export interface EventFilters {
  sport: SportFilter;
  status: StatusFilter;
  search: string;
}

const statusOrder: Record<EventStatus, number> = {
  live: 0,
  scheduled: 1,
  postponed: 2,
  cancelled: 3,
  finished: 4,
};

export function getMockEvents(): SportsEvent[] {
  return [...mockEvents];
}

export async function getBackendEvents(date: string): Promise<BackendEventsResponse> {
  const backendUrl = import.meta.env.VITE_BACKEND_URL ?? "http://127.0.0.1:3000";
  const url = new URL("/api/events", backendUrl);
  url.searchParams.set("sport", "all");
  url.searchParams.set("date", date);

  const response = await fetch(url);
  const payload = (await response.json()) as Partial<BackendEventsResponse> & {
    error?: string;
    warnings?: string[];
  };

  if (!response.ok) {
    throw new Error(
      payload.warnings?.join("; ") ?? payload.error ?? "Backend request failed",
    );
  }

  return {
    source: payload.source ?? "api-sports",
    date: payload.date ?? date,
    events: payload.events ?? [],
    warnings: payload.warnings ?? [],
    updatedAt: payload.updatedAt ?? new Date().toISOString(),
  };
}

export function filterEvents(
  events: SportsEvent[],
  filters: EventFilters,
): SportsEvent[] {
  const normalizedSearch = filters.search.trim().toLowerCase();

  return events.filter((event) => {
    const sportMatches =
      filters.sport === "all" || event.sport === filters.sport;
    const statusMatches =
      filters.status === "all" || event.status === filters.status;
    const searchMatches =
      normalizedSearch.length === 0 ||
      [event.homeParticipant, event.awayParticipant, event.league].some(
        (value) => value.toLowerCase().includes(normalizedSearch),
      );

    return sportMatches && statusMatches && searchMatches;
  });
}

export function sortEvents(events: SportsEvent[]): SportsEvent[] {
  return [...events].sort((left, right) => {
    const statusDifference = statusOrder[left.status] - statusOrder[right.status];

    if (statusDifference !== 0) {
      return statusDifference;
    }

    return (
      new Date(left.startTime).getTime() - new Date(right.startTime).getTime()
    );
  });
}

export function formatEventTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatEventDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
  }).format(new Date(value));
}
