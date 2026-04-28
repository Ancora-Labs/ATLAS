# ATLAS Interface Product Spec

This document defines the intended first ATLAS product surface.
Its main job is to remove ambiguity between "reuse backend/runtime capabilities" and "turn the existing dashboard into the product".

## 1. Product Intent

ATLAS should become the single user-facing entry point for operating this repository.
After cloning the repo on Windows, the user should launch ATLAS and control session work through a dedicated ATLAS application surface.

ATLAS v1 is a Windows-first desktop GUI control product.
It is not an ATLAS-branded page inside the current internal dashboard.
It is not a browser tab that happens to look nicer than the current dashboard.
It is not a command-line-first experience with a thin visual wrapper.

Primary user goals:
- see whether ATLAS is ready
- see what sessions exist
- understand which session can be continued now
- create a new session through guided input
- stop, pause, resume, inspect, and archive sessions safely
- move from high-level session overview into deeper detail without relying on raw terminal logs

Non-goals for v1:
- do not expose continuous self-improvement mode
- do not present ATLAS as a browser-first dashboard product
- do not use the internal dashboard shell as the final ATLAS UX
- do not optimize first for cross-platform packaging
- do not expose raw state files or orchestrator internals as the primary user experience

## 2. Product Class And Boundary

### 2.1 Source Of Truth

When there is any conflict between product intent and existing implementation convenience, product intent wins.

This means:
- existing runtime and state logic are backend capabilities
- existing internal dashboard code is not the default product shell
- a planner must not anchor the solution on the nearest router or existing dashboard page unless the brief explicitly asks for that

### 2.2 Explicitly Forbidden Product Shape

The following outcomes do not satisfy this spec:
- adding `/atlas` to the existing dashboard server as the primary deliverable
- keeping the existing dashboard as the main shell and treating ATLAS as one extra page
- opening ATLAS primarily in the user's browser as a localhost website
- requiring the user to operate the product mainly through cmd, PowerShell, or raw terminal commands
- preserving the dashboard layout/frame and only changing labels, colors, or copy
- describing the result as a safe additive web route because that is the smallest local implementation

If the implementation can be fairly described as "the internal dashboard plus an ATLAS page", the product direction has been violated.

### 2.3 Allowed Reuse

The implementation may reuse:
- runtime state contracts
- session persistence
- orchestration status mapping
- backend endpoints or state-serving helpers
- launch/startup scripts where appropriate

The implementation must own:
- the ATLAS entry flow
- the ATLAS framing and navigation
- the ATLAS product identity
- the session-first information architecture

## 3. Platform And Entry Experience

### 3.1 Platform Scope

Version 1 is Windows-first.

Implications:
- the default launch path is Windows oriented
- the user should have an obvious repo-level ATLAS entry point
- the initial product should feel app-like even if parts of the runtime remain local/web-backed under the hood
- the primary ATLAS experience must not depend on a browser tab or terminal window

### 3.2 Launcher Contract

The repo should contain a user-visible launcher named `ATLAS`.

Launcher responsibilities:
- confirm the workspace is valid
- confirm required runtime prerequisites
- start or reconnect required local services
- open the ATLAS surface
- route failures into a product-owned readiness or recovery experience

The launcher must not dump the user into raw terminal output by default.
The launcher must open the dedicated desktop GUI surface directly.

### 3.3 First-Run Flow

First launch should feel like opening a product, not a dev tool.

Required first-run sequence:
1. Welcome
2. Environment readiness
3. Workspace confirmation
4. Home

The user should quickly understand:
- whether ATLAS is ready
- whether this is the correct workspace
- what to do next

The first-run flow must not:
- ask the user to choose runtime modes
- expose daemon/process terminology as the primary interaction model
- start on logs, metrics, or internal dashboard cards

## 4. Information Architecture

Top-level product navigation for v1:
- Home
- Sessions
- New Session
- Settings

Session Detail is a primary product surface reached from Home or Sessions.

These areas define ATLAS navigation in its own shell.
They are not instructions to place these views under the current dashboard router.

Excluded from top-level navigation in v1:
- Agents
- Pipeline
- Telemetry
- Continuous self-improvement
- Raw logs
- Internal dashboard

These may exist only as subordinate or advanced diagnostic surfaces.

## 5. Screen Definitions

### 5.1 Home

Purpose:
Give a calm operational overview and the clearest next action.

Required content:
- product title `ATLAS`
- system readiness state: `Ready`, `Working`, `Needs attention`, or `Stopped`
- one clear primary action
- secondary entry to create a new session
- session summary cards
- recent activity in human language

Required behavior:
- if there is a clearly resumable session, the primary action is `Continue last session`
- otherwise the primary action becomes `Open sessions`
- the page must feel like a product home, not a monitoring board

### 5.2 Sessions

Purpose:
Help the user scan and act on sessions quickly.

Each session item must show:
- title
- short objective
- status chip
- last updated time
- target or repo label
- progress summary
- primary action

Allowed status chips:
- Active
- Paused
- Waiting for input
- Completed
- Failed

Primary actions by state:
- Active -> `Open`
- Paused -> `Resume`
- Waiting for input -> `Open`
- Completed -> `View`
- Failed -> `Open`

Secondary actions:
- Stop
- Archive

### 5.3 New Session

Purpose:
Create a new single-target session with guided clarity.

Flow:
1. Describe intent in natural language
2. Confirm workspace target
3. Review and start

Rules:
- keep the main flow to three steps or fewer
- keep advanced settings collapsed by default
- do not expose continuous self-improvement as an option

### 5.4 Session Detail

Purpose:
Move from summary into trustworthy detail without forcing raw logs first.

Recommended tabs or sections:
- Overview
- Timeline
- Work
- Activity
- Artifacts
- Controls

Overview must show:
- session title
- objective summary
- current status
- current stage in product language
- started at
- last updated at
- what ATLAS is doing now
- what ATLAS needs from the user
- recommended next action

Timeline must show readable milestones such as:
- session created
- clarification requested
- planning started
- review completed
- delivery handoff ready

Activity is where deeper runtime transparency may appear.
This is the right place for technical phase labels and secondary agent attribution.

Controls must expose only actions the user can trust:
- Pause
- Resume
- Stop
- Archive
- Open workspace

## 6. Content Strategy

Use calm, direct, product-oriented language.

Preferred phrasing:
- `Waiting for input`
- `Needs review`
- `Planning`
- `Executing`
- `Ready to deliver`

Avoid as primary labels:
- daemon
- PID
- orchestrator stage
- raw file names
- internal role jargon

Technical language may appear in expandable or advanced areas when it helps diagnostics.

## 7. Interaction Principles

- one clear primary action per screen
- do not force understanding of internal architecture before action
- important state changes should be explicit and reversible when safe
- surface only controls the user can trust
- preserve continuity so the user can reliably resume work

## 8. V1 Functional Scope

In scope:
- Windows-first ATLAS launcher
- product-owned first-run readiness flow
- Home
- Sessions
- New Session
- Session Detail
- Settings
- stop, resume, pause, and archive controls
- product-language mapping over runtime state

Out of scope:
- multi-platform packaging
- public website experience
- turning the internal dashboard into the ATLAS shell
- multi-repo workspace management
- user-facing self-improvement mode
- raw developer console as the main interface

## 9. Implementation Guardrails

Required implementation direction:
- keep the existing runtime and state model as backend foundation
- build ATLAS as a dedicated product shell over those capabilities
- isolate ATLAS identity from the existing internal dashboard identity
- make the launcher open the ATLAS surface as the canonical start path

Allowed transitional compromise:
- temporary reuse of backend-serving primitives is acceptable if the user still experiences ATLAS as a separate product shell

Forbidden compromise:
- routing the user into the current internal dashboard and calling that ATLAS

Any plan or implementation is out of contract if it makes these statements true:
- "ATLAS is mainly a new page under the existing dashboard"
- "the safest first slice is to add an `/atlas` route to the current dashboard"
- "desktop-style just means we open the browser to the dashboard automatically"

## 10. Acceptance Criteria For Product Direction

The product direction is correct only when all of these are true:
- a Windows user can find a clear ATLAS entry point after cloning the repo
- the launch path opens a dedicated ATLAS experience, not the internal dashboard with a new page
- the user can see, continue, create, stop, inspect, and archive sessions from that ATLAS experience
- continuous self-improvement does not appear in normal user-facing flows
- internal agent names are secondary detail only
- the solution remains repo-scoped and Windows-first for v1
- no planner can honestly reinterpret the spec as permission to make the existing dashboard the primary ATLAS product
