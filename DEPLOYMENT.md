# Free Deployment Guide

Recommended free setup:

- Backend API: Render free web service
- Frontend app: Vercel free static site

This split is the easiest free path for a Vite React frontend plus FastAPI backend. Render free services can sleep after inactivity, so the first request after a quiet period may be slow.

## 1. Push The Project To GitHub

Create a GitHub repository and push this folder.

## 2. Deploy The Backend On Render

1. Go to https://render.com and sign in.
2. Choose **New +** then **Blueprint**.
3. Connect your GitHub repo.
4. Render will detect `render.yaml`.
5. Create the service.
6. After deploy, copy the backend URL. It will look like:

```text
https://basketball-hub-api.onrender.com
```

Your API base URL will be:

```text
https://basketball-hub-api.onrender.com/api
```

## 3. Deploy The Frontend On Vercel

1. Go to https://vercel.com and sign in.
2. Choose **Add New Project**.
3. Import the same GitHub repo.
4. Set **Root Directory** to:

```text
frontend
```

5. Keep the build command as:

```text
npm run build
```

6. Keep the output directory as:

```text
dist
```

7. Add this environment variable in Vercel:

```text
VITE_API_BASE_URL=https://basketball-hub-api.onrender.com/api
```

Example:

```text
VITE_API_BASE_URL=https://basketball-hub-api.onrender.com/api
```

8. Click **Deploy**.

## Local Development

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

For local frontend development, copy `frontend/.env.example` to `frontend/.env` if you want to customize the API URL.

## Best Free Choice

Use **Vercel for the frontend** and **Render for the backend**.

Vercel is better for React/Vite hosting. Render is better for FastAPI because Vercel's free Python serverless functions are not a great fit for this long-running `nba_api` backend.
