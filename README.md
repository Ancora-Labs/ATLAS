# BOX

`BOX` is a repo-agnostic orchestration runtime for autonomous software delivery.
It scans a project, plans tasks, runs isolated workers, and enforces quality gates before merge decisions.

## For Humans (Short + Honest)

BOX is like that teammate who keeps shipping while everyone else is in a coffee break: it finds issues, plans work, opens branches, runs tests, and preps PRs. It turns the classic "quick look" that usually costs two hours into a cleaner, lower-drama workflow with fewer browser tabs.

## AI Handshake (Machine-Readable)

```yaml
project:
    name: BOX
    runtime: nodejs-esm
    purpose: autonomous software delivery orchestrator
entrypoints:
    once: npm run box:once
    daemon: npm run box:start
    worker: node src/workers/run_task.js
required_env:
    - GITHUB_TOKEN
    - TARGET_REPO
optional_env:
    - COPILOT_CLI_COMMAND
core_modules:
    - src/core/orchestrator.js
    - src/core/task_planner.js
    - src/core/task_queue.js
    - src/core/policy_engine.js
    - src/core/budget_controller.js
    - src/core/checkpoint_engine.js
providers:
    coder:
        - src/providers/coder/copilot_cli_provider.js
        - src/providers/coder/fallback_provider.js
    reviewer:
        - src/providers/reviewer/claude_reviewer.js
state_files:
    - state/tasks.json
    - state/project_summary.json
    - state/budget.json
    - state/progress.txt
    - state/tests.json
    - state/copilot_usage.json
    - state/copilot_usage_monthly.json
docker:
    worker_image: box-worker:local
    dockerfile: docker/worker/Dockerfile
quality_gates:
    - tests
    - policy
    - budget
    - reviewer_approval
license:
    file: LICENSE
    commercial_use: prohibited
```

## Quick Start

1. Copy `.env.example` to `.env` and fill required values.
2. Install dependencies.

```bash
npm install
```

3. Build worker image.

```bash
docker build -t box-worker:local -f docker/worker/Dockerfile .
```

4. Run one cycle.

```bash
npm run box:once
```

5. Run daemon loop.

```bash
npm run box:start
```

## Operational Notes

- `GITHUB_TOKEN` and `TARGET_REPO` are required for real repository operations.
- `COPILOT_CLI_COMMAND` can be set per platform in `.env`.
- Claude is used on critical planning/review paths by default.
- Reviewer responses are validated via structured JSON + retry flow.
- Tune behavior in `box.config.json` (for example: `claude.thinking`, `claude.reviewMaxRetries`).

## Copilot Model Strategy

- Default strategy is `task-best`.
- Normal execution uses 1x models from `preferredModelsByTaskKind`.
- `Claude Opus 4.6` (3x) is used only if team-lead review explicitly allows escalation.
- `Claude Opus 4.6 (fast mode) (preview)` is blocked via `neverUseModels`.
- `COPILOT_ALLOW_OPUS=false` disables heuristic escalation.
- Opus escalation requires all gates: team-lead approval, `opusMinBudgetUsd`, and `opusMonthlyMaxCalls`.

## Prompts, Agents, and Routing

- Prompt files: `.github/prompts/*.prompt.md`
- Agent profiles: `.github/agents/*.md`
- Included agents: `box-team-lead`, `box-coder`
- Task-to-agent routing: `copilot.taskKindRouting` in `box.config.json`
- Parallel dispatch limit: `maxParallelWorkers`

## Docker Behavior

- Worker containers run as ephemeral jobs via `docker run --rm`.
- Containers may finish too quickly to notice in Docker Desktop UI.
- Worker image name should be `box-worker:local`.
- Successful task branches are pushed and can auto-create PRs (`git.autoCreatePr=true`).

## Architecture

```text
BOX Core (orchestrator daemon)
    |- Project Scanner
    |- Task Planner
    |- Policy Engine
    |- Task Queue
    |- Budget Controller
    |- Checkpoint Engine
                    |
                    +--> Coder Worker (Copilot)
                    +--> Reviewer Worker (Claude flow)
                    +--> Test Worker (Jest/Playwright)
                    +--> Refactor Worker
                                        |
                                        +--> Docker Pool
                                        +--> Git Manager (branch/commit/push/PR)
                                        +--> GitHub Repo
```
