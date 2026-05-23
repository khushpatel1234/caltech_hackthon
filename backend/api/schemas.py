from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
import datetime

class InterventionBase(BaseModel):
    name: str
    start_date: str
    end_date: Optional[str] = None

class InterventionCreate(InterventionBase):
    pass

class InterventionResponse(InterventionBase):
    id: int
    patient_id: str

    class Config:
        from_attributes = True

class ClockVal(BaseModel):
    value: float
    acceleration: float
    sd: float
    z_score: float
    percentile: float

class ClockPanelResponse(BaseModel):
    clocks: Dict[str, Any]
    chronological_age: float
    consensus_age: float
    consensus_ci: List[float]
    acceleration: float
    disagreement_score: float
    anomaly: Optional[Dict[str, Any]] = None

class VisitResponse(BaseModel):
    id: int
    patient_id: str
    visit: str
    date: Optional[str] = None
    chronological_age: float
    active_programs: List[str]
    clocks: Dict[str, Any]

    class Config:
        from_attributes = True

class PatientBase(BaseModel):
    name: str
    chronological_age: float
    sex: str
    ethnicity: str
    lifestyle_score: float

class PatientCreate(BaseModel):
    id: Optional[str] = None
    name: Optional[str] = None
    chronological_age: Optional[float] = None
    sex: Optional[str] = None
    ethnicity: Optional[str] = None
    lifestyle_score: Optional[float] = None

class PatientResponse(PatientBase):
    id: str
    created_at: datetime.datetime
    interventions: List[InterventionResponse] = []
    visits: List[VisitResponse] = []

    class Config:
        from_attributes = True

# Combined details schema
class PatientDetailResponse(BaseModel):
    patient: PatientResponse
    clocks_panel: Optional[Dict[str, Any]] = None
    ai_interpretation: Optional[Dict[str, Any]] = None

class FollowupRequest(BaseModel):
    question: str

class FollowupResponse(BaseModel):
    answer: str
    suggested_actions: List[str]

# Cohort level responses
class CohortPatientListItem(BaseModel):
    id: str
    name: str
    chronological_age: float
    sex: str
    ethnicity: str
    lifestyle_score: float
    latest_consensus_age: Optional[float] = None
    latest_acceleration: Optional[float] = None
    latest_dunedin_pace: Optional[float] = None
    active_programs_count: int

class CohortSummaryStats(BaseModel):
    total_patients: int
    mean_chronological_age: float
    mean_biological_age: float
    mean_age_acceleration: float
    mean_dunedin_pace: float
    active_interventions_count: Dict[str, int]

class CohortResponse(BaseModel):
    cohort: List[CohortPatientListItem]
    summary_stats: CohortSummaryStats
