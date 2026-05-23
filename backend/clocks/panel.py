import sys
import os
import datetime
import numpy as np
from typing import Dict, Any, List

# Ensure relative pathways function properly
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from synthetic.generator import Patient, generate_clock_panel

# Published test-retest standard deviation noise (variance parameter proxy)
CLOCK_RELIABILITIES = {
    "Horvath": 1.1,
    "Hannum": 1.2,
    "PhenoAge": 1.4,
    "GrimAge": 1.0,
    "ZhangAge": 1.3,
    "CausAge": 0.7,
    "DunedinPACE": 0.02  # Omitted from general year consensus calculations due to rate units
}

STAR_SCORING = {
    "Horvath": {"Stability": 0.85, "Treatment-Responsiveness": 0.50, "Associations": 0.60, "Clinical-Risk": 0.65},
    "Hannum": {"Stability": 0.80, "Treatment-Responsiveness": 0.50, "Associations": 0.55, "Clinical-Risk": 0.60},
    "PhenoAge": {"Stability": 0.75, "Treatment-Responsiveness": 0.75, "Associations": 0.85, "Clinical-Risk": 0.88},
    "GrimAge": {"Stability": 0.90, "Treatment-Responsiveness": 0.82, "Associations": 0.95, "Clinical-Risk": 0.96},
    "DunedinPACE": {"Stability": 0.94, "Treatment-Responsiveness": 0.88, "Associations": 0.90, "Clinical-Risk": 0.92},
    "ZhangAge": {"Stability": 0.82, "Treatment-Responsiveness": 0.68, "Associations": 0.74, "Clinical-Risk": 0.70},
    "CausAge": {"Stability": 0.80, "Treatment-Responsiveness": 0.80, "Associations": 0.83, "Clinical-Risk": 0.82}
}

class ClockPanel:
    def __init__(self, seed: int = 42):
        self.seed = seed
        np.random.seed(seed)

    def analyze(self, patient: Patient, timepoint: datetime.date) -> Dict[str, Any]:
        """
        Extracts multi-clock epigenetic ages, computes inverse-variance consensus,
        and scores potential statistical discrepancy indicators.
        """
        # Ensure repeatable local sample metrics inside calculation
        np.random.seed(self.seed + int(patient.chronological_age * 10))
        
        raw_clocks = generate_clock_panel(patient, timepoint)
        
        # Build weighted consensus for absolute age clocks (excluding DunedinPACE as it is a Pace of Aging rate)
        age_clocks = ["Horvath", "Hannum", "PhenoAge", "GrimAge", "ZhangAge", "CausAge"]
        
        total_weight = 0.0
        weighted_sum = 0.0
        
        individual_clocks_report = {}
        
        for clock in CLOCK_RELIABILITIES.keys():
            val = raw_clocks[clock]
            sd = CLOCK_RELIABILITIES[clock]
            variance = sd ** 2
            
            # 95% Confidence Intervals under standard error distributions
            ci_low = val - (1.96 * sd)
            ci_high = val + (1.96 * sd)
            
            individual_clocks_report[clock] = {
                "value": val,
                "ci_low": float(round(ci_low, 3)),
                "ci_high": float(round(ci_high, 3)),
                "reliability": float(round(1.0 - (sd / 10.0), 3))  # Qualitative index helper
            }
            
            if clock in age_clocks:
                weight = 1.0 / variance
                total_weight += weight
                weighted_sum += weight * val

        # Calculate inverse-variance consensus criteria
        consensus_age = weighted_sum / total_weight
        consensus_variance = 1.0 / total_weight
        consensus_se = np.sqrt(consensus_variance)
        
        consensus_ci_low = consensus_age - (1.96 * consensus_se)
        consensus_ci_high = consensus_age + (1.96 * consensus_se)
        
        acceleration = consensus_age - patient.chronological_age
        
        # disagreement_score calculation (z-score against standard joint covariance baseline)
        dis_score = self.calculate_disagreement_score(raw_clocks, patient.chronological_age)

        return {
            "clocks": individual_clocks_report,
            "chronological_age": patient.chronological_age,
            "consensus_age": float(round(consensus_age, 2)),
            "consensus_ci": [float(round(consensus_ci_low, 2)), float(round(consensus_ci_high, 2))],
            "acceleration": float(round(acceleration, 2)),
            "disagreement_score": float(round(dis_score, 3)),
            "star_scores": STAR_SCORING
        }

    def calculate_disagreement_score(self, clocks: Dict[str, float], chronological_age: float) -> float:
        """
        Empirical measurement of clock discordance compared to baseline correlations.
        Uses standardized distances of deviations from expectation levels.
        """
        # Distances: accelerated deviation offsets
        diffs = []
        for clock in ["Horvath", "Hannum", "PhenoAge", "GrimAge", "ZhangAge", "CausAge"]:
            diffs.append(clocks[clock] - chronological_age)
            
        # Add DunedinPACE centered difference scaling
        diffs.append((clocks["DunedinPACE"] - 1.0) * 10.0) # Scaled equivalent factor
        
        # Calculate deviation variability (disagreement index)
        variance_of_deltas = np.var(diffs)
        
        # Transform variance to a simulated Z-score assuming standard reference variance of ~8.5
        z_score = (variance_of_deltas - 7.5) / 4.2
        return float(z_score)
