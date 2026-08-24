export type Sport = "football" | "basketball" | "formula1";

export type EventStatus =
  | "scheduled"
  | "live"
  | "finished"
  | "postponed"
  | "cancelled";

export interface SportsEvent {
  id: string;
  sport: Sport;
  league: string;
  startTime: string;
  status: EventStatus;
  homeParticipant: string;
  awayParticipant: string;
  homeScore?: number;
  awayScore?: number;
  period?: string;
  venue?: string;
  updatedAt: string;
}

export type SportFilter = "all" | Sport;
export type StatusFilter = "all" | EventStatus;
