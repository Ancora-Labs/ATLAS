# UI Contract System Handoff For Opus 4.7

Use this as the single source of truth for the next implementation pass.
This task is about building the UI contract and verification structure, not
about directly redesigning the ATLAS product shell.

## Role

You are the implementation model for a design-capable autonomous delivery
system slice inside BOX.
Your job is not to produce a loose architecture essay.
Your job is to implement the smallest coherent contract-driven render-judge-
repair foundation that can later control UI quality work.

Do not stop at a plan.
Do not stop at design language.
Do not treat this as an ATLAS visual refresh task.

## Explicit Non-Goal

Do not spend this task redesigning or polishing the ATLAS UI itself.
There is no intention here to directly "fix the ATLAS UI" as the primary
deliverable.

If ATLAS appears in this task at all, it is only as:

- a proving target
- a fixture source
- an example surface for the system to inspect later

The product UI is not the thing to ship in this pass.
The control structure for future UI work is the thing to ship.

## Mission

Build the minimum viable BOX-side structure for UI quality control built on
these ideas:

- intent normalization
- machine-readable design contract
- deterministic scenario matrix
- surface adapter layer
- evidence collection
- judge logic
- bounded repair loop contract

The output should move BOX from a code-writing agent mindset toward a
contract-driven render-judge-repair system, even if the first implementation is
narrow and experimental.

## Core Product Direction

The long-term direction is:

- code-first autonomous system -> contract-driven design-delivery engine

The system should eventually support many design targets and many surfaces.
The key is not one powerful model.
The key is a stable loop made of:

- intent compiler
- per-platform adapters
- deterministic scenario fixtures
- evidence collector
- multimodal or rule-backed judge
- bounded repair controller

## Architecture To Preserve

Treat the architecture below as the intended direction.
Your implementation can be a smaller MVP, but it should align to this shape.

### 1. Intent Normalization

The system must convert vague user taste into machine-readable constraints.

Examples of normalized fields:

- information architecture
- interaction model
- visual direction
- density
- motion
- typography
- color constraints
- anti-goals
- target surfaces
- responsive breakpoints
- accessibility floor

### 2. Research Layer

The system may gather reference patterns and platform norms.
That research should sharpen the contract, not directly replace it.

### 3. Design Contract

This is the most important layer.
Every future UI task should derive from it.

Example fields:

- `layoutModel`
- `navModel`
- `mainPaneMode`
- `density`
- `motion`
- `forbiddenPatterns`
- `targetSurfaces`
- `breakpoints`
- `accessibilityFloor`

## Deterministic Vs Adaptive Boundary

Do not freeze the wrong parts of the system.

The system must be deterministic in its infrastructure and artifact contracts,
but adaptive in the parts that interpret design intent and judge design quality
across many different repositories and surfaces.

Deterministic is correct for:

- contract schema shape
- fixture or scenario file shape
- adapter interface shape
- evidence artifact format
- verdict schema
- retry limits
- stop conditions

Adaptive AI behavior is required for:

- intent normalization from open-ended design requests
- deciding which contract fields matter for a given product or repo
- refining rubric criteria from repo context and target surface
- selecting the most relevant scenario matrix for the design problem
- interpreting evidence against the contract
- writing repair briefs when the output deviates

The schema may be fixed.
The content inside the schema must remain adaptive.

If you hardcode the contract content, forbidden motifs, scenario selection, or
judge logic too aggressively, the system will stop generalizing across many
different repositories and design targets.

### 4. Scenario Matrix

The system must know which states to inspect before it can judge a design.

Examples:

- empty state
- populated state
- selected-item detail
- long-content overflow
- warning or error state
- mobile or narrow state
- desktop wide state

### 5. Surface Adapters

The system needs per-platform render adapters.
The eye of the system is not one generic tool.

Examples:

- web + Playwright screenshots
- Electron capture mode
- Storybook snapshot harness
- mobile emulator screenshots

### 6. Judge Layer

The judge should combine multiple evidence classes.
Screenshot-only evaluation is too weak.

Evidence classes:

- visual evidence
- structural evidence
- behavioral evidence
- accessibility evidence

### 7. Repair Loop

The system should not stop after one implementation pass.
It should:

- implement
- build
- render scenarios
- collect evidence
- judge
- identify deviations
- patch
- rerender
- rejudge

This loop must be bounded.

## Scope For This Pass

Build the smallest coherent version of that architecture inside BOX.
Prefer an experimental or clearly bounded slice over invasive full-runtime
integration.

Good scope examples:

- a design contract schema plus compiler/normalizer
- a scenario matrix format plus sample fixtures
- an adapter interface with one working adapter
- an evidence collector shape
- a verdict format for judge output
- a bounded repair-plan contract
- a minimal execution flow that proves the loop on one narrow target

Bad scope examples:

- redesigning ATLAS end to end
- building every adapter for every platform
- deeply rewriting core orchestrator paths before the concept is proven
- writing only documentation with no executable artifact or tests

## Recommended Implementation Boundary

Keep this work outside the most fragile production runtime paths unless a very
small integration point is required.

Prefer an experimental or isolated location such as a dedicated lab or system
slice that can later graduate into BOX core after validation.

Do not make broad changes to `src/core/orchestrator.ts`,
`src/core/worker_runner.ts`, or verification gates unless absolutely necessary.

## Existing Direction Already Captured In Repo

The repository already contains the key direction in:

- `docs/visual-contract-lab.md`

Use that as a starting point, but strengthen it into executable structure.

## Deliverable Shape

The implementation should create a real control structure, not just prose.
At minimum, the delivered slice should define:

- where contracts live
- how contracts are represented
- how scenarios are represented
- how a target surface is rendered or inspected
- how evidence is stored
- how judge output is represented
- how repair instructions are represented
- how the loop stops or escalates

## Execution Model

Use this logic while implementing:

1. convert the broad idea into a concrete MVP contract
2. choose the narrowest proving slice
3. implement the data contracts and interfaces first
4. implement one render or inspection path
5. implement evidence collection and verdict output
6. add focused tests for schema, fixtures, verdict shape, and loop behavior
7. only then consider any thin integration point

## Validation Requirements

You must validate the implementation with executable checks when possible.

At minimum validate:

- contract parsing or normalization
- fixture or scenario loading
- verdict shape stability
- one adapter path or mock adapter path
- bounded loop behavior or stop conditions

If the implementation includes a real adapter, validate at least one positive
and one negative scenario.

## Repair Discipline

If your first implementation pass leaves the system too abstract, too coupled,
or too under-verified, repair it before finishing.

Use bounded iteration.
Do not drift into framework sprawl.

Suggested limits:

- max 3 implementation-repair passes
- max 2 validation-structure repairs

## Completion Criteria

You are done only when all of the following are true:

- the delivered slice is about UI contract/control structure, not direct ATLAS
  UI redesign
- there is a concrete machine-readable contract or schema layer
- there is a concrete scenario/fixture representation
- there is a concrete evidence and verdict representation
- there is at least one adapter path, real or tightly mocked, that proves the
  architecture
- there is focused validation for the slice
- the result is small enough to evolve, not a speculative giant framework

## Reporting Requirements

When you finish, report:

- what system slice you implemented
- which files now own the contract, scenario, adapter, evidence, and verdict
  layers
- what exact validation you ran
- whether a repair pass was needed
- what remains intentionally out of scope

## Final Reminder

Do not answer the wrong problem.
The wrong problem is "make ATLAS prettier now".
The right problem is "build the contract and control structure that lets BOX
deliver and judge UI work without drifting".
