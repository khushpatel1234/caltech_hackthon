import os
import random
import datetime
import numpy as np
import pandas as pd
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Any, Optional

@dataclass
class Patient:
    id: str
    chronological_age: float
    sex: str
    ethnicity: str
    lifestyle_score: float  # Scale 0 to 10. 5 is average. Higher is superior.
    interventions: List[Dict[str, Any]] = field(default_factory=list)

def make_correlation_matrix() -> np.ndarray:
    """
    Returns a positive-definite symmetric 7x7 correlation matrix 
    representing key biological relationships between epigenetic ageing systems.
    
    Clock index references:
    0: Horvath (2013)
    1: Hannum (2013)
    2: PhenoAge (2018)
    3: GrimAge (2019)
    4: DunedinPACE (2022)
    5: ZhangAge (2019)
    6: CausAge (2023)
    """
    R = np.array([
        [1.00, 0.75, 0.40, 0.35, 0.20, 0.35, 0.45],  # Horvath
        [0.75, 1.00, 0.45, 0.40, 0.20, 0.35, 0.40],  # Hannum
        [0.40, 0.45, 1.00, 0.65, 0.35, 0.55, 0.40],  # PhenoAge
        [0.35, 0.40, 0.65, 1.00, 0.40, 0.60, 0.45],  # GrimAge
        [0.20, 0.20, 0.35, 0.40, 1.00, 0.30, 0.25],  # DunedinPACE
        [0.35, 0.35, 0.55, 0.60, 0.30, 1.00, 0.40],  # ZhangAge
        [0.45, 0.40, 0.40, 0.45, 0.25, 0.40, 1.00],  # CausAge
    ])
    # Add small diagonal ridge to guarantee strict positive-definiteness
    return R + np.eye(7) * 1e-8


def generate_patient(patient_id: Optional[str] = None) -> Patient:
    """
    Instantiates a representative client profile biased toward demographics 
    commonly seen in premium private longevity clinics.
    """
    if patient_id is None:
        patient_id = f"CL-{random.randint(1001, 9999)}"
        
    # Chronological age distribution: skewed 40-65 years (typical clinical client base)
    # Using a skewed Beta distribution to select values
    chrono_age = float(round(40 + random.betavariate(2.2, 1.8) * 25, 1))
    
    sex = random.choice(["Male", "Female", "Non-binary"])
    ethnicity = random.choice(["Caucasian", "East Asian", "South Asian", "Hispanic", "African American/Black", "Mixed Heritage"])
    
    # Lifestyle index out of 10
    lifestyle_score = float(round(random.triangular(2.0, 9.5, 6.0), 1))
    
    # Randomly assign common clinical longevists style interventions
    interventions = []
    today = datetime.date.today()
    
    # Metformin candidate
    if random.random() < 0.35:
        start_date = today - datetime.timedelta(days=random.randint(90, 360))
        # 80% chance it is active (no end_date)
        end_date = None if random.random() < 0.8 else start_date + datetime.timedelta(days=random.randint(60, 180))
        interventions.append({
            "name": "Metformin (Therapeutic)",
            "start_date": start_date,
            "end_date": end_date
        })
        
    # Rapamycin candidate
    if random.random() < 0.25:
        start_date = today - datetime.timedelta(days=random.randint(60, 240))
        end_date = None if random.random() < 0.85 else start_date + datetime.timedelta(days=90)
        interventions.append({
            "name": "Rapamycin (mTOR target)",
            "start_date": start_date,
            "end_date": end_date
        })

    # TRF/Caloric Restriction Intervention
    if random.random() < 0.40:
        start_date = today - datetime.timedelta(days=random.randint(30, 180))
        interventions.append({
            "name": "Caloric Restriction (15%) & TRF",
            "start_date": start_date,
            "end_date": None
        })

    return Patient(
        id=patient_id,
        chronological_age=chrono_age,
        sex=sex,
        ethnicity=ethnicity,
        lifestyle_score=lifestyle_score,
        interventions=interventions
    )


def generate_clock_panel(patient: Patient, timepoint_date: datetime.date) -> Dict[str, float]:
    """
    Computes a synchronized multiomics aging clock panel. Uses correlated multivariate
    normal sampling representing biological coupling, adjusted for lifestyle and intervention status.
    
    Parameters:
    - patient: Patient dataclass instance
    - timepoint_date: Target query date to evaluate intervention efficacy
    """
    # 1. Evaluate current active clinical interventions
    active_interventions = []
    for iv in patient.interventions:
        start_ok = iv["start_date"] <= timepoint_date
        end_ok = iv["end_date"] is None or iv["end_date"] >= timepoint_date
        if start_ok and end_ok:
            active_interventions.append(iv["name"])
            
    # 2. Compute Clock effect multipliers (reductions are in years or DunedinPACE rate units)
    # Effect sizes mapped from current clinical trials (Levine, lu, Belsky, Mannick)
    effect_sizes = {
        "Horvath": 0.0,
        "Hannum": 0.0,
        "PhenoAge": 0.0,
        "GrimAge": 0.0,
        "DunedinPACE": 0.0,
        "ZhangAge": 0.0,
        "CausAge": 0.0
    }
    
    for item in active_interventions:
        if "Rapamycin" in item:
            effect_sizes["GrimAge"] += 1.2
            effect_sizes["PhenoAge"] += 1.0
            effect_sizes["Horvath"] += 0.5
            effect_sizes["Hannum"] += 0.5
            effect_sizes["DunedinPACE"] += 0.06
            effect_sizes["ZhangAge"] += 1.0
            effect_sizes["CausAge"] += 0.8
        elif "Metformin" in item:
            effect_sizes["PhenoAge"] += 0.8
            effect_sizes["GrimAge"] += 0.7
            effect_sizes["CausAge"] += 0.5
            effect_sizes["DunedinPACE"] += 0.04
        elif "Caloric" in item:
            effect_sizes["DunedinPACE"] += 0.05
            effect_sizes["GrimAge"] += 0.8
            effect_sizes["PhenoAge"] += 0.6
            
    # Lifestyle score scaling (Centered at 5.0)
    lifestyle_delta = patient.lifestyle_score - 5.0
    # Higher lifestyle score slows pace of aging and reduces age delta
    lifestyle_year_reduction = lifestyle_delta * 0.35  # max ~ +1.75 to -1.75 yrs
    lifestyle_pace_reduction = lifestyle_delta * 0.008  # max ~ +0.04 to -0.04 rate
    
    # 3. Covariance compilation
    # Standard deviations of deviation from chronological age (Age Acceleration SD)
    # References for SD: Horvath (4.0), Hannum (4.2), PhenoAge (5.5), GrimAge (5.0), DunedinPACE (0.1), Zhang (5.0), CausAge (3.8)
    sds = np.array([4.0, 4.2, 5.5, 5.0, 0.1, 5.0, 3.8])
    R = make_correlation_matrix()
    cov = np.diag(sds) @ R @ np.diag(sds)
    
    # Mean of variables: age acceleration indexes normally center around 0
    # DunedinPACE Centers around 1.0 (Unit rate)
    means = np.zeros(7)
    means[4] = 1.0 # DunedinPACE center
    
    # Apply baseline lifestyle adjustments
    for i in range(7):
        if i == 4: # DunedinPACE index
            means[i] -= lifestyle_pace_reduction
        else:
            means[i] -= lifestyle_year_reduction
            
    # Apply current clinical pharmaceutical interventions
    means[0] -= effect_sizes["Horvath"]
    means[1] -= effect_sizes["Hannum"]
    means[2] -= effect_sizes["PhenoAge"]
    means[3] -= effect_sizes["GrimAge"]
    means[4] -= effect_sizes["DunedinPACE"]
    means[5] -= effect_sizes["ZhangAge"]
    means[6] -= effect_sizes["CausAge"]
    
    # Sample from multivariate normal
    sampled_accelerations = np.random.multivariate_normal(means, cov)
    
    # 4. Integrate test-retest technical noise modeling
    # Epigenetic clocks have technical deviations when run on identical specimens (test-retest reliability SD)
    # Standard technical reliability SDS: 
    noise_sds = {
        "Horvath": 1.1,
        "Hannum": 1.2,
        "PhenoAge": 1.4,
        "GrimAge": 1.0,
        "DunedinPACE": 0.02,
        "ZhangAge": 1.3,
        "CausAge": 0.7
    }
    
    # Compile absolute clock ages/rates
    ca = patient.chronological_age
    
    # Calculations
    horvath_val = ca + sampled_accelerations[0] + np.random.normal(0, noise_sds["Horvath"])
    hannum_val = ca + sampled_accelerations[1] + np.random.normal(0, noise_sds["Hannum"])
    pheno_val = ca + sampled_accelerations[2] + np.random.normal(0, noise_sds["PhenoAge"])
    grim_val = ca + sampled_accelerations[3] + np.random.normal(0, noise_sds["GrimAge"])
    
    # DunedinPACE rate is strictly constrained > 0 (usually bounded between 0.5 and 1.5)
    pace_val = max(0.4, min(1.6, sampled_accelerations[4] + np.random.normal(0, noise_sds["DunedinPACE"])))
    
    zhang_val = ca + sampled_accelerations[5] + np.random.normal(0, noise_sds["ZhangAge"])
    caus_val = ca + sampled_accelerations[6] + np.random.normal(0, noise_sds["CausAge"])
    
    return {
        "Horvath": float(round(horvath_val, 2)),
        "Hannum": float(round(hannum_val, 2)),
        "PhenoAge": float(round(pheno_val, 2)),
        "GrimAge": float(round(grim_val, 2)),
        "DunedinPACE": float(round(pace_val, 3)),
        "ZhangAge": float(round(zhang_val, 2)),
        "CausAge": float(round(caus_val, 2)),
    }


def generate_cohort(n: int = 50) -> List[Dict[str, Any]]:
    """
    Simulates a cohort of longevity clinic patients, returning active clinical patient profiles
    and their contemporary diagnostic multi-clock scoring profiles.
    """
    today = datetime.date.today()
    cohort_dataset = []
    
    for idx in range(n):
        patient = generate_patient(f"CL-{1000 + idx}")
        clock_data = generate_clock_panel(patient, today)
        
        # Merge patient attributes and diagnostic results into a single dataset
        patient_record = asdict(patient)
        patient_record["interventions"] = [
            {
                "name": iv["name"],
                "start_date": iv["start_date"].isoformat(),
                "end_date": iv["end_date"].isoformat() if iv["end_date"] else None
            }
            for iv in patient_record["interventions"]
        ]
        patient_record["clocks"] = clock_data
        cohort_dataset.append(patient_record)
        
    return cohort_dataset


def generate_longitudinal_trajectory(patient: Patient, n_timepoints: int = 6, span_months: int = 18) -> List[Dict[str, Any]]:
    """
    Compiles chronological record of a single patient's biological markers over duration mapping.
    Ensures correlated increments over time (biological progression) rather than disjoint random profiles.
    """
    today = datetime.date.today()
    start_date = today - datetime.timedelta(days=int(span_months * 30.4))
    
    # Build a stable biological deviation state for the patient (so their clock trajectories remain
    # relatively tracking over time, rather than random noise spikes)
    sds = np.array([4.0, 4.2, 5.5, 5.0, 0.1, 5.0, 3.8])
    R = make_correlation_matrix()
    cov = np.diag(sds) @ R @ np.diag(sds)
    baseline_deviation = np.random.multivariate_normal(np.zeros(7), cov)
    
    # Pre-select noise sds
    noise_sds = {
        "Horvath": 0.4,  # Intratransient noise is lower for the same patient over times
        "Hannum": 0.4,
        "PhenoAge": 0.5,
        "GrimAge": 0.3,
        "DunedinPACE": 0.015,
        "ZhangAge": 0.5,
        "CausAge": 0.3
    }
    
    trajectory_data = []
    intervals_days = int((span_months * 30.4) / (n_timepoints - 1 or 1))
    
    for i in range(n_timepoints):
        offset_days = i * intervals_days
        current_date_val = start_date + datetime.timedelta(days=offset_days)
        chronological_age_t = patient.chronological_age - (span_months / 12) + (offset_days / 365.25)
        
        # Test active therapies on the target date
        active_interventions = []
        for iv in patient.interventions:
            start_ok = iv["start_date"] <= current_date_val
            end_ok = iv["end_date"] is None or iv["end_date"] >= current_date_val
            if start_ok and end_ok:
                active_interventions.append(iv["name"])
                
        # Calculate active therapy response
        effect_sizes = {k: 0.0 for k in ["Horvath", "Hannum", "PhenoAge", "GrimAge", "DunedinPACE", "ZhangAge", "CausAge"]}
        for item in active_interventions:
            if "Rapamycin" in item:
                effect_sizes["GrimAge"] += 1.2
                effect_sizes["PhenoAge"] += 1.0
                effect_sizes["Horvath"] += 0.5
                effect_sizes["Hannum"] += 0.5
                effect_sizes["DunedinPACE"] += 0.06
                effect_sizes["ZhangAge"] += 1.0
                effect_sizes["CausAge"] += 0.8
            elif "Metformin" in item:
                effect_sizes["PhenoAge"] += 0.8
                effect_sizes["GrimAge"] += 0.7
                effect_sizes["CausAge"] += 0.5
                effect_sizes["DunedinPACE"] += 0.04
            elif "Caloric" in item:
                effect_sizes["DunedinPACE"] += 0.05
                effect_sizes["GrimAge"] += 0.8
                effect_sizes["PhenoAge"] += 0.6
                
        # Lifestyle scoring centers on 5.0
        lifestyle_delta = patient.lifestyle_score - 5.0
        lifestyle_year_reduction = lifestyle_delta * 0.35
        lifestyle_pace_reduction = lifestyle_delta * 0.008
        
        # Combine parameters
        horvath_val = chronological_age_t + (baseline_deviation[0] - lifestyle_year_reduction - effect_sizes["Horvath"]) + np.random.normal(0, noise_sds["Horvath"])
        hannum_val = chronological_age_t + (baseline_deviation[1] - lifestyle_year_reduction - effect_sizes["Hannum"]) + np.random.normal(0, noise_sds["Hannum"])
        pheno_val = chronological_age_t + (baseline_deviation[2] - lifestyle_year_reduction - effect_sizes["PhenoAge"]) + np.random.normal(0, noise_sds["PhenoAge"])
        grim_val = chronological_age_t + (baseline_deviation[3] - lifestyle_year_reduction - effect_sizes["GrimAge"]) + np.random.normal(0, noise_sds["GrimAge"])
        
        base_pace_accel = baseline_deviation[4] + 1.0 - lifestyle_pace_reduction - effect_sizes["DunedinPACE"]
        pace_val = max(0.4, min(1.6, base_pace_accel + np.random.normal(0, noise_sds["DunedinPACE"])))
        
        zhang_val = chronological_age_t + (baseline_deviation[5] - lifestyle_year_reduction - effect_sizes["ZhangAge"]) + np.random.normal(0, noise_sds["ZhangAge"])
        caus_val = chronological_age_t + (baseline_deviation[6] - lifestyle_year_reduction - effect_sizes["CausAge"]) + np.random.normal(0, noise_sds["CausAge"])
        
        trajectory_data.append({
            "date": current_date_val.isoformat(),
            "chronological_age": float(round(chronological_age_t, 2)),
            "active_interventions": active_interventions,
            "clocks": {
                "Horvath": float(round(horvath_val, 2)),
                "Hannum": float(round(hannum_val, 2)),
                "PhenoAge": float(round(pheno_val, 2)),
                "GrimAge": float(round(grim_val, 2)),
                "DunedinPACE": float(round(pace_val, 3)),
                "ZhangAge": float(round(zhang_val, 2)),
                "CausAge": float(round(caus_val, 2)),
            }
        })
        
    return trajectory_data


if __name__ == "__main__":
    print("=" * 70)
    print("🧪 CHRONOSLAYER: SYNTHETIC BIOLOGICAL CLOCK COHORT VALIDATOR 🧬")
    print("=" * 70)
    
    # Generate an verification sample
    n_sample = 100
    print(f"Generating synthetic verification cohort (N = {n_sample})...")
    cohort = generate_cohort(n_sample)
    
    # Parse results to estimate statistics
    parsed_rows = []
    for patient in cohort:
        r = {
            "Age": patient["chronological_age"],
            "Horvath": patient["clocks"]["Horvath"],
            "Hannum": patient["clocks"]["Hannum"],
            "PhenoAge": patient["clocks"]["PhenoAge"],
            "GrimAge": patient["clocks"]["GrimAge"],
            "DunedinPACE": patient["clocks"]["DunedinPACE"],
            "ZhangAge": patient["clocks"]["ZhangAge"],
            "CausAge": patient["clocks"]["CausAge"]
        }
        # Compute age accelerations
        r["Accel_Horvath"] = r["Horvath"] - r["Age"]
        r["Accel_Hannum"] = r["Hannum"] - r["Age"]
        r["Accel_PhenoAge"] = r["PhenoAge"] - r["Age"]
        r["Accel_GrimAge"] = r["GrimAge"] - r["Age"]
        r["Accel_ZhangAge"] = r["ZhangAge"] - r["Age"]
        r["Accel_CausAge"] = r["CausAge"] - r["Age"]
        parsed_rows.append(r)
        
    df = pd.DataFrame(parsed_rows)
    
    print("\n" + "-" * 50)
    print("📋 COHORT SUMMARY STATISTICS")
    print("-" * 50)
    print(f"Chronological Age Mean : {df['Age'].mean():.2f} years (S.D.: {df['Age'].std():.2f})")
    print(f"DunedinPACE Rate Mean  : {df['DunedinPACE'].mean():.3f} (S.D.: {df['DunedinPACE'].std():.3f})")
    print("-" * 50)
    
    accel_cols = ["Accel_Horvath", "Accel_Hannum", "Accel_PhenoAge", "Accel_GrimAge", "Accel_ZhangAge", "Accel_CausAge"]
    print("\n🗺️ AGE ACCELERATION MEANS & S.D.s (Years deviation from Chronological Age)")
    print("-" * 50)
    for col in accel_cols:
        col_name = col.replace("Accel_", "")
        print(f"• {col_name:<11} Clock | Mean Acceleration: {df[col].mean():+.2f} yr | S.D.: {df[col].std():.2f} yr")
    
    # Calculate correlation matrix of age accelerations & DunedinPACE
    corr_cols = accel_cols + ["DunedinPACE"]
    corr_matrix = df[corr_cols].corr()
    
    # Clean column headers for display matrix
    clean_labels = [c.replace("Accel_", "") for c in corr_cols]
    corr_matrix.columns = clean_labels
    corr_matrix.index = clean_labels
    
    print("\n" + "-" * 70)
    print("🔄 EMPIRICAL CORRELATION MATRIX (Epigenetic Acceleration & Pace indicators)")
    print("-" * 70)
    print(corr_matrix.round(3))
    print("=" * 70)
    
    # Show example longitudinal tracking
    print("\n🧬 SAMPLE CLIENT PROGRESS TRAJECTORY (18 Months, 6 visits)")
    sample_pt = generate_patient()
    sample_pt.patient_name = "Marcus Aurelius"
    sample_pt.lifestyle_score = 8.5
    # Force single Rapamycin clinical program starting in month 3
    sample_pt.interventions = [{
        "name": "Rapamycin (mTOR target)",
        "start_date": datetime.date.today() - datetime.timedelta(days=200),
        "end_date": None
    }]
    
    traj = generate_longitudinal_trajectory(sample_pt, n_timepoints=6, span_months=18)
    for t_idx, visit in enumerate(traj):
        int_str = ", ".join(visit["active_interventions"]) if visit["active_interventions"] else "None"
        print(f"Visit {t_idx+1}: Ref Date: {visit['date']} | Chrono Age: {visit['chronological_age']:.1f} | GrimAge: {visit['clocks']['GrimAge']:.1f} | DunedinPACE: {visit['clocks']['DunedinPACE']:.3f} | Therapy: {int_str}")
    print("=" * 70)
