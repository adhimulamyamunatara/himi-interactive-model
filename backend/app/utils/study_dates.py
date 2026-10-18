"""Date rules for the study planner.

The rule (mirrored in ``frontend/src/utils/studyPlanner.js``):

* Study days run from ``start_date`` (the student's local "today", sent by the browser)
  up to and including the day **before** ``exam_date``.
* The exam day itself is never a study day.
* Only the student's preferred weekdays are study days.
"""

from __future__ import annotations

from datetime import date, timedelta

WEEKDAYS: tuple[str, ...] = (
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
)


def weekday_name(day: date) -> str:
    """Lower-case English weekday name (locale independent)."""
    return WEEKDAYS[day.weekday()]


def get_study_dates(start_date: date, exam_date: date, preferred_days: list[str] | tuple[str, ...]) -> list[date]:
    """Return every allowed study date in chronological order (possibly empty)."""
    allowed = set(preferred_days)
    days: list[date] = []
    current = start_date

    while current < exam_date:
        if weekday_name(current) in allowed:
            days.append(current)
        current += timedelta(days=1)

    return days
