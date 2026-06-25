from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class AnalyzeRequest(BaseModel):
    text: str

@app.get("/")
def root():
    return {"message": "Backend is running"}

@app.post("/api/analyze")
def analyze(request: AnalyzeRequest):
    return {
        "title": "Sample learning win",
        "micro_win": request.text,
        "skills": ["React", "FastAPI"],
        "breakthrough": "The frontend can send text to the backend and receive JSON.",
        "growth_type": "Built",
        "evidence": "The POST request worked.",
        "outcome": "Basic full-stack connection is functional."
    }
