# Vercel Deployment Guide

## Single Vercel project for demo auth

The repo root now supports a single Vercel deployment that serves:

- the React app from `gigshield-ai/frontend`
- the Express demo auth and dashboard API from `/api/*`

Use these settings in Vercel when you want login and signup to work in the same deployment:

| Setting | Value |
| --- | --- |
| Root Directory | `.` |
| Build Command | from `vercel.json` |
| Output Directory | from `vercel.json` |

Environment variables for this root deployment:

```env
JWT_SECRET=change-me
FRONTEND_URLS=https://your-project.vercel.app
AI_ENGINE_URL=https://your-ai-engine-project.vercel.app
```

Notes:
- If `REACT_APP_API_URL` is not set, the frontend now uses `/api` on deployed hosts and `http://localhost:5000/api` locally.
- The root `api/[...route].js` file exposes the Express app as a Vercel serverless function.
- The root `vercel.json` keeps `/api/*` available and rewrites all non-API routes to `index.html`.

## Frontend-only deploy for the current demo

If you only want to deploy the project exactly as it works right now, deploy just the React app.

Use these settings in Vercel:

| Setting | Value |
| --- | --- |
| Root Directory | `gigshield-ai/frontend` |
| Framework | Create React App |
| Build Command | default |
| Output Directory | default |

For the current demo build, no environment variables are required if you do not need live auth APIs.

Why this works:
- The routes currently wired in `frontend/src/App.js` are demo pages and do not require the backend.
- `frontend/vercel.json` already rewrites all routes to `index.html`, so refresh and direct links work on Vercel.

Quick steps:
1. Push the repo to GitHub, GitLab, or Bitbucket.
2. Import the repo in Vercel.
3. Set the Root Directory to `gigshield-ai/frontend`.
4. Click Deploy.

If you later want live registration, admin APIs, database access, or AI scoring, then deploy the backend and AI engine separately.

## Optional full stack later

This repository is a monorepo, so the cleanest full-stack Vercel setup is to create three separate Vercel projects from the same Git repo:

| Project | Root Directory | Purpose |
| --- | --- | --- |
| Frontend | `gigshield-ai/frontend` | React client |
| Backend | `gigshield-ai/backend` | Express API |
| AI Engine | `gigshield-ai/ai-engine` | FastAPI risk and fraud service |

## Recommended deploy order

1. Deploy the AI engine first.
2. Deploy the backend second and point `AI_ENGINE_URL` at the AI engine URL.
3. Deploy the frontend last and point `REACT_APP_API_URL` at the backend URL.

## Frontend project

- Root Directory: `gigshield-ai/frontend`
- Framework: Create React App
- Build Command: default
- Output Directory: default
- Required environment variables:

```env
REACT_APP_API_URL=https://your-backend-project.vercel.app/api
```

Notes:
- `frontend/vercel.json` already rewrites all routes to `index.html`, so BrowserRouter works on refresh.
- If `REACT_APP_API_URL` is not set, the app will use `/api` in deployed environments and `http://localhost:5000/api` locally.

## Backend project

- Root Directory: `gigshield-ai/backend`
- Framework: Express
- Build Command: default
- Required environment variables:

```env
NODE_ENV=production
FRONTEND_URLS=http://localhost:3000,https://your-frontend-project.vercel.app
AI_ENGINE_URL=https://your-ai-engine-project.vercel.app
DB_HOST=your-postgres-host
DB_PORT=5432
DB_NAME=gigpredict_ai
DB_USER=postgres
DB_PASSWORD=change-me
JWT_SECRET=change-me
JWT_EXPIRES_IN=7d
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
LOG_LEVEL=info
```

Notes:
- Use an external Postgres database. Vercel will host the API, but the data must live outside the repo.
- Set `FRONTEND_URLS` as a comma-separated list if you want to allow both local development and your deployed frontend origin.
- The backend root is deployable as-is because Vercel recognizes Express entrypoints such as `src/server.js`.

## AI engine project

- Root Directory: `gigshield-ai/ai-engine`
- Framework: FastAPI
- Build Command: default
- Optional environment variables:

```env
OPENWEATHERMAP_API_KEY=your-openweathermap-key
```

Notes:
- `ai-engine/app.py` was added as a Vercel-compatible FastAPI entrypoint.
- If `OPENWEATHERMAP_API_KEY` is missing, the service falls back to demo values instead of failing.
- The Python deployment bundle must stay within Vercel Function size limits. If deployment fails because of Python dependency size, move only the AI engine to Railway or Render and keep the frontend plus backend on Vercel.

## Deploy from the Vercel dashboard

1. Push this repo to GitHub, GitLab, or Bitbucket.
2. In Vercel, create a new project and import the repository.
3. Set the Root Directory to one of the folders above before deploying.
4. Add that project's environment variables.
5. Repeat for the other two folders.

## Useful URLs

- CRA on Vercel: https://vercel.com/docs/frameworks/create-react-app
- Express on Vercel: https://vercel.com/docs/frameworks/backend/express
- FastAPI on Vercel: https://vercel.com/docs/frameworks/backend/fastapi
- Monorepos on Vercel: https://vercel.com/docs/monorepos

