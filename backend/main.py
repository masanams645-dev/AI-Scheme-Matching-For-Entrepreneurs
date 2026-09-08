from pathlib import Path
import json
import sqlite3
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

BASE = Path(__file__).resolve().parent.parent
DB = BASE / "database" / "scheme_matcher.db"
DATA = BASE / "data" / "schemes.json"
FRONTEND = BASE / "frontend"

app = FastAPI(title="AI Scheme Matcher", version="1.0")
app.mount("/static", StaticFiles(directory=FRONTEND), name="static")

class UserProfile(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    state: str
    category: str
    age: int = Field(ge=18, le=100)
    annual_income: float = Field(ge=0)
    business_type: str
    business_stage: str
    loan_amount: float = Field(ge=0)
    disability: bool = False
    women_entrepreneur: bool = False
    rural: bool = False

class Feedback(BaseModel):
    scheme_id: str
    rating: int = Field(ge=1, le=5)
    comment: str = ""

def load_schemes():
    return json.loads(DATA.read_text(encoding="utf-8"))

def init_db():
    DB.parent.mkdir(exist_ok=True)
    con = sqlite3.connect(DB)
    con.execute("""CREATE TABLE IF NOT EXISTS searches(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT, state TEXT, category TEXT,
        business_type TEXT, annual_income REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP)""")
    con.execute("""CREATE TABLE IF NOT EXISTS feedback(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        scheme_id TEXT, rating INTEGER, comment TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP)""")
    con.commit()
    con.close()

def save_search(p):
    con = sqlite3.connect(DB)
    con.execute(
        "INSERT INTO searches(name,state,category,business_type,annual_income) VALUES(?,?,?,?,?)",
        (p.name, p.state, p.category, p.business_type, p.annual_income))
    con.commit()
    con.close()

def match_scheme(p, s):
    score = 0
    reasons, warnings = [], []

    if "All" in s["states"] or p.state in s["states"]:
        score += 15
        reasons.append("State matches")
    else:
        warnings.append("State does not match")

    if "All" in s["categories"] or p.category in s["categories"]:
        score += 20
        reasons.append("Category matches")
    else:
        warnings.append("Category does not match")

    if p.annual_income <= s["max_income"]:
        score += 20
        reasons.append("Income is within the limit")
    else:
        warnings.append("Income is above the sample limit")

    if "All" in s["business_types"] or p.business_type in s["business_types"]:
        score += 15
        reasons.append("Business type is supported")
    else:
        warnings.append("Business type is not listed")

    if "All" in s["business_stages"] or p.business_stage in s["business_stages"]:
        score += 10
        reasons.append("Business stage matches")
    else:
        warnings.append("Business stage may not qualify")

    if p.loan_amount <= s["max_support"]:
        score += 10
        reasons.append("Funding requirement is within the limit")
    else:
        warnings.append("Funding requirement is above the limit")

    special_required = s.get("women_only") or s.get("disability_support") or s.get("rural_focus")
    special_match = (
        (s.get("women_only") and p.women_entrepreneur) or
        (s.get("disability_support") and p.disability) or
        (s.get("rural_focus") and p.rural) or
        (not special_required)
    )
    if special_match:
        score += 10
        reasons.append("Special eligibility factor matches")
    elif s.get("women_only"):
        warnings.append("Women entrepreneur condition needs to be met")
    elif s.get("disability_support"):
        warnings.append("Disability-support condition needs to be met")
    elif s.get("rural_focus"):
        warnings.append("Rural-business condition needs to be met")

    return {
        "id": s["id"],
        "name": s["name"],
        "description": s["description"],
        "purpose": s["purpose"],
        "max_support": s["max_support"],
        "official_url": s["official_url"],
        "score": score,
        "match_percentage": score,
        "confidence": min(99, 55 + round(score * 0.44)),
        "eligible": not warnings,
        "reasons": reasons,
        "warnings": warnings,
        "documents": s["documents"],
        "next_steps": s["next_steps"]
    }

@app.get("/")
def home():
    return FileResponse(FRONTEND / "index.html")

@app.get("/api/schemes")
def schemes():
    return load_schemes()

@app.post("/api/match")
def match(p: UserProfile):
    save_search(p)
    results = sorted([match_scheme(p, s) for s in load_schemes()],
                     key=lambda x: x["score"], reverse=True)
    return {"profile": p.model_dump(), "total_schemes_checked": len(results), "results": results}

@app.post("/api/feedback")
def feedback(f: Feedback):
    con = sqlite3.connect(DB)
    con.execute("INSERT INTO feedback(scheme_id,rating,comment) VALUES(?,?,?)",
                (f.scheme_id, f.rating, f.comment))
    con.commit()
    con.close()
    return {"message": "Feedback saved"}

@app.get("/api/stats")
def stats():
    con = sqlite3.connect(DB)
    searches = con.execute("SELECT COUNT(*) FROM searches").fetchone()[0]
    feedback = con.execute("SELECT COUNT(*) FROM feedback").fetchone()[0]
    con.close()
    return {"searches": searches, "feedback": feedback, "schemes": len(load_schemes())}

init_db()
