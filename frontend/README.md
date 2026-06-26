# Apogee Frontend

React, TypeScript, and Vite frontend for Apogee.

Apogee turns everyday learning wins into visible proof of growth.

## What it includes

- Capture a micro-win and extract structured skill evidence
- Save evidence notes to the FastAPI and SQLite backend
- Search and inspect saved notes in the Skill Graph
- Generate a Growth Snapshot with summary, skill signals, evidence, next actions, resume bullets, interview talking points, a sprint plan, and a copyable portfolio blurb
- Persisted light and dark themes

## Run locally

Use Node.js 20.19 or newer.

```bash
npm install
npm run dev
```

The frontend expects the FastAPI backend at `http://<current-host>:8000` and normally runs at `http://localhost:5173`.

## Checks

```bash
npm run lint
npm run build
```
