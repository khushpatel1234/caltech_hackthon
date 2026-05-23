import sys
import os
import math
import datetime
import numpy as np
from typing import Dict, Any, List, Optional
from scipy import stats
import ruptures as rpt

# Ensure relative paths are correct
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from clocks.panel import CLOCK_RELIABILITIES, STAR_SCORING

def safe_float(val: Any, fallback: float = 0.0) -> float:
    """Returns a JSON-safe float, replacing nan/inf with fallback."""
    try:
        f = float(val)
        return fallback if (math.isnan(f) or math.isinf(f)) else f
    except Exception:
        return fallback

def sanitize_for_json(obj: Any) -> Any:
    """Recursively replaces nan/inf floats in dicts/lists so JSON serialization never fails."""
    if isinstance(obj, dict):
        return {k: sanitize_for_json(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [sanitize_for_json(v) for v in obj]
    if isinstance(obj, float):
        return safe_float(obj)
    if isinstance(obj, np.floating):
        return safe_float(float(obj))
    return obj

def parse_date(date_val: Any) -> float:
    """Parses a date or float representation to numeric days since baseline."""
    if isinstance(date_val, (int, float)):
        return float(date_val)
    if isinstance(date_val, datetime.date):
        return float((date_val - datetime.date(2020, 1, 1)).days)
    if isinstance(date_val, str):
        try:
            # Handle ISO or simple YYYY-MM-DD
            dt = datetime.datetime.strptime(date_val.split('T')[0], "%Y-%m-%d").date()
            return float((dt - datetime.date(2020, 1, 1)).days)
        except Exception:
            pass
    return 0.0

def fit_linear_trajectory(x: np.ndarray, y: np.ndarray) -> Dict[str, Any]:
    """
    Fits a simple linear regression line to 1D series (e.g. fractional years vs clock ages).
    Returns slope, intercept, p-value, and 95% CI bounds for the slope.
    """
    n = len(x)
    if n < 2:
        return {
            "slope": 0.0,
            "intercept": float(y[0]) if n == 1 else 0.0,
            "slope_ci_low": 0.0,
            "slope_ci_high": 0.0,
            "p_value": 1.0,
            "r_squared": 0.0
        }
    
    slope, intercept, r_value, p_value, std_err = stats.linregress(x, y)

    # Calculate 95% CI of the slope using t-distribution critical values
    t_val = stats.t.ppf(0.975, df=max(1, n - 2))
    ci_half = t_val * std_err if (not np.isnan(std_err) and not np.isinf(std_err)) else 0.0

    return {
        "slope": safe_float(round(slope, 4)),
        "intercept": safe_float(round(intercept, 4)),
        "slope_ci_low": safe_float(round(slope - ci_half, 4)),
        "slope_ci_high": safe_float(round(slope + ci_half, 4)),
        "p_value": safe_float(round(p_value, 6), fallback=1.0),
        "r_squared": safe_float(round(r_value ** 2, 4))
    }

def analyze_longitudinal_trajectory(
    timepoints: List[Dict[str, Any]], 
    seed: int = 42
) -> Dict[str, Any]:
    """
    Core engine to ingest multi-visit patient stats and perform:
      1. Per-clock linear slope modeling
      2. Bayesian inverse-variance true age consensus series
      3. Multidimensional ruptures changepoint search
      4. Dynamic treatment response attribution
    """
    np.random.seed(seed)
    
    # Organize visits deterministically
    # Each timepoint input might look like:
    # { "visit": "M0", "chronoAge": 52.3, "activePrograms": ["Rapamycin"], "clocks": {"Horvath": 51.5, ...} }
    # Or flattened with clock names as root keys. Let's support both.
    
    n_visits = len(timepoints)
    if n_visits == 0:
        return {"error": "No timepoint data provided."}

    # Extract time metrics
    visit_labels = []
    chrono_ages = []
    has_clock_nested = "clocks" in timepoints[0]
    
    for tp in timepoints:
        visit_labels.append(tp.get("visit", f"V{len(visit_labels)}"))
        chrono_ages.append(float(tp.get("chronoAge", tp.get("chronological_age", 52.0))))

    chrono_ages = np.array(chrono_ages)
    
    # Use fractional year offsets relative to the first visit as independent regression coordinate
    x_years = chrono_ages - chrono_ages[0]
    
    # Extract clocks
    clocks_keys = ["Horvath", "Hannum", "PhenoAge", "GrimAge", "ZhangAge", "CausAge", "DunedinPACE"]
    clock_series: Dict[str, List[float]] = {k: [] for k in clocks_keys}
    
    for tp in timepoints:
        source_dict = tp["clocks"] if has_clock_nested and "clocks" in tp else tp
        for k in clocks_keys:
            val = source_dict.get(k, 1.0 if k == "DunedinPACE" else 52.0)
            # Handle potential dictionary wrappers
            if isinstance(val, dict) and "value" in val:
                val = val["value"]
            clock_series[k].append(float(val))

    # Convert lists to numpy arrays
    clock_arrays = {k: np.array(v) for k, v in clock_series.items()}
    
    # 1. Per-clock fitted linear trajectory
    per_clock_trajectories = {}
    for k in clocks_keys:
        per_clock_trajectories[k] = fit_linear_trajectory(x_years, clock_arrays[k])

    # 2. Bayesian-triangulated latent true biological age (excluding rate-based DunedinPACE)
    age_clocks = ["Horvath", "Hannum", "PhenoAge", "GrimAge", "ZhangAge", "CausAge"]
    
    consensus_trajectory = []
    
    # Calculate weight per clock based on inverse reliability variance
    clock_weights = {}
    total_inverse_weight = 0.0
    for k in age_clocks:
        sd = CLOCK_RELIABILITIES.get(k, 1.0)
        clock_weights[k] = 1.0 / (sd ** 2)
        total_inverse_weight += clock_weights[k]
        
    for idx in range(n_visits):
        weighted_sum = 0.0
        for k in age_clocks:
            weighted_sum += clock_arrays[k][idx] * clock_weights[k]
            
        post_mean = weighted_sum / total_inverse_weight
        post_variance = 1.0 / total_inverse_weight
        post_se = np.sqrt(post_variance)
        
        consensus_trajectory.append({
            "visit": visit_labels[idx],
            "chrono_age": float(chrono_ages[idx]),
            "mean": float(round(post_mean, 2)),
            "ci_low": float(round(post_mean - 1.96 * post_se, 2)),
            "ci_high": float(round(post_mean + 1.96 * post_se, 2)),
            "acceleration": float(round(post_mean - chrono_ages[idx], 2))
        })

    # 3. Changepoint Detection
    # Form multi-dimensional matrix. Dimensions: N_visits x N_clocks (using standard scaled acceleration deltas)
    # Scale delta acceleration vectors: (Clock - Chronological Age) / SD to give standard metrics
    multivariate_signal = []
    for idx in range(n_visits):
        row = []
        for k in age_clocks:
            sd = CLOCK_RELIABILITIES.get(k, 1.0)
            row.append((clock_arrays[k][idx] - chrono_ages[idx]) / sd)
        # Add DunedinPACE rate scaled delta
        row.append((clock_series["DunedinPACE"][idx] - 1.0) / CLOCK_RELIABILITIES["DunedinPACE"])
        multivariate_signal.append(row)
        
    multivariate_signal = np.array(multivariate_signal)
    
    changepoint_idx = None
    changepoint_visit = None
    confidence_score = 0.0
    
    # Changepoint detection requires minimum length to split
    if n_visits >= 4:
        # Fit multidimensional Binary Segmentation
        try:
            algo = rpt.Binseg(model="l2").fit(multivariate_signal)
            # Find exactly 1 changepoint (result lists breakpoint indices; n_visits is the end bracket)
            result = algo.predict(n_bkps=1)
            # A result like [3, 6] indicates split occurs at index 3 (visit 3)
            if len(result) > 1 and result[0] < n_visits:
                changepoint_idx = int(result[0])
                changepoint_visit = visit_labels[changepoint_idx]
                
                # Compute RSS reduction for the split to build explanatory confidence score
                flat_mean = np.mean(multivariate_signal, axis=0)
                rss_flat = np.sum((multivariate_signal - flat_mean) ** 2)
                
                post_split_1 = multivariate_signal[:changepoint_idx]
                post_split_2 = multivariate_signal[changepoint_idx:]
                
                rss_split = (
                    np.sum((post_split_1 - np.mean(post_split_1, axis=0)) ** 2) +
                    np.sum((post_split_2 - np.mean(post_split_2, axis=0)) ** 2)
                )
                
                # Normalise ratio of explained variance
                if rss_flat > 0:
                    r2 = 1.0 - (rss_split / rss_flat)
                    confidence_score = float(round(np.clip(r2 * 1.35, 0.0, 1.0), 3))
        except Exception as e:
            # Safe boundary fallback
            pass

    # 4. Intervention Attribution
    attribution = None
    if changepoint_idx is not None and changepoint_idx > 0:
        # Check if an intervention list exists and has additions in the post-changepoint boundary
        pre_interventions = set()
        post_interventions = set()
        
        for idx in range(n_visits):
            active_list = timepoints[idx].get("activePrograms", timepoints[idx].get("active_programs", []))
            if idx < changepoint_idx:
                pre_interventions.update(active_list)
            else:
                post_interventions.update(active_list)
                
        newly_added = post_interventions - pre_interventions
        
        # Calculate standard deviation & mean biological relative accelerations pre vs post
        pre_accels = np.array([pt["acceleration"] for pt in consensus_trajectory[:changepoint_idx]])
        post_accels = np.array([pt["acceleration"] for pt in consensus_trajectory[changepoint_idx:]])
        
        pre_mean = np.mean(pre_accels)
        post_mean = np.mean(post_accels)
        
        delta_accel = post_mean - pre_mean # negative means improved aging/rejuvenation
        
        # Estimate Confidence limits using pooled standard errors
        n_pre = len(pre_accels)
        n_post = len(post_accels)
        
        var_pre = np.var(pre_accels) if n_pre > 1 else 0.5
        var_post = np.var(post_accels) if n_post > 1 else 0.5
        
        se_delta = np.sqrt((var_pre / n_pre) + (var_post / n_post))
        
        attribution = {
            "attributed_programs": list(newly_added) if newly_added else ["General Lifestyle Changes"],
            "pre_mean_acceleration": float(round(pre_mean, 2)),
            "post_mean_acceleration": float(round(post_mean, 2)),
            "rejuvenation_delta": float(round(-delta_accel, 2)), # Positive value signifies "Years Saved"
            "ci_low": float(round(-delta_accel - 1.96 * se_delta, 2)),
            "ci_high": float(round(-delta_accel + 1.96 * se_delta, 2))
        }

    return sanitize_for_json({
        "per_clock_trajectories": per_clock_trajectories,
        "bayes_consensus_trajectory": consensus_trajectory,
        "changepoint": {
            "index": changepoint_idx,
            "visit": changepoint_visit,
            "confidence": confidence_score
        },
        "attribution": attribution
    })
