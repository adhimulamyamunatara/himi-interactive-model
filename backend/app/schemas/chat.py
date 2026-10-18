from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(min_length=1)
    subject: str = Field(min_length=1)
    userName: str = Field(min_length=1)


class ChatResponse(BaseModel):
    response: str
    timestamp: str
    status: str