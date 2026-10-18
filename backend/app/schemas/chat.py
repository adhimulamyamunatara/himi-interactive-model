from pydantic import BaseModel, Field

from app.schemas.learning_profile import LearningProfile


class ChatRequest(BaseModel):
    message: str = Field(min_length=1)
    subject: str = Field(min_length=1)
    userName: str = Field(min_length=1)
    # Optional personalization chosen by the student; omitted when personalization is off.
    learningProfile: LearningProfile | None = None


class ChatResponse(BaseModel):
    response: str
    timestamp: str
    status: str