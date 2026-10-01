# Grimoire

A personal media tracker for anime, movies, TV and books — track what you're watching and reading, rate it, organize custom lists, and pull in provider metadata (e.g. TMDB) for posters and info.

## Stack

- **Backend:** Express + TypeScript, Prisma (SQLite), Zod validation
- **Frontend:** React + Vite + TypeScript, TanStack Query, Zustand, Tailwind CSS, Framer Motion

## Structure

```
backend/
  src/
    routes/       library, lists, providers, suggestions
    services/     provider integrations (TMDB, etc.), suggestion logic
    scripts/      one-off data scripts (enrichAll: provider metadata backfill)
  prisma/         schema + migrations (SQLite)
frontend/
  src/
    pages/        Home, Category, Anime, Lists, ListDetail, MediaDetail, Settings
```

## Setup

### Backend

```bash
cd backend
cp .env.example .env   # fill in TMDB_API_KEY
npm install
npm run prisma:migrate
npm run dev             # http://localhost:5050
```

### Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

## Data model

- `MediaItem` — tracked title (type, provider metadata, your status/rating/progress/notes)
- `CustomList` / `ListItem` — user-defined lists of media items

## Status

Actively developed, single-user app (SQLite). Real auth: shared PIN unlock
across trusted devices, new devices verified via a 6-digit email code.
