import os
import json
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
import datetime
from typing import Any, List

# Custom bioinformatic analytical systems
from synthetic.generator import Patient
from clocks.panel import ClockPanel
from clocks.disagreement import flag_disagreement
from clocks.longitudinal import analyze_longitudinal_trajectory
from ai.interpreter import ClinicalInterpreter
from typing import Any, List, Dict, Optional

# Core API routes & database model associations
from api.routes import router as api_router
from api.database import engine as api_engine, Base as api_base

interpreter_service = ClinicalInterpreter()

# FastAPI boundaries
app = FastAPI(
    title="ChronosLayer Longevity API",
    description="Engine for Biological Age Assessment & Biomarker Tracking",
    version="1.0.0"
)

# Enable CORS for frontend flexibility including localhost:3000
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register new core API routes
app.include_router(api_router)

# Initialize relational cohort model tables
api_base.metadata.create_all(bind=api_engine)


# Database Setup (SQLite local persistence)
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./chronos_longevity.db")
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False} if "sqlite" in SQLALCHEMY_DATABASE_URL else {}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# SQLAlchemy Models
class PatientBiomarkers(Base):
    __tablename__ = "patient_biomarkers"

    id = Column(Integer, primary_key=True, index=True)
    patient_name = Column(String, index=True)
    chronological_age = Column(Float)
    biological_age = Column(Float)
    g_methylation_score = Column(Float, nullable=True) # Epigenetic index
    vo2_max = Column(Float, nullable=True)             # Cardiovascular performance
    hs_crp = Column(Float, nullable=True)              # Chronic inflammation marker (mg/L)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

# Instantiate Database Tables
Base.metadata.create_all(bind=engine)

# Dependency to yield database sessions
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Pydantic Schemas for Validation
class BiomarkerCreate(BaseModel):
    patient_name: str
    chronological_age: float
    biological_age: float
    g_methylation_score: float | None = None
    vo2_max: float | None = None
    hs_crp: float | None = None

class BiomarkerResponse(BiomarkerCreate):
    id: int
    created_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)

# Endpoints
@app.get("/health")
def health_check():
    """Health check endpoint requested by ChronosLayer requirements."""
    return {"status": "ok", "app": "ChronosLayer FastAPI", "timestamp": datetime.datetime.utcnow().isoformat()}

@app.post("/api/biomarkers", response_model=BiomarkerResponse, status_code=201)
def record_biomarkers(data: BiomarkerCreate, db: Session = Depends(get_db)):
    """Records new longevity clinic biomarkers and saves them to SQLAlchemy SQLite."""
    db_record = PatientBiomarkers(
        patient_name=data.patient_name,
        chronological_age=data.chronological_age,
        biological_age=data.biological_age,
        g_methylation_score=data.g_methylation_score,
        vo2_max=data.vo2_max,
        hs_crp=data.hs_crp
    )
    db.add(db_record)
    db.commit()
    db.refresh(db_record)
    return db_record

@app.get("/api/biomarkers", response_model=list[BiomarkerResponse])
def get_biomarkers(limit: int = 10, db: Session = Depends(get_db)):
    """Fetches recently submitted patient biological age measurements."""
    return db.query(PatientBiomarkers).order_by(PatientBiomarkers.id.desc()).limit(limit).all()


# ==========================================
# BIOLOGICAL CLOCKS & ETHICAL EVIDENCE API LAYER
# ==========================================

class PatientAnalyzeRequest(BaseModel):
    id: str | None = None
    chronological_age: float
    sex: str
    ethnicity: str
    lifestyle_score: float
    interventions: List[Dict[str, Any]] | None = None

class LongitudinalTimepointInput(BaseModel):
    visit: str
    chronoAge: float | None = None
    chronological_age: float | None = None
    activePrograms: List[str] | None = None
    active_programs: List[str] | None = None
    clocks: Dict[str, Any]

class LongitudinalRequest(BaseModel):
    timepoints: List[LongitudinalTimepointInput]


@app.get("/api/clocks/evidence")
def get_longevity_evidence():
    """Reads the certified evidence base containing 40 longevity intervention studies."""
    file_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "evidence_base.json")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Evidence base JSON file not found in system.")
    try:
        with open(file_path, "r") as f:
            data = json.load(f)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load evidence base: {str(e)}")


@app.post("/api/clocks/analyze")
def analyze_patient_clocks(payload: PatientAnalyzeRequest):
    """
    Fits and extracts biological ages across 7 distinct clocks,
    runs IsolationForest anomaly checks, and evaluates composite consensus ratings.
    """
    try:
        # Translate to exact Dataclass structure
        patient_record = Patient(
            id=payload.id or "ANALYSIS-PT",
            chronological_age=payload.chronological_age,
            sex=payload.sex,
            ethnicity=payload.ethnicity,
            lifestyle_score=payload.lifestyle_score,
            interventions=payload.interventions or []
        )
        
        # Analyze using ClockPanel
        panel_model = ClockPanel()
        report = panel_model.analyze(patient_record, datetime.date.today())
        
        # Flag and compute discordance anomalies
        anomaly_report = flag_disagreement(report)
        report["anomaly"] = anomaly_report
        
        return report
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Diagnostic analysis execution failed: {str(e)}")


@app.post("/api/clocks/longitudinal")
def analyze_cohort_longitudinal(payload: LongitudinalRequest):
    """
    Computes per-clock linear slopes, estimates latent true biological age
    under Bayesian inverse-variance paradigms, and detects ruptures changepoints dynamically.
    """
    try:
        # Convert Pydantic request to dictionary list representation
        raw_list = []
        for tp in payload.timepoints:
            # Reconstruct dictionary matching longitudinal structure
            raw_list.append({
                "visit": tp.visit,
                "chronoAge": tp.chronoAge if tp.chronoAge is not None else tp.chronological_age,
                "activePrograms": tp.activePrograms if tp.activePrograms is not None else tp.active_programs or [],
                "clocks": tp.clocks
            })
            
        results = analyze_longitudinal_trajectory(raw_list)
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Longitudinal trajectory computations failed: {str(e)}")


def load_evidence_base_internal() -> List[Dict[str, Any]]:
    file_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "evidence_base.json")
    if not os.path.exists(file_path):
        return []
    try:
        with open(file_path, "r") as f:
            return json.load(f)
    except Exception:
        return []


class ClinicalInterpretRequest(BaseModel):
    patient: Dict[str, Any]
    panel: Dict[str, Any]
    trajectory: Optional[Any] = None


class ClinicalFollowupRequest(BaseModel):
    patient: Dict[str, Any]
    panel: Dict[str, Any]
    question: str


@app.post("/api/clinical/interpret")
def interpret_clinical_case(payload: ClinicalInterpretRequest):
    """Uses AI ClinicalInterpreter to analyze demographics, multi-clock panel, trajectories and evidence base."""
    try:
        evidence_base = load_evidence_base_internal()
        res = interpreter_service.interpret(
            patient=payload.patient,
            panel=payload.panel,
            trajectory=payload.trajectory,
            evidence_base=evidence_base
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Interpretation failed: {str(e)}")


@app.post("/api/clinical/followup")
def followup_clinical_question(payload: ClinicalFollowupRequest):
    """Handles arbitrary follow-up questions from clinicians regarding a concrete patient profile."""
    try:
        res = interpreter_service.ask_followup(
            patient=payload.patient,
            panel=payload.panel,
            question=payload.question
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Follow-up execution failed: {str(e)}")

