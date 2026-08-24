import type { SportsEvent } from "../types/sports";
import {
  formatEventDate,
  formatEventTime,
} from "../services/eventsService";

interface EventCardProps {
  event: SportsEvent;
}

const sportEmoji: Record<SportsEvent["sport"], string> = {
  football: "⚽",
  basketball: "🏀",
  formula1: "🏎️",
};

const statusLabel: Record<SportsEvent["status"], string> = {
  live: "LIVE",
  scheduled: "UPCOMING",
  finished: "FINISHED",
  postponed: "POSTPONED",
  cancelled: "CANCELLED",
};

export function EventCard({ event }: EventCardProps) {
  const hasScore = event.homeScore !== undefined || event.awayScore !== undefined;

  return (
    <article className={`event-card event-card--${event.status}`}>
      <div className="event-card__topline">
        <span className="event-card__league">
          {sportEmoji[event.sport]} {event.league}
        </span>
        <span className={`status-badge status-badge--${event.status}`}>
          {event.status === "live" && <span className="live-dot" />}
          {statusLabel[event.status]}
        </span>
      </div>

      <div className="event-card__content">
        <div className="event-card__participants">
          <div className="participant">
            <span className="participant__avatar">
              {event.homeParticipant.charAt(0)}
            </span>
            <span>{event.homeParticipant}</span>
          </div>
          <div className="participant">
            <span className="participant__avatar">
              {event.awayParticipant.charAt(0)}
            </span>
            <span>{event.awayParticipant}</span>
          </div>
        </div>

        <div className="event-card__score">
          {hasScore ? (
            <>
              <strong>{event.homeScore ?? "–"}</strong>
              <span>:</span>
              <strong>{event.awayScore ?? "–"}</strong>
            </>
          ) : (
            <span className="event-card__time">{formatEventTime(event.startTime)}</span>
          )}
          {event.period && <small>{event.period}</small>}
        </div>
      </div>

      <div className="event-card__footer">
        <span>{formatEventDate(event.startTime)}</span>
        <span>{event.venue ?? "Venue not specified"}</span>
      </div>
    </article>
  );
}
