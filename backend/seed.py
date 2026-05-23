import os
import sys
import json
import random
import datetime

# Setup path so standard backend modules are resolved
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from api.database import SessionLocal, engine, Base
from api.models import PatientModel, InterventionModel, VisitModel
from synthetic.generator import generate_patient, generate_longitudinal_trajectory, Patient

def run_seeder():
    print("=" * 70)
    print("🧬 CHRONOSLAYER: CLINICAL DATABASE COHORT SEEDING SYSTEM 🧪")
    print("=" * 70)

    # Recreate tables to clean state
    print("Re-coupling SQLite schema definitions...")
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # Purge existing data
        print("Purging stale experimental registries...")
        db.query(VisitModel).delete()
        db.query(InterventionModel).delete()
        db.query(PatientModel).delete()
        db.commit()

        # 1. Register Hero Patient Case
        print("Engineering reference Hero Patient (id='hero')...")
        hero = PatientModel(
            id="hero",
            name="Patient 7341",
            chronological_age=52.0,
            sex="Female",
            ethnicity="Caucasian",
            lifestyle_score=7.5
        )
        db.add(hero)
        db.commit()

        # Log Rapamycin starting at Month 6
        print("Logging Rapamycin therapy start at Month 6...")
        rapamycin = InterventionModel(
            patient_id="hero",
            name="Rapamycin 6mg/week",
            start_date="Month 6",
            end_date=None
        )
        db.add(rapamycin)
        db.commit()

        # Seed the 6 visits spanning 18 months of trajectory
        visits_dates = [
            "2024-10-15", "2025-01-15", "2025-04-15", 
            "2025-07-15", "2025-10-15", "2026-04-15"
        ]
        visits_names = ["Month 0", "Month 3", "Month 6", "Month 9", "Month 12", "Month 18"]
        
        print("Generating 18-month trajectory across 6 visits for ID 'hero'...")
        for idx, date in enumerate(visits_dates):
            # Map chronological ages specifically: 52.0, 52.25, 52.50, 52.75, 53.00, 53.50
            if idx == 0: current_chrono = 52.0
            elif idx == 1: current_chrono = 52.25
            elif idx == 2: current_chrono = 52.50
            elif idx == 3: current_chrono = 52.75
            elif idx == 4: current_chrono = 53.50 # Wait, let's use 53.00 for Month 12
            else: current_chrono = 53.50 # Month 18
            if idx == 4: current_chrono = 53.00

            active_programs = []
            if idx >= 2:
                active_programs.append("Rapamycin 6mg/week")

            # Custom hardcoded clocks matching instructions exactly:
            # - Flat DunedinPACE at 1.08
            # - Month 0-6 slowly accelerating: GrimAge +3.1y and PhenoAge +2.8y at Month 6
            # - Month 6-18 drops: GrimAge +3.1y to +0.4y, PhenoAge improves modestly
            dunedin = 1.08
            if idx == 0:
                grim_age = current_chrono + 2.80
                pheno_age = current_chrono + 2.50
                horvath = current_chrono + 1.20
                hannum = current_chrono + 0.90
                zhang = current_chrono + 1.50
                caus = current_chrono + 1.60
            elif idx == 1:
                grim_age = current_chrono + 2.95
                pheno_age = current_chrono + 2.65
                horvath = current_chrono + 1.35
                hannum = current_chrono + 1.05
                zhang = current_chrono + 1.65
                caus = current_chrono + 1.75
            elif idx == 2: # Month 6 (Rapamycin starts)
                grim_age = current_chrono + 3.10
                pheno_age = current_chrono + 2.80
                horvath = current_chrono + 1.50
                hannum = current_chrono + 1.20
                zhang = current_chrono + 1.80
                caus = current_chrono + 1.90
            elif idx == 3:
                grim_age = current_chrono + 2.00
                pheno_age = current_chrono + 2.50
                horvath = current_chrono + 1.40
                hannum = current_chrono + 1.10
                zhang = current_chrono + 1.60
                caus = current_chrono + 1.70
            elif idx == 4:
                grim_age = current_chrono + 1.10
                pheno_age = current_chrono + 2.10
                horvath = current_chrono + 1.20
                hannum = current_chrono + 0.90
                zhang = current_chrono + 1.30
                caus = current_chrono + 1.40
            else: # idx == 5 (Month 18)
                grim_age = current_chrono + 0.40
                pheno_age = current_chrono + 1.60
                horvath = current_chrono + 1.00
                hannum = current_chrono + 0.70
                zhang = current_chrono + 1.10
                caus = current_chrono + 1.10

            clocks = {
                "Horvath": float(round(horvath, 2)),
                "Hannum": float(round(hannum, 2)),
                "PhenoAge": float(round(pheno_age, 2)),
                "GrimAge": float(round(grim_age, 2)),
                "DunedinPACE": float(round(dunedin, 3)),
                "ZhangAge": float(round(zhang, 2)),
                "CausAge": float(round(caus, 2))
            }

            v_model = VisitModel(
                patient_id="hero",
                visit=visits_names[idx],
                date=date,
                chronological_age=current_chrono,
                active_programs=json.dumps(active_programs),
                clocks=json.dumps(clocks)
            )
            db.add(v_model)
        db.commit()

        # 2. Seed 50 supplementary cohort patients
        print("Engraving 50 supplementary cohort patient profiles...")
        for i in range(50):
            c_id = f"CL-{1001 + i}"
            sys_pt = generate_patient(c_id)
            pt_model = PatientModel(
                id=c_id,
                name=f"Patient {c_id}",
                chronological_age=sys_pt.chronological_age,
                sex=sys_pt.sex,
                ethnicity=sys_pt.ethnicity,
                lifestyle_score=sys_pt.lifestyle_score
            )
            db.add(pt_model)
            db.commit()

            # Record interventions
            for iv in sys_pt.interventions:
                inv_db = InterventionModel(
                    patient_id=c_id,
                    name=iv["name"],
                    start_date="Month 6" if random.random() < 0.5 else "Month 0",
                    end_date=None
                )
                db.add(inv_db)
            db.commit()

            # Create standard biological trajectory
            raw_traj = generate_longitudinal_trajectory(sys_pt, n_timepoints=6, span_months=18)
            for idx, tp in enumerate(raw_traj):
                visit_name = f"Month {idx * 3}" if idx > 0 else "Month 0"
                visit_model = VisitModel(
                    patient_id=c_id,
                    visit=visit_name,
                    date=tp["date"],
                    chronological_age=tp["chronological_age"],
                    active_programs=json.dumps(tp["active_interventions"]),
                    clocks=json.dumps(tp["clocks"])
                )
                db.add(visit_model)
            db.commit()

        print("\n" + "-" * 50)
        print("🎉 SUCCESS: DATABASE COHORT PROFILES INSTANTIATED")
        print("-" * 50)
        print(f"• Registered Patients        : {db.query(PatientModel).count()}")
        print(f"• Registered Interventions   : {db.query(InterventionModel).count()}")
        print(f"• Total Logged Clinical Visits: {db.query(VisitModel).count()}")
        print("-" * 50)

    except Exception as e:
        print(f"\n❌ Seeding failed dramatically: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    run_seeder()
