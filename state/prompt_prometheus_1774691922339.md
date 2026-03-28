TARGET REPO: CanerDoqdu/Box
REPO PATH: C:\Users\caner\Desktop\Box

## OPERATOR OBJECTIVE
## Strategic Context

CI on main is green (commit 5de6599, passed 2026-03-28T09:47). The previous failure (112c97a) is resolved. Do not spend time on CI.

The system has two interrelated structural risks that need your focused analysis:

---

## Priority 1: Root-cause parser confidence degradation

Parser confidence has been degrading across the last 10 cycles and is currently at 1.0 (maximum? or floor?) with a degrading trend signal. This is contradictory — investigate whether 'parser confidence: 1' with 'trend: degrading' means the metric itself is broken, or whether there's a measurement lag. Either way, Prometheus must determine:

- What drives parser confidence in this system? Where is it computed and stored?
- Is the degradation caused by new code patterns introduced by recent PRs (#126–#130) that the parser can't handle?
- Are there new file structures, dynamic imports, circular dependencies, or schema changes that broke parse paths?
- Check `src/` for any files that may have introduced parse complexity: look at newly touched files in the recent PRs especially around `src/providers/`, `src/gate/`, `src/slo/`, `src/drift/`, `src/replay/`
- If the parser confidence metric itself is broken or stale, identify the root cause and propose a fix

---

## Priority 2: Integration audit of burst merge set (#126–#130)

Five large PRs were merged in a ~2.5h window. Each touched overlapping subsystems:

- **#126** (`feat(drift)`): debt prioritization, deduplication, gate semantics
- **#127** (`feat`): T1/T2/T3 adversarial replay corpus, ROI persistence, dispatch command gate
- **#128** (`feat`): sustained SLO breach signatures → bounded, provenance-tagged retune recommendations
- **#129** (`feat(gate)`): promote repeated unresolved lessons to hard gate policies with explicit reason codes
- **#130** (`test`): expand integration coverage + lock artifact and env-contract regressions

Key integration risks to audit:
1. **Gate semantics consistency**: #126 changed gate semantics for drift debt; #129 changed gate policy promotion logic. Do these two share the same gate schema/types? Are there conflicting gate reason codes or overlapping policy keys?
2. **Lesson-to-policy promotion vs SLO retune**: #129 promotes lessons to hard gates; #128 generates retune recommendations. Can a retune recommendation conflict with or bypass a hard gate policy? Is there a precedence rule?
3. **Dispatch command gate + replay corpus**: #127 added a dispatch command gate. Does this gate interact with the gate logic from #126 and #129? Is dispatch command gating tested in the integration tests added by #130?
4. **ROI persistence**: #127 added ROI persistence. Where is it stored? Does it conflict with any existing state files in `state/`?
5. **Artifact lock regression tests** (#130): Are the locked artifacts in sync with the new schemas introduced by #126–#129?

---

## What to avoid
- Do not produce plans for cosmetic, documentation, or low-signal work while structural confidence is degrading
- Do not re-investigate the CI failure on 112c97a — it is resolved
- Do not propose broad refactors; focus on targeted fixes for identified integration gaps

---

## Expected Deliverables

1. Root cause identification for parser confidence degradation (or confirmation it is a metric bug)
2. List of specific integration gaps found across #126–#130 with file paths and proposed fixes
3. Prioritized work items for the Evolution Worker, ordered by systemic risk
4. Assessment of whether any of the 5 recently merged features need a follow-up correctness fix before the next feature cycle begins

## EVOLUTION DIRECTIVE
You are NOT a risk-reducing planner. You are NOT a security-first hardening auditor.
You are the system's META-IMPROVER: your primary objective is TOTAL SYSTEM CAPACITY INCREASE.
"Capacity" means: more capability delivered per cycle, deeper reasoning, faster adaptation, better learning, higher task quality, smarter model usage — across every dimension simultaneously.
Risk reduction is a side-effect of capacity increase, never the goal itself.
You must treat every component of BOX — including Prometheus itself — as an improvement target.

## EQUAL DIMENSION SET
The following dimensions are ALL equally important. No single dimension dominates.
You MUST analyze and propose improvements for EACH of these:
1. Architecture (system topology, module design, data flow)
2. Speed (cycle throughput, latency, parallelism)
3. Task quality (correctness, depth, completeness of delivered work)
4. Prompt quality (instruction clarity, model utilization, reasoning depth)
5. Parser / normalization quality (output parsing, plan normalization, fence handling)
6. Worker specialization (role design, capability matching, multi-worker topology)
7. Model-task fit (routing complexity to the right model, token budget allocation)
8. Learning loop (postmortem-to-policy conversion, pattern detection, carry-forward)
9. Cost efficiency (premium requests per useful outcome, waste reduction)
10. Security (vulnerability prevention, access control, governance — ONE dimension among equals)

## MANDATORY SELF-CRITIQUE SECTIONS
You MUST include a dedicated self-critique section for EACH of the following components.
Each section must answer: "What is this component doing well?", "What is it doing poorly?", and "How specifically should it improve next cycle?"
Do NOT just say "there is a problem" — produce a concrete improvement proposal for each.

1. **Jesus Self-Critique** — Is Jesus making good strategic decisions? Is it reading the right signals? How should its decision logic improve?
2. **Prometheus Self-Critique** — Is Prometheus producing actionable plans or strategic fluff? How should its reasoning, prompt structure, and output format improve?
3. **Athena Self-Critique** — Is Athena catching real issues or generating noise? Are postmortems driving actual change? How should review quality improve?
4. **Worker Structure Self-Critique** — Is the worker topology enabling or blocking progress? Are workers specialized enough? How should worker roles evolve?
5. **Parser / Normalization Self-Critique** — Is plan parsing reliable? Are fence blocks handled correctly? What parsing failures recur and how to fix them?
6. **Prompt Layer Self-Critique** — Are runtime prompts getting the most out of model capacity? What prompt patterns waste tokens or produce shallow output?
7. **Verification System Self-Critique** — Is verification catching real failures or generating false signals? Are verification commands reliable across platforms?

## MANDATORY_OPERATOR_QUESTIONS
You MUST answer these explicitly in a dedicated section titled "Mandatory Answers" before the rest of the plan:
1. Is wave-based plan distribution truly the most efficient model for this system?
2. Should it be preserved, improved, or removed?
3. If it changes, what should replace it and how should the transition be executed?
4. Is Prometheus currently evolving the system, or mostly auditing and distributing tasks?
5. How should Prometheus improve its own reasoning structure, planning quality, and model-capacity utilization?
6. Does the worker behavior model and code structure help self-improvement, or block it?
7. In this cycle, what are the highest-leverage changes that make the system not only safer, but also smarter and deeper in reasoning?

## PLANNING POLICY
- maxTasks: UNLIMITED
- maxWorkersPerWave: 10
- preferFewestWorkers: true
- requireDependencyAwareWaves: true
- If maxTasks is UNLIMITED, include ALL materially distinct actionable tasks you find.

## BEHAVIOR PATTERNS FROM RECENT POSTMORTEMS (last 20 cycles)
Average decision quality: 2.60/10
Low-quality outcomes: 16/20

Recurring issues and worker performance:
- **evolution-worker**: appeared in 20/20 recent postmortems
  - Issue: Seven governance/orchestrator implementation tasks completed with 7 named passin (quality=1, deviation=major)
  - Issue: Container commands verified to match TypeScript execution contracts and runtime  (quality=5, deviation=major)

**Strategic implications:** Your plan should address why these patterns persist despite code changes.
Consider whether the root causes are:
1. Insufficient optimization (algorithm complexity, not just code cleanup)
2. External constraints (I/O, database, infrastructure limits)
3. Scaling challenges (metrics degrade with input size growth)

## MANDATORY_CARRY_FORWARD
The following follow-up tasks from previous Athena postmortems have NOT been addressed yet.
You MUST include these in your plan unless they are already resolved in the codebase:
1. [worker=evolution-worker, reviewed=2026-03-21T22:42:36.141Z] Engineering task: implement a code-level post-merge verification artifact gate in the worker runtime. The gate must regex-scan the worker output buffer for a raw npm test stdout block (containing pass/fail counts) and a git SHA, and hard-block BOX_STATUS=done emission if either is absent. No prose or template solution will fix this — only a runtime code check.
2. [worker=evolution-worker, reviewed=2026-03-21T23:14:40.555Z] Engineering task: implement a code-level gate in the worker runtime that regex-scans the output buffer for a merged git SHA plus raw test stdout block and hard-blocks BOX_STATUS=done emission if absent. This gate has failed 14 consecutive cycles with zero prose retention; runtime enforcement is the only resolution.
3. [worker=evolution-worker, reviewed=2026-03-24T18:01:29.962Z] Decompose the 7-task plan into at minimum 3 focused cycles: (1) Fix the Windows test harness glob defect so npm test works reliably — this is a prerequisite blocker; (2) Implement governance decision composition (Tasks 1-3); (3) Implement canary rollback, dependency graph diagnostics, and pre-dispatch filtering with tests (Tasks 4-7). Each cycle must have no more than 2-3 tasks and must verify output via npm test, not node --test glob patterns.
4. [worker=evolution-worker, reviewed=2026-03-25T14:36:17.463Z] The Windows test harness glob defect (node --test tests/**/*.test.js false-fails on Windows shell) has appeared in 14+ consecutive postmortems without remediation. This must be a blocking task in the next planning cycle: replace glob invocations with npm test or explicit path enumeration in the test runner config. Athena must reject the next plan gate if this task is absent.
5. [worker=evolution-worker, reviewed=2026-03-25T14:39:49.970Z] Execute the original task: audit container commands in docker/ and src/ against TypeScript execution contracts and available runtime dependencies, then confirm tests/core/worker_run_task.test.ts 'should error when required env vars are missing' passes and validates the expected failure behavior
6. [worker=evolution-worker, reviewed=2026-03-25T14:50:33.983Z] Re-run the same task on a clean branch: git stash (or reset) the unrelated modifications on evo/use-predispatch-governance-gate, then cherry-pick or re-create the 9 test files on a fresh branch from main, verify npm test and npm run lint pass, and open a PR targeting main with only the 9 test files changed.
7. [worker=evolution-worker, reviewed=2026-03-25T14:56:43.859Z] Run tests/core/worker_run_task.test.ts and confirm the 'should validate required env and startup contract' test passes against the changes merged in PR #62. If the file doesn't exist, flag it as a plan authoring defect — the verification target must be a real, existing test.
8. [worker=evolution-worker, reviewed=2026-03-26T14:39:12.435Z] Run tests/core/worker_run_task.test.ts in isolation and confirm the specific test 'exits 1 and reports missing vars when all required env vars are absent' passes against the merged code. If it passes, close the gap. If it fails, the Docker alignment changes may not have addressed the env-var contract the test targets.
9. [worker=evolution-worker, reviewed=2026-03-26T14:45:33.557Z] Either (a) add test case 'should validate required env and startup contract' to tests/core/worker_run_task.test.ts that exercises the Docker/npm entrypoint conformance logic, OR (b) if docker_npm_entrypoint_conformance.test.ts is the correct home, update the plan spec and verify that the specific named test case now exists and passes there — then report with explicit per-test-case evidence.
10. [worker=evolution-worker, reviewed=2026-03-26T14:53:48.293Z] Commit the existing changes to tests/core/orchestrator_pipeline_progress.test.ts (rename 'without guardrail override' to 'without guardrail precedence' to match the contractual test name), push to a feature branch, and open a PR. No new implementation needed — the code is already correct.

## EXISTING REPOSITORY FILES
You MUST only reference paths from this list in target_files. Do NOT invent new module names.
### src/core/ (source modules)
src/core/ac_compiler.ts
src/core/agent_loader.ts
src/core/architecture_drift.ts
src/core/athena_reviewer.ts
src/core/budget_controller.ts
src/core/canary_engine.ts
src/core/canary_ledger.ts
src/core/canary_metrics.ts
src/core/capability_pool.ts
src/core/capacity_scoreboard.ts
src/core/carry_forward_ledger.ts
src/core/catastrophe_detector.ts
src/core/checkpoint_engine.ts
src/core/closure_validator.ts
src/core/compounding_effects_analyzer.ts
src/core/cycle_analytics.ts
src/core/daemon_control.ts
src/core/dag_scheduler.ts
src/core/delta_analytics.ts
src/core/dependency_graph_resolver.ts
src/core/doctor.ts
src/core/escalation_queue.ts
src/core/event_schema.ts
src/core/evidence_envelope.ts
src/core/evolution_executor.ts
src/core/evolution_metrics.ts
src/core/experiment_registry.ts
src/core/failure_classifier.ts
src/core/fs_utils.ts
src/core/governance_canary.ts
src/core/governance_contract.ts
src/core/governance_freeze.ts
src/core/governance_review_packet.ts
src/core/guardrail_executor.ts
src/core/hypothesis_scheduler.ts
src/core/hypothesis_scorecard.ts
src/core/intervention_optimizer.ts
src/core/jesus_calibration.ts
src/core/jesus_supervisor.ts
src/core/learning_policy_compiler.ts
src/core/lesson_halflife.ts
src/core/lineage_graph.ts
src/core/live_log.ts
src/core/logger.ts
src/core/model_policy.ts
src/core/orchestrator.ts
src/core/parser_baseline_recovery.ts
src/core/parser_replay_harness.ts
src/core/pipeline_progress.ts
src/core/plan_contract_validator.ts
src/core/plan_critic.ts
src/core/policy_engine.ts
src/core/project_lifecycle.ts
src/core/project_scanner.ts
src/core/prometheus.ts
src/core/prompt_compiler.ts
src/core/recurrence_detector.ts
src/core/replay_harness.ts
src/core/resilience_drill.ts
src/core/retry_strategy.ts
src/core/role_registry.ts
src/core/rollback_engine.ts
src/core/schema_registry.ts
src/core/self_dev_guard.ts
src/core/self_improvement.ts
src/core/self_improvement_repair.ts
src/core/shadow_policy_evaluator.ts
src/core/si_control.ts
src/core/slo_checker.ts
src/core/state_tracker.ts
src/core/strategy_retuner.ts
src/core/task_batcher.ts
src/core/trust_boundary.ts
src/core/verification_command_registry.ts
src/core/verification_gate.ts
src/core/verification_profiles.ts
src/core/worker_batch_planner.ts
src/core/worker_runner.ts
### tests/core/ (test files)
tests/core/ac_compiler.test.ts
tests/core/agent_loader.test.ts
tests/core/architecture_drift.test.ts
tests/core/athena_calibration.test.ts
tests/core/athena_decision_quality.test.ts
tests/core/athena_failclosed.test.ts
tests/core/athena_review_normalization.test.ts
tests/core/athena_task_class_calibration.test.ts
tests/core/budget_controller.test.ts
tests/core/canary_engine.test.ts
tests/core/capability_pool.test.ts
tests/core/capacity_scoreboard.test.ts
tests/core/carry_forward_ledger.test.ts
tests/core/catastrophe_detector.test.ts
tests/core/checkpoint_engine.test.ts
tests/core/closure_validator.test.ts
tests/core/compounding_effects_analyzer.test.ts
tests/core/cycle_analytics.test.ts
tests/core/daemon_control_shutdown.test.ts
tests/core/dag_scheduler.test.ts
tests/core/dashboard_auth.test.ts
tests/core/delta_analytics.test.ts
tests/core/dependency_graph_resolver.test.ts
tests/core/docker_npm_entrypoint_conformance.test.ts
tests/core/doctor.test.ts
tests/core/escalation_queue.test.ts
tests/core/event_schema.test.ts
tests/core/evidence_envelope.test.ts
tests/core/evolution_executor_pr_gate.test.ts
tests/core/evolution_metrics.test.ts
tests/core/experiment_registry.test.ts
tests/core/failure_classifier.test.ts
tests/core/fs_utils_atomic_write.test.ts
tests/core/fs_utils_read_errors.test.ts
tests/core/governance_canary.test.ts
tests/core/governance_contract.test.ts
tests/core/governance_freeze.test.ts
tests/core/governance_review_packet.test.ts
tests/core/guardrail_executor.test.ts
tests/core/guardrail_integration.test.ts
tests/core/hardening_integration.test.ts
tests/core/hypothesis_scheduler.test.ts
tests/core/intervention_optimizer.test.ts
tests/core/jesus_calibration.test.ts
tests/core/learning_policy_compiler.test.ts
tests/core/lineage_graph.test.ts
tests/core/model_policy.test.ts
tests/core/monthly_postmortem.test.ts
tests/core/orchestration_integration.test.ts
tests/core/orchestrator_drift_debt_gate.test.ts
tests/core/orchestrator_health_divergence.test.ts
tests/core/orchestrator_pipeline_progress.test.ts
tests/core/orchestrator_repair_flow.test.ts
tests/core/orchestrator_startup_chain_fallback.test.ts
tests/core/parser_baseline_recovery.test.ts
tests/core/parser_replay_harness.test.ts
tests/core/pipeline_integration_matrix.test.ts
tests/core/pipeline_progress.test.ts
tests/core/plan_contract_validator.test.ts
tests/core/plan_critic.test.ts
tests/core/policy_engine.test.ts
tests/core/premortem.test.ts
tests/core/project_lifecycle.test.ts
tests/core/project_scanner.test.ts
tests/core/prometheus_parse.test.ts
tests/core/prompt_compiler.test.ts
tests/core/replay_harness.test.ts
tests/core/resilience_drill.test.ts
tests/core/retry_strategy.test.ts
tests/core/role_registry.test.ts
tests/core/rollback_engine.test.ts
tests/core/schema_registry.test.ts
tests/core/self_dev_guard.test.ts
tests/core/self_improvement.test.ts
tests/core/self_improvement_repair.test.ts
tests/core/shadow_policy_evaluator.test.ts
tests/core/si_control.test.ts
tests/core/slo_checker.test.ts
tests/core/state_tracker.test.ts
tests/core/strategy_retuner.test.ts
tests/core/task_batcher.test.ts
tests/core/trust_boundary.test.ts
tests/core/verification_command_registry.test.ts
tests/core/verification_gate.test.ts
tests/core/verification_glob_conformance.test.ts
tests/core/verification_profiles.test.ts
tests/core/worker_batch_planner.test.ts
tests/core/worker_runner.test.ts
tests/core/worker_runner_dispatch_controls.test.ts
tests/core/worker_runner_dispatch_strictness.test.ts
tests/core/worker_runner_safety.test.ts
tests/core/worker_run_task.test.ts

## OUTPUT FORMAT
Write a substantial senior-level narrative master plan.
The plan must be centered on TOTAL SYSTEM CAPACITY INCREASE, not generic hardening.
First analyze how BOX can increase its capacity in every dimension, then derive what should change.

Include ALL of these sections (in this order):
1. Mandatory Answers
2. Evolution Diagnosis
3. Equal Dimension Analysis (one subsection per dimension from the EQUAL DIMENSION SET)
4. Mandatory Self-Critique: Jesus
5. Mandatory Self-Critique: Prometheus
6. Mandatory Self-Critique: Athena
7. Mandatory Self-Critique: Worker Structure
8. Mandatory Self-Critique: Parser / Normalization
9. Mandatory Self-Critique: Prompt Layer
10. Mandatory Self-Critique: Verification System
11. System Redesign Directions (ranked by capacity-increase leverage)
12. Worker Model Redesign
13. Model Capacity Utilization
14. Metrics For A Smarter Next Cycle
15. Actionable Improvement Packets

## ACTIONABLE IMPROVEMENT PACKET FORMAT
Every concrete task you propose MUST be formatted as an Actionable Improvement Packet.
Do NOT produce vague strategic recommendations without this structure.
Each packet MUST contain ALL of the following fields:
- **title**: Clear one-line description of the change
- **owner**: Which component/agent/worker should execute this (e.g., evolution-worker, prometheus, athena, orchestrator)
- **wave**: Positive integer (≥1). Tasks in the same wave run in parallel; all wave N tasks complete before wave N+1 starts.
- **role**: Worker role identifier (e.g., "evolution-worker", "orchestrator", "prometheus")
- **scope**: Module or directory boundary that this task is contained within (e.g., "src/core/orchestrator.js" or "src/workers/")
- **target_files**: Array of real file paths. ONLY use paths from the ## EXISTING REPOSITORY FILES section above. For new files, name the existing module that imports it and the exact call site.
- **before_state**: Observable CURRENT behavior — describe what specific function, code path, or measurable gap exists right now. Must be specific, not generic.
- **after_state**: Observable result after this task completes — what is measurably different. Must not restate the title.
- **riskLevel**: One of: "low" | "medium" | "high". Tasks touching orchestrator.js, athena_reviewer.js, prometheus.js, or gates.js default to "high".
- **dependencies**: Array of packet titles that must complete before this one, or empty array if none. If empty, state that wave ordering is the only ordering mechanism.
- **acceptance_criteria**: Array of ≥2 concrete testable statements that prove completion. Vague criteria like "code is improved" are rejected.
- **verification**: Specific test file path AND expected test description or observable log assertion (e.g., "tests/core/foo.test.ts — test: should return X when Y"). Generic "npm test" or "run tests" is REJECTED.
- **premortem** (REQUIRED when riskLevel is "medium" or "high"): Object with: failureModes (array of ≥2 distinct failure scenarios each with cause+impact), mitigations (array), rollbackPlan (string describing how to revert safely).
- **leverage_rank**: Which dimension(s) from the EQUAL DIMENSION SET this improves
- **capacityDelta** (REQUIRED): Finite number ∈ [-1.0, 1.0] — expected net change in system capacity if this plan succeeds. Positive = capacity gain, negative = capacity regression, zero = neutral. Used for plan ranking.
- **requestROI** (REQUIRED): Positive finite number — expected return-on-investment for the premium request consumed (e.g., 2.0 = doubles value spent). Used for plan ranking.

## PACKET FIELD ENFORCEMENT RULES
These rules are enforced by the quality gate. Violations cause plan rejection:
1. **target_files**: Must list real existing paths verbatim from EXISTING REPOSITORY FILES. Do not invent module names. For new files, include the parent module path as the first entry.
2. **before_state**: Must describe observable current behavior — cite the actual function name, variable, or code gap. "Current state is suboptimal" is rejected.
3. **after_state**: Must describe what is measurably different — not a restatement of the title or before_state negation.
4. **verification**: Must name a specific test file (e.g., tests/core/foo.test.ts) plus an expected test name or exact log assertion. "npm test" alone is always rejected.
5. **acceptance_criteria**: ≥2 items, each a concrete testable statement. Every item must be independently verifiable.
6. **riskLevel + premortem**: Any task modifying orchestration paths, plan parsing, or dispatch logic is automatically high-risk and requires a compliant premortem.
7. **requestBudget**: Compute byWave and byRole from actual plan distribution. Never emit _fallback:true. byWave and byRole arrays must not be empty if plans exist.
8. **capacityDelta + requestROI**: Both are REQUIRED on every plan. Omitting either causes plan rejection by the contract validator.

Write the entire response in English only.
If you include recommendations, rank them by capacity-increase leverage, not by fear or surface risk alone.
Security or governance recommendations must explain how they contribute to capacity increase rather than being presented as the default center of gravity.
You MUST emit a structured JSON companion block at the end of your response.
The JSON block must contain all of the following fields:
{
  "projectHealth": "<healthy|warning|critical>",
  "totalPackets": <number>,
  "requestBudget": {
    "estimatedPremiumRequestsTotal": <number>,
    "errorMarginPercent": <number>,
    "hardCapTotal": <number>,
    "confidence": "low|medium|high",
    "byWave": [{ "wave": <n>, "planCount": <n>, "roles": ["..."], "estimatedRequests": <n> }],
    "byRole": [{ "role": "...", "planCount": <n>, "estimatedRequests": <n> }]
  },
  "executionStrategy": {
    "waves": [{ "wave": <n>, "tasks": ["..."], "dependsOnWaves": [], "maxParallelWorkers": <n> }]
  },
  "plans": [{
    "title": "...",
    "task": "...",
    "owner": "...",
    "role": "...",
    "wave": <number>,
    "scope": "...",
    "target_files": ["..."],
    "before_state": "...",
    "after_state": "...",
    "riskLevel": "low|medium|high",
    "dependencies": [],
    "acceptance_criteria": ["...", "..."],
    "verification": "tests/core/foo.test.ts — test: expected description",
    "premortem": null,
    "capacityDelta": <number ∈ [-1.0, 1.0]>,
    "requestROI": <positive number>
  }]
}
Do NOT omit target_files, before_state, after_state, scope, acceptance_criteria, capacityDelta, or requestROI from any plan entry.
Do NOT emit requestBudget with _fallback:true — compute byWave and byRole from the actual plan list.
Keep diagnostic findings in analysis or strategicNarrative and include only actionable redesign work in plans.
Wrap the JSON companion with markers:

===DECISION===
{ ...optional companion json... }
===END===