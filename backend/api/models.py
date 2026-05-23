from sqlalchemy import Column, String, Float, Integer, ForeignKey, DateTime
from sqlalchemy.orm import relationship
import datetime
from api.database import Base

class PatientModel(Base):
    __tablename__ = "patients"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    chronological_age = Column(Float, nullable=False)
    sex = Column(String, nullable=False)
    ethnicity = Column(String, nullable=False)
    lifestyle_score = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    interventions = relationship("InterventionModel", back_populates="patient", cascade="all, delete-orphan")
    visits = relationship("VisitModel", back_populates="patient", cascade="all, delete-orphan")

class InterventionModel(Base):
    __tablename__ = "interventions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    patient_id = Column(String, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    start_date = Column(String, nullable=False) # e.g. "2026-01-01" or Month offset
    end_date = Column(String, nullable=True)

    patient = relationship("PatientModel", back_populates="interventions")

class VisitModel(Base):
    __tablename__ = "visits"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    patient_id = Column(String, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    visit = Column(String, nullable=False) # e.g. "Month 0", "Month 6"
    date = Column(String, nullable=True) # e.g. "2026-01-01"
    chronological_age = Column(Float, nullable=False)
    active_programs = Column(String, nullable=False) # JSON list eg '["Rapamycin (mTOR target)"]'
    clocks = Column(String, nullable=False) # JSON dict mapping and scoring values

    patient = relationship("PatientModel", back_populates="visits")
