import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import types
from pydantic import BaseModel, Field
from dotenv import load_dotenv

GEMINI_MODEL = "gemini-2.5-flash"
DATABASE_PATH = Path(__file__).with_name("wins.db")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://172.21.29.247:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalyzeRequest(BaseModel):
    text: str = Field(min_length=1)


class AnalyzeResponse(BaseModel):
    micro_win_title: str = Field(description="A short, encouraging title for the achievement.")
    short_summary: str = Field(description="A concise one- or two-sentence summary of the achievement.")
    skills_learned: list[str] = Field(description="Two to four specific skills demonstrated or learned.")
    next_step: str = Field(description="One small, practical next step for continued growth.")


class SaveWinRequest(BaseModel):
    raw_text: str = Field(min_length=1)
    analysis: AnalyzeResponse


class SavedWin(AnalyzeResponse):
    id: int
    raw_text: str
    created_at: str


class SkillReport(BaseModel):
    headline: str = Field(description="A concise headline that captures the student's growth.")
    progress_summary: str = Field(description="A clear summary of learning and progress over time.")
    top_skills: list[str] = Field(description="The most recurring or meaningful demonstrated skills.")
    evidence: list[str] = Field(description="Specific evidence drawn only from the saved wins.")
    recommended_next_steps: list[str] = Field(description="Practical next steps based on the saved wins.")
    portfolio_blurb: str = Field(
        description="A concise professional blurb suitable for a resume, LinkedIn, or personal website."
    )


def get_database() -> sqlite3.Connection:
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def initialize_database() -> None:
    with get_database() as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS wins (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                raw_text TEXT NOT NULL,
                micro_win_title TEXT NOT NULL,
                short_summary TEXT NOT NULL,
                skills_learned TEXT NOT NULL,
                next_step TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )


def row_to_saved_win(row: sqlite3.Row) -> SavedWin:
    return SavedWin(
        id=row["id"],
        raw_text=row["raw_text"],
        micro_win_title=row["micro_win_title"],
        short_summary=row["short_summary"],
        skills_learned=json.loads(row["skills_learned"]),
        next_step=row["next_step"],
        created_at=row["created_at"],
    )


def get_gemini_client() -> genai.Client:
    load_dotenv()
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError(
            "GEMINI_API_KEY is not set. Set it in your environment before starting the backend."
        )

    return genai.Client(api_key=api_key)


def analyze_micro_win(text: str) -> AnalyzeResponse:
    """Ask Gemini to turn a student's micro-win into structured analysis."""
    client = get_gemini_client()
    prompt = f"""
You are a supportive college learning coach.
Analyze the student's micro-win without inventing details.
Keep the title brief, the summary concise, the skills specific, and the next step achievable.

Student's micro-win:
{text.strip()}
"""

    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            temperature=0.1,
            response_mime_type="application/json",
            response_schema=AnalyzeResponse,
        ),
    )

    if not response.text:
        raise ValueError("Gemini returned an empty response.")

    return AnalyzeResponse.model_validate_json(response.text)


def generate_skill_report(wins: list[SavedWin]) -> SkillReport:
    """Ask Gemini to synthesize saved wins into a structured progress report."""
    client = get_gemini_client()
    saved_wins = [
        win.model_dump(
            include={
                "raw_text",
                "micro_win_title",
                "short_summary",
                "skills_learned",
                "next_step",
                "created_at",
            }
        )
        for win in wins
    ]
    prompt = f"""
You are a college learning coach creating a skill report from a student's saved learning wins.

Rules:
- Do not invent accomplishments, outcomes, projects, or experience.
- Base every statement only on evidence in the saved wins below.
- Identify recurring skills, themes, and patterns across the wins.
- Write in a clear student and professional-development tone.
- Make each evidence item specific and grounded in the saved wins.
- Make recommended next steps practical and connected to the observed growth.
- Make portfolio_blurb concise enough to paste into a resume, LinkedIn, or personal website.

Saved wins (most recent first):
{json.dumps(saved_wins, indent=2)}
"""

    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            temperature=0.1,
            response_mime_type="application/json",
            response_schema=SkillReport,
        ),
    )

    if not response.text:
        raise ValueError("Gemini returned an empty response.")

    return SkillReport.model_validate_json(response.text)


initialize_database()


@app.get("/")
def root():
    return {"message": "Backend is running"}


@app.post("/api/analyze", response_model=AnalyzeResponse)
def analyze(request: AnalyzeRequest) -> AnalyzeResponse:
    try:
        return analyze_micro_win(request.text)
    except Exception as error:
        raise HTTPException(status_code=502, detail=f"Gemini analysis failed: {error}") from error


@app.post("/api/wins", response_model=SavedWin, status_code=201)
def save_win(request: SaveWinRequest) -> SavedWin:
    created_at = datetime.now(timezone.utc).isoformat()
    analysis = request.analysis

    with get_database() as connection:
        cursor = connection.execute(
            """
            INSERT INTO wins (
                raw_text,
                micro_win_title,
                short_summary,
                skills_learned,
                next_step,
                created_at
            ) VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                request.raw_text.strip(),
                analysis.micro_win_title,
                analysis.short_summary,
                json.dumps(analysis.skills_learned),
                analysis.next_step,
                created_at,
            ),
        )
        row = connection.execute(
            "SELECT * FROM wins WHERE id = ?", (cursor.lastrowid,)
        ).fetchone()

    if row is None:
        raise HTTPException(status_code=500, detail="Saved win could not be retrieved.")

    return row_to_saved_win(row)


@app.get("/api/wins", response_model=list[SavedWin])
def get_wins() -> list[SavedWin]:
    with get_database() as connection:
        rows = connection.execute(
            "SELECT * FROM wins ORDER BY created_at DESC, id DESC"
        ).fetchall()

    return [row_to_saved_win(row) for row in rows]


@app.get("/api/report", response_model=SkillReport)
def get_report(limit: int = Query(default=10, ge=1, le=50)) -> SkillReport:
    with get_database() as connection:
        rows = connection.execute(
            "SELECT * FROM wins ORDER BY created_at DESC, id DESC LIMIT ?",
            (limit,),
        ).fetchall()

    if not rows:
        raise HTTPException(
            status_code=400,
            detail="A skill report cannot be generated without saved wins.",
        )

    try:
        return generate_skill_report([row_to_saved_win(row) for row in rows])
    except Exception as error:
        raise HTTPException(
            status_code=502,
            detail=f"Gemini report generation failed: {error}",
        ) from error
