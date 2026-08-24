import { useCallback, useEffect, useMemo, useState } from "react";
import { EventCard } from "./components/EventCard";
import { Filters } from "./components/Filters";
import {
  filterEvents,
  formatEventDate,
  getBackendEvents,
  getMockEvents,
  sortEvents,
} from "./services/eventsService";
import type { SportFilter, StatusFilter, SportsEvent } from "./types/sports";

const eventSections: Array<{
  key: SportsEvent["status"];
  title: string;
  icon: string;
}> = [
  { key: "live", title: "Live now", icon: "●" },
  { key: "scheduled", title: "Upcoming", icon: "◷" },
  { key: "finished", title: "Finished", icon: "✓" },
  { key: "postponed", title: "Postponed", icon: "Ⅱ" },
  { key: "cancelled", title: "Cancelled", icon: "×" },
];

function localDate(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function App() {
  const [events, setEvents] = useState<SportsEvent[]>(() => getMockEvents());
  const [sport, setSport] = useState<SportFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState("Connecting to backend...");
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await getBackendEvents(localDate());
      setEvents(result.events);
      setWarnings(result.warnings);
      setMode("API-Sports connected");
      setLastUpdated(new Date(result.updatedAt));
    } catch (reason) {
      setEvents(getMockEvents());
      setWarnings([]);
      setMode("Mock fallback");
      setError(
        reason instanceof Error
          ? `${reason.message}. Showing demo data.`
          : "Backend unavailable. Showing demo data.",
      );
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    const unsubscribe = window.sportsTracker?.onEventsUpdated(() => {
      void loadEvents();
    });

    return unsubscribe;
  }, [loadEvents]);

  const filteredEvents = useMemo(
    () =>
      sortEvents(
        filterEvents(events, {
          sport,
          status,
          search,
        }),
      ),
    [events, search, sport, status],
  );

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand">
          <div className="brand-mark">ST</div>
          <div>
            <p className="eyebrow">SPORTS DASHBOARD</p>
            <h1>Sports Tracker</h1>
          </div>
        </div>

        <div className="header-actions">
          <span className="connection-status">
            <span className={`connection-status__dot ${mode.includes("API") ? "connection-status__dot--online" : ""}`} />
            {mode}
          </span>
          <button className="refresh-button" onClick={() => void loadEvents()} type="button">
            ↻ Refresh
          </button>
        </div>
      </header>

      <section className="hero-row">
        <div>
          <p className="eyebrow">TODAY&apos;S OVERVIEW</p>
          <h2>{formatEventDate(new Date().toISOString())}</h2>
          <p className="muted-text">
            {loading ? "Loading sports events..." : `${filteredEvents.length} events match your filters.`}
          </p>
        </div>
        <div className="summary-card">
          <span className="summary-card__label">Last update</span>
          <strong>
            {lastUpdated.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </strong>
        </div>
      </section>

      <Filters
        sport={sport}
        status={status}
        search={search}
        onSportChange={setSport}
        onStatusChange={setStatus}
        onSearchChange={setSearch}
      />

      {error && <div className="notice notice--warning">⚠ {error}</div>}
      {warnings.map((warning) => (
        <div className="notice notice--info" key={warning}>
          ℹ {warning}
        </div>
      ))}

      <div className="events-board">
        {eventSections.map((section) => {
          const sectionEvents = filteredEvents.filter(
            (event) => event.status === section.key,
          );

          if (sectionEvents.length === 0) return null;

          return (
            <section className="event-section" key={section.key}>
              <div className="section-heading">
                <div>
                  <span className={`section-icon section-icon--${section.key}`}>
                    {section.icon}
                  </span>
                  <h3>{section.title}</h3>
                </div>
                <span className="section-count">{sectionEvents.length}</span>
              </div>
              <div className="event-grid">
                {sectionEvents.map((event) => (
                  <EventCard event={event} key={event.id} />
                ))}
              </div>
            </section>
          );
        })}

        {!loading && filteredEvents.length === 0 && (
          <section className="empty-state">
            <div className="empty-state__icon">⌕</div>
            <h3>No events found</h3>
            <p>There are no events for this date or filter.</p>
          </section>
        )}
      </div>

      <footer className="app-footer">
        <span>Sports Tracker v0.2.0</span>
        <span>{mode} · Data date: {localDate()}</span>
      </footer>
    </main>
  );
}

export default App;
