# Apogee

## Built for Fidelity's FidHacks 2026

Apogee turns everyday learning wins into visible proof of growth.

## Core flow

Capture → Extract evidence → Save → Skill Graph → Growth Snapshot

Students write a micro-win, Gemini extracts structured skill evidence, and Apogee saves it as an evidence note in SQLite. Saved notes appear in the Skill Graph, where skills become connected signals of growth. The Growth Snapshot turns the saved evidence into a practical career artifact for reflection, resume drafting, interview preparation, portfolio writing, and planning what to learn next.

## Tech stack

- React, TypeScript, and Vite frontend
- FastAPI backend
- SQLite for saved evidence notes
- Gemini for skill evidence extraction and grounded growth snapshots

## Run the backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
export GEMINI_API_KEY="your-gemini-api-key"
python -m uvicorn main:app --reload
```

On PowerShell:

```powershell
$env:GEMINI_API_KEY="your-gemini-api-key"
```

The FastAPI backend runs at `http://localhost:8000`. Saved evidence notes remain in `backend/wins.db`, which is ignored by Git.

## Run the frontend

Use Node.js 20.19 or newer. In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the Vite URL shown in the terminal, normally `http://localhost:5173`.

## Checks

```bash
cd frontend
npm run lint
npm run build
```
