import sys
import os
import datetime
import numpy as np
from typing import Dict, Any, List
from sklearn.ensemble import IsolationForest

# Ensure relative pathways work perfectly
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from synthetic.generator import Patient, generate_clock_panel

# Lazy/one-time initialized global model and reference training scores to support standard determinism
_MODEL_CACHE: Dict[str, Any] = {}

def get_trained_detector(seed: int = 42) -> tuple:
    """
    Returns (fitted_isolation_forest, reference_training_scores) deterministically.
    Caches the results to prevent repeated fitting on high-volume requests.
    """
    cache_key = f"forest_seed_{seed}"
    if cache_key in _MODEL_CACHE:
        return _MODEL_CACHE[cache_key]

    # Deterministic simulation of a standard clinical control reference cohort
    np.random.seed(seed)
    n_samples = 1000
    training_vectors = []

    # Demographics and boundaries modeled around clinical reference values
    for i in range(n_samples):
        age = float(np.random.uniform(40.0, 65.0))
        lifestyle = float(np.random.uniform(4.0, 7.5))  # representative control subset
        sex = "Male" if i % 2 == 0 else "Female"
        ethnicity = np.random.choice(["Caucasian", "East Asian", "South Asian", "Hispanic"])
        
        patient = Patient(
            id=f"CTRL-{i:04d}",
            chronological_age=age,
            sex=sex,
            ethnicity=ethnicity,
            lifestyle_score=lifestyle,
            interventions=[]  # pure unmanipulated baseline state
        )
        
        # Draw a synthetic panel
        # We temporarily supply generate_clock_panel which also relies on internal np.random
        clocks = generate_clock_panel(patient, datetime.date.today())
        
        # Features: deviation vectors of epigenetic age from matching chronological age
        features = [
            clocks["Horvath"] - age,
            clocks["Hannum"] - age,
            clocks["PhenoAge"] - age,
            clocks["GrimAge"] - age,
            clocks["DunedinPACE"] - 1.0,
            clocks["ZhangAge"] - age,
            clocks["CausAge"] - age
        ]
        training_vectors.append(features)

    X = np.array(training_vectors)
    forest = IsolationForest(
        n_estimators=100, 
        max_samples="auto", 
        contamination=0.1, 
        random_state=seed
    )
    forest.fit(X)

    # decision_function gives score: lower is more anomalous (outlier)
    scores = forest.decision_function(X)
    
    _MODEL_CACHE[cache_key] = (forest, scores)
    return forest, scores


def flag_disagreement(panel: Dict[str, Any], seed: int = 42) -> Dict[str, Any]:
    """
    Compares the given patient panel against 1000 reference standards using IsolationForest,
    returning the anomaly percentile rank and any high-magnitude alarm text if below the 10th percentile.
    """
    # 1. Retrieve the fitted models
    forest, reference_scores = get_trained_detector(seed)

    # 2. Extract clocks & patient chronological age details
    chrono_age = 50.0
    clock_values = {}

    if "clocks" in panel and "chronological_age" in panel:
        chrono_age = panel["chronological_age"]
        clocks_dict = panel["clocks"]
        for key, item in clocks_dict.items():
            if isinstance(item, dict) and "value" in item:
                clock_values[key] = item["value"]
            else:
                clock_values[key] = float(item)
    else:
        # Support fallback flat structure if passed directly
        chrono_age = panel.get("chronological_age", 50.0)
        for key in ["Horvath", "Hannum", "PhenoAge", "GrimAge", "DunedinPACE", "ZhangAge", "CausAge"]:
            if key in panel:
                item = panel[key]
                if isinstance(item, dict) and "value" in item:
                    clock_values[key] = item["value"]
                else:
                    clock_values[key] = float(item)
            else:
                # Default mock alignment if missing
                clock_values[key] = 1.0 if key == "DunedinPACE" else chrono_age

    # Create target testing vector
    test_vector = np.array([[
        clock_values.get("Horvath", chrono_age) - chrono_age,
        clock_values.get("Hannum", chrono_age) - chrono_age,
        clock_values.get("PhenoAge", chrono_age) - chrono_age,
        clock_values.get("GrimAge", chrono_age) - chrono_age,
        clock_values.get("DunedinPACE", 1.0) - 1.0,
        clock_values.get("ZhangAge", chrono_age) - chrono_age,
        clock_values.get("CausAge", chrono_age) - chrono_age
    ]])

    # Score current vector
    current_score = float(forest.decision_function(test_vector)[0])

    # Compute empirical percentile relative to controls distribution (where lower score is more anomalous)
    # i.e., what % of reference normal controls are MORE anomalous than current subject
    percentile = float(np.sum(reference_scores <= current_score) / len(reference_scores) * 100.0)

    alert_text = None
    if percentile < 10.0:
        alert_text = (
            f"Warning: Clinically significant multi-clock epigenomic discordance detected. "
            f"Acceleration profile scored in the {percentile:.1f}th percentile of expected "
            f"joint biological patterns. This extreme divergence suggests organ-specific "
            f"aging outliers, exceptional biological stress, or unique baseline dynamics."
        )

    return {
        "percentile": float(round(percentile, 2)),
        "alert_text": alert_text
    }
