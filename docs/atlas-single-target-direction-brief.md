# ATLAS Single-Target Direction Brief

This brief is the authoritative product-direction contract for the ATLAS session work.
It exists to prevent planners from collapsing the product into the nearest existing web surface.

## Intent

Build the first real ATLAS user-facing desktop GUI for this repository.
The result must feel like a Windows-first product surface for operating sessions, not like an extension of the existing internal dashboard, a browser page, or a terminal wrapper.

## Non-Negotiable Outcome

ATLAS is a dedicated product entry point.
ATLAS is not a new route inside the existing internal dashboard.
ATLAS is not a browser-first website.
ATLAS is not a localhost browser experience used as the main product.
ATLAS is not a cmd or terminal-first operating surface.
ATLAS is not a cosmetic wrapper over the current dashboard identity.

If an implementation choice would make a reasonable reviewer describe the result as "the dashboard with a new page", that choice is wrong.

## Product Definition

ATLAS should become the primary thing a Windows user launches after cloning the repository.
The product should present a calm, desktop-style control surface centered on sessions and operator actions.
The product should also feel modern and polished, with deliberate motion and visual quality rather than a bare utility shell.
The product must stay premium and monochrome without collapsing into an old-dashboard reskin, a generic dark card grid, or a ChatGPT or Claude lookalike.

The first complete direction must support these product capabilities:
- launch ATLAS from a Windows-first entry point
- understand system readiness without reading logs first
- see session continuity at a glance
- continue, inspect, create, pause, stop, and archive sessions
- move from summary into detailed session context without dropping into raw infrastructure surfaces

## Forbidden Interpretation

The following shortcuts are explicitly disallowed unless a future brief says otherwise:
- adding `/atlas` or any other ATLAS-branded route to the existing internal dashboard server as the main product solution
- opening ATLAS in the browser as the main user-facing experience
- making cmd, PowerShell, or raw terminal usage the primary user environment
- treating `src/dashboard/live_dashboard.ts` as the default implementation anchor for the primary ATLAS surface
- presenting the current dashboard shell as the final ATLAS identity with only copy or styling changes
- using the existing dashboard information architecture as the product baseline
- optimizing for "smallest additive repo diff" when that conflicts with the intended product class

Existing dashboard code may be reused only as backend plumbing or transitional data access, not as the defining UI shell.

## Preferred Implementation Class

The intended solution class is:
- a dedicated desktop GUI with app-like launch behavior
- a dedicated ATLAS shell or app-like surface
- Windows-first launch behavior
- product-owned navigation and framing
- session-first information architecture
- explicit separation between product UI and diagnostic/internal tooling

Acceptable implementation shapes include:
- a dedicated desktop shell
- an Electron-style container
- a dedicated ATLAS frontend served separately from the internal dashboard
- another app-like runtime surface that clearly preserves ATLAS as a separate product identity

Unacceptable implementation shapes include:
- a renamed dashboard page
- a route mounted under the internal dashboard as the main UX
- a browser-only localhost surface as the primary product
- a terminal-first launcher flow that leaves the user inside cmd or PowerShell
- a developer-monitoring layout with ATLAS labels pasted on top
- a premium-sounding but visually generic dark dashboard shell that still reads like prior ATLAS
- a literal or near-literal AI chat product lookalike

## Product Direction

The interface is built around sessions.
Users must immediately understand:
- what sessions exist
- which session needs attention
- which session can be resumed now
- how to start a new session
- how to stop or archive a session safely

Top-level product areas for the intended product are:
- Home
- Sessions
- Session Detail
- New Session
- Settings

These areas describe ATLAS product navigation, not pages that must live under the current dashboard router.

## UX Constraints

- Do not expose continuous self-improvement mode in the normal user path.
- Do not make the user learn daemon/process/runtime vocabulary before taking action.
- Do not make the user start from logs, raw state, or internal operator cards.
- Do not make the primary product language depend on internal agent names.
- Do not let implementation convenience override product identity.
- Do not treat visual polish and motion as optional if the user explicitly asks for a modern GUI.
- Do not confuse monochrome with safe reuse of the existing black dashboard shell.
- Do not let premium collapse into gradients, blur, or generic AI-product mimicry.

## Agent Visibility

Use product-language first.
Technical agent names may appear only as secondary detail inside deeper session diagnostics or advanced drill-down surfaces.

## Platform Scope

This release is Windows-first and repo-scoped.
Do not optimize the first implementation around cross-platform packaging.
Do not reinterpret "Windows-first" as permission to keep the product inside the current browser dashboard.

## Architecture Boundary

Treat the current runtime and state model as backend capabilities.
Treat the ATLAS UI shell as a separate product boundary.

This means:
- runtime/state reuse is allowed
- internal dashboard identity reuse is not the goal
- data contracts may be shared
- the primary ATLAS navigation, framing, and entry flow must belong to ATLAS itself

## Delivery Standard

The session must not stop at abstract design language.
It must convert this direction into a real implementation plan that preserves the intended product class.

Any future planning output is wrong if it does any of the following:
- anchors the work on a new dashboard route as the core ATLAS deliverable
- describes the work as keeping the existing dashboard at `/` and adding an ATLAS page beside it as the main solution
- reduces the surface to a "safe additive page" because the current codebase already has a dashboard server

## Planner Guardrail

When product intent and current implementation convenience conflict, the planner must preserve product intent.
It must not silently downgrade the work into the nearest existing web surface.
