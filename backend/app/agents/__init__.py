"""HIMI tutor agents.

Logical responsibilities, not separate services. Each is a small module with one job:

* ``router``        classifies a student's message deterministically (no model call).
* ``subject_tutor`` explains, gives hints and worked examples (one model call).
* ``reviewer``      checks the answer's structure and obvious problems (no model call).
* ``orchestrator``  runs the workflow within a hard execution budget.
"""
