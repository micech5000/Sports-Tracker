import type { SportFilter, StatusFilter } from "../types/sports";

interface FiltersProps {
  sport: SportFilter;
  status: StatusFilter;
  search: string;
  onSportChange: (value: SportFilter) => void;
  onStatusChange: (value: StatusFilter) => void;
  onSearchChange: (value: string) => void;
}

export function Filters({
  sport,
  status,
  search,
  onSportChange,
  onStatusChange,
  onSearchChange,
}: FiltersProps) {
  return (
    <section className="filters" aria-label="Event filters">
      <label className="search-field">
        <span>⌕</span>
        <input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search teams, players or leagues"
          aria-label="Search events"
        />
      </label>

      <div className="filter-group">
        <span className="filter-label">Sport</span>
        <div className="segmented-control">
          {[
            ["all", "All"],
            ["football", "Football"],
            ["basketball", "Basketball"],
            ["formula1", "Formula 1"],
          ].map(([value, label]) => (
            <button
              key={value}
              className={sport === value ? "is-active" : ""}
              onClick={() => onSportChange(value as SportFilter)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="filter-group">
        <span className="filter-label">Status</span>
        <select
          value={status}
          onChange={(event) => onStatusChange(event.target.value as StatusFilter)}
          aria-label="Filter by status"
        >
          <option value="all">All statuses</option>
          <option value="live">Live</option>
          <option value="scheduled">Upcoming</option>
          <option value="finished">Finished</option>
          <option value="postponed">Postponed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>
    </section>
  );
}
