# FreshSpin Web Admin

The admin app is a React single-page application built with Vite.

## Deploy on Render

This repository includes a Render Blueprint in `render.yaml`. In Render, create a
Blueprint from the GitHub repository containing this app and deploy the
`freshspin-web-admin` web service.

The Blueprint installs dependencies, builds with `npm run build`, and starts
the app with `npm start`. The start script serves the production build on
Render's assigned `PORT` and supports client-side routes.

To configure the service manually, choose the Node runtime, set the build
command to `npm ci --include=dev && npm run build`, and the start command to
`npm start`.

The Render Blueprint uses `https://freshspin-backend.onrender.com` for
`VITE_API_BASE_URL` by default. Override it with the deployed backend origin
(without the `/api` path) if using a different backend. The frontend also
defaults to this API in production builds when the variable is omitted. Vite
embeds this public URL into the frontend; it must not contain secrets.
The backend must allow the Render site origin in `CORS_ALLOWED_ORIGINS`.

## Local development

Install the admin dependencies with `npm install` once. Make sure the sibling
`backend` app has its PHP dependencies, environment, and database configured.
From this directory, run `npm run dev` to start both the Laravel API on
`127.0.0.1:8000` and the admin app on port `5173`; press Ctrl+C to stop both.
The admin dev server proxies `/api` requests to Laravel, so a local
`VITE_API_BASE_URL` is not needed. If the API is already running separately,
use `npm run dev:frontend` to start only the admin app.
