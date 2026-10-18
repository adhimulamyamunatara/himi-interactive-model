from fastapi import APIRouter, HTTPException

from app.schemas.study_planner import StudyPlanGenerateRequest, StudyPlanGenerateResponse
from app.services.study_planner_service import StudyPlannerError, generate_study_plan

router = APIRouter(prefix="/study-planner", tags=["study-planner"])


@router.post("/generate", response_model=StudyPlanGenerateResponse)
def generate_study_plan_endpoint(payload: StudyPlanGenerateRequest) -> StudyPlanGenerateResponse:
    """Generate a day-by-day study plan from the student's subjects, exam date and available time.

    A plain ``def`` on purpose: the Gemini call blocks, so FastAPI runs it in a worker thread.
    Failures are returned as ``{"detail": "<friendly message>"}`` with a 5xx status; internal
    details are logged server-side only. Nothing is stored on the server.
    """
    try:
        plan = generate_study_plan(payload)
    except StudyPlannerError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.public_message) from exc

    return StudyPlanGenerateResponse(plan=plan)
