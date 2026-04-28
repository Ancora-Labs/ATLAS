# Visual Contract Lab

This document defines the lowest-risk path for building a reusable UI/design verification loop before integrating it into BOX runtime planning.

## Why Outside The Core Runtime First

- The current BOX orchestration path has no first-class visual evidence contract.
- Observation work is treated as read-only or low-verification work, which is too weak for design-critical closure.
- Design verification needs platform adapters, deterministic fixtures, and bounded repair loops that should be proven before they influence production dispatch.

## Recommended Build Location

Create the first version as a standalone lab under `experiments/visual-contract-lab/` in the BOX repo.

Why this location:

- It stays close to BOX code and state fixtures.
- It does not change `src/core/**` behavior while the idea is still unstable.
- It can reuse existing target workspaces and ATLAS screenshots without coupling dispatch logic to experimental code.

Do not wire the lab into `src/core/orchestrator.ts`, `src/core/worker_runner.ts`, or verification gates until the lab proves repeatable value.

## Scope Of The First Lab

The first version should solve one narrow problem well:

- input: a machine-readable UI contract
- input: one deterministic fixture state
- input: one render adapter
- output: screenshots plus a structured verdict
- output: a repair brief describing contract deviations

That means the first lab is not yet a general autonomous design system.
It is a deterministic render-judge loop.

## Initial Architecture

### 1. Contract Compiler

Input:

- freeform design brief
- anti-goals
- target platform
- target states to inspect

Output schema:

- `layoutModel`
- `navigationModel`
- `mainPaneMode`
- `density`
- `visualTone`
- `forbiddenPatterns`
- `requiredStates`
- `breakpoints`
- `accessibilityFloor`

Save compiled contracts as JSON under `experiments/visual-contract-lab/contracts/`.

### 2. Fixture Runner

The lab should not inspect random live app state first.
It should launch a product against deterministic fixtures.

Save fixtures under `experiments/visual-contract-lab/fixtures/`.

Examples:

- `blank-home.json`
- `selected-session.json`
- `warning-session.json`
- `stale-session.json`

### 3. Render Adapters

Adapters convert a contract + fixture into visual artifacts.

First adapters to build:

- `web-playwright`
- `electron-capture`

`web-playwright`:

- starts a local URL or static preview
- captures screenshots at configured breakpoints
- can also collect DOM snapshots and accessibility tree summaries

`electron-capture`:

- launches app in capture mode with a fixture
- waits for a ready signal
- uses `BrowserWindow.webContents.capturePage()` or equivalent
- writes screenshots to disk

Save adapters under `experiments/visual-contract-lab/adapters/`.

### 4. Judge

The judge should not rely on screenshot similarity alone.
It should score four evidence classes:

- visual evidence
- structural evidence
- behavioral evidence
- accessibility evidence

Save verdicts under `experiments/visual-contract-lab/artifacts/<run-id>/verdict.json`.

Minimum verdict shape:

```json
{
  "status": "pass|partial|fail",
  "score": 0.0,
  "violations": [
    {
      "code": "FORBIDDEN_DASHBOARD_CARD",
      "severity": "high",
      "evidence": "selected-session screenshot still shows stacked cards in the primary pane"
    }
  ],
  "repairBrief": [
    "remove competing card sections from the selected-session main pane",
    "reduce blank-state explanatory copy density"
  ]
}
```

### 5. Repair Loop Controller

The lab should support bounded retries only.

Suggested first limits:

- max 2 render-repair passes
- max 1 structural repair pass after visual pass
- stop immediately on build/test failure
- escalate to human review when verdict remains `partial`

## First End-To-End Test Cases

Before generalizing, prove the loop on a small matrix:

1. Static web page fixture with Playwright screenshots.
2. Electron fixture screen with capture mode.
3. One negative case where forbidden patterns are intentionally present.

Success means:

- same fixture produces stable artifacts across repeated runs
- judge catches the intentional failure
- repair brief is actionable and specific

## Graduation Criteria Before Core Integration

Do not connect this to BOX workers until all of the following are true:

- contracts compile deterministically from the same prompt
- adapters produce stable artifacts on repeated runs
- verdict format is machine-parseable and consistent
- at least one web and one Electron scenario are proven
- at least one intentional bad design is correctly failed
- repair briefs are specific enough to drive a second implementation pass

## Integration Plan After The Lab Proves Out

Only after the lab works should BOX gain:

- a new visual evidence artifact type
- a design-aware verification profile
- observation/quality tasks that require screenshot artifacts
- a bounded render-judge-repair worker mode

The first production integration point should be verification, not planning.
Planning can mention the contract earlier, but runtime acceptance should be the first hard gate.

## Recommended MVP Sequence

1. Create `experiments/visual-contract-lab/README.md` with the run flow.
2. Add contract JSON schema plus 2 sample contracts.
3. Add one web adapter with Playwright screenshots.
4. Add one simple screenshot judge that emits structured violations.
5. Add one Electron capture adapter.
6. Prove the loop on ATLAS fixture screens.
7. Only then discuss BOX runtime integration.
