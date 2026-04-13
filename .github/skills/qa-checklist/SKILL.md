---
name: qa-checklist
description: Deterministic QA checklist for BOX plan and worker changes.
---

Use this skill when a change affects verification, tests, or plan quality.

Required checklist:
- Prefer targeted tests that exercise the exact changed contract.
- Verify acceptance criteria are machine-checkable, not prose-only.
- Confirm verification commands reference real files or real commands.
- Preserve fail-closed behavior for governance and verification paths.
- Record any residual risk when behavior is intentionally degraded or feature-flagged.