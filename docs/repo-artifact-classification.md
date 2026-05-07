# Repo Artifact Classification

Purpose: classify repository contents before cleanup so active runtime state is preserved and future generated files land in predictable buckets.

## Classification Labels

- `authoritative`: required for current runtime, source-of-truth code, or the active target session
- `historical`: useful for audit, replay, or previous decisions, but not needed in the hot path
- `stale/remove`: disposable debug output, temporary probes, duplicate generated logs, or obsolete scratch artifacts

## Hard Protection Rules

Do not delete or rewrite these during cleanup unless there is an explicit migration plan.

- `src/`, `tests/`, `scripts/`, `docker/`, `public/`
- `package.json`, `package-lock.json`, `tsconfig*.json`, `eslint.config.ts`, `box.config.json`, `policy.json`, `docker-compose.yml`, `ecosystem.config.cjs`
- `state/active_target_session.json`
- `state/open_target_sessions.json`
- `state/projects/target_atlas/sess_20260424090112_a4d8cf/**`
- any file under `state/projects/**/runtime/` for the active target session
- target workspace source tree under `.box-target-workspaces/box/targets/target_atlas/sess_20260424090112_a4d8cf/`

## Root Classification

### Root Authoritative

- `.github/`
- `.vscode/`
- `src/`
- `tests/`
- `scripts/`
- `docker/`
- `public/`
- `docs/` only for currently-used architecture, governance, and operator references
- `README.md`
- `package.json`
- `package-lock.json`
- `box.config.json`
- `policy.json`
- `tsconfig.json`
- `tsconfig.typecheck.json`
- `eslint.config.ts`
- `docker-compose.yml`
- `ecosystem.config.cjs`
- `.env.example`

### Root Historical

- `.box-work/`
- `.box-evolution-prompt-cache-lineage/`
- `docs/atlas-*-brief.md`
- `docs/*migration-plan.md`
- `docs/*-matrix.md`
- `docs/new-architecture-diagrams.md`
- `docs/autonomous-architecture-v2.md` when superseded by newer architecture docs but still useful for history
- ad hoc build evidence logs that document a shipped fix and are intentionally referenced from a PR or incident note

### Root Stale/Remove

- `tmp_*`
- `*_baseline.log`
- `*_after.log`
- `*_current.log`
- `*_raw.log`
- `*_output.txt`
- `lint_*.log`
- `test_*.log`
- one-off probe files like `tmp_synth_check.mts`, `tmp_batch_probe.mts`, `tmp_apply_onboarding_packet.ts`
- transient research folders such as `tmp_research/`, `tmp_research_fetches/`, `tmp_evolution_worktree/`, `tmp_log_context_validation/`

## State Classification

### State Authoritative

- `state/active_target_session.json`
- `state/open_target_sessions.json`
- `state/projects/<active-project>/<active-session>/**`
- `state/projects/<active-project>/<active-session>/target_session.json`
- `state/projects/<active-project>/<active-session>/prometheus_analysis.json`
- `state/projects/<active-project>/<active-session>/research_synthesis.json`
- `state/projects/<active-project>/<active-session>/runtime/dispatch_checkpoint.json`
- `state/projects/<active-project>/<active-session>/runtime/worker_sessions.json`
- `state/projects/<active-project>/<active-session>/runtime/athena_plan_review.json`
- `state/session_runners/**` for currently-alive session runners only
- `state/platform/**`
- `state/pipeline_progress.json`
- `state/worker_sessions.json` if still read by current runtime code
- `state/jesus_directive.json`
- `state/prometheus_analysis.json` when used as current non-target or compatibility state
- `state/research_synthesis.json` when used as current non-target or compatibility state

### State Historical

- `state/archive/**`
- previous session folders under `state/projects/**/sess_*` that are not active
- `state/benchmark_ground_truth.json`
- `state/cycle_analytics.json`
- `state/premium_usage_log.json`
- `state/intervention_optimizer_log.jsonl`
- `state/governance_gate_audit.jsonl`
- `state/reroute_history.jsonl`
- `state/jesus_outcome_ledger.jsonl`
- `state/research_scout_yield_log.jsonl`
- `state/carry_forward_replay_evidence.jsonl`
- `state/intervention_retirement_evidence.jsonl`
- `state/rollback_incidents.jsonl`
- `state/retry_metrics.jsonl`
- `state/wave_boundary_idle.jsonl`
- `state/boundary_checkpoint_*.json`
- `state/prompt_*.md`
- `state/onboarding_terminal_*.txt`
- `state/onboarding_terminal_*.json`
- `state/*_manifest*.json`
- `state/*_report*.json`
- `state/*_transcript*.txt`

### State Stale/Remove

- `state/box_run_output.txt`
- `state/critical_watch.log`
- `state/cycle_fresh_run*.log`
- `state/evo_run_latest.log`
- `state/integration_worker_*.log`
- `state/missing_files_scan.txt`
- `state/random_scout_raw.txt`
- `state/resume_*.log`
- `state/live_agents.log` only if superseded and not used by tooling
- `state/leadership_live.txt` and `state/leadership_thinking.txt` when they are debug leftovers rather than current runtime inputs
- duplicate scratch outputs under `state/tmp_*`
- old `boundary_checkpoint_verification_*` and `boundary_checkpoint_attempt_*` once archived by retention policy

## Docs Classification

### Docs Authoritative

- `docs/architecture-map.md`
- `docs/governance_contract.md`
- `docs/failure_taxonomy.md`
- `docs/prometheus.md`
- `docs/single-target-startup-requirements.md`
- `docs/autonomous-dev-playbook.md`
- `docs/diagrams/README.md`

### Docs Historical

- `docs/atlas-desktop-gui-intent-brief.md`
- `docs/atlas-single-target-direction-brief.md`
- `docs/atlas-single-target-extraction-map.md`
- `docs/atlas-public-migration-plan.md`
- `docs/atlas-interface-product-spec.md`
- `docs/atlas-direct-import-matrix.md`
- `docs/atlas-dependency-trim-matrix.md`
- `docs/typescript-migration-plan.md`
- `docs/new-architecture-diagrams.md`

### Docs Stale/Remove

- duplicate brief/spec docs once their surviving authoritative replacement is identified
- any markdown file whose content is fully superseded and never referenced by current scripts, runtime, or operator workflow

## Retention Policy

### Authoritative

- keep in-place
- allow normal edits
- generated authoritative state must write into canonical paths only

### Historical

- move to an explicit archive surface instead of leaving it in the hot path
- preferred locations:
  - `docs/archive/<yyyy-mm>/...`
  - `state/archive/<yyyy-mm>/...`
- add a short provenance note when archiving if the filename is vague

### Stale/Remove

- safe to delete after quick spot-check that no runtime code or docs reference it
- prefer pattern-based cleanup instead of file-by-file manual deletion

## Future Guardrails

To stop new clutter from piling up in the root:

- scratch files must go under `tmp/` or `state/tmp/`, not repo root
- one-off logs must go under `artifacts/debug/` or `state/archive/debug/`
- historical prompts and boundary checkpoints should roll into dated archive folders
- session manifests and transcripts should write under the owning session folder, not top-level `state/`
- docs should declare one of three intents in the header or filename: `authoritative`, `historical`, or `draft`

## First Cleanup Pass

Low-risk first pass:

- remove root `tmp_*` files
- remove root ad hoc `*_output.txt` and `*_raw.log` files
- move old state `boundary_checkpoint_*`, `prompt_*.md`, and onboarding terminal transcripts into `state/archive/<yyyy-mm>/`
- keep the active target session and its runtime subtree untouched

## Low-Risk Cleanup Map

Use these three lists for the first real cleanup pass.

### Safe Delete

- root `tmp_*`
- root ad hoc outputs such as `*_output.txt`, `*_raw.log`, `*_current.log`, `*_after.log`, `*_baseline.log`
- root one-off probes like `tmp_synth_check.mts`, `tmp_batch_probe.mts`, `tmp_apply_onboarding_packet.ts`
- transient research or scratch folders such as `tmp_research/`, `tmp_research_fetches/`, `tmp_evolution_worktree/`, `tmp_log_context_validation/`
- `state/box_run_output.txt`
- `state/critical_watch.log`
- `state/cycle_fresh_run*.log`
- `state/evo_run_latest.log`
- `state/integration_worker_*.log`
- `state/missing_files_scan.txt`
- `state/random_scout_raw.txt`
- `state/resume_*.log`
- duplicate scratch files under `state/tmp_*`

### Archive

- `state/boundary_checkpoint_attempt_*`
- `state/boundary_checkpoint_planner_*`
- `state/boundary_checkpoint_reviewer_*`
- `state/boundary_checkpoint_verification_*`
- `state/prompt_*.md`
- `state/onboarding_terminal_*.txt`
- `state/onboarding_terminal_*.json`
- `state/*_manifest*.json` that are not the active session manifest
- `state/archive/completed_sessions.jsonl` remains authoritative as archive index; append to it, do not flatten it
- previous non-active session folders under `state/projects/**/sess_*`
- `docs/atlas-*-brief.md`
- `docs/*migration-plan.md`
- `docs/*-matrix.md`
- `docs/new-architecture-diagrams.md`
- `docs/atlas-interface-product-spec.md`

### Do Not Touch

- `src/`, `tests/`, `scripts/`, `docker/`, `public/`, `.github/`, `.vscode/`
- `package.json`, `package-lock.json`, `box.config.json`, `policy.json`, `tsconfig*.json`, `eslint.config.ts`, `docker-compose.yml`, `ecosystem.config.cjs`
- `state/active_target_session.json`
- `state/open_target_sessions.json`
- `state/pipeline_progress.json`
- `state/jesus_directive.json`
- `state/prometheus_analysis.json`
- `state/research_synthesis.json`
- `state/athena_plan_review.json`
- `state/worker_sessions.json` while compat readers still exist
- `state/projects/target_atlas/sess_20260424090112_a4d8cf/**`
- all files under `state/projects/target_atlas/sess_20260424090112_a4d8cf/runtime/`
- the active target workspace under `.box-target-workspaces/box/targets/target_atlas/sess_20260424090112_a4d8cf/`
