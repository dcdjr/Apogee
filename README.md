# SkillVault

SkillVault captures everyday learning wins, extracts the skills behind them, and turns them into a searchable evidence graph and progress report.

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

The FastAPI backend runs at `http://localhost:8000`. Saved wins remain in `backend/wins.db`, which is ignored by Git.

## Run the frontend

Use Node.js 20.19 or newer. In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the Vite URL shown in the terminal, normally `http://localhost:5173`.
