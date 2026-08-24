# Архитектура Sports Tracker

## Desktop

- Electron main process отвечает за окно приложения.
- `preload.ts` является безопасным мостом между Electron и renderer.
- React renderer отвечает только за интерфейс.
- `src/services/eventsService.ts` изолирует источник данных от компонентов.

## Данные

На первом этапе используется `mockEvents.ts`. Позже desktop-приложение будет обращаться к backend:

```text
Electron desktop → backend /api/events → API-Sports
```

Ключ API не должен попадать в desktop-приложение.

## Backend

Backend содержит provider adapter, нормализует ответы внешнего API в единый тип `SportsEvent`, добавляет cache, rate limit и обработку ошибок.
