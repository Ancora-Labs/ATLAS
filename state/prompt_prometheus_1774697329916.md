TARGET REPO: CanerDoqdu/Box
REPO PATH: C:\Users\caner\Desktop\Box

## OPERATOR OBJECTIVE
STRATEGIC BRIEF — Parser Recovery and Gate Consolidation

System is in a critical planning stall. Parser confidence = 0.5 (degrading), plans produced = 0 last cycle. CI is green on HEAD but the planning pipeline cannot produce work items. This must be fixed before any further feature work.

## Context

Five PRs merged in rapid succession (2026-03-28T07:38 to 09:40):
- PR #126: feat(drift) — debt prioritization, deduplication, gate semantics
- PR #127: feat — T1/T2/T3 adversarial replay corpus, ROI persistence, dispatch command gate
- PR #128: feat — sustained SLO breach signatures → bounded retune recommendations
- PR #129: feat(gate) — promote repeated unresolved lessons to hard gate policies with explicit reason codes
- PR #130: test — expand integration coverage, lock artifact and env-contract regressions

There was a CI failure on commit 112c97a (immediately before PR #130 merged at 09:40). PR #130 was the stabilization attempt. Current HEAD (5de6599) is green.

## Priority 1 — Parser Confidence Recovery (BLOCKING)

Identify which source files or modules are producing low parse confidence. The parser confidence metric is at 0.5 and degrading — this is the direct reason plans produced = 0. Specifically:
- Analyze src/ for modules that were heavily modified by PRs 126–129
- Identify any structural complexity (deeply nested conditionals, overlapping type definitions, implicit contracts) introduced by these PRs that could degrade parser confidence
- Recommend targeted, minimal simplifications — NOT broad refactors
- Focus especially on gate/policy modules and SLO signature handling, as these were the most active change areas
- Deliverable: a concrete list of files + specific structural issues + proposed fixes that will restore parser confidence above 0.7

## Priority 2 — Gate/Policy Layer Audit

Four consecutive PRs (126–129) modified overlapping gate and policy semantics. Now that all four have merged, audit the consolidated state:
- Look for duplicate reason code definitions across gate types
- Identify conflicting or redundant gate condition logic (hard gate vs dispatch gate vs debt gate)
- Find dead code from superseded implementations
- Check naming consistency across gate modules
- Deliverable: a consolidation plan — identify redundancies and propose minimal, safe removals. This is an audit + cleanup task, not a redesign.

## Priority 3 — Integration Contract Hardening

PR #130 locked artifact and env-contract regressions after a CI failure. Verify:
- The regression guards in the test suite are comprehensive and cover the contracts introduced by PRs 126–129
- The contracts themselves are explicitly typed/documented rather than implicit
- Any env-contract gaps that the CI failure on 112c97a exposed are now fully addressed
- Deliverable: assessment of contract coverage completeness and any remaining gaps

## Anti-Goals

- Do NOT propose new features
- Do NOT touch adversarial replay corpus or ROI persistence (PR #127) — new, sensitive, not yet a diagnosed problem source
- Do NOT propose broad architectural refactors
- Do NOT propose changes to CI infrastructure unless directly necessary for parser recovery

## Expected Deliverables from Prometheus

1. Root cause identification for parser confidence degradation (specific files, specific issues)
2. Concrete remediation plan for parser recovery (minimal, targeted changes)
3. Gate/policy consolidation audit results
4. Integration contract coverage assessment

The system cannot resume effective autonomous delivery until the parser layer is stable. This is the single most important work item.

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