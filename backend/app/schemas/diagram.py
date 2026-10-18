"""Contracts for the Visual Explanation agent.

The model never returns markup, SVG or code: only a small structured graph (nodes and edges) that is validated
here and drawn by HIMI's own renderer. That keeps the output safe to display and lets us reject nonsense.
"""

from __future__ import annotations

import re
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.core.subjects import SUBJECTS
from app.schemas.learning_profile import LearningProfile
from app.schemas.tutor import SUPPORTED_LANGUAGES, ReviewResult, TraceEntry, clean_line, clean_multiline

MAX_TOPIC_CHARS = 120
MAX_DETAILS_CHARS = 500
MIN_NODES = 2
MAX_NODES = 14
MAX_EDGES = 24
MAX_LABEL_CHARS = 40
MAX_EDGE_LABEL_CHARS = 30
MAX_EXPLANATION_CHARS = 1600

DiagramType = Literal["flowchart", "hierarchy", "states"]
NodeKind = Literal["start", "process", "decision", "end", "state", "concept"]
NODE_KINDS = ("start", "process", "decision", "end", "state", "concept")

_NODE_ID = re.compile(r"^[a-z][a-z0-9_]{0,23}$")


class DiagramRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    topic: str = Field(min_length=1, max_length=MAX_TOPIC_CHARS)
    subject: str = Field(min_length=1, max_length=60)
    diagramType: DiagramType = "flowchart"
    details: str | None = Field(default=None, max_length=MAX_DETAILS_CHARS)
    language: str = "en"
    learningProfile: LearningProfile | None = None

    @field_validator("topic")
    @classmethod
    def _topic_clean(cls, value: str) -> str:
        cleaned = clean_line(value)
        if not cleaned:
            raise ValueError("Topic must not be blank.")
        return cleaned

    @field_validator("details")
    @classmethod
    def _details_clean(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = clean_multiline(value)
        return cleaned or None

    @field_validator("subject")
    @classmethod
    def _subject_supported(cls, value: str) -> str:
        if value not in SUBJECTS:
            raise ValueError("Unsupported subject.")
        return value

    @field_validator("language")
    @classmethod
    def _language_supported(cls, value: str) -> str:
        if value not in SUPPORTED_LANGUAGES:
            raise ValueError(f"Unsupported language. Supported: {', '.join(SUPPORTED_LANGUAGES)}.")
        return value


class DiagramNode(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    label: str = Field(min_length=1, max_length=MAX_LABEL_CHARS)
    kind: NodeKind = "process"

    @field_validator("id")
    @classmethod
    def _id_safe(cls, value: str) -> str:
        if not _NODE_ID.match(value):
            raise ValueError("Node id must be lowercase letters, digits and underscores, starting with a letter.")
        return value

    @field_validator("label", mode="before")
    @classmethod
    def _label_clean(cls, value: Any) -> Any:
        if not isinstance(value, str):
            return value
        cleaned = clean_line(value)
        if not cleaned:
            raise ValueError("Label must not be blank.")
        return cleaned

    @field_validator("kind", mode="before")
    @classmethod
    def _kind_fallback(cls, value: Any) -> Any:
        return value if value in NODE_KINDS else "process"


class DiagramEdge(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    source: str = Field(alias="from")
    target: str = Field(alias="to")
    label: str | None = Field(default=None, max_length=MAX_EDGE_LABEL_CHARS)

    @field_validator("label", mode="before")
    @classmethod
    def _label_clean(cls, value: Any) -> str | None:
        if not isinstance(value, str):
            return None
        cleaned = clean_line(value)[:MAX_EDGE_LABEL_CHARS]
        return cleaned or None


class DiagramSpec(BaseModel):
    """A validated, self-consistent graph. Anything that does not hold together is rejected or repaired here."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    title: str = Field(min_length=1, max_length=100)
    nodes: list[DiagramNode]
    edges: list[DiagramEdge]
    explanation: str = Field(min_length=1, max_length=MAX_EXPLANATION_CHARS)

    @field_validator("title", mode="before")
    @classmethod
    def _title_clean(cls, value: Any) -> Any:
        return clean_line(value)[:100] if isinstance(value, str) else value

    @field_validator("explanation", mode="before")
    @classmethod
    def _explanation_clean(cls, value: Any) -> Any:
        return clean_multiline(value) if isinstance(value, str) else value

    @field_validator("nodes", mode="before")
    @classmethod
    def _nodes_tolerant(cls, value: Any) -> list[Any]:
        """Drop individually malformed nodes (the structure check below decides if enough remain)."""
        if not isinstance(value, list):
            raise ValueError("nodes must be a list.")
        kept: list[DiagramNode] = []
        for item in value:
            try:
                kept.append(DiagramNode.model_validate(item))
            except ValueError:
                continue
        return kept

    @field_validator("edges", mode="before")
    @classmethod
    def _edges_tolerant(cls, value: Any) -> list[Any]:
        if not isinstance(value, list):
            raise ValueError("edges must be a list.")
        kept: list[DiagramEdge] = []
        for item in value:
            try:
                kept.append(DiagramEdge.model_validate(item))
            except ValueError:
                continue
        return kept

    @model_validator(mode="after")
    def _consistent(self) -> "DiagramSpec":
        ids = [node.id for node in self.nodes]

        if len(set(ids)) != len(ids):
            raise ValueError("Node ids must be unique.")

        known = set(ids)
        seen: set[tuple[str, str]] = set()
        edges: list[DiagramEdge] = []

        for edge in self.edges:
            pair = (edge.source, edge.target)
            # Drop edges to nowhere, self loops and duplicates instead of failing the whole diagram.
            if edge.source not in known or edge.target not in known or edge.source == edge.target or pair in seen:
                continue
            seen.add(pair)
            edges.append(edge)

        touched = {edge.source for edge in edges} | {edge.target for edge in edges}
        nodes = [node for node in self.nodes if node.id in touched]

        if len(nodes) < MIN_NODES or not edges:
            raise ValueError("A diagram needs at least two connected nodes.")

        if len(nodes) > MAX_NODES or len(edges) > MAX_EDGES:
            raise ValueError("The diagram is too large.")

        self.nodes, self.edges = nodes, edges
        return self


class DiagramResponse(BaseModel):
    request_id: str = Field(alias="requestId")
    diagram_type: DiagramType = Field(alias="diagramType")
    language: str
    title: str
    nodes: list[DiagramNode]
    edges: list[DiagramEdge]
    explanation: str
    review: ReviewResult | None = None
    trace: list[TraceEntry] = Field(default_factory=list)
    model_calls: int = Field(default=0, alias="modelCalls")

    model_config = ConfigDict(populate_by_name=True, protected_namespaces=())
