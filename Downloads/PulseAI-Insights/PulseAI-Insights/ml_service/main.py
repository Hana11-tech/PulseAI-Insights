import json
import os
import re
from datetime import datetime
from pathlib import Path
from typing import List

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

try:
    import google.generativeai as genai
    from google.api_core.exceptions import ResourceExhausted, GoogleAPIError
except Exception as exc:  # pragma: no cover - handled at runtime
    genai = None
    ResourceExhausted = None
    GoogleAPIError = Exception

BASE_DIR = Path(__file__).resolve().parents[1]
MODEL_DIR = Path(os.getenv("MODEL_DIR", BASE_DIR))


def _load_model(filename: str):
    path = MODEL_DIR / filename
    if not path.exists():
        raise FileNotFoundError(f"Missing model file: {path}")
    return joblib.load(path)


# =======================
# 1️⃣ Load Models & Encoders
# =======================
burnout_model = _load_model("burnout_model.pkl")
performance_model = _load_model("performance_rf_model.pkl")
growth_model = _load_model("growth_potential_model.pkl")

burnout_scaler = _load_model("burnout_scaler.pkl")
performance_scaler = _load_model("performance_scaler.pkl")
growth_scaler = _load_model("growth_scaler.pkl")

burnout_le = _load_model("burnout_label_encoder.pkl")
performance_le = _load_model("performance_label_encoder.pkl")
growth_le = _load_model("growth_label_encoder.pkl")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "models/gemini-2.5-flash")

if genai and GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    gemini_model = genai.GenerativeModel(GEMINI_MODEL)
else:
    gemini_model = None


# =======================
# Request / Response Models
# =======================
class WeeklyMetric(BaseModel):
    week_start: datetime
    tasks_assigned: int
    tasks_completed: int
    missed_deadlines: int
    meeting_hours: float
    collaboration_score: float
    engagement_score: float
    learning_hours: float
    stretch_assignments: int


class EmployeeMetrics(BaseModel):
    employee_id: int
    weeks: List[WeeklyMetric]


class BatchPredictRequest(BaseModel):
    employees: List[EmployeeMetrics]


class PredictionResult(BaseModel):
    employee_id: int
    window_start: datetime
    window_end: datetime
    burnout_risk: str
    burnout_confidence: float
    burnout_top_features: List[str]
    performance_trend: str
    performance_confidence: float
    performance_top_features: List[str]
    growth_potential: str
    growth_confidence: float
    growth_top_features: List[str]
    recommendations: List[str]
    explanation: str


class BatchPredictResponse(BaseModel):
    results: List[PredictionResult]


app = FastAPI(title="PulseAI ML Service", version="1.0.0")


# =======================
# 2️⃣ Compute 4-Week Aggregated Features
# =======================
def compute_feature_sets(weeks: List[WeeklyMetric]) -> dict:
    weeks_sorted = sorted(weeks, key=lambda w: w.week_start)
    if len(weeks_sorted) < 4:
        raise ValueError("At least 4 weeks of data are required.")

    window = weeks_sorted[-4:]

    tasks_assigned_sum = sum(w.tasks_assigned for w in window)
    tasks_completed_sum = sum(w.tasks_completed for w in window)
    missed_deadlines_sum = sum(w.missed_deadlines for w in window)

    task_completion_ratio = (
        tasks_completed_sum / tasks_assigned_sum if tasks_assigned_sum > 0 else 0.0
    )
    workload_trend = window[-1].tasks_assigned - window[0].tasks_assigned
    deadline_miss_rate = (
        missed_deadlines_sum / tasks_assigned_sum if tasks_assigned_sum > 0 else 0.0
    )
    meeting_load = float(np.mean([w.meeting_hours for w in window]))
    engagement_trend = window[-1].engagement_score - window[0].engagement_score
    collaboration_trend = (
        window[-1].collaboration_score - window[0].collaboration_score
    )
    learning_trend = window[-1].learning_hours - window[0].learning_hours
    stretch_assignments = sum(w.stretch_assignments for w in window)

    avg_workload = float(np.mean([w.tasks_assigned for w in window]))
    engagement_drop = max(0.0, window[0].engagement_score - window[-1].engagement_score)
    collaboration_drop = max(
        0.0, window[0].collaboration_score - window[-1].collaboration_score
    )
    recovery_gap = max(0.0, meeting_load - window[-1].learning_hours)

    burnout_features = pd.DataFrame(
        [
            {
                "avg_workload": avg_workload,
                "workload_trend": workload_trend,
                "deadline_miss_rate": deadline_miss_rate,
                "meeting_load": meeting_load,
                "engagement_drop": engagement_drop,
                "collaboration_drop": collaboration_drop,
                "recovery_gap": recovery_gap,
            }
        ]
    )

    performance_features = pd.DataFrame(
        [
            {
                "task_completion_ratio": task_completion_ratio,
                "workload_trend": workload_trend,
                "deadline_miss_rate": deadline_miss_rate,
                "meeting_load": meeting_load,
                "engagement_trend": engagement_trend,
                "collaboration_trend": collaboration_trend,
                "learning_trend": learning_trend,
            }
        ]
    )

    growth_features = pd.DataFrame(
        [
            {
                "task_completion_ratio": task_completion_ratio,
                "workload_trend": workload_trend,
                "deadline_miss_rate": deadline_miss_rate,
                "meeting_load": meeting_load,
                "engagement_trend": engagement_trend,
                "collaboration_trend": collaboration_trend,
                "learning_trend": learning_trend,
                "stretch_assignments": stretch_assignments,
            }
        ]
    )

    return {
        "burnout": burnout_features,
        "performance": performance_features,
        "growth": growth_features,
    }


# =======================
# 3️⃣ Predict All Models for an Employee
# =======================
def predict_employee(feature_sets: dict) -> dict:
    results: dict = {}

    # Burnout
    burnout_features = feature_sets["burnout"]
    X_burnout = burnout_scaler.transform(burnout_features)
    y_burnout_pred = burnout_model.predict(X_burnout)
    y_burnout_proba = burnout_model.predict_proba(X_burnout)
    results["burnout_risk"] = burnout_le.inverse_transform(y_burnout_pred)[0]
    results["burnout_confidence"] = float(np.max(y_burnout_proba))
    results["burnout_top_features"] = list(burnout_features.columns[:3])

    # Performance
    performance_features = feature_sets["performance"]
    X_perf = performance_scaler.transform(performance_features)
    y_perf_pred = performance_model.predict(X_perf)
    y_perf_proba = performance_model.predict_proba(X_perf)
    results["performance_trend"] = performance_le.inverse_transform(y_perf_pred)[0]
    results["performance_confidence"] = float(np.max(y_perf_proba))
    results["performance_top_features"] = list(performance_features.columns[:3])

    # Growth
    growth_features = feature_sets["growth"]
    X_growth = growth_scaler.transform(growth_features)
    y_growth_pred = growth_model.predict(X_growth)
    y_growth_proba = growth_model.predict_proba(X_growth)
    results["growth_potential"] = growth_le.inverse_transform(y_growth_pred)[0]
    results["growth_confidence"] = float(np.max(y_growth_proba))
    results["growth_top_features"] = list(growth_features.columns[:3])

    return results


# =======================
# 4️⃣ Gemini Prompt Generator
# =======================
def generate_gemini_prompt(employee_id: int, predictions: dict) -> str:
    return f"""
You are an AI manager assistant.
Employee {employee_id} has the following signals:

- Burnout Risk: {predictions['burnout_risk']} (top features: {', '.join(predictions['burnout_top_features'])})
- Performance Trend: {predictions['performance_trend']} (top features: {', '.join(predictions['performance_top_features'])})
- Growth Potential: {predictions['growth_potential']} (top features: {', '.join(predictions['growth_top_features'])})

Return JSON ONLY with the following shape:
{{
  "recommendations": ["...", "..."],
  "explanation": "..."
}}

Use concise, human-friendly language. Emphasize aggregated signals, no surveillance.
"""


def _extract_json(text: str) -> dict:
    text = text.strip()
    if "```" in text:
        match = re.search(r"```(?:json)?\\s*(\\{[\\s\\S]*?\\})\\s*```", text)
        if match:
            text = match.group(1)
    if not text.startswith("{"):
        match = re.search(r"(\\{[\\s\\S]*\\})", text)
        if match:
            text = match.group(1)
    try:
        return json.loads(text)
    except Exception:
        return {"recommendations": [], "explanation": ""}


# =======================
# Fallback Recommendations (No Gemini)
# =======================
def _fallback_recommendations(predictions: dict) -> dict:
    burnout = predictions.get("burnout_risk", "Low")
    performance = predictions.get("performance_trend", "Stable")
    growth = predictions.get("growth_potential", "Medium")

    recommendations: List[str] = []
    explanation_bits: List[str] = []

    if burnout in {"High", "Medium"}:
        recommendations.append(
            "Review workload and meeting load to protect focus time for the next sprint."
        )
        explanation_bits.append(f"Burnout risk is {burnout}.")
    if performance == "Declining":
        recommendations.append(
            "Identify blockers and clarify top priorities to stabilize performance."
        )
        explanation_bits.append("Performance trend is declining.")
    elif performance == "Improving":
        recommendations.append(
            "Reinforce what is working and share best practices with the team."
        )
    if growth in {"High-Potential", "Medium-Potential"}:
        recommendations.append(
            "Offer a stretch assignment or mentorship to sustain growth momentum."
        )
        explanation_bits.append(f"Growth potential is {growth}.")
    else:
        recommendations.append(
            "Allocate dedicated learning time to build longer-term growth signals."
        )

    if len(recommendations) > 4:
        recommendations = recommendations[:4]
    if len(recommendations) < 2:
        recommendations.append(
            "Schedule a check-in focused on workload balance and priorities."
        )

    explanation = " ".join(explanation_bits) or "Recommendations based on aggregated 4-week signals."
    return {"recommendations": recommendations, "explanation": explanation}


def _fallback_team_insights(summary: dict) -> List[dict]:
    total = summary.get("total_employees", 0) or 0
    high_burnout = summary.get("high_burnout_count", 0) or 0
    declining = summary.get("declining_performance_count", 0) or 0
    high_potential = summary.get("high_potential_count", 0) or 0

    top_burnout = summary.get("top_burnout_features", []) or []
    top_performance = summary.get("top_performance_features", []) or []
    top_growth = summary.get("top_growth_features", []) or []

    insights: List[dict] = []

    if total > 0 and high_burnout > 0:
        focus = ", ".join(top_burnout[:2]) if top_burnout else "workload signals"
        insights.append({
            "title": "Workload Pressure Signals",
            "description": f"{high_burnout} of {total} employees show elevated burnout risk driven by {focus}.",
            "type": "team_shift",
            "level": "team",
        })

    if total > 0 and declining > 0:
        focus = ", ".join(top_performance[:2]) if top_performance else "completion trends"
        insights.append({
            "title": "Performance Drag Emerging",
            "description": f"{declining} employees show declining performance linked to {focus}.",
            "type": "pattern",
            "level": "team",
        })

    if total > 0 and high_potential > 0:
        focus = ", ".join(top_growth[:2]) if top_growth else "learning signals"
        insights.append({
            "title": "Growth Momentum",
            "description": f"{high_potential} employees show high growth potential tied to {focus}.",
            "type": "alert_summary",
            "level": "team",
        })

    if not insights:
        insights.append({
            "title": "Stable Team Signals",
            "description": "No major shifts detected in the latest 4-week window.",
            "type": "team_shift",
            "level": "team",
        })

    return insights[:4]


# =======================
# 5️⃣ Gemini API Call
# =======================
def call_gemini(prompt: str) -> dict:
    if not gemini_model:
        return {}
    try:
        response = gemini_model.generate_content(prompt)
    except Exception:
        return {}
    parsed = _extract_json(response.text or "")
    recs = parsed.get("recommendations", [])
    if not isinstance(recs, list):
        recs = [str(recs)]
    explanation = parsed.get("explanation", "")
    return {"recommendations": [str(r) for r in recs], "explanation": str(explanation)}


def call_gemini_json(prompt: str) -> dict:
    if not gemini_model:
        return {}
    try:
        response = gemini_model.generate_content(
            prompt,
            generation_config={"temperature": 0.4, "response_mime_type": "application/json"},
        )
        return _extract_json(response.text or "")
    except Exception:
        return {}


class TeamInsightsRequest(BaseModel):
    total_employees: int
    high_burnout_count: int
    declining_performance_count: int
    high_potential_count: int
    top_burnout_features: List[str]
    top_performance_features: List[str]
    top_growth_features: List[str]


class TeamInsight(BaseModel):
    title: str
    description: str
    type: str = Field(default="team_shift")
    level: str = Field(default="team")


class TeamInsightsResponse(BaseModel):
    insights: List[TeamInsight]


def generate_team_insights_prompt(summary: dict) -> str:
    return f"""
You are an AI insights analyst for a people analytics dashboard.
Team summary:
{json.dumps(summary, indent=2)}

Return JSON ONLY with this shape:
{{
  "insights": [
    {{
      "title": "...",
      "description": "...",
      "type": "team_shift|pattern|alert_summary",
      "level": "team"
    }}
  ]
}}

Rules:
- Provide 2 to 4 insights.
- Keep each description under 2 sentences.
- Focus on aggregated signals, not individual surveillance.
"""


# =======================
# 6️⃣ Batch Prediction + Gemini Integration
# =======================
@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.post("/predict/batch", response_model=BatchPredictResponse)
def batch_predict(payload: BatchPredictRequest):
    results: List[PredictionResult] = []

    for emp in payload.employees:
        if len(emp.weeks) < 4:
            continue

        window = sorted(emp.weeks, key=lambda w: w.week_start)[-4:]
        feature_sets = compute_feature_sets(window)
        preds = predict_employee(feature_sets)
        prompt = generate_gemini_prompt(emp.employee_id, preds)
        ai = call_gemini(prompt)
        if not ai or not ai.get("recommendations"):
            ai = _fallback_recommendations(preds)

        results.append(
            PredictionResult(
                employee_id=emp.employee_id,
                window_start=window[0].week_start,
                window_end=window[-1].week_start,
                burnout_risk=preds["burnout_risk"],
                burnout_confidence=preds["burnout_confidence"],
                burnout_top_features=preds["burnout_top_features"],
                performance_trend=preds["performance_trend"],
                performance_confidence=preds["performance_confidence"],
                performance_top_features=preds["performance_top_features"],
                growth_potential=preds["growth_potential"],
                growth_confidence=preds["growth_confidence"],
                growth_top_features=preds["growth_top_features"],
                recommendations=ai["recommendations"],
                explanation=ai["explanation"],
            )
        )

    return BatchPredictResponse(results=results)


@app.post("/insights/team", response_model=TeamInsightsResponse)
def team_insights(payload: TeamInsightsRequest):
    prompt = generate_team_insights_prompt(payload.dict())
    parsed = call_gemini_json(prompt)
    insights = parsed.get("insights", []) if parsed else []
    if not isinstance(insights, list) or len(insights) == 0:
        insights = _fallback_team_insights(payload.dict())

    cleaned: List[TeamInsight] = []
    for item in insights:
        if not isinstance(item, dict):
            continue
        try:
            cleaned.append(TeamInsight(**item))
        except Exception:
            continue

    return TeamInsightsResponse(insights=cleaned)
