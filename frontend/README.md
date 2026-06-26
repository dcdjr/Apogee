# SkillVault Frontend

React, TypeScript, and Vite frontend for SkillVault.

SkillVault captures everyday learning wins, extracts the skills behind them, and turns them into a searchable evidence graph and progress report.

## What it includes

- Capture and AI extraction of skill evidence from a micro-win
- Saving evidence notes to the FastAPI and SQLite backend
- Searchable SkillVault explorer and interactive skill graph
- AI-generated Skill Report with a copyable portfolio blurb
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
