# BasketBall Hub

NBA Live Intelligence is a full-stack basketball analytics dashboard built with React, Vite, Tailwind CSS, FastAPI, and `nba_api`.

It includes live scoreboards, game feeds, player analysis, fatigue detection, standings, awards, leaderboards, strategy tools, and historical NBA data views.

## Features

- Live NBA scoreboard and game detail feed
- Player box scores with headshots and team logos
- Assisted-teammate breakdown showing who a player assisted and how many points those assists created
- Fatigue detection from recent workload and game logs
- Player analyzer, leaderboards, standings, awards, shot tools, trade tools, and season archive views
- Mobile-friendly responsive layout
- Deployment-ready frontend/backend split

## Tech Stack

- Frontend: React 18, Vite, TypeScript, Tailwind CSS, lucide-react
- Backend: FastAPI, `nba_api`, pandas, requests
- Free deployment: Vercel for frontend, Render for backend

## Local Setup

Backend:

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Open:

```text
http://127.0.0.1:5173
```

## Environment Variables

Frontend:

```text
VITE_API_BASE_URL=http://localhost:8000/api
```

For production, set it to your Render backend URL:

```text
VITE_API_BASE_URL=https://YOUR_RENDER_BACKEND_URL/api
```

## Deployment

The recommended free setup is:

- Frontend on Vercel
- Backend on Render

Full instructions are in [DEPLOYMENT.md](DEPLOYMENT.md).

## Build

```bash
cd frontend
npm run build
```

The production files are generated in `frontend/dist`, which is intentionally ignored by Git.
