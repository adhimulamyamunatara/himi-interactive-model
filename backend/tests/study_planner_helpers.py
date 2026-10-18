"""Builders for the study planner tests. No real Gemini calls are made anywhere in these tests."""

import json
from datetime import date, timedelta

from app.schemas.study_planner import StudyPlanGenerateRequest
from app.utils.study_dates import get_study_dates


def make_request_data(**overrides) -> dict:
    today = date.today()
    data = {
        "title": "Semester preparation",
        "exam_date": (today + timedelta(days=10)).isoformat(),
        "start_date": today.isoformat(),
        "subjects": [
            {"subject": "DBMS", "topics": ["Normalization", "Transactions"], "confidence": "basic"},
            {"subject": "Operating Systems", "topics": [], "confidence": "need_to_start"},
        ],
        "daily_available_minutes": 120,
        "preferred_study_days": None,
        "additional_instructions": "Focus on numerical problems.",
    }
    data.update(overrides)
    return data


def make_request(**overrides) -> StudyPlanGenerateRequest:
    return StudyPlanGenerateRequest(**make_request_data(**overrides))


def make_task(index: int, subject: str, minutes: int = 45, **overrides) -> dict:
    task = {
        "subject": subject,
        "title": f"{subject} task {index}",
        "description": f"Work through the key ideas of {subject}, part {index}, with short examples.",
        "duration_minutes": minutes,
        "activity_type": "learn",
    }
    task.update(overrides)
    return task


def make_plan_data(request: StudyPlanGenerateRequest, days: int | None = None, minutes: int = 45) -> dict:
    """A valid schedule: two tasks per day alternating over the selected subjects."""
    study_dates = get_study_dates(request.start_date, request.exam_date, request.preferred_study_days)
    study_dates = study_dates[:days] if days is not None else study_dates
    subjects = [item.subject for item in request.subjects]
    counter = 0
    schedule = []

    for day in study_dates:
        tasks = []
        for _ in range(2):
            counter += 1
            tasks.append(make_task(counter, subjects[counter % len(subjects)], minutes))
        schedule.append({"date": day.isoformat(), "focus": f"Focus {day.isoformat()}", "tasks": tasks})

    # Make sure every selected subject appears at least once.
    if len(schedule) == 1 and len(subjects) > 1:
        schedule[0]["tasks"][0]["subject"] = subjects[0]
        schedule[0]["tasks"][1]["subject"] = subjects[1]

    return {"schedule": schedule, "notes": ["Take a short break every 45 minutes."]}


def make_plan_json(request: StudyPlanGenerateRequest, **kwargs) -> str:
    return json.dumps(make_plan_data(request, **kwargs))
