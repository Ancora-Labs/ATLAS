TARGET REPO: CanerDoqdu/Box
REPO PATH: C:\Users\caner\Desktop\Box

## OPERATOR OBJECTIVE
Standalone run requested by user: deeply analyze the repository and produce a self-evolution master plan focused on how BOX can evolve itself, improve Prometheus planning quality, redesign worker behavior, deepen model utilization, strengthen learning loops, and increase long-term capability per premium request. Security and governance are supporting concerns, not the main objective.

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
- researchCoverageTarget: 12
- Do NOT create extra waves without explicit task-level dependsOn/dependencies evidence.
- Avoid single-task waves unless dependency constraints force them.

## BUNDLED WORK PACKAGES — MANDATORY
Each plan packet you produce is ONE AI worker call consuming the model's FULL context window (~160k tokens for Claude Sonnet, ~400k for GPT-5 Codex). A single-sentence task is a catastrophic waste of this capacity.

RULE: Every packet MUST contain enough work to justify a full AI context call. This means:
1. GROUP related sub-tasks into a single packet. If you find 5 small fixes in the same area (e.g. budget_controller.ts, worker_batch_planner.ts), bundle ALL of them into ONE packet with ordered steps.
2. A packet's task field must describe a COMPLETE feature or improvement area, not a single micro-fix. Use the format: "Implement [AREA]: [step1], [step2], [step3], ..." listing all concrete sub-tasks.
3. TARGET 3-5 packets per cycle maximum. More packets = more premium requests = more cost. If you are producing more than 5 packets, you are splitting too granularly — merge them.
4. Each packet's scope should cover multiple related files and multiple related behaviors. A packet touching only 1 file for 1 change is too small.
5. EXCEPTION: Only create separate packets when there is a HARD dependency ordering requirement (wave N+1 needs wave N's output). File conflicts are NOT a reason to split — the worker handles sequential execution.

WRONG: 5 separate single-sentence packets for small fixes in the same subsystem.
CORRECT: 1 packet titled "Harden budget/batch subsystem: [fix1], [fix2], [fix3], [fix4], [fix5]" with all steps in the task field.

- QUALITY OVER QUANTITY: Produce fewer, deeper, more original packets rather than many shallow or repetitive ones. Each plan must address a genuinely NEW capability gap not covered in previous cycles. Do NOT reproduce plans with the same task theme as completed or carry-forward items.
- VERIFICATION DISCIPLINE: Every plan must have a concrete, runnable verification command. Avoid verification steps that require manual inspection, long waits, or external services — these inflate cycle time. Target sub-5-minute automated verification wherever possible.
- ORIGINALITY: Before outputting a plan, ask yourself: has this theme appeared in recent cycles? If yes and it is not resolved, produce a DIFFERENT angle of attack rather than restating the same plan. Novelty is mandatory.
- If EXTERNAL RESEARCH INTELLIGENCE is present, convert unresolved high-confidence topics into actionable packets (with concrete target_files + verification), not vague notes.
- If ACCUMULATED TOPIC KNOWLEDGE is present, leverage all accumulated knowledge from previous runs to produce deeper, more informed plans. Do NOT re-research topics marked as completed.

## STRUCTURAL CORRECTNESS — LEARN THESE PATTERNS
Athena rejects structurally broken packets every cycle. Don't repeat these mistakes:

### dependencies — use EXACT packet titles, never aliases
WRONG: "dependencies": ["routing fix", "the caching task", "step 2"]
CORRECT: "dependencies": ["Convert rolling-yield hard block into adaptive throttle with per-model cooldown windows"]
Rule: The dependency string must be the EXACT value of the 'title' field in another packet in this output. If you cannot find an exact match, leave dependencies empty.

### acceptance_criteria — every item MUST contain a numeric threshold
WRONG: "acceptance_criteria": ["tests pass", "performance improves", "no errors in logs"]
CORRECT: "acceptance_criteria": ["All existing unit tests pass (npx tsc --noEmit exits 0)", "P95 latency < 200ms on 1000-request load test", "Zero new TypeScript errors (grep -c 'error TS' = 0)"]
Rule: Each criterion must be independently verifiable with a concrete command AND a numeric pass/fail threshold.

### wave assignments — tasks with dependencies must be in a later wave
WRONG: task A in wave 1, task B in wave 1, task B depends on task A
CORRECT: task A in wave 1, task B in wave 2 (because B depends on A)
Rule: If task X lists task Y in dependencies, X must have a strictly higher wave number than Y.

## EXTERNAL RESEARCH INTELLIGENCE
Research signal available for this cycle: 83 topic(s), 17 source(s).

Research coverage target: 12 research-backed packet(s) when materially applicable.
Do NOT ignore this section. For each high-confidence unresolved topic, either:
1) produce an actionable packet with concrete target_files and verification, or
2) state that it is already implemented and cite exact file evidence in before_state/after_state.

All research topics:
1. List directory src
2. Agent Evaluation Infrastructure & Anti-Confounding
3. LLM Routing & Budget-Constrained Inference
4. Agent Safety, Guardrail Robustness & Long-Horizon Attack Resistance
5. Agent Memory Systems — Persistent, Graph-Structured, Selective
6. Tool-Use, Trajectory Fidelity & Repository-Level Verification
7. evaluation
8. generalization
9. benchmarking
10. autonomous-agents
11. General Agent Evaluation
12. evaluation-harness
13. leaderboard
14. reproducibility
15. Holistic Agent Leaderboard: The Missing Infrastructure for AI Agent Evaluation
16. coding-agents
17. benchmark-quality
18. human-validation
19. software-delivery
20. SWE-bench Verified
21. eval-framework
22. regression-testing
23. model-upgrades
24. private-evals
25. OpenAI Evals (README)
26. evaluation-frameworks
27. confounders
28. agent-benchmarks
29. The Necessity of a Unified Framework for LLM-Based Agent Evaluation
30. tool-use
31. trajectory-evaluation
32. agent-reliability
33. TRAJECT-Bench: A Trajectory-Aware Benchmark for Evaluating Agentic Tool Use
34. constrained-tool-use
35. instruction-following
36. self-refinement
37. CCTU: A Benchmark for Tool Use under Complex Constraints
38. online-learning
39. model-routing
40. contextual-bandits
41. cost-aware
42. Reward-Based Online LLM Routing via NeuralUCB
43. routing
44. preference-learning
45. dueling-bandits
46. LLM Routing with Dueling Feedback
47. safety
48. long-horizon
49. adversarial-evaluation
50. governance
51. AgentLAB: Benchmarking LLM Agents against Long-Horizon Attacks
52. guardrails
53. jailbreaks
54. adversarial-security
55. Bypassing LLM Guardrails: An Empirical Analysis of Evasion Attacks against Prompt Injection and Jailbreak Detection Systems
56. guardrail-security
57. black-box-attacks
58. reverse-engineering
59. Black-Box Guardrail Reverse-engineering Attack
60. memory
61. knowledge-graphs
62. long-horizon-reasoning
63. taxonomy
64. Graph-based Agent Memory: Taxonomy, Techniques, and Applications
65. memory-efficiency
66. forgetting
67. long-context
68. scalability
69. FadeMem: Biologically-Inspired Forgetting for Efficient Agent Memory
70. memory-interoperability
71. retrieval
72. subgraph
73. agent-architecture
74. MemAdapter: Fast Alignment across Agent Memory Paradigms via Generative Subgraph Retrieval
75. error-analysis
76. user-aware-metrics
77. diagnostics
78. Talk, Evaluate, Diagnose: User-aware Agent Evaluation with Automated Error Analysis
79. formal-verification
80. repository-level
81. code-agents
82. correctness
83. Towards Repository-Level Program Verification with Large Language Models

Source signals:
1. General Agent Evaluation — BOX needs to measure true cross-task autonomy (not benchmark overfitting), and this source directly targets that gap.
2. Holistic Agent Leaderboard: The Missing Infrastructure for AI Agent Evaluation — BOX can adopt a standardized harness to compare strategy/prompt/model changes across cycles without confounding factors.
3. SWE-bench Verified — BOX is an autonomous software delivery system, and SWE-bench Verified provides high-trust external ground truth for coding-agent quality.
4. OpenAI Evals (README) — Gives BOX a practical framework to gate model/prompt changes with repeatable eval suites and private task-specific datasets.
5. The Necessity of a Unified Framework for LLM-Based Agent Evaluation — Directly addresses benchmark confounders that can mislead BOX’s self-improvement loop.
6. TRAJECT-Bench: A Trajectory-Aware Benchmark for Evaluating Agentic Tool Use — BOX workers need not only correct final outputs, but correct action sequences; this benchmark evaluates trajectory fidelity explicitly.
7. CCTU: A Benchmark for Tool Use under Complex Constraints — BOX operates under policy/budget/test constraints; this benchmark mirrors constraint-heavy execution conditions.
8. Reward-Based Online LLM Routing via NeuralUCB — BOX can replace static routing with online bandit adaptation tied to observed task reward and cost.
9. LLM Routing with Dueling Feedback — BOX can learn routing from pairwise outcomes (A/B agent performance) without expensive absolute labeling.
10. AgentLAB: Benchmarking LLM Agents against Long-Horizon Attacks — BOX’s autonomous loops are long-horizon; this directly evaluates multi-turn attack susceptibility beyond single-prompt jailbreaks.
11. Bypassing LLM Guardrails: An Empirical Analysis of Evasion Attacks against Prompt Injection and Jailbreak Detection Systems — BOX governance cannot assume guardrail reliability; this gives evidence that detector evasion is practical.
12. Black-Box Guardrail Reverse-engineering Attack — BOX’s external-facing agents may leak policy boundaries; this highlights exploitability of observable guardrail behavior.
13. Graph-based Agent Memory: Taxonomy, Techniques, and Applications — BOX needs persistent, structured memory across cycles; this maps graph-memory design space for implementation choices.
14. FadeMem: Biologically-Inspired Forgetting for Efficient Agent Memory — BOX can reduce context bloat and token cost by adopting selective forgetting instead of all-or-nothing retention.
15. MemAdapter: Fast Alignment across Agent Memory Paradigms via Generative Subgraph Retrieval — BOX can unify heterogeneous memory modules (episodic/task/policy memory) without rewriting each retrieval stack.

Research gaps to address next (areas the Scout did NOT cover — generate packets for these):
The following important areas were **not covered** by this Scout cycle. Recommended for next cycle:

1. **Checkpoint and rollback strategies for long multi-step agents** — No source addressed how to checkpoint intermediate agent state at fine granularity (e.g., LangGraph's checkpoint-based persistence). BOX's `checkpoint_engine.ts` could benefit from a literature review of state-of-the-art approaches.

2. **Multi-agent coordination protocols** — No source covered inter-agent communication patterns (shared blackboard vs. message-passing vs. hierarchical delegation). BOX has multiple agents (Prometheus, workers, Athena, Medic, Jesus) but no research grounding for their coordination model.

3. **Prompt caching and KV-cache utilization** — BOX's `prompt_compiler.ts` has `markCacheableSegments` but no research backing on optimal cache partitioning strategies. No source addressed cache-aware prompt construction for long agentic workflows.

4. **Continual learning / online fine-tuning** — How to update model weights (not just prompts or routing) based on observed BOX task performance. Sources covered routing adaptation but not model-level adaptation.

5. **Formal specification of autonomous agent policies** — Sources 8 and 13 mention constraint-following and attack resistance, but no source covered formal specification languages or contract-based agent governance (e.g., TLA+, Alloy for policy specs). BOX's `governance_contract.ts` could benefit from this.

6. **Cost of self-improvement vs. capability gain empirics** — No source provided empirical data on the ROI of agent self-improvement cycles (how many cycles to measurably improve capability, at what cost). This is directly relevant to BOX's `evolution_metrics.ts` and hypothesis scheduling.

### FULL RESEARCH SYNTHESIS (Synthesizer output — read carefully)
● List directory src
  └ 8 files found

● List directory src\core
  └ 83 files found

● List directory src\providers
  └ 3 files found

● Read research_synthesizer.ts
  │ src\core\research_synthesizer.ts
  └ 296 lines read

● Read prometheus.ts
  │ src\core\prometheus.ts
  └ L1:60 (60 lines read)

---

# Research Synthesis — BOX Intelligence Report

**Date:** 2026-04-01
**Sources processed:** 20 *(note: task header stated 17; actual source list contains 20 entries — all 20 are included below)*
**Topics identified:** 5
**Ordered by:** BOX impact potential (highest first)

---

## Topic: Agent Evaluation Infrastructure & Anti-Confounding

**Net Findings:**
- Anthropic (Source 1) argues agent evals must be **trajectory-level**, not single-turn: they require task setup, tool access records, state transitions, and post-run verification hooks (e.g., unit tests as post-checks). Evals compound in value over the agent lifecycle.
- Sources 2 and 6 converge: most existing agent benchmarks are **confounded** by prompt wording, tool config, scaffolding design, and environment dynamics. They inflate apparent agent capability and mislead self-improvement loops.
- Source 3 (Holistic Agent Leaderboard) proposes treating **evaluation as infrastructure**: standardized orchestration for parallel runs, reproducible comparison across strategy/model/prompt changes, real-world task breadth.
- Source 5 (OpenAI Evals): supports **private custom eval suites** gating model/prompt version changes, enabling repeatable automated regression testing rather than manual spot checks.
- Source 6 explicitly warns that **static QA-style methods are insufficient** for LLM agents — success/fail over a flat test set does not capture behavioral degradation across dynamic multi-step workflows.
- Source 19 highlights that current agent systems rely on **brittle bespoke success checks**, and proposes scalable automated error-analysis that classifies failure modes (not just flags them), with user-aware evaluation criteria.

**Applicable Ideas for BOX:**
- BOX's current Prometheus→Athena evaluation loop produces pass/fail verdicts per cycle. **Replace or augment this with trajectory-level scoring**: log tool calls, state transitions, and intermediate decisions per worker run. Athena (`athena_reviewer.ts`) could score trajectory fidelity, not just final output diff.
- The `canary_engine.ts` / `canary_ledger.ts` system gates deployments but doesn't systematically classify *why* something failed. Integrate Source 19's **automated error-analysis orientation** — add a `failure_classifier.ts`-driven postmortem that buckets failures into classes (e.g., tool misuse, constraint violation, regression, flaky) and feeds them back into the `self_improvement.ts` loop.
- Add a **private eval registry** (modeled on OpenAI Evals, Source 5) inside `experiment_registry.ts` that stores task-specific golden trajectories. Before any Prometheus plan changes a prompt or worker config, run the relevant eval suite and gate on regression delta, not manual review.
- Use Source 3's principle: standardize BOX's benchmark runs as infrastructure — dedicated eval wave in `dag_scheduler.ts` that's always runnable in isolation, with locked environment snapshots to prevent confounders from leaking between cycles.
- `cycle_analytics.ts` currently tracks aggregate metrics. Extend it to track **per-task benchmark scores across cycles** so Prometheus can detect whether its self-evolution is improving or degrading measurable capability.

**Risks:**
- Trajectory-level eval dramatically increases logging and storage costs. Uncontrolled growth of trajectory logs could bloat `state/` and hit disk/context limits.
- Private eval suites can themselves become stale: if golden trajectories aren't updated when BOX's toolset or APIs change, they'll produce false regressions and block valid improvements.
- Parallel eval infrastructure (Source 3) adds orchestration complexity. Running it inside the same `dag_scheduler` that runs production tasks risks resource contention and eval result contamination.
- Confound-awareness (Source 6) is hard to enforce operationally — even with standardized harnesses, uncontrolled model version changes upstream can silently invalidate historical comparisons.

**Conflicting Views:**
- Sources 1 and 19 partially disagree on framing: Source 1 emphasizes **automated evals during development** to prevent reactive fixes. Source 19 emphasizes **user-aware evaluation criteria** oriented around deployment context. The tension is: development-time evals optimize for correctness; user-aware evals optimize for satisfaction/fit. For BOX (no human users in the loop), the development-time framing (Source 1) is the more actionable primary signal — but Source 19's error-classification layer is still additive.

**Confidence:** high
**Freshness:** 2025–2026

**Sources:**
- https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents
- https://arxiv.org/abs/2602.22953
- https://arxiv.org/abs/2510.11977
- https://raw.githubusercontent.com/openai/evals/main/README.md
- https://arxiv.org/abs/2602.03238
- https://arxiv.org/abs/2603.15483

---

## Topic: LLM Routing & Budget-Constrained Inference

**Net Findings:**
- Source 9 (RouterBench): no single model dominates all tasks; routing is a **cost/performance Pareto selection problem** across a heterogeneous model pool.
- Source 10 (NeuralUCB): **online bandit routing** using NeuralUCB adapts routing decisions using observed task reward signals and cost feedback, outperforming static or supervised-only routing in simulated RouterBench settings.
- Source 11 (Adaptive Routing under Budget): frames routing as **budget-constrained decision-making** — routing policy must respect hard token/cost envelopes while maximizing quality. Critiques approaches requiring full optimal labels for training; targets real-world incomplete feedback.
- Source 12 (Dueling Feedback): formulates routing using **contextual dueling bandits** — learns from pairwise A/B comparisons of agent outputs rather than absolute quality scores. Explicitly models cost, expertise fit, and user satisfaction.
- Sources 10, 11, 12 form a coherent progression: static routing → budget-constrained adaptive routing → preference-learning routing without expensive labeling.

**Applicable Ideas for BOX:**
- BOX's `model_policy.ts` and `budget_controller.ts` currently make model selection decisions at config/policy compile time (static). **Replace or augment with an online routing layer** that uses NeuralUCB or a simpler contextual bandit (Source 10) to select between premium/standard models per task type, learning from per-task outcomes stored in `carry_forward_ledger.ts` or `hypothesis_scorecard.ts`.
- Implement **budget-envelope routing** (Source 11): expose `budget_controller.ts` remaining budget as a hard constraint the routing policy must respect, not a soft warning. Tasks that arrive late in a budget cycle should automatically down-route to cheaper models without human intervention.
- For self-improvement hypothesis comparison (A vs B prompt/config), use **dueling-bandit evaluation** (Source 12) — compare two candidate worker configs on identical tasks and infer preference without needing absolute quality labels. This is significantly cheaper than building labeled ground truth for each hypothesis.
- Populate a routing table in `experiment_registry.ts` indexed by `(task_type, budget_remaining, model_pool)` → `(routing_decision, observed_reward)` tuples to feed the bandit's replay buffer.

**Risks:**
- Online bandit routing can converge to local optima if the reward signal is sparse or delayed (e.g., test failures discovered hours after model selection). Sparse feedback can cause the bandit to over-exploit cheap models.
- NeuralUCB requires a neural function approximator — adds a non-trivial runtime dependency and increases inference latency for the routing decision itself.
- A/B dueling routing (Source 12) requires running both candidate models on the same task, doubling cost during the exploration phase. This may conflict with hard budget limits.
- Budget-constrained routing (Source 11) was evaluated on simulated settings; real BOX tasks have bursty, unpredictable token consumption patterns that may violate stationarity assumptions.

**Conflicting Views:**
- Sources 10 and 12 address different feedback paradigms: Source 10 uses absolute reward (e.g., test pass rate) while Source 12 uses pairwise preference. For BOX, absolute reward (tests pass/fail) is readily available, which slightly favors Source 10's approach for primary routing. Source 12's pairwise framing is better suited for prompt/strategy comparison during self-improvement hypothesis evaluation, where absolute ground truth is harder to define.
- Source 11 critiques assumptions requiring full optimal labels (implicit disagreement with supervised routing baselines from Source 9), but RouterBench (Source 9) includes both supervised and bandit baselines without declaring a winner across all domains.

**Confidence:** high
**Freshness:** 2024–2026

**Sources:**
- https://arxiv.org/abs/2403.12031
- https://arxiv.org/abs/2603.30035
- https://arxiv.org/abs/2508.21141
- https://arxiv.org/abs/2510.00841

---

## Topic: Agent Safety, Guardrail Robustness & Long-Horizon Attack Resistance

**Net Findings:**
- Source 13 (AgentLAB): introduces a benchmark specifically for **long-horizon adversarial attacks** — multi-turn vulnerabilities that are infeasible to detect in single-prompt safety testing. User-agent-environment interaction across many steps creates emergent attack surfaces.
- Source 14 (Guardrail Bypass): empirically demonstrates practical bypasses of guardrail systems using **character injection, AML-style evasion, and adaptive perturbation**. Multiple commercial guardrail products were defeated, implying no single guardrail classifier is reliably safe.
- Source 15 (Black-Box Reverse Engineering): attackers can probe observable guardrail decision patterns to **reverse-engineer decision boundaries** without access to internals. The guardrail itself becomes an exploitable attack surface through probing.
- Sources 14 and 15 converge: single guardrail classifiers are insufficient. **Layered, diverse controls** and **dynamic policy randomization** are the appropriate countermeasures.

**Applicable Ideas for BOX:**
- BOX's `guardrail_executor.ts` currently implements a single-layer guardrail pass. **Add a layered defense stack**: at minimum, combine a classifier-based guardrail with a separate rule-based policy gate (`policy_engine.ts`) and an output schema validator (`plan_contract_validator.ts`) operating independently. No single layer should be a single point of failure.
- The `governance_freeze.ts` and `governance_canary.ts` modules gate deployments but don't simulate adversarial long-horizon sequences. **Add adversarial replay scenarios** to `resilience_drill.ts` that test multi-turn prompt injection across a full Prometheus→Worker→Athena cycle, not just individual node inputs.
- Based on Source 15: **avoid exposing consistent guardrail decision patterns** through observable outputs (e.g., standardized refusal messages). Consider randomizing refusal phrasing and adding noise to confidence thresholds in `guardrail_executor.ts` to prevent decision-boundary probing.
- Use the AgentLAB benchmark structure (Source 13) as a template for BOX's internal canary attack library in `canary_engine.ts`: build multi-turn attack scenarios that stress-test rollback gates across an entire autonomous cycle, not just per-step checks.
- The `self_dev_guard.ts` module is a critical enforcement point. Ensure it **cannot be bypassed** through a long-horizon prompt injection sequence by adding a rule-based hard limit (e.g., disallow self-modification of `self_dev_guard.ts` itself) that runs outside the LLM decision path.

**Risks:**
- Layered guardrails significantly increase per-request latency and cost. In high-throughput BOX cycles, this compounds across all worker invocations.
- Randomizing guardrail responses to prevent boundary probing may reduce interpretability for legitimate debugging — engineers will find it harder to reproduce and diagnose guardrail-triggered failures.
- Adversarial resilience testing (multi-turn attack replay) may surface false positives during normal operation if the boundary between attack simulation and real task execution isn't cleanly isolated.
- Source 14's bypass techniques are described in academic context; real attackers may have more sophisticated methods not covered. Guardrail improvement is inherently reactive.

**Conflicting Views:**
- Sources 14 and 15 imply different threat models: Source 14 focuses on **externally crafted adversarial inputs** reaching BOX through task descriptions or tool outputs. Source 15 focuses on **observable system behavior being reverse-engineered** by a persistent adversary. For BOX, both are relevant (external task injection is a real threat; internal behavior leakage through logs/APIs is also possible). Neither source prioritizes one over the other, but the mitigations are different and should both be addressed.

**Confidence:** high
**Freshness:** 2025–2026

**Sources:**
- https://arxiv.org/abs/2602.16901
- https://arxiv.org/abs/2504.11168
- https://arxiv.org/abs/2511.04215

---

## Topic: Agent Memory Systems — Persistent, Graph-Structured, Selective

**Net Findings:**
- Source 16 (Graph-based Memory Taxonomy): positions **graph-structured memory** as superior to flat key-value or vector stores for relational, long-horizon reasoning. Provides a taxonomy: episodic memory (past events), semantic memory (domain knowledge), procedural memory (learned behaviors). Graph edges capture dependencies that flat stores cannot.
- Source 17 (FadeMem): the core tradeoff in long-running agents is **memory overload vs. catastrophic forgetting**. FadeMem proposes biologically-inspired **adaptive decay** — entries lose salience over time but can be reinforced by repeated access, preventing context bloat while retaining actionable knowledge.
- Source 18 (MemAdapter): addresses **fragmentation across memory paradigms** (explicit/parametric/latent). Proposes generative subgraph retrieval to align memory reads across different storage backends without rewriting each retrieval stack.
- Sources 16, 17, 18 together form a full memory architecture picture: graph structure (16) + adaptive forgetting (17) + interoperability across heterogeneous stores (18).

**Applicable Ideas for BOX:**
- BOX currently persists state via flat JSON files (`state/` directory, `state_tracker.ts`, `carry_forward_ledger.ts`). **Replace carry-forward and lesson storage with a graph-structured memory** (Source 16): nodes are tasks/hypotheses/lessons; edges encode dependencies (e.g., "lesson X was derived from task Y which blocked task Z"). This makes cross-cycle reasoning by Prometheus structurally richer.
- Implement **adaptive forgetting** (Source 17 / FadeMem) in `lesson_halflife.ts` (which already exists as a module): rather than simple time-decay, apply recency + access-frequency weighting so frequently referenced lessons resist forgetting while stale one-off lessons decay automatically. This directly limits context bloat in Prometheus's planning prompt.
- `lineage_graph.ts` already exists and tracks task lineage. **Extend it to serve as the memory graph backend**: add episodic nodes (past failures, successful patterns) and procedural nodes (learned strategies), connected via typed edges. This turns an existing module into the graph-memory foundation without a full rewrite.
- Use MemAdapter's **generative subgraph retrieval** (Source 18) as a model for `carry_forward_ledger.ts` reads: instead of loading the full carry-forward set into every Prometheus prompt, generate a task-relevant subgraph query and retrieve only structurally relevant prior knowledge.

**Risks:**
- Graph-structured memory is harder to inspect, debug, and audit than flat JSON files. If `lineage_graph.ts` becomes the source of truth for Prometheus decisions, graph corruption or inconsistent edges could silently degrade planning quality.
- Adaptive forgetting (FadeMem) relies on decay parameters that may require tuning per BOX's cycle frequency. Incorrect decay rates could cause important lessons to be forgotten before they've been operationalized in policy.
- Generative subgraph retrieval (Source 18) is more complex than key-lookup and introduces latency in the Prometheus prompt build phase. For long graphs, retrieval quality depends heavily on the embedding model's alignment with BOX's task domain.
- All three memory papers are arXiv-stage — none are production libraries. Implementing them requires significant original engineering with uncertain reliability in production settings.

**Conflicting Views:**
- Sources 16 and 17 represent somewhat different priorities: Source 16 emphasizes **richness of representation** (graph edges, relational structure). Source 17 prioritizes **cost efficiency** (forgetting aggressively to keep context manageable). These can conflict: a dense graph with many retained nodes provides richer Prometheus context but violates FadeMem's efficiency goal. The right balance depends on BOX's typical cycle length and prompt budget.

**Confidence:** medium
**Freshness:** 2026

**Sources:**
- https://arxiv.org/abs/2602.05665
- https://arxiv.org/abs/2601.18642
- https://arxiv.org/abs/2602.08369

---

## Topic: Tool-Use, Trajectory Fidelity & Repository-Level Verification

**Net Findings:**
- Source 7 (TRAJECT-Bench): existing benchmarks score end answers, not action sequences. TRAJECT-Bench evaluates **tool selection, parameterization ordering, and call sequencing** — the trajectory — as a first-class metric. Introduces trajectory-level diagnostics for agent failure attribution.
- Source 8 (CCTU): extends trajectory evaluation to **constraint-heavy execution** — tasks where function calls must satisfy complex explicit constraints simultaneously (instruction following, constraint adherence, self-refinement). Directly mirrors BOX's policy/budget/test-gated execution environment.
- Source 4 (SWE-bench Verified): human-validated 500-task coding subset that reduces benchmark noise by verifying problem clarity, test correctness, and task solvability before inclusion. Documents setup/version comparability caveats critical for longitudinal tracking.
- Source 20 (Repository-Level Verification): LLM-based verification at repository scale requires **handling cross-module dependencies** — function-level verification is insufficient for real projects. Identifies global-context handling as the key bottleneck. Directly targets Athena-grade post-edit correctness gating.

**Applicable Ideas for BOX:**
- BOX workers produce diffs; `athena_reviewer.ts` reviews them. Currently, review is diff-centric, not trajectory-centric. **Add trajectory logging to `worker_runner.ts`**: record every tool call (shell, edit, read) in order, with parameters and outcomes. Feed this to Athena as trajectory context, not just the diff. This enables TRAJECT-Bench-style scoring of whether the worker's action sequence was efficient and correct, not just whether the final output passed tests.
- Use CCTU (Source 8) as a design template for BOX's worker eval suite: construct test tasks that require workers to satisfy **multiple simultaneous constraints** (e.g., fix bug + respect lint rules + stay within token budget + avoid touching protected files). This directly stresses test constraint compliance under realistic conditions.
- Adopt SWE-bench Verified's **validation methodology** (Source 4) for BOX's internal task backlog: before adding a task to the evaluation benchmark set, verify it has clear acceptance criteria, unambiguous success tests, and is actually solvable. This prevents benchmark contamination by poorly-specified tasks inflating or deflating Prometheus's self-assessment.
- `verification_gate.ts` currently applies per-command verification. Extend it using Source 20's findings to perform **cross-module dependency analysis** post-edit: after a worker modifies files, the gate should resolve dependent modules (via `dependency_graph_resolver.ts`) and verify that cross-module contracts are not broken, not just that the modified file's tests pass.

**Risks:**
- Trajectory logging adds overhead to every worker invocation. For large batches (many workers in parallel), the volume of trajectory data could exceed state storage limits and degrade dashboard and Athena performance.
- SWE-bench Verified's task validation process (Source 4) is human-labor-intensive as originally designed. Automating the validation step (to make it scalable for BOX) risks re-introducing the noise it was designed to eliminate.
- Repository-level formal verification (Source 20) identified **global-context handling** as the key bottleneck — this is exactly BOX's context budget pressure point. Athena already operates at the edge of context limits; adding cross-module dependency verification may exceed those limits for large repos.
- Trajectory-level scoring requires defining what constitutes an "optimal" trajectory for a given task — this is non-trivial and potentially subjective. Penalizing "inefficient but correct" trajectories could discourage valid worker exploration strategies.

**Conflicting Views:**
- Sources 7 and 8 both target trajectory evaluation but differ in emphasis: Source 7 focuses on **observational fidelity** (did the agent do the right actions in the right order?). Source 8 focuses on **constraint compliance** (did the agent satisfy all constraints simultaneously?). For BOX, both dimensions matter, but they require different scoring mechanisms. Source 7 is more relevant to `worker_runner.ts` diagnostics; Source 8 is more relevant to `verification_gate.ts` and `guardrail_executor.ts`.

**Confidence:** high (Sources 4, 7, 8); medium (Source 20 — arXiv-stage)
**Freshness:** 2025 (Sources 4, 7, 20); 2026 (Source 8)

**Sources:**
- https://arxiv.org/abs/2510.04550
- https://arxiv.org/abs/2603.15309
- https://www.swebench.com/verified
- https://arxiv.org/abs/2509.25197

---

## Cross-Topic Connections

- **Memory improvements (Topic 4) directly enhance Evaluation quality (Topic 1):** A graph-structured `lineage_graph.ts` with FadeMem decay would allow `cycle_analytics.ts` and Prometheus to retrieve the most relevant prior benchmark results without flooding the context — addressing the confounding problem raised in Topic 1.

- **Routing improvements (Topic 2) depend on Evaluation infrastructure (Topic 1):** NeuralUCB and dueling-bandit routing (Topic 2) require reliable reward signals. Trajectory-level scoring (Topic 5 / Topic 1) is a stronger reward signal for routing than current pass/fail verdicts. Building Topic 1's eval infrastructure first makes Topic 2's routing adaptation more effective.

- **Guardrail layering (Topic 3) amplifies trajectory logging value (Topic 5):** Multi-turn adversarial attack detection (Source 13) requires trajectory-level visibility — you cannot detect a long-horizon attack from a single-step log. Topic 5's trajectory logging in `worker_runner.ts` is a prerequisite for Topic 3's multi-turn canary attack simulation.

- **Repository-level verification (Topic 5) is the end-to-end correctness gate for self-evolution (Topic 1):** Prometheus proposes changes → workers execute → `verification_gate.ts` with cross-module dependency checks validates safety. Closing this loop robustly requires all five topics to be addressed together.

- **Budget-constrained routing (Topic 2) must account for memory retrieval cost (Topic 4):** If `lineage_graph.ts` retrieval adds latency/tokens, routing decisions that assume a fixed per-task cost model will undercount total inference spend. The budget model in `budget_controller.ts` must account for memory retrieval overhead.

---

## Research Gaps

The following important areas were **not covered** by this Scout cycle. Recommended for next cycle:

1. **Checkpoint and rollback strategies for long multi-step agents** — No source addressed how to checkpoint intermediate agent state at fine granularity (e.g., LangGraph's checkpoint-based persistence). BOX's `checkpoint_engine.ts` could benefit from a literature review of state-of-the-art approaches.

2. **Multi-agent coordination protocols** — No source covered inter-agent communication patterns (shared blackboard vs. message-passing vs. hierarchical delegation). BOX has multiple agents (Prometheus, workers, Athena, Medic, Jesus) but no research grounding for their coordination model.

3. **Prompt caching and KV-cache utilization** — BOX's `prompt_compiler.ts` has `markCacheableSegments` but no research backing on optimal cache partitioning strategies. No source addressed cache-aware prompt construction for long agentic workflows.

4. **Continual learning / online fine-tuning** — How to update model weights (not just prompts or routing) based on observed BOX task performance. Sources covered routing adaptation but not model-level adaptation.

5. **Formal specification of autonomous agent policies** — Sources 8 and 13 mention constraint-following and attack resistance, but no source covered formal specification languages or contract-based agent governance (e.g., TLA+, Alloy for policy specs). BOX's `governance_contract.ts` could benefit from this.

6. **Cost of self-improvement vs. capability gain empirics** — No source provided empirical data on the ROI of agent self-improvement cycles (how many cycles to measurably improve capability, at what cost). This is directly relevant to BOX's `evolution_metrics.ts` and hypothesis scheduling.

## ACCUMULATED TOPIC KNOWLEDGE (cross-run memory)
This knowledge has been accumulated across multiple Prometheus runs.
Use it to produce deeper, more informed plans. Do NOT re-research completed topics.
Active topics tracked: 122. Completed topics tracked: 32.

### ACTIVE TOPICS (still being researched — use accumulated knowledge)

**tool-use** (14 run(s), since 2026-03-30):
  - Plan: Require deterministic proof artifacts tied to each verification command before done closure. | scope=src/core/verification_gate.ts
  - Plan: Normalize dual-lane output into one validated contract consumed by verification bypass checks. | scope=src/core/athena_reviewer.ts

**tracing** (10 run(s), since 2026-03-30):
  - Plan: Normalize event fields to a cross-agent span contract for deterministic tracing. | scope=src/core/event_schema.ts

**agent-memory-systems-persistent-graph-structured-selective** (2 run(s), since 2026-04-01):
  - Plan: Prioritize unresolved, high-yield memory slices in prompt generation under explicit token budgets. | scope=src/core/prometheus.ts

**cctu-a-benchmark-for-tool-use-under-complex-constraints** (2 run(s), since 2026-04-01):
  - Plan: Prioritize unresolved, high-yield memory slices in prompt generation under explicit token budgets. | scope=src/core/prometheus.ts

**routing** (2 run(s), since 2026-04-01):
  - Research signal: confidence=** high freshness=** 2024–2026

**safety** (2 run(s), since 2026-04-01):
  - Research signal: confidence=** high freshness=** 2025–2026
  - Plan: Introduce dependency-scored micro-batches inside governance waves to increase throughput while preserving gate safety. | scope=src/core/orchestrator.ts

... 2 additional active topic(s) with stored evidence omitted for prompt budget control.

### COMPLETED TOPICS (fully researched — summaries only)
- **agent-evaluation-infrastructure-continuous-quality-loops**: Topic researched over 2 runs. Key findings: Plan: Persist gate-fired, rework, and false-negative proxy metrics for calibration loops. | scope=src/core/state_tracker.ts; Plan: Mark cache-eligible prompt segments and prioritize cost-effective routes un
- **genai-observability-telemetry-standards**: Topic researched over 4 runs. Key findings: Plan: Tune high-risk rejection threshold using recent outcome telemetry with hard bounds. | scope=src/core/prometheus.ts; Plan: Calibrate packet ranking and model routing with declared-vs-realized ROI telem
- **cost-latency-optimization-prompt-caching-model-routing**: Topic researched over 2 runs. Key findings: Plan: Mark cache-eligible prompt segments and prioritize cost-effective routes under quality constraints. | scope=src/core/model_policy.ts; Plan: Optimize model routing with completion-yield ROI while prese
- **security-governance-threat-modeling-for-llm-systems**: Topic researched over 6 runs. Key findings: Plan: Refactor governance pre-dispatch evaluation to compute reusable gate signals once while preserving current precedence an | scope=src/core/orchestrator.ts governance gate path. Plans produced: Refactor
- **control-loop-desired-state-reconciliation-architecture**: Topic researched over 6 runs. Key findings: Plan: Persist gate-fired, rework, and false-negative proxy metrics for calibration loops. | scope=src/core/state_tracker.ts; Plan: Bind deterministic role->workerKind resolution at dispatch and verification
- **observability-genai-telemetry-standards**: Topic researched over 4 runs. Key findings: Plan: Tune high-risk rejection threshold using recent outcome telemetry with hard bounds. | scope=src/core/prometheus.ts; Plan: Calibrate packet ranking and model routing with declared-vs-realized ROI telem
- **cost-latency-optimization-via-caching-model-routing**: Topic researched over 2 runs. Key findings: Plan: Mark cache-eligible prompt segments and prioritize cost-effective routes under quality constraints. | scope=src/core/model_policy.ts; Plan: Optimize model routing with completion-yield ROI while prese
- **durable-execution-for-workflows-and-agents-conductor-oss**: Topic researched over 4 runs. Key findings: Plan: Guarantee all core agents emit span-conformant planning transition events. | scope=src/core/event_schema.ts. Plans produced: Guarantee all core agents emit span-conformant planning transition events.
- ... 24 additional completed topic summary/summaries omitted for prompt budget control.

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
You MUST include these in your plan unless they are already resolved in the codebase: (17 low-recurrence items omitted):
1. [worker=evolution-worker, reviewed=2026-03-21T18:25:35.767Z, recurrence=1] Reproduce the `npm test` failure on the current main branch (HEAD a3ddbb4), identify whether it is a new regression introduced by the schema registry changes or an environment/timing artifact, fix any real failure, and re-emit the full raw `npm test` output as traceable evidence before closing the task.
2. [worker=evolution-worker, reviewed=2026-03-21T18:37:51.653Z, recurrence=1] Run `git checkout main && git pull && node --test 2>&1` from a clean working tree, record the full raw output alongside `git log --oneline origin/main -3`, and confirm whether the two BOX-reported local failures (npm test, node --test) are pre-existing agent_loader failures or regressions introduced by the T-010 squash commit. If pre-existing, close the cycle with that evidence. If new failures, identify and patch.
3. [worker=evolution-worker, reviewed=2026-03-21T19:24:41.236Z, recurrence=1] Run `git checkout main && git pull && node --test 2>&1 | tee post_merge_test.log && git log --oneline origin/main -3` from a clean working tree, embed raw output in a follow-up comment on PR #25, and investigate the `node --test tests/**/*.test.js` glob failure to confirm it is a Windows shell expansion artifact and not a real test failure. Update the verification report template to include the mandatory raw-artifact placeholder so the hard gate is structurally enforced rather than relying on prose memory.
4. [worker=evolution-worker, reviewed=2026-03-21T19:39:44.354Z, recurrence=1] Run `git checkout main && git pull && npm test` from a clean tree on main post-merge and emit the raw stdout + `git log --oneline origin/main -3` SHA as a quoted artifact. Also diagnose and document the `node --test tests/**/*.test.js` FAIL — confirm whether it is a Windows glob expansion artifact or a real test gap, and patch if real.
5. [worker=evolution-worker, reviewed=2026-03-21T20:34:20.221Z, recurrence=1] Enforce the post-merge verification artifact as a structural schema gate: create a verification_report.md template in the session-state folder with a mandatory placeholder that Athena validates as a literal string check. If placeholder is unfilled, Athena returns FAIL regardless of CI status. This converts a prose lesson (six failures) into a machine-checkable contract.

## SOURCE CODE (for planning reference — you are reading the actual codebase)
The following source files are injected so you can plan with deep codebase knowledge.
Reference exact functions, types, and line-level details in your packets.

### FILE: src/core/worker_runner.ts
```typescript
/**
 * Worker Runner — Single-Prompt Worker Sessions
 *
 * Each worker (King David, Esther, Aaron, etc.) has a conversation thread.
 * The orchestrator dispatches tasks via runWorkerConversation().
 *
 * The conversation history is passed as context on every call,
 * making it feel like a persistent session even though Copilot CLI is stateless.
 *
 * Workers use single-prompt mode (--agent only, no autopilot/allow-all):
 *   - 1 worker call = 1 premium request, tool calls within session are FREE
 *   - Worker uses tools to read/edit files, run commands, create PRs
 *   - Session management and status tracking are handled by the runner
 */

import path from "node:path";
import fs from "node:fs/promises";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { spawnAsync } from "./fs_utils.js";
import { getRoleRegistry } from "./role_registry.js";
import { appendProgress, appendLineageEntry, appendFailureClassification } from "./state_tracker.js";
import { buildAgentArgs, nameToSlug } from "./agent_loader.js";
import { buildVerificationChecklist } from "./verification_profiles.js";
import { getVerificationCommands } from "./verification_command_registry.js";
import { parseVerificationReport, parseResponsiveMatrix, validateWorkerContract, decideRework, checkPostMergeArtifact, collectArtifactGaps, isArtifactGateRequired, isDiscoverySafeTask, extractMergedSha, buildArtifactAuditEntry } from "./verification_gate.js";
import { enforceModelPolicy, routeModelWithUncertainty, classifyComplexityTier, COMPLEXITY_TIER } from "./model_policy.js";
import { deriveRoutingAdjustments, buildPromptHardConstraints } from "./learning_policy_compiler.js";
import { loadPolicy, getProtectedPathMatches, getRolePathViolations } from "./policy_engine.js";
import { appendEscalation, BLOCKING_REASON_CLASS, NEXT_ACTION, resolveEscalationsForTask } from "./escalation_queue.js";
import { buildTaskFingerprint, buildLineageId, LINEAGE_ENTRY_STATUS } from "./lineage_graph.js";
import { buildSpanEvent, EVENTS, EVENT_DOMAIN, SPAN_CONTRACT } from "./event_schema.js";
import { classifyFailure } from "./failure_classifier.js";
import { resolveRetryAction, persistRetryMetric } from "./retry_strategy.js";

type WorkerRunnerConfig = {
  env?: Record<string, string | undefined>;
  paths?: {
    stateDir?: string;
  };
  [key: string]: unknown;
};

type PremiumUsageMeta = {
  outcome?: string;
  taskId?: string | number | null;
};

type WorkerRegistryEntry = {
  name?: string;
  model?: string;
  kind?: string;
  [key: string]: unknown;
};

type TaskHints = {
  estimatedLines?: number;
  estimatedDurationMinutes?: number;
  complexity?: string;
};

type RoutingAdjustment = {
  policyId: string;
  modelOverride: string;
  reason: string;
  severity: string;
};

type PromptHardConstraint = {
  policyId: string;
  constraint: string;
  blocking: boolean;
  severity: string;
};

type PromptControls = {
  tier?: string;
  hardConstraints?: PromptHardConstraint[];
};

type WorkerActivityEntry = {
  at?: string;
  status?: string;
  task?: string;
  files?: string[];
  pr?: string;
};

type WorkerSessionState = {
  currentBranch?: string | null;
  createdPRs?: string[];
  filesTouched?: string[];
  activityLog?: WorkerActivityEntry[];
  [key: string]: unknown;
};

type SpawnAsyncResult = {
  status: number;
  stdout: string;
  stderr: string;
  timedOut?: boolean;
  aborted?: boolean;
};

type VerificationEvidence = {
  profile: string;
  hasReport: boolean;
  report: unknown;
  responsiveMatrix: unknown;
  prUrl: string | null;
  gaps: string[];
  passed: boolean;
  attempt: number;
  validatedAt: string;
  roleName: string;
  taskSnippet: string;
  /** Optional-field failures from the VERIFICATION_REPORT (tracked for calibration, not blocking). */
  optionalFieldFailures: string[];
  artifactDetail?: {
    hasSha: boolean;
    hasTestOutput: boolean;
    hasUnfilledPlaceholder: boolean;
    hasExplicitShaMarker: boolean;
    hasExplicitTestBlock: boolean;
    mergedSha: string | null;
  } | null;
};

type ParsedWorkerResponse = ReturnType<typeof parseWorkerResponse> & {
  verificationEvidence?: VerificationEvidence | null;
};

// ── Span contract emitter ─────────────────────────────────────────────────────

/** Canonical agent identifier for workers in span events. */
export const WORKER_AGENT_ID = "worker";

/**
 * Build a PLANNING_STAGE_TRANSITION span event for a worker.
 * Conforms to SPAN_CONTRACT: stamps spanId, parentSpanId, traceId, agentId.
 *
 * @param correlationId — non-empty cycle trace ID
 * @param stageFrom     — stage being left (one of ORCHESTRATION_LOOP_STEPS)
 * @param stageTo       — stage being entered
 * @param opts          — optional parentSpanId, durationMs, taskId
 * @returns validated event envelope
 */
export function emitWorkerSpanTransition(
  correlationId: string,
  stageFrom: string,
  stageTo: string,
  opts: { parentSpanId?: string | null; durationMs?: number | null; taskId?: string | null } = {},
) {
  return buildSpanEvent(
    EVENTS.PLANNING_STAGE_TRANSITION,
    EVENT_DOMAIN.PLANNING,
    correlationId,
    { agentId: WORKER_AGENT_ID, parentSpanId: opts.parentSpanId ?? null },
    {
      [SPAN_CONTRACT.stageTransition.taskId]:     opts.taskId ?? null,
      [SPAN_CONTRACT.stageTransition.stageFrom]:  stageFrom,
      [SPAN_CONTRACT.stageTransition.stageTo]:    stageTo,
      [SPAN_CONTRACT.stageTransition.durationMs]: opts.durationMs ?? null,
    },
  );
}

/**
 * Build a PLANNING_TASK_DROPPED span event for a worker (blocked/capacity-exhausted path).
 * Conforms to SPAN_CONTRACT.dropReason.
 *
 * @param correlationId  — non-empty cycle trace ID
 * @param taskId         — identifier of the dropped task
 * @param reason         — human-readable drop reason
 * @param dropCode       — machine code from SPAN_CONTRACT.dropCodes (defaults to CAPACITY_EXHAUSTED)
 * @param opts           — optional parentSpanId, stageWhenDropped
 * @returns validated event envelope
 */
export function emitWorkerSpanDrop(
  correlationId: string,
  taskId: string,
  reason: string,
  dropCode: string = SPAN_CONTRACT.dropCodes.CAPACITY_EXHAUSTED,
  opts: { parentSpanId?: string | null; stageWhenDropped?: string } = {},
) {
  return buildSpanEvent(
    EVENTS.PLANNING_TASK_DROPPED,
    EVENT_DOMAIN.PLANNING,
    correlationId,
    { agentId: WORKER_AGENT_ID, parentSpanId: opts.parentSpanId ?? null },
    {
      [SPAN_CONTRACT.dropReason.taskId]:           taskId,
      [SPAN_CONTRACT.dropReason.stageWhenDropped]: opts.stageWhenDropped ?? "workers_running",
      [SPAN_CONTRACT.dropReason.reason]:           reason,
      [SPAN_CONTRACT.dropReason.dropCode]:         dropCode,
    },
  );
}

// ── Premium usage tracking ──────────────────────────────────────────────────

function logPremiumUsage(config, roleName, model, taskKind, durationMs, { outcome, taskId }: PremiumUsageMeta = {}) {
  const logPath = path.join(config.paths?.stateDir || "state", "premium_usage_log.json");
  let entries = [];
  try {
    if (existsSync(logPath)) {
      entries = JSON.parse(readFileSync(logPath, "utf8"));
      if (!Array.isArray(entries)) entries = [];
    }
  } catch { entries = []; }
  entries.push({
    worker: roleName,
    model,
    taskKind: taskKind || "general",
    startedAt: new Date(Date.now() - durationMs).toISOString(),
    completedAt: new Date().toISOString(),
    durationMs,
    outcome: outcome || "unknown",
    taskId: taskId || null
  });
  // Keep last 500 entries to prevent unbounded growth
  if (entries.length > 500) entries = entries.slice(-500);
  try { writeFileSync(logPath, JSON.stringify(entries, null, 2), "utf8"); } catch { /* non-critical */ }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function truncate(text, max) {
  const s = String(text || "");
  return s.length > max ? `${s.slice(0, max)}...` : s;
}

/**
 * Compute a recent ROI proxy from the premium usage log for the given task kind.
 * Returns a value in [0, 1]: ratio of "done" outcomes in the last 10 matching entries.
 * Returns 0 when there is no history (fail-open — caller treats 0 as "no signal").
 */
function computeRecentROI(config, taskKind: string): number {
  try {
    const logPath = path.join(config.paths?.stateDir || "state", "premium_usage_log.json");
    if (!existsSync(logPath)) return 0;
    const entries = JSON.parse(readFileSync(logPath, "utf8"));
    if (!Array.isArray(entries)) return 0;
    const relevant = entries
      .filter((e) => !taskKind || e.taskKind === taskKind)
      .slice(-10);
    if (relevant.length === 0) return 0;
    const successCount = relevant.filter((e) => e.outcome === "done").length;
    return successCount / relevant.length;
  } catch {
    return 0; // fail-open: absence of history must never block dispatch
  }
}

/**
 * Load compiled lesson-based policies from state/learned_policies.json.
 * Fail-open: returns [] on any read or parse error.
 */
function loadLearnedPolicies(config): any[] {
  try {
    const pPath = path.join(config.paths?.stateDir || "state", "learned_policies.json");
    if (!existsSync(pPath)) return [];
    const data = JSON.parse(readFileSync(pPath, "utf8"));
    return Array.isArray(data) ? data : [];
  } catch {
    return []; // non-critical; missing policy file must never block dispatch
  }
}

function getLiveLogPath(config, roleName) {
  const stateDir = config.paths?.stateDir || "state";
  const safeRole = String(roleName || "worker").replace(/[^a-z0-9_-]+/gi, "_");
  return path.join(stateDir, `live_worker_${safeRole}.log`);
}

async function appendLiveWorkerLog(logPath, text) {
  await fs.mkdir(path.dirname(logPath), { recursive: true });
  await fs.appendFile(logPath, text, "utf8");
}

// ── Find worker config by role name ─────────────────────────────────────────

function findWorkerByName(config, roleName) {
  const registry = getRoleRegistry(config);
  const workers = registry?.workers || {};
  for (const [kind, worker] of Object.entries(workers) as Array<[string, WorkerRegistryEntry]>) {
    if (worker?.name === roleName) return { kind, ...worker };
  }
  return null;
}

// ── Repo contamination detection and recovery ────────────────────────────────

/** Patterns in worker output that indicate repo contamination (out-of-scope file modifications). */
const CONTAMINATION_INDICATORS = [
  /scope\s+violation/i,
  /unrelated\s+file/i,
  /modified\s+outside\s+(declared\s+)?scope/i,
  /git\s+checkout\s+--/i,
];

/**
 * Detect whether a worker's output indicates repo contamination — i.e., files
 * were modified outside the declared task scope.
 *
 * Returns isContamination=true when the summary text contains known contamination
 * markers OR when filesTouched contains entries that fall outside filesHint scope.
 *
 * @param summary      - worker summary text (may contain SCOPE VIOLATION markers)
 * @param filesTouched - files the worker reported touching
 * @param filesHint    - declared scope from the task (empty means "no scope declared")
 */
export function detectRepoContamination(
  summary: string,
  filesTouched: string[],
  filesHint: string[],
): { isContamination: boolean; unrelatedFiles: string[] } {
  const text = String(summary || "");
  const markerFound = CONTAMINATION_INDICATORS.some(r => r.test(text));

  let unrelatedFiles: string[] = [];
  if (Array.isArray(filesHint) && filesHint.length > 0
      && Array.isArray(filesTouched) && filesTouched.length > 0) {
    const normalizedHints = filesHint.map(h => h.replace(/\\/g, "/").toLowerCase());
    unrelatedFiles = filesTouched.filter(file => {
      const normalized = file.replace(/\\/g, "/").toLowerCase();
      return !normalizedHints.some(hint => {
        if (normalized === hint) return true;
        if (normalized.startsWith(hint.endsWith("/") ? hint : hint + "/")) return true;
        const hintBase = hint.replace(/\.(ts|js)$/, "");
        return normalized.includes(hintBase);
      });
    });
  }

  return {
    isContamination: markerFound || unrelatedFiles.length > 0,
    unrelatedFiles,
  };
}

/**
 * Attempt to recover branch cleanliness by reverting files outside the task scope.
 * Runs `git checkout -- <file>` for each file in filesToRecover.
 *
 * This is a best-effort, deterministic recovery: it retries up to maxAttempts times.
 * A blocked/partial closure is only permitted after all recovery attempts are exhausted.
 *
 * @param config         - runner config (used for path resolution context)
 * @param filesToRecover - files to revert via git checkout
 * @param maxAttempts    - max attempts before giving up (default 2)
 */
export async function attemptBranchCleanlinessRecovery(
  config: WorkerRunnerConfig,
  filesToRecover: string[],
  maxAttempts: number = 2,
): Promise<{ recovered: boolean; attemptsMade: number; errors: string[] }> {
  if (!Array.isArray(filesToRecover) || filesToRecover.length === 0) {
    return { recovered: true, attemptsMade: 0, errors: [] };
  }

  const errors: string[] = [];
  let attempt = 0;
  let pending = [...filesToRecover];

  while (attempt < maxAttempts && pending.length > 0) {
    attempt++;
    const failedThisAttempt: string[] = [];
    for (const file of pending) {
      try {
        const r = await spawnAsync("git", ["checkout", "--", file], {
          env: { ...process.env },
        }) as SpawnAsyncResult;
        if (r.status !== 0) {
          failedThisAttempt.push(file);
          errors.push(
            `[attempt ${attempt}] git checkout -- ${file} exit=${r.status}: ${String(r.stderr || "").slice(0, 80)}`
          );
        }
      } catch (e: unknown) {
        failedThisAttempt.push(file);
        errors.push(
          `[attempt ${attempt}] git checkout -- ${file}: ${String((e as Error)?.message || e).slice(0, 80)}`
        );
      }
    }
    pending = failedThisAttempt;
  }

  return { recovered: pending.length === 0, attemptsMade: attempt, errors };
}

// ── Task-aware model resolution ───────────────────────────────────────────────
// Priority: taskKind → role preference → worker model → uncertainty-aware routing → default
// Policy adjustments from compiled lessons may override the candidate after selection.

function resolveModel(config, roleName, taskKind, taskHints: TaskHints = {}, routingAdjustments: RoutingAdjustment[] = []) {
  const defaultModel = config?.copilot?.defaultModel || "Claude Sonnet 4.6";
  const strongModel = config?.copilot?.strongModel || defaultModel;
  const efficientModel = config?.copilot?.efficientModel || defaultModel;

  let candidate;
  // 1. Task-kind override (e.g. "scan" always uses GPT-5.3-Codex)
  if (taskKind) {
    const byKind = config?.copilot?.preferredModelsByTaskKind?.[taskKind];
    if (Array.isArray(byKind) && byKind.length > 0) candidate = byKind[0];
  }
  // 2. Role-specific preference
  if (!candidate) {
    const byRole = config?.copilot?.preferredModelsByRole?.[roleName];
    if (Array.isArray(byRole) && byRole.length > 0) candidate = byRole[0];
  }
  // 3. Worker's registered static model
  if (!candidate) {
    const workerConfig = findWorkerByName(config, roleName);
    if (workerConfig?.model) candidate = workerConfig.model;
  }
  // 4. Uncertainty-aware routing: factor in task complexity tier + historical ROI
  //    to auto-select the right model when no explicit config override exists.
  if (!candidate) {
    const recentROI = computeRecentROI(config, taskKind);
    const uncertaintyRoute = routeModelWithUncertainty(
      taskHints,
      { defaultModel, strongModel, efficientModel },
      { recentROI }
    );
    candidate = uncertaintyRoute.model;
    if (uncertaintyRoute.uncertainty !== "low") {
      try {
        appendProgress(config,
          `[UNCERTAINTY_ROUTE] ${roleName}: tier=${uncertaintyRoute.tier} uncertainty=${uncertaintyRoute.uncertainty} recentROI=${recentROI.toFixed(2)} → ${candidate}`
        );
      } catch { /* non-critical */ }
    }
  }

  // 5. Apply routing adjustments derived from compiled lesson policies.
  //    Recurring failure classes (e.g. syntax errors, import errors) override the
  //    complexity-based selection since model capability was NOT the root cause.
  for (const adj of routingAdjustments) {
    if (adj.modelOverride === "force-sonnet") {
      const previous = candidate;
      candidate = defaultModel;
      try {
        appendProgress(config,
          `[POLICY_ROUTE] ${roleName}: ${previous} → ${defaultModel} (policy=${adj.policyId}: ${adj.reason})`
        );
      } catch { /* non-critical */ }
      break; // First critical policy override wins
    }
    if (adj.modelOverride === "block-opus" && /opus/i.test(String(candidate || ""))) {
      candidate = defaultModel;
      try {
        appendProgress(config,
          `[POLICY_ROUTE] ${roleName}: Opus blocked → ${defaultModel} (policy=${adj.policyId}: ${adj.reason})`
        );
      } catch { /* non-critical */ }
      break;
    }
  }

  // 6. Enforce model policy — ban fast/30x, gate Opus to large tasks
  const policy = enforceModelPolicy(candidate || defaultModel, taskHints, defaultModel);
  if (policy.downgraded) {
    try { appendProgress(config, `[MODEL_POLICY] ${roleName}: ${policy.reason}`); } catch { /* non-critical */ }
  }
  return policy.model;
}

// ── Build conversation-only context (persona is in .agent.md) ───────────────

function buildConversationContext(history, instruction, sessionState: WorkerSessionState = {}, config: WorkerRunnerConfig = {}, workerKind = null, promptControls: PromptControls = {}) {
  const parts = [];

  // Persistent worker state — always injected first so workers always know where they stand
  const targetRepo = config.env?.targetRepo || "(not set)";
  const branch = sessionState.currentBranch || null;
  const prs = Array.isArray(sessionState.createdPRs) ? sessionState.createdPRs : [];
  const filesTouchedAll = Array.isArray(sessionState.filesTouched) ? sessionState.filesTouched : [];
  const activityLog = Array.isArray(sessionState.activityLog) ? sessionState.activityLog : [];

  parts.push("## YOUR PERSISTENT STATE");
  parts.push(`Target Repo: ${targetRepo}`);
  if (branch) parts.push(`Current Branch: ${branch}`);
  if (prs.length > 0) parts.push(`PRs You Created: ${prs.slice(-5).join(", ")}`);
  if (filesTouchedAll.length > 0) {
    const shown = filesTouchedAll.slice(-10);
    const more = filesTouchedAll.length - shown.length;
    parts.push(`Files You've Worked On: ${shown.join(", ")}${more > 0 ? ` (+${more} more)` : ""}`);
  }
  parts.push("");

  if (activityLog.length > 0) {
    parts.push("## YOUR ACTIVITY LOG");
    activityLog.slice(-5).forEach(entry => {
      const date = entry.at ? entry.at.slice(0, 16).replace("T", " ") : "?";
      const files = Array.isArray(entry.files) && entry.files.length > 0
        ? ` | ${entry.files.slice(0, 4).join(", ")}` : "";
      const pr = entry.pr ? ` → PR ${entry.pr.split("/").pop()}` : "";
      parts.push(`[${date}] ${String(entry.status || "").toUpperCase().padEnd(8)} ${String(entry.task || "").slice(0, 80)}${pr}${files}`);
    });
    parts.push("");
  }

  // Inject knowledge memory lessons relevant to this worker
  try {
    const kmPath = path.join(config.paths?.stateDir || "state", "knowledge_memory.json");
    if (existsSync(kmPath)) {
      const km = JSON.parse(readFileSync(kmPath, "utf8"));
      const promptHints = Array.isArray(km.promptHints)
        ? km.promptHints.filter(h => {
            const target = String(h.targetAgent || "").toLowerCase();
            return target === "all" || target === "workers" || target === String(workerKind || "").toLowerCase();
          })
        : [];
      const recentLessons = Array.isArray(km.lessons) ? km.lessons.slice(-5) : [];

      if (promptHints.length > 0 || recentLessons.length > 0) {
        parts.push("## SYSTEM LEARNINGS (from previous cycles)");
        for (const hint of promptHints) {
          parts.push(`- [HINT] ${hint.hint} (reason: ${hint.reason})`);
        }
        for (const lesson of recentLessons) {
          if (lesson.severity === "critical" || lesson.severity === "warning") {
            parts.push(`- [${lesson.severity.toUpperCase()}] ${lesson.lesson}`);
          }
        }
        parts.push("");
      }
    }
  } catch { /* knowledge memory not available yet — no-op */ }

  // Loop detection — inject a visible warning before history if the worker is stuck
  const myMessages = history.filter(m => {
    const from = String(m?.from || "").toLowerCase();
    return from !== "athena" && from !== "prometheus";
  });
  const recentOwn = myMessages.slice(-3);
  const allFailed = recentOwn.length >= 2 && recentOwn.every(m =>
    m.status === "error" || m.status === "blocked" ||
    String(m.content || "").toLowerCase().startsWith("error")
  );
  const repeatedContent = recentOwn.length >= 2 &&
    recentOwn.every(m => truncate(m.content, 120) === truncate(recentOwn[0].content, 120));

  if (repeatedContent) {
    parts.push("## ⚠️ LOOP DETECTED — YOU ARE REPEATING THE SAME OUTPUT");
    parts.push("Your last responses are identical. You are in a loop.");
    parts.push("MANDATORY: Stop completely. Do NOT repeat the same action.");
    parts.push("Step 1: Re-read the task from scratch — assume your previous understanding was wrong.");
    parts.push("Step 2: Pick a completely different implementation strategy.");
    parts.push("Step 3: If you genuinely cannot proceed differently, output BOX_STATUS=blocked with a root-cause analysis.");
    parts.push("");
  } else if (allFailed) {
    parts.push("## ⚠️ REPEATED FAILURE — CHANGE YOUR APPROACH");
    parts.push(`You have failed ${recentOwn.length} times in a row on this task. Your current approach is not working.`);
    parts.push("MANDATORY before continuing:");
    parts.push("  1. Identify WHY each previous attempt failed (permissions? missing deps? wrong file? wrong assumption?)");
    parts.push("  2. Form a NEW hypothesis about the root cause.");
    parts.push("  3. Apply a fundamentally different fix strategy.");
    parts.push("  4. If after this attempt it still fails, output BOX_STATUS=blocked with:");
    parts.push("     - All approaches you tried");
    parts.push("     - The exact error each time");
    parts.push("     - Evidence-based root cause analysis for why none of them worked");
    parts.push("");
  }

  if (history.length > 0) {
    parts.push("## CONVERSATION HISTORY");
    const recentHistory = history.slice(-12);
    for (const msg of recentHistory) {
      const from = String(msg?.from || "").toLowerCase();
      if (from === "athena" || from === "prometheus") {
        parts.push(`\nINSTRUCTION: ${truncate(msg.content, 600)}`);
      } else {
        parts.push(`\nYOU (${msg.from}): ${truncate(msg.content, 800)}`);
      }
    }
    parts.push("");
  }

  parts.push("## NEW INSTRUCTION");
  parts.push("Treat this instruction as an execution brief: objective, constraints, and success criteria.");
  parts.push("You own the method. If a better implementation order or safer approach exists, use it and explain why in your summary.");
  parts.push("Do not follow literal step ordering if repository reality suggests a stronger senior-level approach.");
  parts.push("\n## EXECUTION INTEGRITY PROTOCOL");
  parts.push("1) Verify access before acting. Validate: target repo path, required files, required tools, and required remote/API access.");
  parts.push("2) Never guess. Do not use assumed/projected facts when evidence is missing. If you need data, fetch it.");
  parts.push("3) If anything is inaccessible, do not improvise. Report the exact blocker with evidence.");
  parts.push("4) If you choose an alternative path, include impact analysis: correctness risk, scope impact, rollback, and whether it is a permanent fix or temporary workaround.");
  parts.push("5) Prefer permanent deterministic fixes over temporary bypasses.");
  parts.push("6) PR ownership is yours end-to-end: create/update your PR for your task, monitor GitHub checks, fix failures you see, and when checks are green merge it yourself.");
  parts.push("7) If checks remain pending, keep watching until green or report the exact failing/pending checks.");

  parts.push("\n## INDEPENDENT THINKING — VERIFY YOUR ORDERS");
  parts.push("You are a senior engineer, not a blind executor. Before implementing your instructions:");
  parts.push("1) EVALUATE the plan: Does this instruction make technical sense for the codebase? Is it the right approach?");
  parts.push("2) CHECK for conflicts: Will this change break something that's already working? Does it conflict with other workers' work?");
  parts.push("3) VALIDATE scope: Is the instruction appropriately scoped for this project type? (Don't add enterprise security to a portfolio site, don't skip auth on a SaaS app)");
  parts.push("4) CHALLENGE if wrong: If the instruction contains a technical error, an incorrect assumption, or a suboptimal approach:");
  parts.push("   - State what's wrong and why");
  parts.push("   - Propose the correct approach");
  parts.push("   - Implement the CORRECT version, not the flawed instruction");
  parts.push("   - Document your reasoning in the summary");
  parts.push("5) ENHANCE if possible: If you see an obviously better way to achieve the goal that the plan didn't consider, do it the better way.");
  parts.push("6) NEVER blindly execute instructions that would:");
  parts.push("   - Break existing passing tests");
  parts.push("   - Remove functionality that's currently working");
  parts.push("   - Add unnecessary complexity for the project type");
  parts.push("   - Introduce security vulnerabilities");
  parts.push("You own the quality of YOUR output. Execute at a senior engineering level — methodology is yours.");
  parts.push("\n## WORK QUALITY MANDATE");
  parts.push("Each premium request costs real money. You MUST deliver complete, correct, production-quality work in this single request.");
  parts.push("- Write exactly as much code as the task requires — no more, no less.");
  parts.push("- Prefer focused, targeted changes that solve the problem cleanly over large rewrites.");
  parts.push("- Complete your ENTIRE assigned task in one shot — do not leave partial work for a follow-up request.");
  parts.push("- If your task involves multiple files, fix ALL of them before reporting done.");
  parts.push("- Senior production standard: correct logic, proper error handling, edge cases handled, tests where relevant.");

  // Canonical verification commands from the central registry
  const verifCmds = getVerificationCommands(config);
  parts.push("\n## CANONICAL VERIFICATION COMMANDS");
  parts.push(`Use these exact commands for verification (do NOT invent shell globs):`);
  parts.push(`  Test:  ${verifCmds.test}`);
  parts.push(`  Lint:  ${verifCmds.lint}`);
  parts.push(`  Build: ${verifCmds.build}`);

  // Prompt tier budget — informs the worker how much reasoning depth is expected.
  // T3 (architectural): deep think required, critic mandatory, multi-pass.
  // T2 (medium): two-pass, moderate reasoning.
  // T1 (routine): lean, direct implementation — no extra passes needed.
  const tier = promptControls.tier;
  if (tier === COMPLEXITY_TIER.T3) {
    parts.push("\n## PROMPT TIER BUDGET — T3 (ARCHITECTURAL)");
    parts.push("This task is classified as T3: deep architectural reasoning required.");
    parts.push("- Mandatory: multi-pass reasoning (design → implement → verify → critique).");
    parts.push("- Perform a critic step before finalising: challenge your own solution.");
    parts.push("- Verify all edge cases explicitly before reporting done.");
    parts.push("- Budget: up to 5 continuation passes if needed.");
  } else if (tier === COMPLEXITY_TIER.T2) {
    parts.push("\n## PROMPT TIER BUDGET — T2 (MEDIUM)");
    parts.push("This task is classified as T2: two-pass reasoning expected.");
    parts.push("- Implement first, then verify the result before reporting done.");
    parts.push("- Budget: up to 3 continuation passes if needed.");
  }
  // T1: no tier section — keep the prompt lean for routine patches.

  // Role-based verification — inject requirements specific to this worker's kind
  if (workerKind) {
    parts.push("");
    parts.push(buildVerificationChecklist(workerKind));
  } else {
    // Fallback for unknown roles — basic verification
    parts.push("\n## SELF-VERIFICATION PROTOCOL");
    parts.push("Before reporting done, verify your work: run build, run tests, check edge cases.");
    parts.push("Include VERIFICATION_REPORT: BUILD=<pass|fail|n/a>; TESTS=<pass|fail|n/a>; RESPONSIVE=<pass|fail|n/a>; API=<pass|fail|n/a>; EDGE_CASES=<pass|fail|n/a>; SECURITY=<pass|fail|n/a>");
  }

  // Hard constraints from compiled lesson policies — injected prominently so the
  // model cannot silently violate them. Blocking constraints cause immediate rework
  // if violated. Violation is detected via the verification gate at post-task review.
  const hardConstraints = Array.isArray(promptControls.hardConstraints) ? promptControls.hardConstraints : [];
  if (hardConstraints.length > 0) {
    parts.push("\n## HARD CONSTRAINTS (enforced from prior cycle lessons — violations trigger rework)");
    for (const hc of hardConstraints) {
      const blockLabel = hc.blocking ? " [BLOCKING]" : "";
      parts.push(`${hc.constraint}${blockLabel}`);
    }
  }

  parts.push("\n## OUTPUT FORMAT");
  parts.push("Think deeply and work naturally. Write your full reasoning, analysis, and implementation details.");
  parts.push("At the END of your response, include these optional machine-readable markers (if applicable):");
  parts.push("BOX_STATUS=<done|partial|blocked|error>");
  parts.push("BOX_PR_URL=<url>   (if you created/updated a PR)");
  parts.push("BOX_BRANCH=<name>  (if you created/switched a branch)");
  parts.push("BOX_FILES_TOUCHED=<comma-separated list>  (files you edited/created)");
  parts.push("BOX_ACCESS=repo:<ok|blocked>;files:<ok|blocked>;tools:<ok|blocked>;api:<ok|blocked>  (if you encountered access issues)");
  parts.push("If BOX_STATUS is omitted, it defaults to done.");
  parts.push("PR POLICY: If your task changes code, open or update your PR and carry it to merge when checks are green.");
  parts.push("");
  parts.push("## DONE-PATH ARTIFACT REQUIREMENTS (MANDATORY for BOX_STATUS=done on merge tasks)");
  parts.push("When reporting BOX_STATUS=done after merging code, you MUST include BOTH of the following:");
  parts.push("1. BOX_MERGED_SHA=<7-40 char hex commit SHA from the merged state>");
  parts.push("   Example: BOX_MERGED_SHA=abc1234");
  parts.push("   Run: git rev-parse HEAD   (after merge is confirmed)");
  parts.push("2. A raw npm test output block wrapped in explicit markers:");
  parts.push("   ===NPM TEST OUTPUT START===");
  parts.push("   <paste full stdout from 'npm test' run on the merged branch>");
  parts.push("   ===NPM TEST OUTPUT END===");
  parts.push("Omitting either artifact will cause the verification gate to reject your done status.");
  parts.push(String(instruction.task || ""));

  // Warn when the task text provides no specific test file targets so the worker
  // knows it must supply concrete test evidence in its VERIFICATION_REPORT.
  const taskText = String(instruction.task || "");
  const hasSpecificTestTarget = /\.(test|spec)\.(ts|js|tsx|jsx)/i.test(taskText) ||
    /\/tests?\/[^\s]+/.test(taskText) ||
    /[—\-–]\s*test[:\s]/i.test(taskText);
  if (!hasSpecificTestTarget) {
    parts.push("");
    parts.push("## ⚠️ VERIFICATION TARGET REQUIRED");
    parts.push("No specific test file target was detected in this task's verification commands.");
    parts.push("You MUST provide specific test evidence in your VERIFICATION_REPORT:");
    parts.push("  - Run or create a specific test file (e.g. tests/core/<module>.test.ts)");
    parts.push("  - Reference it explicitly: 'node --test tests/core/<module>.test.ts'");
    parts.push("  - Generic 'npm test passed' alone is NOT accepted as verification evidence.");
  }

  if (instruction.context) {
    parts.push("");
    parts.push("Additional context:");
    parts.push(String(instruction.context));
  }
  if (instruction.isFollowUp && instruction.previousResult) {
    parts.push("");
    parts.push(`Your previous result: ${truncate(instruction.previousResult, 400)}`);
  }

  return parts.join("\n");
}

// ── Parse worker response ────────────────────────────────────────────────────
// Exported for unit testing of marker extraction and access-guard normalization.
export function parseWorkerResponse(stdout, stderr) {
  const output = String(stdout || "");
  const combined = `${output}\n${String(stderr || "")}`;

  // Extract status marker
  const statusMatch = combined.match(/BOX_STATUS=(\w+)/i);
  const status = statusMatch ? statusMatch[1].toLowerCase() : "done";

  // Extract PR URL
  const prMatch = combined.match(/BOX_PR_URL=(https?:\/\/\S+)/i);
  const prUrl = prMatch ? prMatch[1] : null;

  // Extract branch name — workers output BOX_BRANCH=feature/... when they create/switch a branch
  const branchMatch = combined.match(/BOX_BRANCH=(\S+)/i);
  const currentBranch = branchMatch ? branchMatch[1] : null;

  // Extract files edited/created — workers output BOX_FILES_TOUCHED=src/a.js,src/b.js
  const filesMatch = combined.match(/BOX_FILES_TOUCHED=([^\n\r]+)/i);
  const filesTouched = filesMatch
    ? filesMatch[1].split(",").map(f => f.trim()).filter(Boolean)
    : [];

  const accessHeaderMatch = combined.match(/BOX_ACCESS=([^\n\r]+)/i);
  const accessHeader = accessHeaderMatch ? accessHeaderMatch[1].trim() : null;
  const hasBlockedAccess = accessHeader ? /\bblocked\b/i.test(accessHeader) : false;

  // Guardrail: if access protocol reports blocked but status is not blocked,
  // force status to blocked for safe deterministic follow-up routing.
  let normalizedStatus = ["done", "partial", "blocked", "error"].includes(status) ? status : "done";
  if (hasBlockedAccess && normalizedStatus !== "blocked") {
    normalizedStatus = "blocked";
  }

  // Summary: preserve full natural-language output (no truncation)
  const lines = output.split(/\r?\n/).filter(l => l.trim());
  const meaningfulLines = lines.filter(l =>
    !l.startsWith("●") &&
    !l.startsWith("✓") &&
    !l.startsWith("⏺") &&
    !l.includes("tool_call") &&
    l.trim().length > 5
  );
  const summary = meaningfulLines.join("\n") || output;

  // Extract verification evidence from worker output
  const verificationReport = parseVerificationReport(output);
  const responsiveMatrix = parseResponsiveMatrix(output);

  // Extract explicit merged SHA marker (BOX_MERGED_SHA=<sha>).
  // Stored for audit and lineage — also surfaced in the done-path artifact check.
  const mergedSha = extractMergedSha(output);

  return {
    status: normalizedStatus,
    prUrl,
    currentBranch,
    filesTouched,
    summary,
    fullOutput: output,
    verificationReport,
    responsiveMatrix,
    mergedSha,
  };
}

// ── Main Worker Conversation ─────────────────────────────────────────────────

export async function runWorkerConversation(config, roleName, instruction, history = [], sessionState: WorkerSessionState = {}) {
  const taskHints: TaskHints = {
    estimatedLines: Number(instruction.estimatedLines || 0),
    estimatedDurationMinutes: Number(instruction.estimatedDurationMinutes || 0),
    complexity: String(instruction.complexity || instruction.estimatedComplexity || "")
  };

  // ── Task 2: Load compiled lesson policies and derive dispatch controls ──────
  // learned_policies.json is written by the orchestrator after each cycle from
  // postmortem lessons. Routing adjustments and prompt hard constraints are
  // derived here — fail-open so a missing/corrupt file never blocks dispatch.
  const learnedPolicies = loadLearnedPolicies(config);
  const routingAdjustments: RoutingAdjustment[] = deriveRoutingAdjustments(learnedPolicies);
  const hardConstraints: PromptHardConstraint[] = buildPromptHardConstraints(learnedPolicies);

  // ── Task 1: Uncertainty-aware model selection ─────────────────────────────
  // resolveModel now uses routeModelWithUncertainty (backed by historical ROI)
  // and applies policy routing adjustments from recurring failure lessons.
  const model = resolveModel(config, roleName, instruction.taskKind, taskHints, routingAdjustments);

  // Classify complexity tier for prompt budget injection
  const { tier } = classifyComplexityTier(taskHints);

  const command = config.env?.copilotCliCommand || "copilot";
  const agentSlug = nameToSlug(roleName); // "king-david", "esther", etc.

  // Resolve worker kind for role-based verification
  const workerConfig = findWorkerByName(config, roleName);
  const workerKind = workerConfig?.kind || null;

  // Build conversation-only context with prompt tier budget and hard constraints injected
  const conversationContext = buildConversationContext(
    history, instruction, sessionState, config, workerKind,
    { tier, hardConstraints }
  );

  await appendProgress(config, `[WORKER:${roleName}] [${instruction.taskKind || "general"}→${model}] ${truncate(instruction.task, 70)}`);

  const updatedHistory = [
    ...history,
    { from: "prometheus", content: instruction.task, timestamp: new Date().toISOString() }
  ];

  // Single-prompt mode: no autopilot continuations.
  // All implementation workers dispatched by the daemon need full tool access.
  const taskKindLower = String(instruction.taskKind || "").toLowerCase();
  const isImplementationTask = !taskKindLower || taskKindLower === "implementation";
  const allowAllTools = isImplementationTask || String(roleName || "").toLowerCase() === "evolution-worker";
  const args = buildAgentArgs({
    agentSlug,
    prompt: conversationContext,
    model,
    allowAll: allowAllTools,
    noAskUser: allowAllTools,
    maxContinues: undefined
  });

  // Compute timeout: config.runtime.workerTimeoutMinutes → ms.
  // 0 or negative means no timeout for worker execution.
  const workerTimeoutMinutes = Number(config?.runtime?.workerTimeoutMinutes || 0);
  const workerTimeoutMs = workerTimeoutMinutes > 0 ? workerTimeoutMinutes * 60 * 1000 : null;
  const liveLogPath = getLiveLogPath(config, roleName);

  await appendLiveWorkerLog(
    liveLogPath,
    [
      "",
      `${"=".repeat(80)}`,
      `[${new Date().toISOString()}] START role=${roleName} model=${model}`,
      `TASK: ${instruction.task}`,
      `${"-".repeat(80)}`,
      ""
    ].join("\n")
  );

  const startMs = Date.now();

  // Circuit breaker: detect consecutive transient API errors from the Copilot CLI
  // and abort the process early instead of waiting for 45-minute timeout.
  const TRANSIENT_ERROR_THRESHOLD = 10;
  let transientErrorCount = 0;
  const abortController = new AbortController();

  const result = await spawnAsync(command, args, {
    env: {
      ...process.env,
      GH_TOKEN: config.env?.githubToken || process.env.GH_TOKEN || "",
      GITHUB_TOKEN: config.env?.githubToken || process.env.GITHUB_TOKEN || "",
      TARGET_REPO: config.env?.targetRepo || "",
      TARGET_BASE_BRANCH: config.env?.targetBaseBranch || "main"
    },
    timeoutMs: workerTimeoutMs,
    signal: abortController.signal,
    onStdout: (chunk) => {
      const text = String(chunk);
      appendLiveWorkerLog(liveLogPath, text).catch(() => {});
      if (/transient API error/i.test(text)) {
        transientErrorCount++;
        if (transientErrorCount >= TRANSIENT_ERROR_THRESHOLD) {
          abortController.abort(
            `[BOX] Transient API error circuit breaker: ${transientErrorCount} consecutive errors — aborting to avoid waste`
          );
        }
      } else if (text.trim().length > 20) {
        // Reset counter on meaningful (non-error) output
        transientErrorCount = 0;
      }
    },
    onStderr: (chunk) => {
      const text = String(chunk);
      appendLiveWorkerLog(liveLogPath, `[stderr] ${text}`).catch(() => {});
      if (/transient API error/i.test(text)) {
        transientErrorCount++;
        if (transientErrorCount >= TRANSIENT_ERROR_THRESHOLD) {
          abortController.abort(
            `[BOX] Transient API error circuit breaker: ${transientErrorCount} consecutive errors — aborting to avoid waste`
          );
        }
      }
    }
  }) as SpawnAsyncResult;

  const stdout = String(result?.stdout || "");
  const stderr = String(result?.stderr || "");

  if (result.status !== 0) {
    const isTransient = result.aborted === true && /transient API error circuit breaker/i.test(stderr);
    const label = isTransient ? `TransientAPIError` : result.timedOut ? `Timeout` : `Error exit=${result.status}`;
    await appendLiveWorkerLog(
      liveLogPath,
      `\n[${new Date().toISOString()}] END status=error exit=${result.status}${result.timedOut ? " timeout=true" : ""}${isTransient ? " transient=true" : ""}\n`
    );
    await appendProgress(config, `[WORKER:${roleName}] ${label}`);
    const errorMsg = truncate(stderr || stdout || "unknown error", 300);

    // Persist structured escalation for worker errors/timeouts (non-critical write)
    appendEscalation(config, {
      role: roleName,
      task: instruction.task,
      blockingReasonClass: BLOCKING_REASON_CLASS.WORKER_ERROR,
      attempts: Number(instruction.reworkAttempt || 0),
      nextAction: NEXT_ACTION.RETRY,
      summary: label + ": " + errorMsg
    }).catch(() => { /* non-fatal */ });

    // Classify and persist failure (non-critical — never blocks the return)
    {
      const cfResult = classifyFailure({
        workerStatus: "error",
        blockingReasonClass: BLOCKING_REASON_CLASS.WORKER_ERROR,
        errorMessage: errorMsg,
        logLines: result.timedOut ? ["Process timed out"] : [],
        taskId: instruction.taskId || null,
      });
      if (cfResult.ok) {
        appendFailureClassification(config, cfResult.classification).catch(() => { /* non-fatal */ });
      }
    }

    // Resolve adaptive retry decision for error path
    let errorRetryDecision = null;
    try {
      const exitClassification = classifyFailure({
        workerStatus: "error",
        blockingReasonClass: BLOCKING_REASON_CLASS.WORKER_ERROR,
        errorMessage: errorMsg,
        logLines: result.timedOut ? ["Process timed out"] : [],
        taskId: instruction.taskId || null,
      });
      if (exitClassification.ok) {
        const rd = resolveRetryAction(
          exitClassification.classification.primaryClass,
          Number(instruction.reworkAttempt || 0),
          config,
          instruction.taskId || null
        );
        if (rd.ok) {
          errorRetryDecision = rd.decision;
          persistRetryMetric(config, rd.decision);
        }
      }
    } catch { /* non-fatal */ }

    updatedHistory.push({
      from: roleName,
      content: `ERROR: ${errorMsg}`,
      timestamp: new Date().toISOString(),
      status: "error"
    });
    return {
      status: isTransient ? "transient_error" : "error",
      summary: errorMsg,
      updatedHistory,
      prUrl: null,
      tier,
      failureClassification: null,
      retryDecision: errorRetryDecision
    };
  }

  // Save raw output for debugging
  try {
    writeFileSync(
      path.join(config.paths?.stateDir || "state", `debug_worker_${roleName.replace(/\s+/g, "_")}.txt`),
      `TASK: ${instruction.task}\n\nOUTPUT:\n${stdout}`,
      "utf8"
    );
  } catch { /* non-critical */ }

  const parsed: ParsedWorkerResponse = parseWorkerResponse(stdout, stderr);

  // If access was reported as blocked, persist a structured escalation (non-critical)
  if (parsed.status === "blocked" && /BOX_ACCESS=[^\n]*blocked/i.test(stdout)) {
    appendEscalation(config, {
      role: roleName,
      task: instruction.task,
      blockingReasonClass: BLOCKING_REASON_CLASS.ACCESS_BLOCKED,
      attempts: Number(instruction.reworkAttempt || 0),
      nextAction: NEXT_ACTION.RETRY,
      summary: "Worker reported BOX_ACCESS blocked"
    }).catch(() => { /* non-fatal */ });
  }

  // Policy gate: protected path changes require reviewer approval,
  // so workers cannot auto-finish these changes as fully done.
  try {
    const policy = await loadPolicy(config);
    if (policy?.requireReviewerApprovalForProtectedPaths) {
      const protectedTouched = getProtectedPathMatches(policy, parsed.filesTouched);
      if (protectedTouched.length > 0 && parsed.status === "done") {
        parsed.status = "partial";
        parsed.summary = `Reviewer approval required for protected paths: ${protectedTouched.join(", ")}\n${parsed.summary}`;
      }
    }

    const pathViolations = getRolePathViolations(policy, roleName, parsed.filesTouched);
    if (pathViolations.hasViolation) {
      const deniedPreview = pathViolations.deniedMatches.slice(0, 3).join(", ");
      const outsidePreview = pathViolations.outsideAllowed.slice(0, 3).join(", ");
      const violationSummary = [
        pathViolations.deniedMatches.length > 0 ? `denied paths: ${deniedPreview}${pathViolations.deniedMatches.length > 3 ? " ..." : ""}` : "",
        pathViolations.outsideAllowed.length > 0 ? `outside allowed paths: ${outsidePreview}${pathViolations.outsideAllowed.length > 3 ? " ..." : ""}` : ""
      ].filter(Boolean).join(" | ");

      parsed.status = "blocked";
      parsed.summary = `Role path policy violation for ${roleName}: ${violationSummary}\n${parsed.summary}`;

      // Persist structured escalation for policy violations (non-critical)
      appendEscalation(config, {
        role: roleName,
        task: instruction.task,
        blockingReasonClass: BLOCKING_REASON_CLASS.POLICY_VIOLATION,
        attempts: Number(instruction.reworkAttempt || 0),
        nextAction: NEXT_ACTION.ESCALATE_TO_HUMAN,
        summary: `Role path policy violation: ${violationSummary}`,
        prUrl: parsed.prUrl
      }).catch(() => { /* non-fatal */ });
    }
  } catch {
    // Non-fatal: if policy cannot be read, keep existing worker result.
  }

  // Auto-resolve transient ACCESS_BLOCKED escalations once the same worker+task
  // completes or partially completes in a later retry.
  if (parsed.status !== "blocked" && parsed.status !== "error") {
    resolveEscalationsForTask(config, {
      role: roleName,
      task: instruction.task,
      blockingReasonClass: BLOCKING_REASON_CLASS.ACCESS_BLOCKED,
      resolutionSummary: `Worker recovered with status=${parsed.status}`,
      resolvedBy: `worker:${roleName}`,
    }).catch(() => { /* non-fatal */ });
  }

  // Track premium request usage per worker (always log, even for failed verification attempts)
  logPremiumUsage(config, roleName, model, instruction.taskKind, Date.now() - startMs, {
    outcome: parsed.status,
    taskId: instruction.taskId || instruction.task || null
  });

  // ── Unconditional artifact hard-block (strict merge evidence gate) ───────────
  // For any worker+task combination that requires a post-merge artifact
  // (determined by role kind AND task kind), the gate is NON-BYPASSABLE —
  // it runs regardless of config.runtime.requireTaskContract.
  //
  // Discovery-safe task kinds (scan, doc, observation, diagnosis, discovery,
  // research, review, audit) are exempt even for done-capable roles, eliminating
  // false completion loss on read-only / non-merge tasks (adaptive throttle bypass).
  //
  // Explicit telemetry is emitted for both gate paths:
  //   - discoveryBypass=true  → task is non-merge; artifact gate skipped
  //   - discoveryBypass=false → merge task blocked due to missing artifact evidence
  //
  // The artifact is computed once here and reused by both this hard-block check
  // and the subsequent validateWorkerContract call, avoiding a duplicate evaluation
  // of the same output string.
  const isArtifactRequired = parsed.status === "done" && isArtifactGateRequired(workerKind ?? "unknown", instruction.taskKind);
  const precomputedArtifact = isArtifactRequired
    ? checkPostMergeArtifact(parsed.fullOutput || parsed.summary || "")
    : undefined;

  // Telemetry: emit bypass signal when discovery-safe task passes without artifact check
  if (parsed.status === "done" && !isArtifactRequired && isDiscoverySafeTask(instruction.taskKind)) {
    try {
      appendProgress(config,
        `[ARTIFACT GATE] ${roleName} taskKind=${instruction.taskKind} discoveryBypass=true — non-merge task bypasses artifact gate`
      );
    } catch { /* non-critical */ }
  }

  if (isArtifactRequired) {
    const artifact = precomputedArtifact!;
    if (!artifact.hasArtifact) {
      const artifactGaps = collectArtifactGaps(artifact);

      // Explicit telemetry for strict gate block (merge task without required artifact)
      try {
        appendProgress(config,
          `[ARTIFACT GATE] ${roleName} hard-blocked taskKind=${instruction.taskKind || "unknown"} discoveryBypass=false hasSha=${artifact.hasSha} hasTestOutput=${artifact.hasTestOutput} gaps=${artifactGaps.length}`
        );
      } catch { /* non-critical */ }

      parsed.status = "blocked";
      parsed.summary = `[ARTIFACT GATE] done hard-blocked — ${artifactGaps.join("; ")}\n${parsed.summary}`;

      // Write structured audit entry so hard-blocked attempts are traceable
      // in verification_audit.json alongside the soft-verify path entries.
      try {
        const auditPath = path.join(config.paths?.stateDir || "state", "verification_audit.json");
        let audit: unknown[] = [];
        try {
          if (existsSync(auditPath)) {
            const raw = readFileSync(auditPath, "utf8");
            const parsed2 = JSON.parse(raw);
            if (Array.isArray(parsed2)) audit = parsed2;
          }
        } catch { audit = []; }
        audit.push(buildArtifactAuditEntry(artifact, artifactGaps, {
          gateSource: "hard-block",
          workerKind: workerKind ?? "unknown",
          roleName: String(roleName),
          taskId: instruction.taskId || null,
          taskSnippet: String(instruction.task || "").slice(0, 100),
        }));
        if (audit.length > 200) audit = audit.slice(-200);
        writeFileSync(auditPath, JSON.stringify(audit, null, 2), "utf8");
      } catch { /* non-critical */ }
    }
  }

  // ── Verification gate — evidence-based done acceptance ──────────────────────
  // Feature-flagged via config.runtime.requireTaskContract (default: true).
  // Rework threshold: config.runtime.maxReworkAttempts (default: 2, per Athena AC#2 concern).
  // Evidence snapshot schema includes profile, report fields, gaps, attempt, and timestamp (AC#4).
  const requireTaskContract = config?.runtime?.requireTaskContract !== false;
  if (requireTaskContract && parsed.status === "done") {
    const maxReworkAttempts = Number(config?.runtime?.maxReworkAttempts ?? 2);
    // reworkAttempt is set by buildReworkInstruction on re-dispatches; 0 on the first call
    const currentAttempt = Number(instruction.reworkAttempt || 0);

    // Artifact check is mandatory for all done-capable workers, even when workerKind is unknown.
    // Unknown workerKind falls back to the DEFAULT_PROFILE (build required, others optional).
    // Task kind is passed through so non-merge tasks (scan, doc, etc.) skip the artifact gate.
    // verificationText is passed from the packet's verification field so the named-test-proof gate
    // fires when the packet names a specific test file/description in its verification commands.
    // precomputedArtifact is reused from the hard-block gate above to avoid evaluating the same
    // output string twice.
    const effectiveKind = workerKind ?? "unknown";
    const validationResult = validateWorkerContract(effectiveKind, {
      status: parsed.status,
      fullOutput: parsed.fullOutput,
      summary: parsed.summary
    }, {
      gatesConfig: config?.gates as Record<string, unknown> | undefined,
      taskKind: instruction.taskKind,
      verificationText: String(instruction.verification || "").trim() || null,
      precomputedArtifact,
    });

    // Evidence snapshot for audit (AC#4 defined schema)
    const postMergeArtifact = validationResult.evidence?.postMergeArtifact as ReturnType<typeof checkPostMergeArtifact> | undefined;
    const verificationEvidence: VerificationEvidence = {
      profile: String(validationResult.evidence?.profile || effectiveKind),
      hasReport: Boolean(validationResult.evidence?.hasReport),
      report: validationResult.evidence?.report || {},
      responsiveMatrix: validationResult.evidence?.responsiveMatrix || {},
      prUrl: (validationResult.evidence?.prUrl as string | null) ?? null,
      gaps: validationResult.gaps,
      passed: validationResult.passed,
      attempt: currentAttempt,
      validatedAt: new Date().toISOString(),
      roleName: String(roleName),
      taskSnippet: String(instruction.task || "").slice(0, 100),
      optionalFieldFailures: Array.isArray(validationResult.evidence?.optionalFieldFailures)
        ? (validationResult.evidence.optionalFieldFailures as string[])
        : [],
      artifactDetail: postMergeArtifact ? {
        hasSha: postMergeArtifact.hasSha,
        hasTestOutput: postMergeArtifact.hasTestOutput,
        hasUnfilledPlaceholder: postMergeArtifact.hasUnfilledPlaceholder,
        hasExplicitShaMarker: postMergeArtifact.hasExplicitShaMarker,
        hasExplicitTestBlock: postMergeArtifact.hasExplicitTestBlock,
        mergedSha: postMergeArtifact.mergedSha ?? null,
      } : null,
    };

    // Persist evidence snapshot for audit trail (non-critical, keep last 200 entries)
    try {
      const auditPath = path.join(config.paths?.stateDir || "state", "verification_audit.json");
      let audit = [];
      try {
        if (existsSync(auditPath)) {
          audit = JSON.parse(readFileSync(auditPath, "utf8"));
          if (!Array.isArray(audit)) audit = [];
        }
      } catch { audit = []; }
      audit.push(verificationEvidence);
      if (audit.length > 200) audit = audit.slice(-200);
      writeFileSync(auditPath, JSON.stringify(audit, null, 2), "utf8");
    } catch { /* non-critical */ }

    const reworkDecision = decideRework(validationResult, instruction.task, currentAttempt, maxReworkAttempts);

    if (reworkDecision.shouldEscalate) {
      // Max rework attempts exhausted — block the task instead of looping
      parsed.status = "blocked";
      parsed.summary = `[VERIFICATION GATE] Escalated after ${currentAttempt} failed attempt(s). ${reworkDecision.escalationReason}\n${parsed.summary}`;

      // Persist structured escalation payload (non-critical write)
      appendEscalation(config, {
        role: roleName,
        task: instruction.task,
        blockingReasonClass: BLOCKING_REASON_CLASS.MAX_REWORK_EXHAUSTED,
        attempts: currentAttempt,
        nextAction: NEXT_ACTION.ESCALATE_TO_HUMAN,
        summary: reworkDecision.escalationReason || validationResult.gaps.slice(0, 3).join("; "),
        prUrl: parsed.prUrl
      }).catch(() => { /* non-fatal */ });
    } else if (reworkDecision.shouldRework) {
      // Push the failed attempt into history so the worker sees context on rework
      updatedHistory.push({
        from: roleName,
        content: `[VERIFICATION FAILED — attempt ${currentAttempt + 1}/${maxReworkAttempts}] ${truncate(parsed.summary, 400)}`,
        fullOutput: parsed.fullOutput,
        prUrl: parsed.prUrl,
        timestamp: new Date().toISOString(),
        status: "verification_failed",
        verificationEvidence
      });
      await appendProgress(config,
        `[WORKER:${roleName}] Verification failed (attempt ${currentAttempt + 1}/${maxReworkAttempts}) — gaps: ${validationResult.gaps.slice(0, 2).join("; ")}`
      );
      // Re-dispatch with rework instruction; recursive depth is bounded by maxReworkAttempts
      return runWorkerConversation(config, roleName, reworkDecision.instruction, updatedHistory, sessionState);
    }

    parsed.verificationEvidence = verificationEvidence;
  }

  await appendLiveWorkerLog(
    liveLogPath,
    `\n[${new Date().toISOString()}] END status=${parsed.status}${parsed.prUrl ? ` pr=${parsed.prUrl}` : ""}\n`
  );

  await appendProgress(config,
    `[WORKER:${roleName}] Completed status=${parsed.status}${parsed.prUrl ? ` PR=${parsed.prUrl}` : ""}`
  );

  // ── Optional lineage graph recording (non-blocking; rollback via config.runtime.lineageGraphEnabled=false) ──
  // Only records when instruction.taskId is provided. Safe to skip — lineage is observability,
  // not execution state. On any failure, warn and continue.
  if (config?.runtime?.lineageGraphEnabled !== false && instruction.taskId) {
    try {
      const fp = buildTaskFingerprint(instruction.taskKind || "general", instruction.task || "");
      const attempt = Number(instruction.reworkAttempt || 0) + 1;
      const taskId = Number(instruction.taskId);
      const parentId = instruction.parentLineageId || null;
      const rootId = Number(instruction.lineageRootId || taskId);
      const depth = Number(instruction.lineageDepth || instruction.reworkAttempt || 0);
      const splitAncestry = Array.isArray(instruction.splitAncestry) ? instruction.splitAncestry : [];

      // Map worker result status to lineage entry status
      const statusMap = { done: LINEAGE_ENTRY_STATUS.PASSED, blocked: LINEAGE_ENTRY_STATUS.BLOCKED, error: LINEAGE_ENTRY_STATUS.FAILED };
      const entryStatus = statusMap[parsed.status] || LINEAGE_ENTRY_STATUS.FAILED;

      const lineageEntry = {
        id: buildLineageId(fp, taskId, attempt),
        taskId,
        semanticKey: String(instruction.semanticKey || `${instruction.taskKind || "general"}::${fp.slice(0, 16)}`),
        fingerprint: fp,
        parentId,
        rootId,
        depth,
        status: entryStatus,
        timestamp: new Date().toISOString(),
        failureReason: (entryStatus === LINEAGE_ENTRY_STATUS.FAILED || entryStatus === LINEAGE_ENTRY_STATUS.BLOCKED)
          ? truncate(parsed.summary || "unknown failure", 200)
          : null,
        splitAncestry
      };

      await appendLineageEntry(config, lineageEntry);
    } catch (lineageErr) {
      // Lineage recording failures are non-fatal — log but never block execution
      await appendProgress(config, `[LINEAGE] recording failed (non-fatal): ${String(lineageErr?.message || lineageErr)}`).catch(() => {});
    }
  }

  // Classify failure for error/blocked/partial statuses (non-critical)
  let failureClassification = null;
  let retryDecision = null;
  if (parsed.status === "error" || parsed.status === "blocked" || parsed.status === "partial") {
    // Derive blockingReasonClass from the escalation that was persisted (best-effort)
    let derivedRc = null;
    if (parsed.status === "blocked") {
      // Check common markers in summary text
      if (/policy violation|path policy/i.test(parsed.summary)) {
        derivedRc = BLOCKING_REASON_CLASS.POLICY_VIOLATION;
      } else if (/BOX_ACCESS.*blocked/i.test(parsed.fullOutput || "")) {
        derivedRc = BLOCKING_REASON_CLASS.ACCESS_BLOCKED;
      } else if (/rework.*exhausted|max rework/i.test(parsed.summary)) {
        derivedRc = BLOCKING_REASON_CLASS.MAX_REWORK_EXHAUSTED;
      } else if (/verification gate/i.test(parsed.summary)) {
        derivedRc = BLOCKING_REASON_CLASS.VERIFICATION_GATE;
      }
    }

    const cfResult = classifyFailure({
      workerStatus: parsed.status,
      blockingReasonClass: derivedRc,
      errorMessage: parsed.summary,
      taskId: instruction.taskId || null,
    });
    if (cfResult.ok) {
      failureClassification = cfResult.classification;
      appendFailureClassification(config, cfResult.classification).catch(() => { /* non-fatal */ });

      // Resolve adaptive retry decision based on failure class (non-critical)
      try {
        const rd = resolveRetryAction(
          cfResult.classification.primaryClass,
          Number(instruction.reworkAttempt || 0),
          config,
          instruction.taskId || null
        );
        if (rd.ok) {
          retryDecision = rd.decision;
          persistRetryMetric(config, rd.decision);
        }
      } catch { /* non-fatal — retry resolution must never block worker results */ }
    }
  }

  // Add worker's response to history
  updatedHistory.push({
    from: roleName,
    content: parsed.summary,
    fullOutput: parsed.fullOutput,
    prUrl: parsed.prUrl,
    timestamp: new Date().toISOString(),
    status: parsed.status
  });

  return {
    status: parsed.status,
    summary: parsed.summary,
    prUrl: parsed.prUrl,
    currentBranch: parsed.currentBranch,
    filesTouched: parsed.filesTouched,
    updatedHistory,
    workerKind,
    tier,
    verificationReport: parsed.verificationReport,
    responsiveMatrix: parsed.responsiveMatrix,
    verificationEvidence: parsed.verificationEvidence || null,
    fullOutput: parsed.fullOutput,
    failureClassification,
    retryDecision
  };
}

```

### FILE: src/core/worker_batch_planner.ts
```typescript
import { getRoleRegistry } from "./role_registry.js";
import { enforceModelPolicy } from "./model_policy.js";
import { resolveDependencyGraph, GRAPH_STATUS } from "./dependency_graph_resolver.js";
import { enforceLaneDiversity, selectWorkerByFitScore, LanePerformanceLedger } from "./capability_pool.js";
import { compactSingletonWaves } from "./dag_scheduler.js";

const CHARS_PER_TOKEN = 4;
const DEFAULT_CONTEXT_WINDOW_TOKENS = 100000;
const DEFAULT_CONTEXT_RESERVE_TOKENS = 12000;

/**
 * Maximum number of plans per batch when any plan in the batch carries explicit
 * dependency declarations (dependsOn / dependencies fields).  Dependency-linked
 * plans must be kept small so a worker can reason about the full dependency chain
 * without hitting context limits or missing inter-plan ordering constraints.
 *
 * Configurable via config.runtime.maxPlansPerDependencyBatch (default: 6).
 */
export const MAX_PLANS_PER_DEPENDENCY_BATCH = 6;
const SPLIT_CONFLICTING_PLANS_DEFAULT = false;
const KNOWN_MODEL_CONTEXT_WINDOWS = [
  { pattern: /gpt\s*[- ]?5\.[123]\s*[- ]?codex/i, tokens: 400000 },
  { pattern: /claude\s+sonnet\s+4\.6/i, tokens: 160000 },
  { pattern: /claude\s+sonnet/i, tokens: 160000 },
];

function normalizePositiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeNonNegativeNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function normalizeDependencyBatchLimit(value, fallback = MAX_PLANS_PER_DEPENDENCY_BATCH) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.max(1, Math.min(20, Math.floor(parsed)));
}

function shouldSplitConflictingPlansAcrossBatches(config: any): boolean {
  const configured = (config as any)?.planner?.splitConflictingPlansAcrossBatches;
  if (configured === undefined || configured === null) return SPLIT_CONFLICTING_PLANS_DEFAULT;
  return configured === true;
}

function hasExplicitDependencies(plan) {
  return (
    (Array.isArray(plan?.dependsOn) && plan.dependsOn.length > 0)
    || (Array.isArray(plan?.dependencies) && plan.dependencies.length > 0)
  );
}

function slugify(text) {
  return String(text || "worker")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "worker";
}

function aggregateTaskHints(plans = []) {
  const complexities = plans.map((plan) => String(plan?.riskLevel || plan?.complexity || "").toLowerCase());
  const hasCritical = complexities.some((value) => value === "critical");
  const hasHigh = complexities.some((value) => value === "high");

  return {
    estimatedLines: Math.ceil(estimateBatchTokens(plans) * 2.5),
    estimatedDurationMinutes: Math.max(20, plans.length * 20),
    complexity: hasCritical ? "critical" : hasHigh ? "high" : "medium"
  };
}

function getRegisteredWorkerModel(config, roleName) {
  const registry = getRoleRegistry(config);
  const workers = registry?.workers || {};
  for (const worker of Object.values(workers) as Array<{ name?: string; model?: string }>) {
    if (worker?.name === roleName && worker?.model) return worker.model;
  }
  return null;
}

function collectCandidateModels(config, roleName, taskKind, taskHints) {
  const requestedModels = [
    ...(Array.isArray(config?.copilot?.preferredModelsByTaskKind?.[taskKind])
      ? config.copilot.preferredModelsByTaskKind[taskKind]
      : []),
    ...(Array.isArray(config?.copilot?.preferredModelsByRole?.[roleName])
      ? config.copilot.preferredModelsByRole[roleName]
      : []),
    getRegisteredWorkerModel(config, roleName),
    config?.copilot?.defaultModel || "Claude Sonnet 4.6"
  ].filter(Boolean);

  const fallbackModel = config?.copilot?.defaultModel || "Claude Sonnet 4.6";
  const seen = new Set();
  const resolved = [];

  for (const requestedModel of requestedModels) {
    const policy = enforceModelPolicy(requestedModel, taskHints, fallbackModel);
    const model = String(policy.model || fallbackModel).trim();
    if (!model || seen.has(model)) continue;
    seen.add(model);
    resolved.push(model);
  }

  if (resolved.length === 0) resolved.push(fallbackModel);
  return resolved;
}

function resolveConfiguredContextWindow(config, modelName) {
  const configured = config?.copilot?.modelContextWindows;
  if (!configured || typeof configured !== "object") return null;

  if (configured[modelName] != null) {
    return normalizePositiveNumber(configured[modelName], null);
  }

  const target = String(modelName || "").toLowerCase();
  for (const [name, value] of Object.entries(configured)) {
    if (String(name).toLowerCase() === target) {
      return normalizePositiveNumber(value, null);
    }
  }

  return null;
}

export function getModelContextWindowTokens(config, modelName) {
  const configured = resolveConfiguredContextWindow(config, modelName);
  if (configured) return configured;

  const model = String(modelName || "");
  for (const entry of KNOWN_MODEL_CONTEXT_WINDOWS) {
    if (entry.pattern.test(model)) return entry.tokens;
  }

  return normalizePositiveNumber(config?.runtime?.workerContextTokenLimit, DEFAULT_CONTEXT_WINDOW_TOKENS);
}

export function getUsableModelContextTokens(config, modelName) {
  const windowTokens = getModelContextWindowTokens(config, modelName);
  const reserveTokens = normalizeNonNegativeNumber(
    config?.copilot?.modelContextReserveTokens,
    DEFAULT_CONTEXT_RESERVE_TOKENS
  );
  return Math.max(1, windowTokens - reserveTokens);
}

export function estimatePlanTokens(plan) {
  const payload = [
    plan?.task,
    plan?.context,
    plan?.scope,
    plan?.verification,
    plan?.before_state,
    plan?.after_state,
    plan?.beforeState,
    plan?.afterState,
    plan?.description,
    plan?.premortem ? JSON.stringify(plan.premortem) : "",
    Array.isArray(plan?.target_files) ? plan.target_files.join("\n") : "",
    Array.isArray(plan?.acceptance_criteria) ? plan.acceptance_criteria.join("\n") : "",
    JSON.stringify(Array.isArray(plan?.dependencies) ? plan.dependencies : []),
  ].filter(Boolean).join("\n");

  // Base: payload text / 4 chars per token + per-plan overhead (prompt framing, formatting)
  const payloadTokens = Math.ceil(payload.length / CHARS_PER_TOKEN);
  // Estimate worker reasoning overhead: more complex tasks need more reasoning tokens
  const fileCount = Array.isArray(plan?.target_files) ? plan.target_files.length : 0;
  const riskMultiplier = String(plan?.riskLevel || "").toLowerCase() === "high" ? 1.5
    : String(plan?.riskLevel || "").toLowerCase() === "medium" ? 1.2
    : 1.0;
  const baseOverhead = 300;
  const fileReadOverhead = fileCount * 150; // estimated tokens per file the worker will read
  const reasoningOverhead = Math.ceil(payloadTokens * 0.3 * riskMultiplier); // model reasoning space

  return Math.max(1, payloadTokens + baseOverhead + fileReadOverhead + reasoningOverhead);
}

/**
 * Estimate the total token budget a plan will consume during worker execution,
 * including prompt framing, file reads, and model reasoning. Used by the batch
 * planner to pack tasks into model context windows.
 */
export function estimatePlanExecutionTokens(plan) {
  return estimatePlanTokens(plan);
}

export function estimateBatchTokens(plans = []) {
  return plans.reduce((sum, plan) => sum + estimatePlanTokens(plan), 0);
}

export function packPlansIntoContextBatches(plans = [], usableTokens) {
  if (!Array.isArray(plans) || plans.length === 0) return [];

  const maxTokens = Math.max(1, normalizePositiveNumber(usableTokens, 1));
  const batches = [];
  let currentPlans = [];
  let currentTokens = 0;

  for (const plan of plans) {
    const planTokens = estimatePlanTokens(plan);
    const shouldSplit = currentPlans.length > 0 && currentTokens + planTokens > maxTokens;

    if (shouldSplit) {
      batches.push({ plans: currentPlans, estimatedTokens: currentTokens });
      currentPlans = [plan];
      currentTokens = planTokens;
      continue;
    }

    currentPlans.push(plan);
    currentTokens += planTokens;
  }

  if (currentPlans.length > 0) {
    batches.push({ plans: currentPlans, estimatedTokens: currentTokens });
  }

  return batches;
}

/**
 * Nucleus/Frontier classification result.
 * - nucleus: plans with critical-path score > 0 (they have downstream dependents that must be
 *   unblocked promptly; dispatching them first minimises downstream idle time).
 * - frontier: plans with critical-path score = 0 (leaf tasks — no other work depends on them;
 *   they can be packed aggressively to maximise context utilisation and reduce request count).
 */
export interface NucleusFrontierClassification {
  nucleus: any[];
  frontier: any[];
}

/**
 * Classify plans into nucleus (critical-path blockers) and frontier (dependency-ready leaves).
 *
 * Plans whose critical-path score > 0 are assigned to the nucleus — they have downstream
 * work waiting and must be dispatched first. Plans with score 0 are assigned to the frontier —
 * they can safely be co-batched with nucleus tasks to fill context window space, reducing
 * the total number of API requests without compromising dependency safety.
 *
 * @param plans              - plan objects (must be the same objects passed to computeCriticalPathScores)
 * @param criticalPathScores - map from plan id to downstream depth score
 * @returns classification with nucleus and frontier arrays (original order preserved within each)
 */
export function classifyNucleusFrontier(
  plans: any[],
  criticalPathScores: Map<string, number>
): NucleusFrontierClassification {
  if (!Array.isArray(plans) || plans.length === 0) return { nucleus: [], frontier: [] };

  const nucleus: any[] = [];
  const frontier: any[] = [];

  for (const plan of plans) {
    const id = String(plan?.task_id || plan?.task || plan?.role || "");
    const score = criticalPathScores.get(id) ?? 0;
    if (score > 0) {
      nucleus.push(plan);
    } else {
      frontier.push(plan);
    }
  }

  return { nucleus, frontier };
}

/**
 * Pack plans into context batches using the nucleus/frontier model.
 *
 * Strategy (reduces API request count vs naive sequential packing):
 *  1. Classify plans into nucleus (score > 0) and frontier (score = 0).
 *  2. Pack nucleus tasks into batches first — their ordering matters.
 *  3. Greedily absorb frontier tasks into each nucleus batch, filling the
 *     remaining context window space. Frontier tasks have no downstream
 *     dependents, so co-batching them with nucleus work is dependency-safe.
 *  4. Any frontier tasks that did not fit into nucleus batches are packed
 *     into additional frontier-only batches appended at the end.
 *
 * When no nucleus tasks exist (all plans are frontier), falls back to
 * standard packPlansIntoContextBatches.
 *
 * @param plans              - plan objects for one wave/sub-group
 * @param criticalPathScores - scores from computeCriticalPathScores
 * @param usableTokens       - usable context window size in tokens
 * @returns array of { plans, estimatedTokens } — same shape as packPlansIntoContextBatches
 */
export function packNucleusFrontierBatches(
  plans: any[],
  criticalPathScores: Map<string, number>,
  usableTokens: number
): Array<{ plans: unknown[]; estimatedTokens: number }> {
  if (!Array.isArray(plans) || plans.length === 0) return [];

  const maxTokens = Math.max(1, normalizePositiveNumber(usableTokens, 1));
  const { nucleus, frontier } = classifyNucleusFrontier(plans, criticalPathScores);

  if (nucleus.length === 0) {
    // All plans are frontier tasks (no critical-path blockers) — standard packing suffices.
    return packPlansIntoContextBatches(plans, maxTokens);
  }

  // Pack nucleus tasks into ordered batches.
  const nucleusBatches = packPlansIntoContextBatches(nucleus, maxTokens);

  // Greedily fill each nucleus batch with frontier tasks that fit within the context window.
  let remainingFrontier = [...frontier];
  for (const batch of nucleusBatches) {
    if (remainingFrontier.length === 0) break;
    const batchPlans = batch.plans as any[];
    const absorbed: any[] = [];
    for (const fp of remainingFrontier) {
      const proposed = [...batchPlans, ...absorbed, fp];
      if (estimateBatchTokens(proposed) <= maxTokens) {
        absorbed.push(fp);
      }
    }
    if (absorbed.length > 0) {
      batch.plans = [...batchPlans, ...absorbed];
      batch.estimatedTokens = estimateBatchTokens(batch.plans as any[]);
      const absorbedSet = new Set(absorbed);
      remainingFrontier = remainingFrontier.filter(p => !absorbedSet.has(p));
    }
  }

  // Pack any frontier tasks that could not be absorbed into nucleus batches.
  if (remainingFrontier.length > 0) {
    const frontierBatches = packPlansIntoContextBatches(remainingFrontier, maxTokens);
    return [...nucleusBatches, ...frontierBatches];
  }

  return nucleusBatches;
}

function chooseModelForRolePlans(config, roleName, plans, taskKind) {
  const taskHints = aggregateTaskHints(plans);
  const candidates = collectCandidateModels(config, roleName, taskKind, taskHints);
  let best = null;

  for (let index = 0; index < candidates.length; index += 1) {
    const model = candidates[index];
    const contextWindowTokens = getModelContextWindowTokens(config, model);
    const usableContextTokens = getUsableModelContextTokens(config, model);
    const batches = packPlansIntoContextBatches(plans, usableContextTokens);

    const score = {
      batchCount: batches.length,
      preferenceIndex: index,
      contextWindowTokens,
    };

    if (!best
      || score.batchCount < best.score.batchCount
      || (score.batchCount === best.score.batchCount && score.preferenceIndex < best.score.preferenceIndex)
      || (score.batchCount === best.score.batchCount
        && score.preferenceIndex === best.score.preferenceIndex
        && score.contextWindowTokens > best.score.contextWindowTokens)) {
      best = {
        model,
        contextWindowTokens,
        usableContextTokens,
        batches,
        score,
      };
    }
  }

  return best;
}

function buildSharedBranchName(roleName, plans) {
  const roleSlug = slugify(roleName);
  const firstTask = slugify(plans?.[0]?.task || plans?.[0]?.title || "batch").slice(0, 24);
  return `box/${roleSlug}-${firstTask || "batch"}`;
}

/**
 * Default maximum number of tasks per micro-wave when splitting large waves.
 * Keeps each dependency layer small so workers can reason without context overload.
 * Configurable via config.planner.maxTasksPerMicrowave.
 */
export const MICROWAVE_MAX_TASKS_DEFAULT = 3;

/**
 * Deterministically split plans into micro-waves of at most maxTasksPerWave tasks
 * per dependency layer, with critical-path ordering within each split wave.
 *
 * Algorithm:
 *  1. Group plans by their wave number.
 *  2. For each wave group larger than maxTasksPerWave, sort by intra-wave critical-path
 *     priority: tasks depended on by other tasks in the same wave are placed first.
 *  3. Slice sorted tasks into chunks of maxTasksPerWave and assign new sequential wave numbers.
 *  4. Waves that already fit within the limit are preserved as-is (only their wave number
 *     is resequenced to remain contiguous after earlier waves are split).
 *
 * @param plans - normalized plan objects (must have .wave and .dependencies fields)
 * @param maxTasksPerWave - max tasks per micro-wave (default MICROWAVE_MAX_TASKS_DEFAULT)
 * @returns new plans array with resequenced wave numbers; original objects are not mutated
 */
export function splitWavesIntoMicrowaves(
  plans: any[],
  maxTasksPerWave: number = MICROWAVE_MAX_TASKS_DEFAULT
): any[] {
  if (!Array.isArray(plans) || plans.length === 0) return [];

  const maxTasks = Math.max(1, Math.floor(maxTasksPerWave));

  // Group plans by their declared wave number
  const waveMap = new Map<number, any[]>();
  for (const plan of plans) {
    const wave = Number.isFinite(Number(plan.wave)) ? Number(plan.wave) : 1;
    if (!waveMap.has(wave)) waveMap.set(wave, []);
    waveMap.get(wave)!.push(plan);
  }

  const sortedWaveKeys = [...waveMap.keys()].sort((a, b) => a - b);
  const result: any[] = [];
  let nextWaveNum = 1;

  for (const waveKey of sortedWaveKeys) {
    const wavePlans = waveMap.get(waveKey)!;

    // Compute intra-wave dependent count for each task (critical-path ordering).
    // Only considers tasks within the same wave — cross-wave dependencies are excluded
    // to prevent inflating scores of tasks whose dependents belong to a later wave.
    const idToDepCount = new Map<string, number>();
    const waveTaskIds = new Set<string>();
    for (const plan of wavePlans) {
      const id = String(plan.task_id || plan.id || plan.task || "");
      if (id) { idToDepCount.set(id, 0); waveTaskIds.add(id); }
    }
    for (const plan of wavePlans) {
      const deps = Array.isArray(plan.dependencies) ? plan.dependencies : [];
      for (const dep of deps) {
        const depStr = String(dep || "");
        // Only count intra-wave dependencies (cross-wave deps do not affect ordering here)
        if (waveTaskIds.has(depStr)) {
          idToDepCount.set(depStr, (idToDepCount.get(depStr) ?? 0) + 1);
        }
      }
    }

    // Sort: tasks with more intra-wave dependents (critical path) go first
    const sorted = [...wavePlans].sort((a: any, b: any) => {
      const idA = String(a.task_id || a.id || a.task || "");
      const idB = String(b.task_id || b.id || b.task || "");
      return (idToDepCount.get(idB) ?? 0) - (idToDepCount.get(idA) ?? 0);
    });

    // Slice into micro-waves of maxTasks, reassigning wave numbers sequentially
    for (let i = 0; i < sorted.length; i += maxTasks) {
      const chunk = sorted.slice(i, i + maxTasks);
      for (const plan of chunk) {
        result.push({ ...plan, wave: nextWaveNum });
      }
      nextWaveNum++;
    }
  }

  return result;
}

export function computeCriticalPathScores(
  tasks: Array<{ id: string; dependsOn: string[] }>
): Map<string, number> {
  // Build reverse adjacency: id → ids of tasks that directly depend on it
  const dependentsOf = new Map<string, string[]>();
  for (const task of tasks) {
    if (!dependentsOf.has(task.id)) dependentsOf.set(task.id, []);
    for (const depId of (task.dependsOn || [])) {
      if (!dependentsOf.has(depId)) dependentsOf.set(depId, []);
      dependentsOf.get(depId)!.push(task.id);
    }
  }

  const memo = new Map<string, number>();

  function downstreamDepth(id: string, visiting: Set<string>): number {
    if (memo.has(id)) return memo.get(id)!;
    if (visiting.has(id)) return 0; // cycle guard — DAG assumption; should not trigger
    const deps = dependentsOf.get(id) || [];
    if (deps.length === 0) { memo.set(id, 0); return 0; }
    const next = new Set([...visiting, id]);
    const maxChild = deps.reduce((m, d) => Math.max(m, downstreamDepth(d, next)), 0);
    const score = 1 + maxChild;
    memo.set(id, score);
    return score;
  }

  for (const task of tasks) downstreamDepth(task.id, new Set());
  return memo;
}

export function buildRoleExecutionBatches(plans = [], config, capabilityPoolResult = null) {
  // ── Micro-wave splitting ──────────────────────────────────────────────────
  // When config.planner.maxTasksPerMicrowave is set to a positive integer,
  // large waves are split into micro-waves of at most that many tasks.
  // Critical-path tasks within each wave are placed first so the longest tail
  // of dependent work is unblocked as early as possible.
  //
  // This is opt-in: if maxTasksPerMicrowave is absent/falsy, no splitting
  // occurs and the function behaves identically to the previous version
  // (backward-compatible).
  const rawMicrowaveMax = (config as any)?.planner?.maxTasksPerMicrowave;
  const microwaveMax = Number.isFinite(Number(rawMicrowaveMax)) && Number(rawMicrowaveMax) > 0
    ? Math.floor(Number(rawMicrowaveMax))
    : 0; // 0 = disabled
  let inputPlans = microwaveMax > 0
    ? splitWavesIntoMicrowaves(plans as any[], microwaveMax)
    : (plans as any[]);

  // Compact non-dependent singleton waves into earlier waves when enabled.
  // This reduces unnecessary serial execution stages by merging singleton waves
  // whose sole task has no dependencies into the earliest eligible wave.
  // Opt-in via config.planner.compactSingletonWaves — backward-compatible (default: off).
  if ((config as any)?.planner?.compactSingletonWaves === true) {
    inputPlans = compactSingletonWaves(inputPlans);
  }

  const enforceDependencyAwareWaves = (config as any)?.planner?.requireDependencyAwareWaves !== false;
  const splitConflictingPlansAcrossBatches = shouldSplitConflictingPlansAcrossBatches(config);

  if (enforceDependencyAwareWaves) {
    const hasDependenciesDeclared = (inputPlans as any[]).some((plan) => hasExplicitDependencies(plan));
    if (!hasDependenciesDeclared) {
      inputPlans = (inputPlans as any[]).map((plan) => {
        if (plan && typeof plan === "object") {
          const mutable = plan as any;
          const explicitWave = Number(mutable.wave);
          if (!Number.isFinite(explicitWave) || explicitWave <= 0) {
            mutable.wave = 1;
          }
          if (!Array.isArray(mutable.waveDepends)) {
            mutable.waveDepends = [];
          }
          return mutable;
        }

        const explicitWave = Number(plan?.wave);
        const normalizedWave = Number.isFinite(explicitWave) && explicitWave > 0 ? explicitWave : 1;
        const waveDepends = Array.isArray(plan?.waveDepends) ? plan.waveDepends : [];
        return { ...plan, wave: normalizedWave, waveDepends };
      });
    }
  }

  // ── Dependency graph resolution ───────────────────────────────────────────
  // When any plan carries explicit dependency or file-scope hints, resolve the
  // full dependency graph to (a) assign accurate wave numbers and (b) detect
  // file-conflict pairs that lane detection may not cover (e.g. when no
  // capabilityPoolResult is available).
  // Graph resolution is advisory — a failure never blocks scheduling.
  const graphWaveByPlanId = new Map<string, number>();
  const graphConflictList: Array<[string, string]> = [];
  // Critical-path scores computed from the dependency graph.
  // Within the same wave, tasks with higher scores are dispatched first so the
  // longest tail of blocked downstream work is unblocked as early as possible.
  const criticalPathScoreByPlanId = new Map<string, number>();

  const hasGraphHints = (inputPlans as any[]).some(p =>
    (Array.isArray(p.filesInScope)   && p.filesInScope.length   > 0) ||
    (Array.isArray(p.dependsOn)      && p.dependsOn.length      > 0) ||
    (Array.isArray(p.dependencies)   && p.dependencies.length   > 0)
  );

  if (hasGraphHints) {
    try {
      const graphTasks = (inputPlans as any[]).map(p => ({
        id:                 String(p.task_id || p.task || p.role || ""),
        dependsOn:          Array.isArray(p.dependsOn)    ? p.dependsOn
                          : Array.isArray(p.dependencies) ? p.dependencies
                          : [],
        filesInScope:       Array.isArray(p.filesInScope) ? p.filesInScope : [],
        // Confidence metadata (opt-in): carry through for the readiness gate
        ...(typeof p.shapeConfidence      === "number" ? { shapeConfidence:      p.shapeConfidence      } : {}),
        ...(typeof p.budgetConfidence     === "number" ? { budgetConfidence:     p.budgetConfidence     } : {}),
        ...(typeof p.dependencyConfidence === "number" ? { dependencyConfidence: p.dependencyConfidence } : {}),
      }));
      const graph = resolveDependencyGraph(graphTasks);
      if (graph.status === GRAPH_STATUS.OK) {
        for (const wave of (graph.waves || [])) {
          for (const id of wave.taskIds) {
            graphWaveByPlanId.set(id, wave.wave);
          }
        }
        for (const cp of (graph.conflictPairs || [])) {
          graphConflictList.push([cp.taskA, cp.taskB]);
        }
      }
      // Compute critical-path scores for within-wave ordering.
      // Runs unconditionally so scores are available even when graph.status
      // is not OK (e.g. cycle detected) — the scores still reflect declared deps.
      const scores = computeCriticalPathScores(graphTasks);
      for (const [id, score] of scores) criticalPathScoreByPlanId.set(id, score);
    } catch {
      // advisory — never block scheduling on graph resolution error
    }
  }

  function resolvePlanWave(plan: any) {
    const explicitWave = Number(plan?.wave);
    if (Number.isFinite(explicitWave) && explicitWave > 0) {
      return explicitWave;
    }

    const planId = String(plan?.task_id || plan?.task || plan?.role || "");
    if (enforceDependencyAwareWaves) {
      const graphWave = graphWaveByPlanId.get(planId);
      if (Number.isFinite(Number(graphWave)) && Number(graphWave) > 0) {
        return Number(graphWave);
      }
    }
    return 1;
  }

  const sortedPlans = [...(inputPlans as any[])].sort((a, b) => {
    const idA   = String(a?.task_id || a?.task || a?.role || "");
    const idB   = String(b?.task_id || b?.task || b?.role || "");
    // Use graph-derived wave when the plan lacks an explicit wave field
    const waveA = resolvePlanWave(a);
    const waveB = resolvePlanWave(b);
    const waveDelta = waveA - waveB;
    if (waveDelta !== 0) return waveDelta;
    // Within the same wave, dispatch critical-path tasks first.
    // Higher critical-path score means more downstream work is blocked on this
    // task — running it earlier maximises throughput across the wave.
    const scoreA = criticalPathScoreByPlanId.get(idA) ?? 0;
    const scoreB = criticalPathScoreByPlanId.get(idB) ?? 0;
    const scoreDelta = scoreB - scoreA; // descending: higher score → earlier dispatch
    if (scoreDelta !== 0) return scoreDelta;
    return Number(a?.priority || 0) - Number(b?.priority || 0);
  });

  // ── Conflict-aware lane separation ────────────────────────────────────────
  // If the capability pool detected intra-lane file conflicts, plans that
  // share target files within the same lane must not be co-batched.
  // Build a conflict adjacency set: "planIndex_a:planIndex_b" → true
  const conflictedPairs = new Set();
  if (splitConflictingPlansAcrossBatches && capabilityPoolResult?.assignments) {
    const assignments = capabilityPoolResult.assignments;
    const laneMap = new Map();
    for (let i = 0; i < assignments.length; i++) {
      const lane = assignments[i]?.selection?.lane || "unknown";
      if (!laneMap.has(lane)) laneMap.set(lane, []);
      laneMap.get(lane).push(i);
    }
    for (const indices of laneMap.values()) {
      for (let a = 0; a < indices.length - 1; a++) {
        for (let b = a + 1; b < indices.length; b++) {
          const planA = assignments[indices[a]]?.plan;
          const planB = assignments[indices[b]]?.plan;
          const filesA = new Set(
            Array.isArray(planA?.target_files) ? planA.target_files.map(String) :
            (Array.isArray(planA?.targetFiles) ? planA.targetFiles.map(String) : [])
          );
          if (filesA.size === 0) continue;
          const hasOverlap = (
            Array.isArray(planB?.target_files) ? planB.target_files.map(String) :
            (Array.isArray(planB?.targetFiles) ? planB.targetFiles.map(String) : [])
          ).some(f => filesA.has(f));
          if (hasOverlap) {
            // Record original-array indices so we can match back to sortedPlans
            conflictedPairs.add(`${indices[a]}:${indices[b]}`);
            conflictedPairs.add(`${indices[b]}:${indices[a]}`);
          }
        }
      }
    }
  }

  // Build a lookup from plan object identity → original assignment index
  const planToAssignmentIndex = new Map();
  if (splitConflictingPlansAcrossBatches && capabilityPoolResult?.assignments) {
    capabilityPoolResult.assignments.forEach((a, i) => {
      if (a?.plan) planToAssignmentIndex.set(a.plan, i);
    });
  }

  // Build a plan-ID-based conflict set from the dependency graph resolution.
  // This supplements lane-based conflicts and covers cases where capabilityPoolResult is absent.
  const graphConflictIdPairs = new Set<string>();
  if (splitConflictingPlansAcrossBatches) {
    for (const [taskA, taskB] of graphConflictList) {
      graphConflictIdPairs.add(`${taskA}:${taskB}`);
      graphConflictIdPairs.add(`${taskB}:${taskA}`);
    }
  }

  /**
   * Determine whether two plan objects are in conflict via either:
   *  (a) lane-based file overlap detected by the capability pool, or
   *  (b) file-scope conflict detected by the dependency graph resolver.
   */
  function arePlansConflicting(planA: any, planB: any) {
    if (!splitConflictingPlansAcrossBatches) return false;
    const idxA = planToAssignmentIndex.get(planA) ?? -1;
    const idxB = planToAssignmentIndex.get(planB) ?? -1;
    // Lane-based conflict (assignment index pair)
    if (idxA !== -1 && idxB !== -1 && conflictedPairs.has(`${idxA}:${idxB}`)) return true;
    // Graph-based conflict (plan ID pair)
    if (graphConflictIdPairs.size > 0) {
      const planAId = String((planA as any)?.task_id || (planA as any)?.task || (planA as any)?.role || "");
      const planBId = String((planB as any)?.task_id || (planB as any)?.task || (planB as any)?.role || "");
      if (planAId && planBId && graphConflictIdPairs.has(`${planAId}:${planBId}`)) return true;
    }
    return false;
  }

  const roleBuckets = new Map();
  for (const plan of sortedPlans) {
    const roleName = String(plan?.role || "Evolution Worker");
    if (!roleBuckets.has(roleName)) roleBuckets.set(roleName, []);
    roleBuckets.get(roleName).push(plan);
  }

  const flattened = [];
  for (const [roleName, rolePlans] of roleBuckets.entries()) {
    const taskKind = String(rolePlans[0]?.taskKind || rolePlans[0]?.kind || "implementation");
    const sharedBranch = buildSharedBranchName(roleName, rolePlans);

    // ── Conflict-aware sub-grouping within a role bucket ──────────────────
    // Default behavior keeps potentially conflicting plans in the same role
    // batch so the worker can execute them in deterministic order. When
    // planner.splitConflictingPlansAcrossBatches=true, fallback to greedy
    // conflict coloring to isolate conflicting plans into separate sub-groups.
    const subGroups: Array<typeof rolePlans> = [];
    if (splitConflictingPlansAcrossBatches) {
      for (let i = 0; i < rolePlans.length; i++) {
        const plan = rolePlans[i];

        // Find the first group that has no conflict with this plan
        let placed = false;
        for (let g = 0; g < subGroups.length; g++) {
          const hasConflict = subGroups[g].some((existing) => arePlansConflicting(plan, existing));
          if (!hasConflict) {
            subGroups[g].push(plan);
            placed = true;
            break;
          }
        }
        if (!placed) {
          subGroups.push([plan]);
        }
      }
    } else {
      subGroups.push(rolePlans);
    }

    // ── Wave-boundary enforcement ─────────────────────────────────────────
    // Plans from different waves must NOT be co-batched into the same context
    // batch delivered to a worker. Wave N+1 tasks have data dependencies on
    // ALL wave N completions across all workers; co-batching would allow a
    // worker to start wave N+1 work before wave N is globally complete.
    //
    // For each sub-group, split by wave number first, then pack each wave
    // slice into context batches independently using the critical-path-sized
    // model selection.
    for (const subGroupPlans of subGroups) {
      const plansByWave = new Map<number, typeof subGroupPlans>();
      for (const plan of subGroupPlans) {
        const waveNum = resolvePlanWave(plan);
        if (!plansByWave.has(waveNum)) plansByWave.set(waveNum, []);
        plansByWave.get(waveNum)!.push(plan);
      }

      const sortedWaves = [...plansByWave.keys()].sort((a, b) => a - b);
      // Nucleus/frontier mode: opt-in via config.planner.nucleusFrontierMode.
      // When enabled, nucleus tasks (critical-path score > 0) are packed first
      // and frontier tasks (score = 0) are greedily absorbed into nucleus batches
      // to maximise context utilisation and reduce total request count.
      const nucleusFrontierMode = (config as any)?.planner?.nucleusFrontierMode === true;
      for (const waveNum of sortedWaves) {
        const wavePlans = plansByWave.get(waveNum)!;
        const selection = chooseModelForRolePlans(config, roleName, wavePlans, taskKind);

        // When nucleus/frontier mode is active, replace the standard sequential
        // batches with nucleus-first / frontier-fill batches.  This reduces the
        // total number of API requests while preserving dependency ordering.
        const activeBatches = nucleusFrontierMode && criticalPathScoreByPlanId.size > 0
          ? packNucleusFrontierBatches(wavePlans, criticalPathScoreByPlanId, selection.usableContextTokens)
          : selection.batches;

        // ── Dependency-sensitive batch splitting ──────────────────────────
        // When any plan in a model-selected batch carries explicit dependency
        // declarations, split oversized batches to MAX_PLANS_PER_DEPENDENCY_BATCH
        // plans each.  This prevents a worker from receiving a large context
        // bundle where dependency ordering can be silently ignored.
        const maxDepBatch = normalizeDependencyBatchLimit(
          (config as any)?.runtime?.maxPlansPerDependencyBatch,
          MAX_PLANS_PER_DEPENDENCY_BATCH
        );
        const splitBatches: Array<{ plans: unknown[]; estimatedTokens: number }> = [];
        for (const batch of activeBatches) {
          const batchPlans = batch.plans as any[];
          const hasDeps = batchPlans.some((p) => hasExplicitDependencies(p));
          if (hasDeps && batchPlans.length > maxDepBatch) {
            // Chunk into groups of maxDepBatch; distribute estimated tokens proportionally
            for (let offset = 0; offset < batchPlans.length; offset += maxDepBatch) {
              const chunk = batchPlans.slice(offset, offset + maxDepBatch);
              splitBatches.push({
                plans: chunk,
                estimatedTokens: Math.round(batch.estimatedTokens * chunk.length / batchPlans.length),
              });
            }
          } else {
            splitBatches.push(batch);
          }
        }

        const compactedBatches: Array<{ plans: unknown[]; estimatedTokens: number }> = [];
        for (const batch of splitBatches) {
          const currentPlans = batch.plans as any[];
          if (compactedBatches.length === 0) {
            compactedBatches.push(batch);
            continue;
          }

          // Best-fit packing: try to fit into the existing batch with the most
          // remaining capacity (fewest wasted tokens). This maximizes context
          // utilization per worker invocation.
          let bestFitIndex = -1;
          let bestFitRemaining = Infinity;
          for (let ci = 0; ci < compactedBatches.length; ci++) {
            const candidate = compactedBatches[ci];
            const candidatePlans = candidate.plans as any[];
            const mergedPlans = [...candidatePlans, ...currentPlans];
            const mergedTokens = estimateBatchTokens(mergedPlans);
            const mergedHasDeps = mergedPlans.some((p) => hasExplicitDependencies(p));
            const withinDepLimit = !mergedHasDeps || mergedPlans.length <= maxDepBatch;
            const withinContextLimit = mergedTokens <= selection.usableContextTokens;

            if (withinDepLimit && withinContextLimit) {
              const remaining = selection.usableContextTokens - mergedTokens;
              if (remaining < bestFitRemaining) {
                bestFitIndex = ci;
                bestFitRemaining = remaining;
              }
            }
          }

          if (bestFitIndex >= 0) {
            const target = compactedBatches[bestFitIndex];
            const merged = [...(target.plans as any[]), ...currentPlans];
            target.plans = merged;
            target.estimatedTokens = estimateBatchTokens(merged);
          } else {
            compactedBatches.push(batch);
          }
        }

        compactedBatches.forEach((batch, index) => {
          const utilization = selection.usableContextTokens > 0
            ? Math.round((batch.estimatedTokens / selection.usableContextTokens) * 100)
            : 0;
          flattened.push({
            role: roleName,
            plans: batch.plans,
            model: selection.model,
            contextWindowTokens: selection.contextWindowTokens,
            usableContextTokens: selection.usableContextTokens,
            estimatedTokens: batch.estimatedTokens,
            contextUtilizationPercent: utilization,
            taskKind,
            sharedBranch,
            wave: waveNum,
            roleBatchIndex: index + 1,
            roleBatchTotal: compactedBatches.length,
            githubFinalizer: index === compactedBatches.length - 1,
          });
        });
      }
    }
  }

  // ── Lane diversity enforcement ───────────────────────────────────────────────
  // When a capabilityPoolResult is available (computed by capability_pool before
  // dispatch), enforce the minimum lane diversity threshold.  A violation is
  // advisory — it does NOT block scheduling — but it is surfaced on every batch
  // descriptor so the orchestrator or cycle-analytics can observe and react.
  //
  // Configurable via config.runtime.minDiversityLanes (default: 2).
  const minDiversityLanes = Number(
    (config as any)?.runtime?.minDiversityLanes ?? 2
  );
  const diversityCheck = capabilityPoolResult
    ? enforceLaneDiversity(capabilityPoolResult, { minLanes: minDiversityLanes })
    : { meetsMinimum: true, activeLaneCount: 0, warning: "" };

  const diversityViolation = !diversityCheck.meetsMinimum
    ? { activeLaneCount: diversityCheck.activeLaneCount, minRequired: minDiversityLanes, warning: diversityCheck.warning }
    : null;

  // Sort by wave so that sequential dispatch (orchestrator's for-loop) respects the
  // global wave boundary across roles.  Without this, role-grouped insertion order
  // produces [A-wave1, A-wave2, B-wave1, B-wave2] — causing wave-2 work to start
  // before all wave-1 work is globally complete.
  flattened.sort((a, b) => (a.wave as number) - (b.wave as number));

  return flattened.map((batch, index) => ({
    ...batch,
    bundleIndex: index + 1,
    totalBundles: flattened.length,
    diversityViolation,
  }));
}

/**
 * Build execution batches using fit-score-based worker assignment.
 *
 * Alternative entry point to buildRoleExecutionBatches for callers that want
 * worker-task fit scoring (selectWorkerByFitScore) rather than relying solely on
 * the plan's `role` field.
 *
 * Each plan is assigned the highest-scoring worker (deterministic tie-breaking)
 * and its `role` field is set accordingly before delegating to
 * buildRoleExecutionBatches.
 *
 * @param plans          — plan objects to assign and batch
 * @param config         — BOX config
 * @param lanePerformance — optional historical lane outcomes for fit scoring
 * @returns same shape as buildRoleExecutionBatches
 */
export function buildFitScoredBatches(
  plans: any[],
  config?: object,
  lanePerformance?: LanePerformanceLedger
) {
  if (!Array.isArray(plans) || plans.length === 0) {
    return buildRoleExecutionBatches([], config);
  }

  const assignedPlans = plans.map(plan => {
    const selection = selectWorkerByFitScore(plan, config, lanePerformance);
    return { ...plan, role: selection.role };
  });

  return buildRoleExecutionBatches(assignedPlans, config);
}

```

### FILE: src/core/model_policy.ts
```typescript
/**
 * Model Policy — Enforces banned/allowed model rules system-wide.
 *
 * ABSOLUTE RULES:
 *   - Claude Opus 4.6 Fast Mode (30x rate) = FORBIDDEN ALWAYS
 *   - Claude Opus 4.6 Fast / Preview = FORBIDDEN ALWAYS
 *   - Any model with "fast" in name = FORBIDDEN ALWAYS
 *   - Claude Opus 4.5/4.6 (regular) = allowed ONLY for large tasks
 *   - 3x rate models = allowed for long-duration tasks
 *
 * This module is imported by worker_runner.js and agent_loader.js
 * to enforce model selection before any AI call.
 */

import path from "node:path";
import { readJson, writeJson } from "./fs_utils.js";

// ── Banned model patterns (case-insensitive) ─────────────────────────────────
// These patterns match against the resolved model slug BEFORE any CLI call.
// If a model matches ANY pattern, it is rejected unconditionally.

const BANNED_PATTERNS = [
  /fast/i,                    // Any model with "fast" in name — 30x rate risk
  /preview/i,                 // Preview/experimental models — unstable behavior
  /30x/i,                     // Explicit 30x rate reference
  /opus.*fast/i,              // Claude Opus fast mode specifically
  /fast.*opus/i,              // Reverse order match
];

// ── Opus-tier models (expensive, only for large tasks) ───────────────────────
// These are allowed ONLY when estimated task scope justifies the cost.

const OPUS_PATTERNS = [
  /opus/i,                    // Any Opus model
];

// ── Large-task threshold ─────────────────────────────────────────────────────
// Tasks must meet at least ONE criterion to use Opus:
// - estimatedLines >= 3000
// - estimatedDurationMinutes >= 120 (2 hours)
// - taskComplexity === "critical" or "massive"

const OPUS_MIN_ESTIMATED_LINES = 3000;
const OPUS_MIN_DURATION_MINUTES = 120;
const OPUS_ALLOWED_COMPLEXITIES = new Set(["critical", "massive", "high"]);

// ── Typed interfaces for decision branches ────────────────────────────────────

/** Hints describing a task's estimated scope, used for model selection decisions. */
export interface TaskHints {
  estimatedLines?: number;
  estimatedDurationMinutes?: number;
  complexity?: string;
  /** Expected quality gain — used by uncertainty-aware routing (Packet 14). */
  expectedQualityGain?: number;
}

/** Available model tiers for complexity-based routing. */
export interface ModelOptions {
  defaultModel?: string;
  strongModel?: string;
  efficientModel?: string;
}

/** Historical ROI data for uncertainty-aware routing. */
export interface RoutingHistory {
  /** Recent ROI value for the current task type (0–∞; 0 means no history). */
  recentROI?: number;
}

/**
 * Check if a model is absolutely banned.
 * @param {string} modelName - Model name or slug
 * @returns {{ banned: boolean, reason: string }}
 */
export function isModelBanned(modelName) {
  const name = String(modelName || "").trim();
  if (!name) return { banned: false, reason: "" };

  for (const pattern of BANNED_PATTERNS) {
    if (pattern.test(name)) {
      return {
        banned: true,
        reason: `MODEL BANNED: "${name}" matches forbidden pattern ${pattern}. Fast/preview/30x models are absolutely forbidden in BOX.`
      };
    }
  }
  return { banned: false, reason: "" };
}

/**
 * Check if a model is Opus-tier (expensive).
 * @param {string} modelName
 * @returns {boolean}
 */
export function isOpusTier(modelName) {
  const name = String(modelName || "").trim();
  return OPUS_PATTERNS.some(p => p.test(name));
}

/**
 * Check if task scope justifies Opus usage.
 * @param {{ estimatedLines?: number, estimatedDurationMinutes?: number, complexity?: string }} taskHints
 * @returns {{ allowed: boolean, reason: string }}
 */
export function isOpusJustified(taskHints: TaskHints = {}) {
  const lines = Number(taskHints.estimatedLines || 0);
  const duration = Number(taskHints.estimatedDurationMinutes || 0);
  const complexity = String(taskHints.complexity || "").toLowerCase();

  if (lines >= OPUS_MIN_ESTIMATED_LINES) {
    return { allowed: true, reason: `Task scope ${lines} lines >= ${OPUS_MIN_ESTIMATED_LINES} threshold` };
  }
  if (duration >= OPUS_MIN_DURATION_MINUTES) {
    return { allowed: true, reason: `Task duration ${duration}m >= ${OPUS_MIN_DURATION_MINUTES}m threshold` };
  }
  if (OPUS_ALLOWED_COMPLEXITIES.has(complexity)) {
    return { allowed: true, reason: `Task complexity "${complexity}" qualifies for Opus` };
  }

  return {
    allowed: false,
    reason: `Task does not meet Opus thresholds (lines=${lines}<${OPUS_MIN_ESTIMATED_LINES}, duration=${duration}m<${OPUS_MIN_DURATION_MINUTES}m, complexity="${complexity}")`
  };
}

/**
 * Routing reason codes for observability.
 * @enum {string}
 */
export const ROUTING_REASON = Object.freeze({
  ALLOWED:           "ALLOWED",
  BANNED:            "BANNED",
  OPUS_DOWNGRADED:   "OPUS_DOWNGRADED",
  EMPTY_MODEL:       "EMPTY_MODEL",
});

/**
 * Complexity tier taxonomy (T1/T2/T3).
 * Maps task complexity to model selection and token budget strategy.
 *
 * @enum {string}
 */
export const COMPLEXITY_TIER = Object.freeze({
  /** T1: routine patch — short context, quick execution. */
  T1: "T1",
  /** T2: medium — two-pass reasoning, moderate context. */
  T2: "T2",
  /** T3: architectural — deep think budget, critic mandatory. */
  T3: "T3",
});

/**
 * Classify a task into a complexity tier based on task hints.
 *
 * @param {{ estimatedLines?: number, estimatedDurationMinutes?: number, complexity?: string }} taskHints
 * @returns {{ tier: string, reason: string, maxContinuations: number }}
 */
export function classifyComplexityTier(taskHints: TaskHints = {}) {
  const lines = Number(taskHints.estimatedLines || 0);
  const duration = Number(taskHints.estimatedDurationMinutes || 0);
  const complexity = String(taskHints.complexity || "").toLowerCase();

  // T3: architectural — needs deep reasoning
  if (OPUS_ALLOWED_COMPLEXITIES.has(complexity) || lines >= 3000 || duration >= 120) {
    return { tier: COMPLEXITY_TIER.T3, reason: `complexity=${complexity} lines=${lines} duration=${duration}`, maxContinuations: 5 };
  }

  // T2: medium — two-pass, moderate scope
  if (lines >= 500 || duration >= 30 || complexity === "medium") {
    return { tier: COMPLEXITY_TIER.T2, reason: `complexity=${complexity} lines=${lines} duration=${duration}`, maxContinuations: 3 };
  }

  // T1: routine — quick patch
  return { tier: COMPLEXITY_TIER.T1, reason: `complexity=${complexity} lines=${lines} duration=${duration}`, maxContinuations: 1 };
}

/**
 * Route model selection by task complexity and uncertainty (Packet 7).
 * Returns the recommended model based on complexity tier classification.
 *
 * @param {{ estimatedLines?: number, estimatedDurationMinutes?: number, complexity?: string }} taskHints
 * @param {{ defaultModel?: string, strongModel?: string, efficientModel?: string }} modelOptions
 * @returns {{ model: string, tier: string, reason: string }}
 */
export function routeModelByComplexity(taskHints: TaskHints = {}, modelOptions: ModelOptions = {}) {
  const defaultModel = modelOptions.defaultModel || "Claude Sonnet 4.6";
  const strongModel = modelOptions.strongModel || defaultModel;
  const efficientModel = modelOptions.efficientModel || defaultModel;

  const { tier, reason } = classifyComplexityTier(taskHints);

  if (tier === COMPLEXITY_TIER.T3) {
    return { model: strongModel, tier, reason: `T3 (deep reasoning): ${reason}` };
  }
  if (tier === COMPLEXITY_TIER.T1) {
    return { model: efficientModel, tier, reason: `T1 (routine): ${reason}` };
  }
  return { model: defaultModel, tier, reason: `T2 (medium): ${reason}` };
}

/**
 * Enforce model policy: ban forbidden models, gate Opus to large tasks.
 * Returns the safe model to use — either the requested model (if allowed)
 * or a downgraded fallback.
 *
 * @param {string} requestedModel - Model requested by worker/config
 * @param {{ estimatedLines?: number, estimatedDurationMinutes?: number, complexity?: string, expectedQualityGain?: number }} taskHints
 * @param {string} fallbackModel - Safe fallback model
 * @returns {{ model: string, downgraded: boolean, reason: string, routingReasonCode: string }}
 */
export function enforceModelPolicy(requestedModel, taskHints = {}, fallbackModel = "Claude Sonnet 4.6") {
  const name = String(requestedModel || "").trim();

  // Step 1: Absolute ban check
  const banCheck = isModelBanned(name);
  if (banCheck.banned) {
    return {
      model: fallbackModel,
      downgraded: true,
      reason: banCheck.reason,
      routingReasonCode: ROUTING_REASON.BANNED
    };
  }

  // Step 2: Opus tier gate
  if (isOpusTier(name)) {
    const justification = isOpusJustified(taskHints);
    if (!justification.allowed) {
      return {
        model: fallbackModel,
        downgraded: true,
        reason: `Opus downgraded to ${fallbackModel}: ${justification.reason}`,
        routingReasonCode: ROUTING_REASON.OPUS_DOWNGRADED
      };
    }
  }

  // Step 3: Model is allowed
  return {
    model: name || fallbackModel,
    downgraded: false,
    reason: "",
    routingReasonCode: name ? ROUTING_REASON.ALLOWED : ROUTING_REASON.EMPTY_MODEL
  };
}

/**
 * Token ROI telemetry entry (Packet 14).
 * Records model choice, token spend, and quality outcome per task for
 * uncertainty-aware routing optimization.
 *
 * @typedef {object} TokenROIEntry
 * @property {string} taskId
 * @property {string} model
 * @property {string} tier — T1/T2/T3
 * @property {number} estimatedTokens — estimated prompt tokens
 * @property {string} outcome — done/partial/blocked/error
 * @property {number} qualityScore — 0-1 quality assessment
 * @property {string} recordedAt — ISO timestamp
 */

/**
 * Compute token ROI for a completed task.
 *
 * @param {{ model: string, tier: string, estimatedTokens: number, outcome: string, qualityScore?: number }} entry
 * @returns {{ roi: number, efficiency: string }}
 */
export function computeTokenROI(entry) {
  const tokens = entry.estimatedTokens || 1;
  const quality = entry.qualityScore ?? (entry.outcome === "done" ? 1.0 : entry.outcome === "partial" ? 0.5 : 0);
  const roi = Math.round((quality / (tokens / 1000)) * 100) / 100;

  let efficiency = "normal";
  if (roi > 1.0) efficiency = "high";
  else if (roi < 0.2) efficiency = "low";

  return { roi, efficiency };
}

/**
 * Route model selection with uncertainty awareness (Packet 14).
 * Combines complexity tier classification with historical ROI data.
 *
 * @param {{ estimatedLines?: number, estimatedDurationMinutes?: number, complexity?: string }} taskHints
 * @param {{ defaultModel?: string, strongModel?: string, efficientModel?: string }} modelOptions
 * @param {{ recentROI?: number }} history — historical ROI for this task type
 * @returns {{ model: string, tier: string, reason: string, uncertainty: string }}
 */
export function routeModelWithUncertainty(taskHints: TaskHints = {}, modelOptions: ModelOptions = {}, history: RoutingHistory = {}) {
  const base = routeModelByComplexity(taskHints, modelOptions);
  const recentROI = Number(history.recentROI || 0);

  // If historical ROI for this tier is low, consider downgrading
  let uncertainty = "low";
  if (recentROI > 0 && recentROI < 0.3) {
    uncertainty = "high";
    // For high-uncertainty tasks with low historical ROI, use the default model
    if (base.tier === COMPLEXITY_TIER.T3 && recentROI < 0.2) {
      return {
        model: modelOptions.defaultModel || "Claude Sonnet 4.6",
        tier: base.tier,
        reason: `${base.reason} — downgraded due to low historical ROI (${recentROI})`,
        uncertainty,
      };
    }
  } else if (recentROI >= 0.3 && recentROI < 0.7) {
    uncertainty = "medium";
  }

  return { ...base, uncertainty };
}

// ── Route ROI Ledger — Packet 14 persistence ──────────────────────────────────
//
// The ledger persists expected and realized quality scores per routing decision
// so that historical ROI deltas can inform next-cycle model selection.
//
// File: state/route_roi_ledger.json  (array of RouteROIEntry, capped at MAX_LEDGER_SIZE)

const ROUTE_ROI_LEDGER_FILE = "route_roi_ledger.json";

/** Maximum number of entries kept in the ledger. */
export const MAX_LEDGER_SIZE = 200;

/**
 * A single routing decision record in the ROI ledger.
 *
 * @property taskId           — unique task identifier
 * @property model            — model that was selected for this task
 * @property tier             — complexity tier (T1/T2/T3)
 * @property estimatedTokens  — estimated prompt token count at routing time
 * @property expectedQuality  — quality score predicted at routing time (0–1)
 * @property realizedQuality  — actual quality score recorded after task completion (null until realized)
 * @property outcome          — task outcome ("done"/"partial"/"blocked"/"error"; null until realized)
 * @property roi              — computed ROI = realizedQuality / (estimatedTokens / 1000); null until realized
 * @property roiDelta         — realizedROI − expectedROI; learning signal for next-cycle routing; null until realized
 * @property routedAt         — ISO timestamp when the routing decision was made
 * @property realizedAt       — ISO timestamp when the outcome was recorded; null until realized
 */
export interface RouteROIEntry {
  taskId: string;
  model: string;
  tier: string;
  estimatedTokens: number;
  expectedQuality: number;
  realizedQuality: number | null;
  outcome: string | null;
  roi: number | null;
  roiDelta: number | null;
  routedAt: string;
  realizedAt: string | null;
}

/**
 * Append a new routing decision to the ROI ledger.
 * The realized fields (realizedQuality, outcome, roi, roiDelta, realizedAt)
 * start as null and are populated later by realizeRouteROIEntry().
 *
 * Never throws — write errors propagate to the caller.
 *
 * @param config  — BOX config object (config.paths.stateDir)
 * @param entry   — routing decision to record (realized fields optional, default null)
 */
export async function appendRouteROIEntry(
  config: object,
  entry: Pick<RouteROIEntry, "taskId" | "model" | "tier" | "estimatedTokens" | "expectedQuality"> & Partial<RouteROIEntry>
): Promise<void> {
  const stateDir = (config as any)?.paths?.stateDir || "state";
  const filePath = path.join(stateDir, ROUTE_ROI_LEDGER_FILE);

  const ledger: RouteROIEntry[] = await readJson(filePath, []);
  const safeList: RouteROIEntry[] = Array.isArray(ledger) ? ledger : [];

  const record: RouteROIEntry = {
    taskId:          entry.taskId,
    model:           entry.model,
    tier:            entry.tier,
    estimatedTokens: entry.estimatedTokens,
    expectedQuality: entry.expectedQuality,
    realizedQuality: entry.realizedQuality ?? null,
    outcome:         entry.outcome ?? null,
    roi:             entry.roi ?? null,
    roiDelta:        entry.roiDelta ?? null,
    routedAt:        entry.routedAt || new Date().toISOString(),
    realizedAt:      entry.realizedAt ?? null,
  };

  safeList.push(record);
  const trimmed = safeList.length > MAX_LEDGER_SIZE ? safeList.slice(-MAX_LEDGER_SIZE) : safeList;
  await writeJson(filePath, trimmed);
}

/**
 * Record the realized outcome for a previously appended routing entry.
 * Locates the most-recent entry for taskId, computes ROI and delta, then
 * persists the updated ledger.
 *
 * No-op (safe) when taskId is not found in the ledger.
 *
 * @param config        — BOX config object
 * @param taskId        — task identifier matching the original appendRouteROIEntry() call
 * @param qualityScore  — actual quality score (0–1) assessed after task completion
 * @param outcome       — task outcome string ("done"/"partial"/"blocked"/"error")
 */
export async function realizeRouteROIEntry(
  config: object,
  taskId: string,
  qualityScore: number,
  outcome: string
): Promise<void> {
  const stateDir = (config as any)?.paths?.stateDir || "state";
  const filePath = path.join(stateDir, ROUTE_ROI_LEDGER_FILE);

  const ledger: RouteROIEntry[] = await readJson(filePath, []);
  const safeList: RouteROIEntry[] = Array.isArray(ledger) ? ledger : [];

  // Find the last unrealized entry for this taskId
  let found = false;
  for (let i = safeList.length - 1; i >= 0; i--) {
    if (safeList[i].taskId === taskId && safeList[i].realizedAt === null) {
      const entry = safeList[i];
      const tokens = entry.estimatedTokens || 1;
      const roi = Math.round((qualityScore / (tokens / 1000)) * 100) / 100;
      const expectedROI = Math.round((entry.expectedQuality / (tokens / 1000)) * 100) / 100;
      safeList[i] = {
        ...entry,
        realizedQuality: qualityScore,
        outcome,
        roi,
        roiDelta: Math.round((roi - expectedROI) * 1000) / 1000,
        realizedAt: new Date().toISOString(),
      };
      found = true;
      break;
    }
  }

  if (found) {
    await writeJson(filePath, safeList);
  }
}

/**
 * Load the full ROI ledger from state.
 * Returns an empty array when the file does not exist.
 *
 * @param config — BOX config object
 */
export async function loadRouteROILedger(config: object): Promise<RouteROIEntry[]> {
  const stateDir = (config as any)?.paths?.stateDir || "state";
  const filePath = path.join(stateDir, ROUTE_ROI_LEDGER_FILE);
  const data = await readJson(filePath, []);
  return Array.isArray(data) ? data : [];
}

// ── Cost-aware routing — quality-floor model selection ────────────────────────
//
// Selects the cheapest model whose expected quality meets or exceeds a caller-
// supplied floor.  Falls back to the strongest available model when no candidate
// qualifies, marking the result so the caller can log a warning.

/** Heuristic default quality scores per model (case-insensitive normalized key). */
const DEFAULT_MODEL_QUALITY: Record<string, number> = {
  "claude sonnet 4.6": 0.85,
  "claude haiku 4":    0.70,
  "claude haiku 4.5":  0.72,
  "claude opus 4.6":   0.95,
};

/**
 * Route to the cheapest model that still meets a minimum quality floor.
 *
 * Candidates are evaluated cheapest → strongest.  The first candidate whose
 * expected quality meets or exceeds `qualityFloor` is returned.  When no
 * candidate satisfies the constraint the strongest model is returned and
 * `meetsQualityFloor` is `false`.
 *
 * @param taskHints    — task scope for complexity-tier derivation
 * @param modelOptions — model pool; supply efficientModel / defaultModel / strongModel
 *                       and optionally qualityByModel to override heuristic scores
 * @param qualityFloor — minimum acceptable quality score (0–1; default 0.7)
 * @returns {{ model, tier, reason, meetsQualityFloor }}
 */
export function routeModelByCost(
  taskHints: TaskHints = {},
  modelOptions: ModelOptions & { qualityByModel?: Record<string, number> } = {},
  qualityFloor = 0.7
): { model: string; tier: string; reason: string; meetsQualityFloor: boolean } {
  const { tier } = classifyComplexityTier(taskHints);
  const qualityByModel = modelOptions.qualityByModel || {};

  const resolveQuality = (name: string): number => {
    const key = String(name || "").toLowerCase();
    return qualityByModel[name] ?? qualityByModel[key] ?? DEFAULT_MODEL_QUALITY[key] ?? 0.75;
  };

  const efficientModel = modelOptions.efficientModel || "";
  const defaultModel   = modelOptions.defaultModel   || "Claude Sonnet 4.6";
  const strongModel    = modelOptions.strongModel    || defaultModel;

  // Build candidate list cheapest → strongest (deduplication preserving order)
  const candidates: string[] = [];
  const seen = new Set<string>();
  for (const m of [efficientModel, defaultModel, strongModel]) {
    if (m && !seen.has(m)) { candidates.push(m); seen.add(m); }
  }

  for (const candidate of candidates) {
    const quality = resolveQuality(candidate);
    if (quality >= qualityFloor) {
      return {
        model: candidate,
        tier,
        reason: `cost-aware: "${candidate}" meets quality floor ${qualityFloor} (score=${quality}) for tier ${tier}`,
        meetsQualityFloor: true,
      };
    }
  }

  // No candidate meets the floor — use strongest as safe fallback
  const fallback = candidates[candidates.length - 1] || defaultModel;
  const fallbackQuality = resolveQuality(fallback);
  return {
    model: fallback,
    tier,
    reason: `cost-aware: no model meets quality floor ${qualityFloor}; using strongest "${fallback}" (score=${fallbackQuality}) for tier ${tier}`,
    meetsQualityFloor: fallbackQuality >= qualityFloor,
  };
}

// ── Completion-yield ROI-adjusted routing ─────────────────────────────────────
//
// Adjusts the quality floor based on historical tier ROI so that
// model selection optimises for completion yield:
//   - High-ROI tiers → relax floor slightly → cheaper model passes (cost saving)
//   - Low-ROI tiers  → tighten floor        → better model required (quality uplift)
//   - No history     → use floor as-is      → deterministic baseline behaviour

const ROI_HIGH_THRESHOLD   = 0.8;   // Above this: tier is productive; allow relaxation
const ROI_LOW_THRESHOLD    = 0.3;   // Below this (and > 0): tier is under-performing; tighten
const FLOOR_RELAX_AMOUNT   = 0.05;  // Floor reduction when ROI is high
const FLOOR_TIGHTEN_AMOUNT = 0.10;  // Floor increase when ROI is low
const MIN_QUALITY_FLOOR    = 0.50;  // Absolute minimum — always route to something
const MAX_QUALITY_FLOOR    = 0.99;  // Absolute maximum — preserve a model selection path

/**
 * Route to the cheapest model that satisfies a quality floor adjusted by
 * the tier's historical completion-yield ROI.
 *
 * The effective floor is derived from `qualityFloor` and `tierROI`:
 *   - tierROI > ROI_HIGH_THRESHOLD → floor − FLOOR_RELAX_AMOUNT (productive tier; cheaper ok)
 *   - 0 < tierROI < ROI_LOW_THRESHOLD → floor + FLOOR_TIGHTEN_AMOUNT (under-performing; tighten)
 *   - otherwise (no history or medium) → floor unchanged
 * The floor is always clamped to [MIN_QUALITY_FLOOR, MAX_QUALITY_FLOOR].
 *
 * Quality contract is preserved: when no model meets the effective floor the
 * strongest available model is returned with `meetsQualityFloor: false`.
 *
 * @param taskHints    — task scope for complexity-tier derivation
 * @param modelOptions — model pool; efficientModel / defaultModel / strongModel
 *                       and optional qualityByModel score overrides
 * @param qualityFloor — caller-supplied minimum quality score (default 0.7)
 * @param tierROI      — recent average ROI for this tier (0 = no data; see computeRecentROIForTier)
 */
export function routeModelWithCompletionROI(
  taskHints: TaskHints = {},
  modelOptions: ModelOptions & { qualityByModel?: Record<string, number> } = {},
  qualityFloor = 0.7,
  tierROI = 0,
): { model: string; tier: string; reason: string; meetsQualityFloor: boolean; effectiveFloor: number; roiAdjustment: string } {
  let effectiveFloor = qualityFloor;
  let roiAdjustment = "none";

  if (tierROI > ROI_HIGH_THRESHOLD) {
    effectiveFloor = qualityFloor - FLOOR_RELAX_AMOUNT;
    roiAdjustment = `relaxed (tierROI=${tierROI} > ${ROI_HIGH_THRESHOLD})`;
  } else if (tierROI > 0 && tierROI < ROI_LOW_THRESHOLD) {
    effectiveFloor = qualityFloor + FLOOR_TIGHTEN_AMOUNT;
    roiAdjustment = `tightened (tierROI=${tierROI} < ${ROI_LOW_THRESHOLD})`;
  }

  effectiveFloor = Math.max(MIN_QUALITY_FLOOR, Math.min(MAX_QUALITY_FLOOR, effectiveFloor));
  effectiveFloor = Math.round(effectiveFloor * 1000) / 1000;

  const base = routeModelByCost(taskHints, modelOptions, effectiveFloor);
  return {
    ...base,
    effectiveFloor,
    roiAdjustment,
    reason: `roi-adjusted(${roiAdjustment}): ${base.reason}`,
  };
}

// ── Closure-yield routing — quality floor tightening ─────────────────────────
//
// Low closure yield (few carry-forward items shipped with verified evidence) signals
// the system is struggling to deliver improvements.  Under these conditions, prefer
// stronger models to increase the probability of successful task completion.

/** Closure yield below this value triggers quality floor tightening. */
export const CLOSURE_YIELD_LOW_THRESHOLD = 0.5;

/** Quality floor increase applied when closure yield is below the threshold. */
const CLOSURE_YIELD_TIGHTEN_AMOUNT = 0.10;

/**
 * Route to a model with quality floor adjusted by realized closure yield.
 *
 * Low closure yield (> 0 and < CLOSURE_YIELD_LOW_THRESHOLD) tightens the floor,
 * biasing selection toward stronger models when the system has a track record of
 * failing to ship verifiably.  Zero yield (no data) leaves the floor unchanged so
 * the function is safe to call before any closure history exists.
 *
 * The effective floor is always clamped to [MIN_QUALITY_FLOOR, MAX_QUALITY_FLOOR].
 *
 * @param taskHints    — task scope for complexity-tier derivation
 * @param modelOptions — model pool; efficientModel / defaultModel / strongModel
 *                       and optional qualityByModel score overrides
 * @param qualityFloor — caller-supplied minimum quality score (default 0.7)
 * @param closureYield — realized closure yield (0–1; 0 = no data / no history)
 */
export function routeModelWithClosureYield(
  taskHints: TaskHints = {},
  modelOptions: ModelOptions & { qualityByModel?: Record<string, number> } = {},
  qualityFloor = 0.7,
  closureYield = 0,
): { model: string; tier: string; reason: string; meetsQualityFloor: boolean; effectiveFloor: number; closureYieldAdjustment: string } {
  let effectiveFloor = qualityFloor;
  let closureYieldAdjustment = "none";

  if (closureYield > 0 && closureYield < CLOSURE_YIELD_LOW_THRESHOLD) {
    effectiveFloor = qualityFloor + CLOSURE_YIELD_TIGHTEN_AMOUNT;
    closureYieldAdjustment = `tightened (closureYield=${closureYield} < ${CLOSURE_YIELD_LOW_THRESHOLD})`;
  }

  effectiveFloor = Math.max(MIN_QUALITY_FLOOR, Math.min(MAX_QUALITY_FLOOR, effectiveFloor));
  effectiveFloor = Math.round(effectiveFloor * 1000) / 1000;

  const base = routeModelByCost(taskHints, modelOptions, effectiveFloor);
  return {
    ...base,
    effectiveFloor,
    closureYieldAdjustment,
    reason: `closure-yield-adjusted(${closureYieldAdjustment}): ${base.reason}`,
  };
}

/**
 * Route model selection by combining uncertainty-awareness with quality-floor enforcement.
 *
 * Priority:
 *   1. Apply uncertainty-aware routing as the primary mechanism.
 *   2. Check whether the selected candidate meets the quality floor.
 *   3. If not, fall back to cost-aware quality-floor routing so no model below the
 *      minimum bar is dispatched. Uncertainty routing operates *under* the floor.
 *
 * @param taskHints    - task scope for complexity classification
 * @param modelOptions - model pool; defaultModel / strongModel / efficientModel and optional qualityByModel overrides
 * @param history      - routing history for uncertainty computation (recentROI)
 * @param qualityFloor - minimum acceptable quality score (0-1; default 0.7)
 */
export function routeModelUnderQualityFloor(
  taskHints: TaskHints = {},
  modelOptions: ModelOptions & { qualityByModel?: Record<string, number> } = {},
  history: RoutingHistory = {},
  qualityFloor = 0.7,
): { model: string; tier: string; reason: string; uncertainty: string; meetsQualityFloor: boolean } {
  const uncertaintyResult = routeModelWithUncertainty(taskHints, modelOptions, history);

  const qualityByModel = modelOptions.qualityByModel || {};
  const resolveQuality = (name: string): number => {
    const key = String(name || "").toLowerCase();
    return qualityByModel[name] ?? qualityByModel[key] ?? DEFAULT_MODEL_QUALITY[key] ?? 0.75;
  };
  const candidateQuality = resolveQuality(uncertaintyResult.model);

  if (candidateQuality >= qualityFloor) {
    return { ...uncertaintyResult, meetsQualityFloor: true };
  }

  // Uncertainty-selected model is below quality floor - upgrade via cost-aware routing.
  const floorResult = routeModelByCost(taskHints, modelOptions, qualityFloor);
  return {
    model: floorResult.model,
    tier: floorResult.tier,
    reason: `quality-floor-upgrade(uncertainty-selected=${uncertaintyResult.model} score=${candidateQuality.toFixed(2)} < floor=${qualityFloor}): ${floorResult.reason}`,
    uncertainty: uncertaintyResult.uncertainty,
    meetsQualityFloor: floorResult.meetsQualityFloor,
  };
}

/**
 * Compute the average realized ROI for a complexity tier from the ledger.
 *
 * Only realized entries (realizedAt !== null) for the requested tier are
 * included. Returns 0 when no realized history is available so callers
 * can distinguish "no data" from "genuinely zero ROI" (which would require
 * quality=0 on every task, an unusual but possible state).
 *
 * @param config  — BOX config object
 * @param tier    — COMPLEXITY_TIER value ("T1"/"T2"/"T3")
 * @param limit   — max entries to consider (most-recent first; default 20)
 * @returns average realized ROI (0 when no realized history for tier)
 */
export async function computeRecentROIForTier(
  config: object,
  tier: string,
  limit = 20
): Promise<number> {
  const ledger = await loadRouteROILedger(config);
  const realized = ledger
    .filter(e => e.tier === tier && e.realizedAt !== null && typeof e.roi === "number")
    .slice(-limit);

  if (realized.length === 0) return 0;
  const sum = realized.reduce((acc, e) => acc + (e.roi as number), 0);
  return Math.round((sum / realized.length) * 1000) / 1000;
}

/**
 * Summarize realized ROI deltas for a complexity tier from the ledger.
 *
 * The roiDelta is the learning signal (realized − expected ROI). A positive average
 * means the tier consistently outperforms predictions; negative means underperformance.
 * Only fully-realized entries (realizedAt !== null, roiDelta is a finite number) for
 * the requested tier are included.
 *
 * Returns { avgRoiDelta: 0, sampleCount: 0 } when no realized history is available so
 * callers can distinguish "no data" from "genuinely neutral history" (avgRoiDelta=0 with
 * sampleCount > 0 means history exists but deltas cancel out).
 *
 * @param config  — BOX config object
 * @param tier    — COMPLEXITY_TIER value ("T1"/"T2"/"T3")
 * @param limit   — max most-recent entries to include (default: 20)
 * @returns { avgRoiDelta, sampleCount }
 */
export async function summarizeTierTelemetry(
  config: object,
  tier: string,
  limit = 20
): Promise<{ avgRoiDelta: number; sampleCount: number }> {
  try {
    const ledger = await loadRouteROILedger(config);
    const realized = ledger
      .filter(
        e =>
          e.tier === tier &&
          e.realizedAt !== null &&
          typeof e.roiDelta === "number" &&
          Number.isFinite(e.roiDelta)
      )
      .slice(-limit);
    if (realized.length === 0) return { avgRoiDelta: 0, sampleCount: 0 };
    const sum = realized.reduce((acc, e) => acc + (e.roiDelta as number), 0);
    return {
      avgRoiDelta: Math.round((sum / realized.length) * 1000) / 1000,
      sampleCount: realized.length,
    };
  } catch {
    return { avgRoiDelta: 0, sampleCount: 0 };
  }
}

// ── Realized-ROI-dominant routing with bounded exploration ────────────────────
//
// Uses the actual realized ROI from the ledger as the primary adaptive signal
// rather than a caller-supplied estimate.  Bounded exploration prevents the
// system from indefinitely trying expensive models on tiers with consistently
// poor outcomes.

/**
 * Maximum fraction of dispatch cycles that may explore stronger models when
 * realized ROI is very low.  Below this threshold the system switches to
 * conservative floor-tightening rather than continued exploration.
 */
export const EXPLORATION_BOUND = 0.15 as const;

/** Realized ROI below this value triggers exploration limiting. */
const EXPLORATION_LIMIT_THRESHOLD = EXPLORATION_BOUND;

/** Additional quality floor increase applied when exploration is limited. */
const EXPLORATION_LIMIT_TIGHTEN = 0.15;

/**
 * Route model selection using the realized ROI from the ROI ledger as the
 * dominant adaptive signal.
 *
 * Steps:
 *   1. Read `computeRecentROIForTier` for the task's complexity tier.
 *   2. Apply bounded exploration: when realizedROI > 0 but < EXPLORATION_BOUND,
 *      tighten the quality floor to prevent continued wasteful exploration.
 *   3. Delegate to `routeModelWithCompletionROI` with the effective floor and
 *      realized ROI.
 *
 * Zero realizedROI (no ledger data) leaves the floor unchanged — the function
 * is safe to call before any history exists.
 *
 * @param config       — BOX config object (config.paths.stateDir for ledger)
 * @param taskHints    — task scope for complexity-tier derivation
 * @param modelOptions — model pool; efficientModel / defaultModel / strongModel
 * @param opts         — qualityFloor (default 0.7), explorationBound override
 */
export async function routeModelWithRealizedROI(
  config: object,
  taskHints: TaskHints = {},
  modelOptions: ModelOptions & { qualityByModel?: Record<string, number> } = {},
  opts: { qualityFloor?: number; explorationBound?: number } = {},
): Promise<{
  model: string;
  tier: string;
  reason: string;
  realizedROI: number;
  uncertainty: string;
  meetsQualityFloor: boolean;
  explorationLimited: boolean;
}> {
  const qualityFloor    = opts.qualityFloor    ?? 0.7;
  const explorationBound = opts.explorationBound ?? EXPLORATION_LIMIT_THRESHOLD;

  const { tier } = classifyComplexityTier(taskHints);

  let realizedROI = 0;
  try {
    realizedROI = await computeRecentROIForTier(config, tier);
  } catch {
    // keep realizedROI = 0 (no data → no adjustment)
  }

  // Bounded exploration: very low ROI means exploration has been wasteful — tighten
  let explorationLimited = false;
  let effectiveFloor     = qualityFloor;

  if (realizedROI > 0 && realizedROI < explorationBound) {
    effectiveFloor     = Math.min(MAX_QUALITY_FLOOR, qualityFloor + EXPLORATION_LIMIT_TIGHTEN);
    explorationLimited = true;
  }

  const base = routeModelWithCompletionROI(taskHints, modelOptions, effectiveFloor, realizedROI);

  let uncertainty: string;
  if (realizedROI === 0)       uncertainty = "low";     // no data → no signal
  else if (realizedROI < 0.3)  uncertainty = "high";
  else if (realizedROI < 0.7)  uncertainty = "medium";
  else                          uncertainty = "low";

  const explorationTag = explorationLimited ? " [exploration-limited]" : "";
  return {
    model:              base.model,
    tier,
    reason:             `realized-roi(roi=${realizedROI}, tier=${tier})${explorationTag}: ${base.reason}`,
    realizedROI,
    uncertainty,
    meetsQualityFloor:  base.meetsQualityFloor,
    explorationLimited,
  };
}

```

### FILE: src/core/verification_gate.ts
```typescript
/**
 * Verification Gate — Contract validator + auto-rework controller
 *
 * After a worker reports "done", this module validates the response
 * against the role's verification profile. If required evidence is
 * missing or failed, it produces a rework instruction for Athena to
 * re-dispatch the worker with specific gap feedback.
 *
 * Anti-loop: max rework attempts are configurable (default 2).
 * After exhausting retries, the task escalates instead of looping.
 */

import { getVerificationProfile } from "./verification_profiles.js";
import {
  validateDispatchCommands,
  type DispatchCommandValidationResult,
} from "./verification_command_registry.js";

// ── Named test proof patterns ─────────────────────────────────────────────────
// Packets whose verification field names a specific test file + description must
// produce matching evidence in the worker output before done closure is accepted.

/**
 * Pattern to parse a named test proof from a packet's verification field.
 *
 * Accepted formats (case-insensitive):
 *   "tests/core/foo.test.ts — test: description text"
 *   "tests/core/foo.test.ts – it: description text"
 *   "tests/core/foo.test.ts"
 *   "tests/providers/bar.test.ts — should return X when Y"
 */
export const NAMED_TEST_PROOF_PATTERN =
  /^(tests\/[^\s—–-]+(?:\.test\.ts|\.test\.js))\s*(?:[—–-]+\s*(?:test:|it:|describe:|should\s)?(.+))?$/i;

/**
 * Gap message emitted when the named test proof required by the packet's
 * verification field is absent from the worker's output.
 */
export const NAMED_TEST_PROOF_GAP =
  "Named test proof missing — the verification field names a specific test file/description that must appear in the worker output before done closure";

/**
 * Check whether a worker's output contains the named test proof specified in
 * a packet's verification field.
 *
 * Returns `matched: false` when the verification text does not follow the named
 * test proof format (e.g., it is just "npm test") — in that case no gap is raised.
 * Returns `matched: true` with `gap: null` when the proof is present.
 * Returns `matched: true` with `gap: <string>` when the proof is missing.
 *
 * @param verificationText — packet's verification field value
 * @param workerOutput — full worker output text
 */
export function checkNamedTestProof(
  verificationText: string,
  workerOutput: string
): { matched: boolean; testFile: string | null; testDesc: string | null; gap: string | null } {
  const text = String(verificationText || "").trim();
  const output = String(workerOutput || "");

  const match = NAMED_TEST_PROOF_PATTERN.exec(text);
  if (!match) {
    return { matched: false, testFile: null, testDesc: null, gap: null };
  }

  const testFile = match[1].trim();
  // Extract just the filename stem for loose matching (handles path prefix differences)
  const filenamePart = testFile.split("/").pop() ?? testFile;
  const testDesc = match[2] ? match[2].trim() : null;

  const fileInOutput = output.includes(testFile) || output.includes(filenamePart);
  if (!fileInOutput) {
    return {
      matched: true,
      testFile,
      testDesc,
      gap: `${NAMED_TEST_PROOF_GAP}: test file "${testFile}" not found in worker output`,
    };
  }

  if (testDesc && !output.includes(testDesc)) {
    return {
      matched: true,
      testFile,
      testDesc,
      gap: `${NAMED_TEST_PROOF_GAP}: test description "${testDesc}" not found in worker output`,
    };
  }

  return { matched: true, testFile, testDesc, gap: null };
}

// ── Post-merge verification artifact patterns (Packet 1) ───────────────────
// Worker output must contain a git SHA and raw npm test stdout block for
// BOX_STATUS=done to be accepted on merge-oriented tasks.

/** Regex matching a 7-40 character hex git SHA in output. */
const GIT_SHA_PATTERN = /\b[0-9a-f]{7,40}\b/i;

/**
 * Regex matching an explicit BOX_MERGED_SHA marker.
 * Workers that include this explicit marker provide stronger evidence than
 * pattern-detected hex strings, since it unambiguously identifies the post-merge
 * commit SHA rather than any incidental hex value in the output.
 */
const BOX_MERGED_SHA_PATTERN = /BOX_MERGED_SHA\s*=\s*([0-9a-f]{7,40})/i;

/** Regex matching raw npm test output block (pass/fail counts). */
const NPM_TEST_OUTPUT_PATTERN = /(?:passing|failing|tests?\s+\d|✓|✗|#\s+tests\s+\d|test result|suites?\s+\d|\d+\s+pass)/i;

/**
 * Regex matching an explicit NPM test output block delimited by
 * ===NPM TEST OUTPUT START=== / ===NPM TEST OUTPUT END=== markers.
 * Workers that include this explicit block provide stronger evidence than
 * scattered pattern matches across the full output.
 */
const NPM_TEST_BLOCK_PATTERN = /={3,}\s*NPM TEST OUTPUT\s*(?:START\s*)?={3,}[\s\S]*?={3,}\s*(?:NPM TEST OUTPUT\s*)?(?:END\s*)?={3,}/i;

/** Placeholder literal that must be replaced in verification reports. */
export const POST_MERGE_PLACEHOLDER = "POST_MERGE_TEST_OUTPUT";

/**
 * Template placeholder for the git SHA field inside the post-merge artifact block.
 * Workers must replace this with the actual output of `git rev-parse HEAD`.
 */
export const POST_MERGE_SHA_PLACEHOLDER = "<paste git rev-parse HEAD here>";

/**
 * Template placeholder for the npm test output field inside the post-merge artifact block.
 * Workers must replace this with the actual stdout from `npm test`.
 */
export const POST_MERGE_OUTPUT_PLACEHOLDER = "<paste full raw npm test stdout here>";

/**
 * All known template placeholder literals that constitute unfilled residue.
 * A worker output containing any of these strings has not completed the
 * post-merge artifact template and must be rejected deterministically.
 */
export const ALL_POST_MERGE_PLACEHOLDERS: readonly string[] = Object.freeze([
  POST_MERGE_PLACEHOLDER,
  POST_MERGE_SHA_PLACEHOLDER,
  POST_MERGE_OUTPUT_PLACEHOLDER,
]);

/**
 * Canonical artifact-gate gap reason strings.
 * Shared by worker_runner and evolution_executor so failure reasons are identical
 * regardless of which finalization path triggers the artifact check.
 */
export const ARTIFACT_GAP = Object.freeze({
  UNFILLED_PLACEHOLDER: "POST_MERGE_TEST_OUTPUT placeholder is still unfilled — replace it with actual test output",
  MISSING_SHA:          "Post-merge git SHA missing — run 'git rev-parse HEAD' on merged state and include the SHA",
  MISSING_TEST_OUTPUT:  "Post-merge raw npm test output missing — run 'npm test' on merged state and paste raw stdout",
});

/** Prefix used in taskState.error when the artifact gate fails. */
export const ARTIFACT_GATE_ERROR_PREFIX = "artifact-gate";

/**
 * Machine-readable reason codes for artifact gate gaps.
 * These structured codes complement the human-readable ARTIFACT_GAP messages
 * and can be matched programmatically (e.g., for dashboards, policy filters,
 * or downstream escalation routing).
 */
export const ARTIFACT_GAP_CODE = Object.freeze({
  UNFILLED_PLACEHOLDER: "artifact-gate/unfilled-placeholder",
  MISSING_SHA:          "artifact-gate/missing-sha",
  MISSING_TEST_OUTPUT:  "artifact-gate/missing-test-output",
  UNKNOWN:              "artifact-gate/unknown",
});

/**
 * Check if worker output contains the required post-merge verification artifact.
 * The artifact is: a git SHA + raw npm test stdout block.
 *
 * Explicit markers are preferred over pattern detection:
 *   - BOX_MERGED_SHA=<sha>  takes precedence over any 7-40 hex string in the output.
 *   - ===NPM TEST OUTPUT START=== ... ===NPM TEST OUTPUT END=== block is preferred over
 *     scattered npm output patterns; falls back to the legacy pattern for compatibility.
 *
 * @param {string} output — full worker output text
 * @returns {{ hasArtifact: boolean, hasSha: boolean, hasTestOutput: boolean, hasUnfilledPlaceholder: boolean, mergedSha: string | null, hasExplicitShaMarker: boolean, hasExplicitTestBlock: boolean }}
 */
export function checkPostMergeArtifact(output) {
  const text = String(output || "");

  // Prefer explicit BOX_MERGED_SHA=<sha> marker; fall back to loose hex detection.
  const explicitShaMatch = BOX_MERGED_SHA_PATTERN.exec(text);
  const hasExplicitShaMarker = explicitShaMatch !== null;
  const mergedSha: string | null = explicitShaMatch ? explicitShaMatch[1] : null;
  const hasSha = hasExplicitShaMarker || GIT_SHA_PATTERN.test(text);

  // Prefer explicit NPM test output block; fall back to legacy pattern.
  const hasExplicitTestBlock = NPM_TEST_BLOCK_PATTERN.test(text);
  const hasTestOutput = hasExplicitTestBlock || NPM_TEST_OUTPUT_PATTERN.test(text);

  // Deterministic rejection: any known template placeholder literal means the
  // worker did not fill in the artifact fields.  Check all known residues.
  const hasUnfilledPlaceholder = ALL_POST_MERGE_PLACEHOLDERS.some(p => text.includes(p));

  return {
    hasArtifact: hasSha && hasTestOutput && !hasUnfilledPlaceholder,
    hasSha,
    hasTestOutput,
    hasUnfilledPlaceholder,
    mergedSha,
    hasExplicitShaMarker,
    hasExplicitTestBlock,
  };
}

/**
 * Extract the merged commit SHA from worker output.
 *
 * Returns the value from the explicit BOX_MERGED_SHA=<sha> marker when present.
 * Falls back to null when the explicit marker is absent (loose SHA detection is
 * intentionally NOT used here — loose detection is for the hasArtifact check only).
 *
 * @param {string} output — full worker output text
 * @returns {string | null} — 7-40 char hex SHA, or null when not explicitly declared
 */
export function extractMergedSha(output: string): string | null {
  const match = BOX_MERGED_SHA_PATTERN.exec(String(output || ""));
  return match ? match[1] : null;
}

/**
 * Canonical artifact gap collector — shared contract used by worker_runner,
 * evolution_executor, and validateWorkerContract so all finalization paths
 * produce identical gap reason strings from a single source of truth.
 *
 * @param {{ hasSha: boolean, hasTestOutput: boolean, hasUnfilledPlaceholder: boolean }} artifact
 *   — result of checkPostMergeArtifact()
 * @returns {string[]} ordered list of gap reason strings (empty when artifact is complete)
 */
export function collectArtifactGaps(artifact: { hasSha: boolean; hasTestOutput: boolean; hasUnfilledPlaceholder: boolean }): string[] {
  const gaps: string[] = [];
  if (artifact.hasUnfilledPlaceholder) gaps.push(ARTIFACT_GAP.UNFILLED_PLACEHOLDER);
  if (!artifact.hasSha)               gaps.push(ARTIFACT_GAP.MISSING_SHA);
  if (!artifact.hasTestOutput)         gaps.push(ARTIFACT_GAP.MISSING_TEST_OUTPUT);
  return gaps;
}

/** Shape of an artifact gate audit entry written to verification_audit.json. */
export interface ArtifactAuditEntry {
  gateSource: "hard-block" | "evolution-gate";
  workerKind: string;
  roleName: string;
  taskId: string | number | null;
  taskSnippet: string | null;
  passed: boolean;
  gaps: string[];
  reasonCodes: string[];
  artifactDetail: {
    hasSha: boolean;
    hasTestOutput: boolean;
    hasUnfilledPlaceholder: boolean;
    hasExplicitShaMarker: boolean;
    hasExplicitTestBlock: boolean;
    mergedSha: string | null;
  };
  auditedAt: string;
}

/**
 * Build a structured audit entry for an artifact gate check.
 *
 * Centralises audit record construction so worker_runner and evolution_executor
 * emit identical schemas regardless of which finalization path fires the gate.
 * The entry is suitable for appending to verification_audit.json.
 *
 * @param artifact — result of {@link checkPostMergeArtifact}
 * @param gaps     — result of {@link collectArtifactGaps}
 * @param meta     — contextual metadata from the calling finalization path
 * @returns structured {@link ArtifactAuditEntry}
 */
export function buildArtifactAuditEntry(
  artifact: ReturnType<typeof checkPostMergeArtifact>,
  gaps: string[],
  meta: {
    gateSource: "hard-block" | "evolution-gate";
    taskId?: string | number | null;
    workerKind?: string;
    roleName?: string;
    taskSnippet?: string;
  }
): ArtifactAuditEntry {
  const reasonCodes = gaps.map(g => {
    if (g === ARTIFACT_GAP.UNFILLED_PLACEHOLDER) return ARTIFACT_GAP_CODE.UNFILLED_PLACEHOLDER;
    if (g === ARTIFACT_GAP.MISSING_SHA)          return ARTIFACT_GAP_CODE.MISSING_SHA;
    if (g === ARTIFACT_GAP.MISSING_TEST_OUTPUT)  return ARTIFACT_GAP_CODE.MISSING_TEST_OUTPUT;
    return ARTIFACT_GAP_CODE.UNKNOWN;
  });

  return {
    gateSource: meta.gateSource,
    workerKind: meta.workerKind || "unknown",
    roleName: meta.roleName || "unknown",
    taskId: meta.taskId ?? null,
    taskSnippet: meta.taskSnippet ? String(meta.taskSnippet).slice(0, 100) : null,
    passed: gaps.length === 0,
    gaps,
    reasonCodes,
    artifactDetail: {
      hasSha: artifact.hasSha,
      hasTestOutput: artifact.hasTestOutput,
      hasUnfilledPlaceholder: artifact.hasUnfilledPlaceholder,
      hasExplicitShaMarker: artifact.hasExplicitShaMarker,
      hasExplicitTestBlock: artifact.hasExplicitTestBlock,
      mergedSha: artifact.mergedSha ?? null,
    },
    auditedAt: new Date().toISOString(),
  };
}

/**
 * Gates config can upgrade optional evidence fields to required.
 *
 * Mapping:
 *   requireBuild: true        → build "optional"    → "required"
 *   requireTests: true        → tests "optional"    → "required"
 *   requireSecurityScan: true → security "optional" → "required"
 *
 * Exempt fields are never upgraded — exempt means not applicable for the role.
 *
 * Promoted fields are tracked in a `promotedFields` Set on the returned profile.
 * The validation loop uses this to allow `n/a` for globally-promoted fields —
 * the config promotes to catch build failures when a build step exists, but must
 * not produce false completion blocks for tasks where the field is genuinely
 * non-applicable (e.g., test-only tasks where no compilation step runs).
 *
 * @param {object} profile — profile from getVerificationProfile()
 * @param {object} gatesConfig — config.gates from box.config.json
 * @returns {object} — new profile with evidence overrides applied (original is not mutated)
 */
export function applyConfigOverrides(profile, gatesConfig) {
  if (!gatesConfig) return profile;

  const evidence = { ...profile.evidence };

  // Carry forward any already-promoted fields from a prior applyConfigOverrides call.
  const promotedFields = new Set<string>(
    profile.promotedFields instanceof Set ? profile.promotedFields : []
  );

  // Map config gate flags to their corresponding evidence field names
  const fieldMap = {
    requireBuild: "build",
    requireTests: "tests",
    requireSecurityScan: "security"
  };

  for (const [configKey, evidenceField] of Object.entries(fieldMap)) {
    if (gatesConfig[configKey] === true && evidence[evidenceField] === "optional") {
      evidence[evidenceField] = "required";
      promotedFields.add(evidenceField);
    }
  }

  return { ...profile, evidence, promotedFields };
}

/**
 * The canonical set of accepted VERIFICATION_REPORT field values.
 * Workers must use one of these values; anything else is non-canonical.
 */
export const CANONICAL_REPORT_VALUES = Object.freeze(new Set(["pass", "fail", "n/a"]));

/**
 * Normalize a raw VERIFICATION_REPORT field value to its canonical form.
 *
 * Common "pass" synonyms (passing, passed, ok, yes, true) → "pass"
 * Common "fail" synonyms (failing, failed, no, false, error) → "fail"
 * Common "n/a" synonyms (na, not-applicable, skip, skipped, exempt) → "n/a"
 * Already-canonical values are returned unchanged.
 * Truly unknown values are returned as-is so the gate can flag them.
 *
 * @param raw — raw lowercased value string from the report line
 * @returns canonical value string
 */
export function normalizeReportValue(raw: string): string {
  const v = String(raw || "").trim().toLowerCase();
  if (v === "passing" || v === "passed" || v === "ok" || v === "yes" || v === "true") return "pass";
  if (v === "failing" || v === "failed" || v === "no" || v === "false" || v === "error") return "fail";
  if (v === "na" || v === "not-applicable" || v === "skip" || v === "skipped" || v === "exempt") return "n/a";
  return v;
}

/**
 * Parse VERIFICATION_REPORT from worker output.
 * Expected format: VERIFICATION_REPORT: BUILD=pass; TESTS=fail; RESPONSIVE=n/a; ...
 *
 * Values are normalized via normalizeReportValue before storage so common
 * synonyms (passing/passed/ok → pass) are canonicalized at parse time.
 */
export function parseVerificationReport(output) {
  const text = String(output || "");
  const match = text.match(/VERIFICATION_REPORT:\s*([^\n\r]+)/i);
  if (!match) return null;

  const report: Record<string, string> = {};
  const pairs = match[1].split(";").map(s => s.trim()).filter(Boolean);
  for (const pair of pairs) {
    const eqIdx = pair.indexOf("=");
    if (eqIdx < 0) continue;
    const key = pair.slice(0, eqIdx).trim().toLowerCase().replace(/[_\s]+/g, "");
    const rawValue = pair.slice(eqIdx + 1).trim().toLowerCase();
    // Normalize key names
    const keyMap = {
      build: "build",
      tests: "tests",
      test: "tests",
      responsive: "responsive",
      responsivematrix: "responsive",
      api: "api",
      edgecases: "edgeCases",
      edge_cases: "edgeCases",
      security: "security"
    };
    const normalizedKey = keyMap[key];
    if (normalizedKey) {
      report[normalizedKey] = normalizeReportValue(rawValue);
    }
  }
  return report;
}

/**
 * Parse BOX_PR_URL from worker output.
 */
export function parsePrUrl(output) {
  const text = String(output || "");
  const match = text.match(/BOX_PR_URL\s*=\s*(https:\/\/github\.com\/[^\s]+)/i);
  return match ? match[1].trim() : null;
}

/**
 * Parse RESPONSIVE_MATRIX from worker output.
 * Expected format: RESPONSIVE_MATRIX: 320x568=pass, 360x640=fail, ...
 */
export function parseResponsiveMatrix(output) {
  const text = String(output || "");
  const match = text.match(/RESPONSIVE_MATRIX:\s*([^\n\r]+)/i);
  if (!match) return null;

  const matrix: Record<string, string> = {};
  const pairs = match[1].split(",").map(s => s.trim()).filter(Boolean);
  for (const pair of pairs) {
    const eqIdx = pair.indexOf("=");
    if (eqIdx < 0) continue;
    const viewport = pair.slice(0, eqIdx).trim();
    const result = pair.slice(eqIdx + 1).trim().toLowerCase();
    if (viewport && result) matrix[viewport] = result;
  }
  return Object.keys(matrix).length > 0 ? matrix : null;
}

/**
 * Task kinds that are non-merge by nature — they do not involve committing
 * or merging code, so the post-merge artifact gate (git SHA + npm test output)
 * does not apply.  Implementation and rework kinds are NOT in this set.
 */
export const NON_MERGE_TASK_KINDS = Object.freeze(new Set([
  "scan",
  "doc",
  "observation",
  "diagnosis",
  "discovery",
  "research",
  "review",
  "audit",
]));

/**
 * Task kinds that are safe to execute even when dispatch strictness is BLOCKED.
 * These tasks do not modify code, so they cannot introduce regressions and
 * are exempt from the post-merge artifact gate (adaptive throttle bypass).
 *
 * DISCOVERY_SAFE_TASK_KINDS is a superset of NON_MERGE_TASK_KINDS — every
 * non-merge task is discovery-safe, but future non-merge kinds that carry
 * deployment risk may be excluded from the discovery-safe bypass while still
 * being excluded from the artifact gate.
 */
export const DISCOVERY_SAFE_TASK_KINDS = Object.freeze(new Set([
  "scan",
  "doc",
  "observation",
  "diagnosis",
  "discovery",
  "research",
  "review",
  "audit",
]));

/**
 * Check whether a task kind qualifies for the discovery-safe bypass.
 *
 * Discovery-safe tasks:
 *   1. Are exempt from the post-merge artifact gate (they don't produce merges).
 *   2. May proceed even when dispatch strictness is BLOCKED (adaptive throttle bypass).
 *
 * @param taskKind — task kind string from the instruction
 * @returns true when the task is discovery-safe (read-only / no-commit)
 */
export function isDiscoverySafeTask(taskKind?: string | null): boolean {
  if (!taskKind) return false;
  return DISCOVERY_SAFE_TASK_KINDS.has(String(taskKind).toLowerCase());
}

/**
 * Determine whether the post-merge artifact gate should run for a given
 * worker kind + task kind combination.
 *
 * Returns false (gate skipped) when:
 *   - The worker role is fully exempt (all evidence fields = "exempt"), OR
 *   - The task kind is a non-merge task (scan, doc, observation, diagnosis,
 *     discovery, research, review, audit).
 *
 * @param {string} workerKind — role kind (e.g. "backend", "scanA")
 * @param {string|null|undefined} taskKind — instruction task kind
 * @returns {boolean} — true when the artifact gate must run
 */
export function isArtifactGateRequired(workerKind: string, taskKind?: string | null): boolean {
  // Exempt roles (scan/doc workers) never need artifacts
  const profile = getVerificationProfile(workerKind);
  const allExempt = Object.values(profile.evidence).every(v => v === "exempt");
  if (allExempt) return false;

  // Non-merge task kinds never produce a git SHA or test output
  if (taskKind && NON_MERGE_TASK_KINDS.has(String(taskKind).toLowerCase())) return false;

  return true;
}

/** Options for {@link validateWorkerContract}. */
export interface ValidateWorkerContractOptions {
  /** Config.gates object to upgrade optional evidence fields to required. */
  gatesConfig?: Record<string, unknown>;
  /**
   * The task kind from the instruction (e.g. "backend", "scan", "doc").
   * Non-merge task kinds (scan, doc, observation, diagnosis) are exempt from
   * the artifact gate even when the worker role is done-capable.
   */
  taskKind?: string | null;
  /**
   * The packet's verification field value (e.g. "tests/core/foo.test.ts — test: desc").
   * When provided and the value follows the named-test-proof format, the gate checks
   * that the specified test file and description appear in the worker output.
   * Packets with non-specific verification text (e.g. "npm test") are not checked.
   */
  verificationText?: string | null;
  /**
   * Pre-computed artifact evidence from a prior checkPostMergeArtifact() call.
   * When provided, the artifact gate reuses this result instead of re-evaluating
   * the output, avoiding a duplicate computation on the same string.
   */
  precomputedArtifact?: ReturnType<typeof checkPostMergeArtifact>;
}

/**
 * Validate a worker's output against its role's verification profile.
 *
 * @param {string} workerKind — the role kind from box.config.json (e.g. "frontend", "backend")
 * @param {object} parsedResponse — output from parseWorkerResponse() in worker_runner.js
 * @param {ValidateWorkerContractOptions} [options] — optional overrides
 * @returns {{ passed: boolean, gaps: string[], evidence: object }}
 */
export function validateWorkerContract(workerKind: string, parsedResponse: Record<string, unknown>, options: ValidateWorkerContractOptions = {}) {
  const baseProfile = getVerificationProfile(workerKind);
  const profile = options.gatesConfig ? applyConfigOverrides(baseProfile, options.gatesConfig) : baseProfile;
  const output = parsedResponse?.fullOutput || parsedResponse?.summary || "";
  const report = parseVerificationReport(output);
  const responsiveMatrix = parseResponsiveMatrix(output);
  const prUrl = parsePrUrl(output);

  const gaps: string[] = [];
  const evidence: Record<string, unknown> = {
    hasReport: !!report,
    report: report || {},
    responsiveMatrix: responsiveMatrix || {},
    prUrl: prUrl || null,
    profile: profile.kind,
    optionalFieldFailures: [] as string[]
  };

  // If worker reported skipped (already-merged), pass immediately
  const status = String(parsedResponse?.status || "done").toLowerCase();
  if (status === "skipped") {
    return { passed: true, gaps: [], evidence, reason: "status=skipped, worker reported task already done" };
  }

  // If worker reported a non-done status, skip verification
  if (status !== "done") {
    return { passed: true, gaps: [], evidence, reason: `status=${status}, verification skipped` };
  }

  // Scan/doc roles are exempt from verification
  const allExempt = Object.values(profile.evidence).every(v => v === "exempt");
  if (allExempt) {
    return { passed: true, gaps: [], evidence, reason: "role exempt from verification" };
  }

  // Roles with at least one required evidence field are "done-capable lanes"
  const hasRequiredFields = Object.values(profile.evidence).some(v => v === "required");

  // ── Post-merge verification artifact gate ───────────────────────────────
  // Done-capable lanes (roles with at least one required evidence field) must
  // include a git SHA + raw test output when reporting done, UNLESS the task
  // kind is a non-merge kind (scan, doc, observation, diagnosis) — those tasks
  // do not produce a merged commit and are exempt from artifact requirements.
  // This gate is NON-BYPASSABLE — no caller option can disable it.
  const requireArtifact = hasRequiredFields
    && isArtifactGateRequired(workerKind, options.taskKind);
  if (requireArtifact) {
    // Reuse a pre-computed artifact object when the caller already evaluated
    // the same output (e.g., the hard-block gate in worker_runner), avoiding
    // a redundant call to checkPostMergeArtifact on the same string.
    const artifact = options.precomputedArtifact ?? checkPostMergeArtifact(output);
    evidence.postMergeArtifact = artifact;
    for (const gap of collectArtifactGaps(artifact)) gaps.push(gap);
  }

  // ── Named test proof gate ────────────────────────────────────────────────
  // When the task packet's verification field names a specific test file and
  // optionally a test description, the worker output must contain that evidence
  // before done closure is accepted.  Generic "npm test" values are not checked.
  if (options.verificationText) {
    const namedProof = checkNamedTestProof(String(options.verificationText), String(output));
    if (namedProof.matched && namedProof.gap) {
      gaps.push(namedProof.gap);
    }
    evidence.namedTestProof = namedProof;
  }

  // No verification report at all — gap for any role with required fields
  if (!report && hasRequiredFields) {
    gaps.push("VERIFICATION_REPORT missing — worker did not provide any verification evidence");
    return { passed: false, gaps, evidence, reason: "no verification report" };
  }

  // ── Profile-aware optional field failure tracking ───────────────────────
  // Optional fields that appear in the report with "fail" are tracked in
  // evidence for false-negative proxy calibration, but do NOT cause a gap.
  if (report) {
    for (const [field, requirement] of Object.entries(profile.evidence)) {
      if (requirement !== "optional") continue;
      if (field === "prUrl") continue;
      if (report[field] === "fail") {
        (evidence.optionalFieldFailures as string[]).push(field);
      }
    }
  }

  // Check each required field (except prUrl — handled separately below)
  for (const [field, requirement] of Object.entries(profile.evidence)) {
    if (requirement !== "required") continue;
    if (field === "prUrl") continue;

    const value = report?.[field];

    // Globally-promoted fields allow n/a — the config promotes to enforce coverage
    // when a build/test step exists, but must not produce false completion blocks
    // for tasks where the field is genuinely non-applicable (e.g., test-only tasks
    // where no compilation step runs, or doc tasks with no test suite to execute).
    const isGloballyPromoted =
      profile.promotedFields instanceof Set && profile.promotedFields.has(field);
    if (isGloballyPromoted && value === "n/a") continue;

    if (!value || value === "n/a") {
      gaps.push(`${field.toUpperCase()} is required but was ${value || "missing"}`);
    } else if (value === "fail") {
      gaps.push(`${field.toUpperCase()} reported as FAIL — worker must fix before done`);
    } else if (!CANONICAL_REPORT_VALUES.has(value)) {
      // Non-canonical value — prevents false negatives from values like "xyz"
      // that slip past the fail/n-a checks.  Workers must use pass/fail/n/a.
      gaps.push(`${field.toUpperCase()} has non-canonical value "${value}" — use pass, fail, or n/a`);
    }
  }

  // Responsive viewport count check for frontend roles
  if (profile.responsiveRequired && responsiveMatrix) {
    const passCount = Object.values(responsiveMatrix).filter(v => v === "pass").length;
    if (passCount < profile.minViewports) {
      gaps.push(`RESPONSIVE: only ${passCount}/${profile.minViewports} viewports passed (need ≥${profile.minViewports})`);
    }
  } else if (profile.responsiveRequired && !responsiveMatrix) {
    gaps.push("RESPONSIVE_MATRIX missing — frontend role must verify responsive viewports");
  }

  // PR URL check — generic for all implementation roles that require it
  if (profile.evidence.prUrl === "required") {
    if (!prUrl) {
      gaps.push("BOX_PR_URL missing — worker must push a branch and open a real GitHub PR. Prose claims of completion are not accepted.");
    }
  }

  return {
    passed: gaps.length === 0,
    gaps,
    evidence,
    reason: gaps.length === 0 ? "all required evidence present and passing" : `${gaps.length} verification gap(s)`
  };
}

/**
 * Build a rework instruction when verification gaps are detected.
 *
 * @param {string} originalTask — the task the worker was originally assigned
 * @param {string[]} gaps — array of gap descriptions
 * @param {number} attempt — current rework attempt number (1-based)
 * @param {number} maxAttempts — maximum rework attempts allowed
 * @returns {object} — instruction object for Athena to re-dispatch
 */
export function buildReworkInstruction(originalTask, gaps, attempt, maxAttempts) {
  const gapList = gaps.map((g, i) => `  ${i + 1}. ${g}`).join("\n");

  const task = `## AUTO-REWORK — VERIFICATION GAPS DETECTED (attempt ${attempt}/${maxAttempts})

Your previous completion was REJECTED by the verification gate because the following evidence was missing or failed:

${gapList}

## WHAT YOU MUST DO

1. Go back to your work and fix each gap listed above.
2. Re-run verification for each gap (build, tests, responsive checks, etc.)
3. Include a complete VERIFICATION_REPORT in your response.
4. Do NOT repeat the same approach if it already failed — try a different strategy.

## ORIGINAL TASK (for reference)
${originalTask}

${attempt >= maxAttempts ? "⚠️ THIS IS YOUR FINAL ATTEMPT. If you cannot resolve all gaps, report BOX_STATUS=blocked with a root-cause analysis of why each gap cannot be resolved." : ""}`;

  return {
    task,
    context: `Rework attempt ${attempt}/${maxAttempts}. Gaps: ${gaps.join("; ")}`,
    isFollowUp: true,
    isRework: true,
    reworkAttempt: attempt,
    maxReworkAttempts: maxAttempts,
    taskKind: "rework"
  };
}

/**
 * Determine if auto-rework should be triggered.
 *
 * @param {object} validationResult — output from validateWorkerContract()
 * @param {number} currentAttempt — how many times this worker has been re-dispatched for this task
 * @param {number} maxAttempts — configurable max rework attempts (default from config)
 * @returns {{ shouldRework: boolean, instruction: object|null, shouldEscalate: boolean }}
 */
export function decideRework(validationResult, originalTask, currentAttempt, maxAttempts = 2) {
  if (validationResult.passed) {
    return { shouldRework: false, instruction: null, shouldEscalate: false };
  }

  const nextAttempt = currentAttempt + 1;

  if (nextAttempt > maxAttempts) {
    // Max retries exhausted — escalate to Athena, don't loop
    return {
      shouldRework: false,
      instruction: null,
      shouldEscalate: true,
      escalationReason: `Worker failed verification ${currentAttempt} times. Gaps: ${validationResult.gaps.join("; ")}`
    };
  }

  const instruction = buildReworkInstruction(
    originalTask,
    validationResult.gaps,
    nextAttempt,
    maxAttempts
  );

  return {
    shouldRework: true,
    instruction,
    shouldEscalate: false
  };
}

// ── Dispatch command gate (Task 3) ────────────────────────────────────────────

/** Re-export for callers that only import from verification_gate. */
export type { DispatchCommandValidationResult };

/**
 * Apply the dispatch command gate to a task plan before worker dispatch begins.
 *
 * Rewrites any non-portable verification commands (shell globs, bash/sh scripts,
 * BOX daemon invocations) to their canonical, cross-platform equivalents and
 * returns both the sanitized task and an audit record of applied rewrites.
 *
 * This gate is intended to be called immediately before a task plan is handed
 * off to worker_runner or evolution_executor — NOT after the worker returns.
 *
 * Usage:
 *   const { task: safeTask, gate } = applyDispatchCommandGate(rawTask);
 *   if (!gate.safe) logger.warn("Rewrote non-portable commands", gate.rewrites);
 *   dispatch(safeTask);
 *
 * @param task — raw task plan object; must have an optional verification_commands array
 * @returns {{ task: object, gate: DispatchCommandValidationResult }}
 */
export function applyDispatchCommandGate(
  task: { verification_commands?: string[] | unknown } & Record<string, unknown>
): { task: typeof task; gate: DispatchCommandValidationResult } {
  const rawCommands = Array.isArray(task?.verification_commands)
    ? (task.verification_commands as string[])
    : [];

  const gate = validateDispatchCommands(rawCommands);

  const sanitizedTask = gate.safe
    ? task
    : { ...task, verification_commands: gate.sanitizedCommands };

  return { task: sanitizedTask, gate };
}

```

### FILE: src/core/budget_controller.ts
```typescript
import path from "node:path";
import { readJson, writeJson } from "./fs_utils.js";

/** Minimum remaining USD required to allow a Claude call. */
export const BUDGET_THRESHOLD_USD = 0.2;

/** Rolling window size for completion yield computation (number of recent dispatches). */
export const ROLLING_YIELD_WINDOW_SIZE = 10;

/**
 * Minimum number of dispatches required in the window before throttling fires.
 * Below this count there is not enough signal to throttle.
 */
export const ROLLING_YIELD_MIN_DISPATCHES = 3;

/**
 * Minimum acceptable rolling completion yield (0–1).
 * When the fraction of "done" outcomes in the window falls at or below this
 * threshold (and the window is large enough), dispatch is throttled to prevent
 * premium-request waste spirals.
 */
export const ROLLING_YIELD_THROTTLE_THRESHOLD = 0.2;

/**
 * Structured eligibility contract produced on every pre-dispatch budget
 * reconciliation.  Always emitted — even when the budget gate is not
 * configured — so callers have a uniform surface for observability and
 * policy decisions.
 */
export interface BudgetEligibilityContract {
  /** True when dispatch is allowed from a budget perspective. */
  eligible: boolean;
  /** Remaining USD at reconciliation time.  null when unconfigured or unreadable. */
  remainingUsd: number | null;
  /** The USD threshold below-or-equal to which dispatch is blocked. */
  thresholdUsd: number;
  /** ISO timestamp of when the check ran. */
  checkedAt: string;
  /**
   * Human-readable reason when not eligible, or a non-fatal error note
   * when a read error occurred (fail-open path).  null when eligible and
   * no errors.
   */
  reason: string | null;
  /** False when no budgetFile path is configured (unlimited / unconstrained). */
  configured: boolean;
}

export async function loadBudget(config) {
  return readJson(config.paths.budgetFile, {
    initialUsd: config.env.budgetUsd,
    remainingUsd: config.env.budgetUsd,
    claudeCalls: 0,
    workerRuns: 0,
    updatedAt: new Date().toISOString()
  });
}

export async function chargeBudget(config, patch) {
  const budget = await loadBudget(config);
  budget.remainingUsd = Math.max(0, Number((budget.remainingUsd - (patch.usd ?? 0)).toFixed(4)));
  budget.claudeCalls += patch.claudeCalls ?? 0;
  budget.workerRuns += patch.workerRuns ?? 0;
  budget.updatedAt = new Date().toISOString();
  await writeJson(config.paths.budgetFile, budget);
  return budget;
}

export function canUseClaude(budget) {
  return budget.remainingUsd > BUDGET_THRESHOLD_USD;
}

/**
 * Reconcile current budget state into a BudgetEligibilityContract.
 *
 * Always returns a contract object regardless of configuration or errors:
 *   - Unconfigured budget path  → eligible=true, configured=false
 *   - Budget above threshold    → eligible=true, configured=true
 *   - Budget at/below threshold → eligible=false, configured=true
 *   - Read error                → eligible=true (fail-open), reason carries the error
 */
/**
 * Rolling completion yield contract produced by computeRollingCompletionYield.
 *
 * Always emitted — even when the log is absent or unconfigured — so callers
 * have a uniform surface for observability and throttle decisions.
 */
export interface RollingYieldContract {
  /** True when dispatch should be throttled due to low completion yield. */
  throttled: boolean;
  /** Completion yield in [0, 1]; 0 when there are no entries in the window. */
  yield: number;
  /** Number of dispatch entries considered (capped at ROLLING_YIELD_WINDOW_SIZE). */
  windowSize: number;
  /** Count of "done" outcomes in the window. */
  completions: number;
  /** Total dispatch entries in the window. */
  dispatches: number;
  /** Threshold below-or-equal to which throttling fires. */
  threshold: number;
  /** Human-readable reason when throttled, null otherwise. */
  reason: string | null;
  /** ISO timestamp of when the check ran. */
  checkedAt: string;
  /** False when no log file exists (fail-open — new deployments have no history). */
  configured: boolean;
}

/**
 * Compute the rolling completion yield from the premium usage log and return a
 * RollingYieldContract that callers can act on for throttle decisions.
 *
 * Fail-open contract:
 *   - No log file / empty log  → throttled=false, configured=false
 *   - Too few entries           → throttled=false (ROLLING_YIELD_MIN_DISPATCHES not met)
 *   - yield > threshold         → throttled=false
 *   - yield <= threshold        → throttled=true
 *   - Read/parse error          → throttled=false (fail-open), reason carries error note
 *
 * @param config  BOX config object; reads stateDir from config.paths.stateDir
 * @param opts    { windowSize?, minDispatches?, threshold? } — override defaults for tests
 */
export async function computeRollingCompletionYield(config, opts: {
  windowSize?: number;
  minDispatches?: number;
  threshold?: number;
} = {}): Promise<RollingYieldContract> {
  const windowSize  = opts.windowSize   ?? ROLLING_YIELD_WINDOW_SIZE;
  const minDispatch = opts.minDispatches ?? ROLLING_YIELD_MIN_DISPATCHES;
  const threshold   = opts.threshold    ?? ROLLING_YIELD_THROTTLE_THRESHOLD;
  const checkedAt   = new Date().toISOString();

  const stateDir = config?.paths?.stateDir || "state";
  const logPath  = path.join(stateDir, "premium_usage_log.json");

  try {
    const raw = await readJson(logPath, null);
    if (!Array.isArray(raw)) {
      return { throttled: false, yield: 0, windowSize, completions: 0, dispatches: 0, threshold, reason: null, checkedAt, configured: false };
    }

    const window = raw.slice(-windowSize);
    const dispatches   = window.length;
    const completions  = window.filter((e: any) => e?.outcome === "done").length;
    const yieldRatio   = dispatches > 0 ? completions / dispatches : 0;

    if (dispatches < minDispatch) {
      // Not enough signal — fail-open to avoid blocking on a near-empty log.
      return { throttled: false, yield: yieldRatio, windowSize, completions, dispatches, threshold, reason: null, checkedAt, configured: true };
    }

    const throttled = yieldRatio <= threshold;
    return {
      throttled,
      yield: yieldRatio,
      windowSize,
      completions,
      dispatches,
      threshold,
      reason: throttled
        ? `rolling_yield_throttle:yield=${yieldRatio.toFixed(2)},completions=${completions}/${dispatches},threshold=${threshold}`
        : null,
      checkedAt,
      configured: true,
    };
  } catch (err) {
    // Fail-open: any read or parse error must never block legitimate dispatch.
    return {
      throttled: false,
      yield: 0,
      windowSize,
      completions: 0,
      dispatches: 0,
      threshold,
      reason: `rolling_yield_read_error:${String((err as any)?.message || err)}`,
      checkedAt,
      configured: false,
    };
  }
}

export async function reconcileBudgetEligibility(config): Promise<BudgetEligibilityContract> {
  const thresholdUsd = BUDGET_THRESHOLD_USD;
  const checkedAt = new Date().toISOString();

  if (!config?.paths?.budgetFile) {
    return { eligible: true, remainingUsd: null, thresholdUsd, checkedAt, reason: null, configured: false };
  }

  try {
    const budget = await loadBudget(config);
    const eligible = budget.remainingUsd > thresholdUsd;
    return {
      eligible,
      remainingUsd: budget.remainingUsd,
      thresholdUsd,
      checkedAt,
      reason: eligible ? null : `budget_exhausted:remainingUsd=${budget.remainingUsd}`,
      configured: true,
    };
  } catch (err) {
    // Fail-open: a corrupt or missing budget file must not halt legitimate work.
    return {
      eligible: true,
      remainingUsd: null,
      thresholdUsd,
      checkedAt,
      reason: `budget_read_error:${String(err?.message || err)}`,
      configured: true,
    };
  }
}

```

### FILE: src/core/intervention_optimizer.ts
```typescript
/**
 * intervention_optimizer.js — Budget-aware intervention optimizer for BOX.
 *
 * An "Intervention" is the domain concept for a planned unit of work dispatched
 * to a specific worker role in a specific execution wave.
 *
 * ── Domain definitions (deterministic, machine-checkable) ────────────────────
 *
 * INTERVENTION object shape (all fields required unless noted):
 *   id                  {string}  — unique identifier for this intervention
 *   type                {string}  — enum: "task" | "split" | "followup"
 *   wave                {integer} — execution wave number (>= 1)
 *   role                {string}  — worker role name (non-empty)
 *   title               {string}  — short description (non-empty)
 *   successProbability  {number}  — P(success) ∈ [0.0, 1.0]
 *   impact              {number}  — gain if success ∈ [0.0, 1.0]
 *   riskCost            {number}  — cost if failure ∈ [0.0, 1.0]
 *   sampleCount         {integer} — historical observations (>= 0)
 *   budgetCost          {integer} — worker spawns consumed (>= 1)
 *
 * BUDGET object shape:
 *   maxWorkerSpawns     {integer} — total spawn budget (>= 1; unit: workerSpawns)
 *   maxWorkersPerWave   {integer} — per-wave spawn cap (optional; defaults to maxWorkerSpawns)
 *   byRole              {object}  — per-role spawn caps: { [roleName]: integer } (optional)
 *
 * ── Expected-value formula (deterministic) ───────────────────────────────────
 *
 *   SPARSE_DATA_THRESHOLD = 3   — minimum sample count for full confidence
 *
 *   confidenceMultiplier(n) = min(1.0, n / SPARSE_DATA_THRESHOLD)
 *     n = 0  → 0.000  (no data — maximum confidence penalty)
 *     n = 1  → 0.333
 *     n = 2  → 0.667
 *     n >= 3 → 1.000  (full confidence)
 *
 *   adjustedSuccessProbability = successProbability × confidenceMultiplier(sampleCount)
 *
 *   EV = adjustedSuccessProbability × impact
 *      − (1 − adjustedSuccessProbability) × riskCost
 *
 * ── Budget reconciliation (all three constraints must be satisfied) ───────────
 *
 *   1. totalBudget  — Σ budgetCost of selected interventions ≤ maxWorkerSpawns
 *   2. byWaveBudget — per-wave Σ budgetCost ≤ maxWorkersPerWave
 *   3. byRoleBudget — per-role Σ budgetCost ≤ byRole[role] (when configured)
 *
 *   Selection algorithm: greedy by descending EV.
 *   An intervention is blocked if accepting it would violate any active constraint.
 *   Blocked interventions appear in `rejected[]` with an explicit `reasonCode`.
 *
 * ── Budget unit ───────────────────────────────────────────────────────────────
 *   Unit: "workerSpawns" — integer count of worker process spawns.
 *   Source: box.config.json → runtime.runtimeBudget.maxWorkerSpawnsPerCycle
 *
 * ── Persistence ───────────────────────────────────────────────────────────────
 *   Log file: state/intervention_optimizer_log.json
 *   Schema version: OPTIMIZER_LOG_SCHEMA_VERSION (integer, currently 1)
 *   Required fields in each entry: schemaVersion, generatedAt, status, reasonCode,
 *     budgetUnit, totalBudgetLimit, totalBudgetUsed, byWaveBudgetLimit,
 *     byWaveUsed, byRoleBudgetLimits, byRoleUsed, selected, rejected
 *
 * Risk level: HIGH — modification of prometheus.js, state_tracker.js, and this
 *   new module requires careful isolation. All optimizer calls are non-blocking
 *   and never fail the parent orchestration flow.
 */

import path from "node:path";
import { readJson, writeJson } from "./fs_utils.js";
import { applyClassificationToSuccessProbability } from "./failure_classifier.js";

// ── Budget unit ───────────────────────────────────────────────────────────────

/**
 * Canonical budget unit identifier. Written into every persisted record so that
 * log consumers know what integer counts represent.
 */
export const BUDGET_UNIT = "workerSpawns";

// ── Intervention type enum ────────────────────────────────────────────────────

/**
 * Canonical Intervention type values.
 *   task      — a primary planned task assigned to one worker
 *   split     — a sub-task split from a larger task
 *   followup  — a follow-up task generated after a prior worker's output
 */
export const INTERVENTION_TYPE = Object.freeze({
  TASK:      "task",
  SPLIT:     "split",
  FOLLOWUP:  "followup",
});

// ── Optimizer status enum ─────────────────────────────────────────────────────

/**
 * Top-level status codes returned by runInterventionOptimizer.
 * Written to the `status` field in every persisted log entry.
 */
export const OPTIMIZER_STATUS = Object.freeze({
  /** All interventions scheduled without budget violations. */
  OK:              "ok",
  /**
   * One or more interventions were rejected for budget reasons.
   * The schedule was created for the remaining interventions.
   */
  BUDGET_EXCEEDED: "budget_exceeded",
  /**
   * Input validation failed — no schedule was created.
   * Check `errorMessage` for the human-readable explanation and
   * `reasonCode` for the machine-readable reason.
   */
  INVALID_INPUT:   "invalid_input",
  /** Interventions array was valid but empty — no schedule created. */
  EMPTY_INPUT:     "empty_input",
});

// ── Optimizer reason code enum ────────────────────────────────────────────────

/**
 * Machine-readable reason codes for the top-level optimizer result.
 * Callers must inspect this field; silent fallback is not allowed.
 */
export const OPTIMIZER_REASON_CODE = Object.freeze({
  /** Schedule created, all interventions accepted. */
  VALID:                      "VALID",
  /** No interventions were provided. */
  EMPTY_INPUT:                "EMPTY_INPUT",
  /** Required input (interventions array or budget) was null/undefined. */
  MISSING_INPUT:              "MISSING_INPUT",
  /** An individual intervention failed schema validation. */
  INVALID_INTERVENTION:       "INVALID_INTERVENTION",
  /** Budget object failed validation. */
  INVALID_BUDGET:             "INVALID_BUDGET",
  /** At least one intervention was dropped — total spawn budget exceeded. */
  BUDGET_TOTAL_EXCEEDED:      "BUDGET_TOTAL_EXCEEDED",
  /** At least one intervention was dropped — wave spawn budget exceeded. */
  BUDGET_WAVE_EXCEEDED:       "BUDGET_WAVE_EXCEEDED",
  /** At least one intervention was dropped — role spawn budget exceeded. */
  BUDGET_ROLE_EXCEEDED:       "BUDGET_ROLE_EXCEEDED",
});

// ── Per-intervention rejection reason codes ───────────────────────────────────

/**
 * Machine-readable reason codes attached to each entry in the `rejected[]` array.
 */
export const INTERVENTION_REJECTION_CODE = Object.freeze({
  BUDGET_TOTAL: "BUDGET_TOTAL",
  BUDGET_WAVE:  "BUDGET_WAVE",
  BUDGET_ROLE:  "BUDGET_ROLE",
});

// ── Intervention validation error codes ──────────────────────────────────────

/**
 * Reason codes returned by validateIntervention.
 * Distinguishes missing input from invalid field values.
 */
export const INTERVENTION_ERROR_CODE = Object.freeze({
  /** Input is null/undefined (missing entirely). */
  MISSING_INPUT:  "MISSING_INPUT",
  /** Input is not a plain object (wrong type). */
  INVALID_TYPE:   "INVALID_TYPE",
  /** A required field is absent from the object. */
  MISSING_FIELD:  "MISSING_FIELD",
  /** A field is present but its value is invalid. */
  INVALID_FIELD:  "INVALID_FIELD",
});

// ── Sparse data constant ──────────────────────────────────────────────────────

/**
 * Minimum number of historical observations (sampleCount) required before the
 * optimizer applies full confidence to an intervention's successProbability.
 *
 * Below this threshold the confidence penalty formula applies:
 *   confidenceMultiplier = min(1.0, sampleCount / SPARSE_DATA_THRESHOLD)
 *
 * Formula is deterministic and testable:
 *   sampleCount = 0 → multiplier = 0.000
 *   sampleCount = 1 → multiplier = 0.333
 *   sampleCount = 2 → multiplier = 0.667
 *   sampleCount >= 3 → multiplier = 1.000
 */
export const SPARSE_DATA_THRESHOLD = 3;

// ── Schema version ────────────────────────────────────────────────────────────

/**
 * Schema version for intervention_optimizer_log.json.
 * Bump (integer) when the persisted schema changes incompatibly.
 */
export const OPTIMIZER_LOG_SCHEMA_VERSION = 1;

// ── Intervention schema ───────────────────────────────────────────────────────

/**
 * Canonical Intervention schema: required field names and type constraints.
 * Used by validateIntervention for deterministic, machine-checkable validation.
 */
export const INTERVENTION_SCHEMA = Object.freeze({
  required: Object.freeze([
    "id", "type", "wave", "role", "title",
    "successProbability", "impact", "riskCost",
    "sampleCount", "budgetCost",
  ]),
  typeEnum: Object.freeze(Object.values(INTERVENTION_TYPE)),
});

// ── Validation ────────────────────────────────────────────────────────────────

/**
 * Validate a single Intervention object against INTERVENTION_SCHEMA.
 *
 * Distinguishes missing input from invalid input:
 *   null/undefined input  → ok=false, code=MISSING_INPUT
 *   non-object input      → ok=false, code=INVALID_TYPE
 *   absent required field → ok=false, code=MISSING_FIELD, field=<name>
 *   invalid field value   → ok=false, code=INVALID_FIELD, field=<name>
 *   fully valid           → ok=true,  code=null
 *
 * @param {any} intervention
 * @returns {{ ok: boolean, code: string|null, field?: string, message: string }}
 */
export function validateIntervention(intervention) {
  if (intervention === null || intervention === undefined) {
    return {
      ok: false,
      code: INTERVENTION_ERROR_CODE.MISSING_INPUT,
      message: "intervention is required (got null/undefined)",
    };
  }
  if (typeof intervention !== "object" || Array.isArray(intervention)) {
    return {
      ok: false,
      code: INTERVENTION_ERROR_CODE.INVALID_TYPE,
      message: "intervention must be a plain object",
    };
  }

  // Required field presence check
  for (const field of INTERVENTION_SCHEMA.required) {
    if (!(field in intervention)) {
      return {
        ok: false,
        code: INTERVENTION_ERROR_CODE.MISSING_FIELD,
        field,
        message: `required field '${field}' is missing`,
      };
    }
  }

  // type: must be one of INTERVENTION_TYPE values
  if (!INTERVENTION_SCHEMA.typeEnum.includes(intervention.type)) {
    return {
      ok: false,
      code: INTERVENTION_ERROR_CODE.INVALID_FIELD,
      field: "type",
      message: `type must be one of: ${INTERVENTION_SCHEMA.typeEnum.join(", ")}; got '${intervention.type}'`,
    };
  }

  // wave: must be a positive integer
  if (!Number.isInteger(intervention.wave) || intervention.wave < 1) {
    return {
      ok: false,
      code: INTERVENTION_ERROR_CODE.INVALID_FIELD,
      field: "wave",
      message: `wave must be a positive integer; got ${intervention.wave}`,
    };
  }

  // id, role, title: must be non-empty strings
  for (const field of ["id", "role", "title"]) {
    if (typeof intervention[field] !== "string" || intervention[field].trim() === "") {
      return {
        ok: false,
        code: INTERVENTION_ERROR_CODE.INVALID_FIELD,
        field,
        message: `${field} must be a non-empty string`,
      };
    }
  }

  // successProbability, impact, riskCost: numbers in [0.0, 1.0]
  for (const field of ["successProbability", "impact", "riskCost"]) {
    const v = intervention[field];
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 1) {
      return {
        ok: false,
        code: INTERVENTION_ERROR_CODE.INVALID_FIELD,
        field,
        message: `${field} must be a finite number between 0.0 and 1.0; got ${v}`,
      };
    }
  }

  // sampleCount: non-negative integer
  if (!Number.isInteger(intervention.sampleCount) || intervention.sampleCount < 0) {
    return {
      ok: false,
      code: INTERVENTION_ERROR_CODE.INVALID_FIELD,
      field: "sampleCount",
      message: `sampleCount must be a non-negative integer; got ${intervention.sampleCount}`,
    };
  }

  // budgetCost: positive integer (>= 1)
  if (!Number.isInteger(intervention.budgetCost) || intervention.budgetCost < 1) {
    return {
      ok: false,
      code: INTERVENTION_ERROR_CODE.INVALID_FIELD,
      field: "budgetCost",
      message: `budgetCost must be a positive integer (>= 1); got ${intervention.budgetCost}`,
    };
  }

  return { ok: true, code: null, message: "valid" };
}

/**
 * Validate a Budget object.
 *
 * Distinguishes missing input from invalid input:
 *   null/undefined         → ok=false, code=MISSING_INPUT
 *   invalid maxWorkerSpawns → ok=false, code=INVALID_FIELD
 *   fully valid            → ok=true,  code=null
 *
 * @param {any} budget
 * @returns {{ ok: boolean, code: string|null, field?: string, message: string }}
 */
export function validateBudget(budget) {
  if (budget === null || budget === undefined) {
    return {
      ok: false,
      code: INTERVENTION_ERROR_CODE.MISSING_INPUT,
      message: "budget is required (got null/undefined)",
    };
  }
  if (typeof budget !== "object" || Array.isArray(budget)) {
    return {
      ok: false,
      code: INTERVENTION_ERROR_CODE.INVALID_TYPE,
      message: "budget must be a plain object",
    };
  }

  // maxWorkerSpawns: required positive integer
  if (!("maxWorkerSpawns" in budget)) {
    return {
      ok: false,
      code: INTERVENTION_ERROR_CODE.MISSING_FIELD,
      field: "maxWorkerSpawns",
      message: "required field 'maxWorkerSpawns' is missing",
    };
  }
  if (!Number.isInteger(budget.maxWorkerSpawns) || budget.maxWorkerSpawns < 1) {
    return {
      ok: false,
      code: INTERVENTION_ERROR_CODE.INVALID_FIELD,
      field: "maxWorkerSpawns",
      message: `budget.maxWorkerSpawns must be a positive integer; got ${budget.maxWorkerSpawns}`,
    };
  }

  // maxWorkersPerWave: optional positive integer
  if (budget.maxWorkersPerWave !== undefined) {
    if (!Number.isInteger(budget.maxWorkersPerWave) || budget.maxWorkersPerWave < 1) {
      return {
        ok: false,
        code: INTERVENTION_ERROR_CODE.INVALID_FIELD,
        field: "maxWorkersPerWave",
        message: `budget.maxWorkersPerWave must be a positive integer when provided; got ${budget.maxWorkersPerWave}`,
      };
    }
  }

  // byRole: optional object with positive integer values
  if (budget.byRole !== undefined) {
    if (typeof budget.byRole !== "object" || Array.isArray(budget.byRole)) {
      return {
        ok: false,
        code: INTERVENTION_ERROR_CODE.INVALID_FIELD,
        field: "byRole",
        message: "budget.byRole must be a plain object when provided",
      };
    }
    for (const [role, cap] of Object.entries(budget.byRole) as any[]) {
      if (!Number.isInteger(cap) || cap < 1) {
        return {
          ok: false,
          code: INTERVENTION_ERROR_CODE.INVALID_FIELD,
          field: `byRole.${role}`,
          message: `budget.byRole.${role} must be a positive integer; got ${cap}`,
        };
      }
    }
  }

  return { ok: true, code: null, message: "valid" };
}

// ── Expected-value computation ────────────────────────────────────────────────

/**
 * Compute the confidence multiplier for a given sample count.
 *
 * Formula: min(1.0, sampleCount / SPARSE_DATA_THRESHOLD)
 *   n < SPARSE_DATA_THRESHOLD → fractional multiplier (confidence penalty)
 *   n >= SPARSE_DATA_THRESHOLD → 1.0 (full confidence)
 *
 * @param {number} sampleCount — non-negative integer
 * @returns {number} — multiplier in [0.0, 1.0]
 */
export function computeConfidenceMultiplier(sampleCount) {
  return Math.min(1.0, sampleCount / SPARSE_DATA_THRESHOLD);
}

/**
 * Apply the confidence penalty to a raw successProbability.
 *
 * adjustedSuccessProbability = successProbability × confidenceMultiplier(sampleCount)
 *
 * @param {number} successProbability — raw P(success) in [0.0, 1.0]
 * @param {number} sampleCount — historical observation count (>= 0)
 * @returns {number} — adjusted P(success) in [0.0, 1.0]
 */
export function applyConfidencePenalty(successProbability, sampleCount) {
  return successProbability * computeConfidenceMultiplier(sampleCount);
}

/**
 * Compute the Expected Value (EV) for an Intervention.
 *
 * Formula:
 *   adjustedP = successProbability × confidenceMultiplier(sampleCount)
 *   EV = adjustedP × impact − (1 − adjustedP) × riskCost
 *
 * The EV is not clamped — it may be negative when riskCost is high
 * and/or confidence is low.
 *
 * @param {object} intervention — validated Intervention object
 * @returns {{ adjustedSuccessProbability: number, ev: number }}
 */
export function computeExpectedValue(intervention) {
  const adjustedP = applyConfidencePenalty(
    intervention.successProbability,
    intervention.sampleCount,
  );
  const ev = adjustedP * intervention.impact - (1 - adjustedP) * intervention.riskCost;
  return { adjustedSuccessProbability: adjustedP, ev };
}

// ── Ranking ───────────────────────────────────────────────────────────────────

/**
 * Rank a list of interventions by descending Expected Value (EV).
 *
 * Applies confidence penalties and attaches `ev` and
 * `adjustedSuccessProbability` to each ranked entry.
 * Does not mutate the input array.
 *
 * @param {object[]} interventions — array of validated Intervention objects
 * @returns {object[]} — new array sorted by descending EV, each item decorated with ev
 */
export function rankInterventions(interventions) {
  return interventions
    .map((intervention) => {
      const { adjustedSuccessProbability, ev } = computeExpectedValue(intervention);
      return { ...intervention, adjustedSuccessProbability, ev };
    })
    .sort((a, b) => b.ev - a.ev);
}

// ── Budget reconciliation ─────────────────────────────────────────────────────

/**
 * Greedily select interventions by descending EV while respecting all three
 * budget constraints simultaneously.
 *
 * Reconciliation semantics (all three enforced concurrently):
 *   1. total    — running Σ budgetCost of accepted interventions ≤ maxWorkerSpawns
 *   2. by-wave  — per-wave Σ budgetCost ≤ maxWorkersPerWave (defaults to maxWorkerSpawns)
 *   3. by-role  — per-role Σ budgetCost ≤ byRole[role] (only when role is in byRole map)
 *
 * An intervention is accepted only if it satisfies ALL active constraints.
 * Rejected interventions are annotated with a machine-readable `reasonCode`.
 *
 * @param {object[]} ranked — EV-ranked interventions (output of rankInterventions)
 * @param {object} budget   — validated Budget object
 * @returns {object} — reconciliation result with selected/rejected arrays and usage tallies
 */
export function reconcileBudgets(ranked, budget) {
  const maxTotal    = budget.maxWorkerSpawns;
  const maxPerWave  = budget.maxWorkersPerWave ?? maxTotal;
  const byRoleLimits = budget.byRole ?? {};

  let totalUsed = 0;
  const byWaveUsed: Record<string, any> = {};
  const byRoleUsed: Record<string, any> = {};
  const selected    = [];
  const rejected    = [];

  for (const intervention of ranked) {
    const waveKey = String(intervention.wave);
    const role    = intervention.role;
    const cost    = intervention.budgetCost;

    // Constraint 1: total budget
    if (totalUsed + cost > maxTotal) {
      rejected.push({
        ...intervention,
        rejectionReason: `total budget exceeded (used=${totalUsed}, cost=${cost}, limit=${maxTotal})`,
        reasonCode: INTERVENTION_REJECTION_CODE.BUDGET_TOTAL,
      });
      continue;
    }

    // Constraint 2: per-wave budget
    const waveUsed = byWaveUsed[waveKey] ?? 0;
    if (waveUsed + cost > maxPerWave) {
      rejected.push({
        ...intervention,
        rejectionReason: `wave ${waveKey} budget exceeded (waveUsed=${waveUsed}, cost=${cost}, limit=${maxPerWave})`,
        reasonCode: INTERVENTION_REJECTION_CODE.BUDGET_WAVE,
      });
      continue;
    }

    // Constraint 3: per-role budget (only when configured)
    if (byRoleLimits[role] !== undefined) {
      const roleUsed = byRoleUsed[role] ?? 0;
      if (roleUsed + cost > byRoleLimits[role]) {
        rejected.push({
          ...intervention,
          rejectionReason: `role '${role}' budget exceeded (roleUsed=${roleUsed}, cost=${cost}, limit=${byRoleLimits[role]})`,
          reasonCode: INTERVENTION_REJECTION_CODE.BUDGET_ROLE,
        });
        continue;
      }
    }

    // Accept
    selected.push(intervention);
    totalUsed             += cost;
    byWaveUsed[waveKey]    = (byWaveUsed[waveKey] ?? 0) + cost;
    byRoleUsed[role]       = (byRoleUsed[role] ?? 0) + cost;
  }

  // Derive top-level status and reason code from the first rejection type found
  let status: any     = OPTIMIZER_STATUS.OK;
  let reasonCode: any = OPTIMIZER_REASON_CODE.VALID;

  if (rejected.length > 0) {
    status = OPTIMIZER_STATUS.BUDGET_EXCEEDED;
    const firstCode = rejected[0].reasonCode;
    if (firstCode === INTERVENTION_REJECTION_CODE.BUDGET_TOTAL) {
      reasonCode = OPTIMIZER_REASON_CODE.BUDGET_TOTAL_EXCEEDED;
    } else if (firstCode === INTERVENTION_REJECTION_CODE.BUDGET_WAVE) {
      reasonCode = OPTIMIZER_REASON_CODE.BUDGET_WAVE_EXCEEDED;
    } else {
      reasonCode = OPTIMIZER_REASON_CODE.BUDGET_ROLE_EXCEEDED;
    }
  }

  return {
    status,
    reasonCode,
    totalBudgetUsed:     totalUsed,
    totalBudgetLimit:    maxTotal,
    byWaveBudgetLimit:   maxPerWave,
    byWaveUsed,
    byRoleBudgetLimits:  { ...byRoleLimits },
    byRoleUsed,
    selected,
    rejected,
  };
}

// ── Main optimizer entry point ────────────────────────────────────────────────

/**
 * Run the budget-aware intervention optimizer.
 *
 * Steps:
 *   1. Validate budget (missing vs invalid — explicit reason codes)
 *   2. Validate interventions array (must be non-null array)
 *   3. Validate each individual intervention against INTERVENTION_SCHEMA
 *   4. Apply failure classifications to successProbability (AC #5 — intervention prioritisation)
 *   5. Rank interventions by descending Expected Value (with confidence penalties)
 *   6. Greedily reconcile budgets (total, by-wave, by-role simultaneously)
 *   7. Return structured result with full selection rationale
 *
 * AC #5 / Athena missing item #2 — failure classification integration:
 *   When options.failureClassifications is provided as an object keyed by role name,
 *   each intervention's successProbability is adjusted before ranking via
 *   applyClassificationToSuccessProbability().  This is the observable behavioral
 *   change that "feeds intervention prioritization": interventions for roles with
 *   prior failures receive lower EV scores and are ranked lower (or rejected first
 *   under budget pressure).
 *
 *   options.failureClassifications: { [role: string]: ClassificationResult }
 *
 * No silent fallbacks. All failure modes set an explicit `status` and `reasonCode`.
 *
 * @param {any[]} interventions — array of Intervention objects to evaluate
 * @param {object} budget       — Budget object (must include maxWorkerSpawns)
 * @param {object} [options]    — optional settings
 *   @param {object} [options.failureClassifications] — { [role]: ClassificationResult }
 * @returns {object}            — optimizer result conforming to OPTIMIZER_RESULT_SCHEMA
 */
export function runInterventionOptimizer(interventions, budget, options: any = {}) {
  const generatedAt = new Date().toISOString();

  // Validate budget first (fail fast on missing/invalid budget)
  const budgetValidation = validateBudget(budget);
  if (!budgetValidation.ok) {
    return {
      schemaVersion:       OPTIMIZER_LOG_SCHEMA_VERSION,
      generatedAt,
      status:              OPTIMIZER_STATUS.INVALID_INPUT,
      reasonCode:          OPTIMIZER_REASON_CODE.INVALID_BUDGET,
      errorMessage:        budgetValidation.message,
      invalidField:        budgetValidation.field ?? null,
      budgetUnit:          BUDGET_UNIT,
      totalBudgetLimit:    0,
      totalBudgetUsed:     0,
      byWaveBudgetLimit:   0,
      byWaveUsed:          {},
      byRoleBudgetLimits:  {},
      byRoleUsed:          {},
      selected:            [],
      rejected:            [],
    };
  }

  const maxTotal  = budget.maxWorkerSpawns;
  const maxWave   = budget.maxWorkersPerWave ?? maxTotal;
  const byRoleLimits = budget.byRole ?? {};

  // Validate interventions array (missing vs invalid distinction)
  if (interventions === null || interventions === undefined) {
    return {
      schemaVersion:       OPTIMIZER_LOG_SCHEMA_VERSION,
      generatedAt,
      status:              OPTIMIZER_STATUS.INVALID_INPUT,
      reasonCode:          OPTIMIZER_REASON_CODE.MISSING_INPUT,
      errorMessage:        "interventions is required (got null/undefined)",
      invalidField:        null,
      budgetUnit:          BUDGET_UNIT,
      totalBudgetLimit:    maxTotal,
      totalBudgetUsed:     0,
      byWaveBudgetLimit:   maxWave,
      byWaveUsed:          {},
      byRoleBudgetLimits:  { ...byRoleLimits },
      byRoleUsed:          {},
      selected:            [],
      rejected:            [],
    };
  }

  if (!Array.isArray(interventions)) {
    return {
      schemaVersion:       OPTIMIZER_LOG_SCHEMA_VERSION,
      generatedAt,
      status:              OPTIMIZER_STATUS.INVALID_INPUT,
      reasonCode:          OPTIMIZER_REASON_CODE.MISSING_INPUT,
      errorMessage:        "interventions must be an array",
      invalidField:        null,
      budgetUnit:          BUDGET_UNIT,
      totalBudgetLimit:    maxTotal,
      totalBudgetUsed:     0,
      byWaveBudgetLimit:   maxWave,
      byWaveUsed:          {},
      byRoleBudgetLimits:  { ...byRoleLimits },
      byRoleUsed:          {},
      selected:            [],
      rejected:            [],
    };
  }

  // Empty array is valid input (distinct from missing/invalid)
  if (interventions.length === 0) {
    return {
      schemaVersion:       OPTIMIZER_LOG_SCHEMA_VERSION,
      generatedAt,
      status:              OPTIMIZER_STATUS.EMPTY_INPUT,
      reasonCode:          OPTIMIZER_REASON_CODE.EMPTY_INPUT,
      errorMessage:        "no interventions provided",
      budgetUnit:          BUDGET_UNIT,
      totalBudgetLimit:    maxTotal,
      totalBudgetUsed:     0,
      byWaveBudgetLimit:   maxWave,
      byWaveUsed:          {},
      byRoleBudgetLimits:  { ...byRoleLimits },
      byRoleUsed:          {},
      selected:            [],
      rejected:            [],
    };
  }

  // Validate each intervention — fail fast on first invalid (gives index + field)
  for (let i = 0; i < interventions.length; i++) {
    const vr = validateIntervention(interventions[i]);
    if (!vr.ok) {
      return {
        schemaVersion:       OPTIMIZER_LOG_SCHEMA_VERSION,
        generatedAt,
        status:              OPTIMIZER_STATUS.INVALID_INPUT,
        reasonCode:          OPTIMIZER_REASON_CODE.INVALID_INTERVENTION,
        errorMessage:        `interventions[${i}]: ${vr.message}`,
        invalidField:        vr.field ?? null,
        budgetUnit:          BUDGET_UNIT,
        totalBudgetLimit:    maxTotal,
        totalBudgetUsed:     0,
        byWaveBudgetLimit:   maxWave,
        byWaveUsed:          {},
        byRoleBudgetLimits:  { ...byRoleLimits },
        byRoleUsed:          {},
        selected:            [],
        rejected:            [],
      };
    }
  }

  // Apply failure classifications to successProbability before ranking (AC #5)
  // failureClassifications: { [role: string]: ClassificationResult }
  // Observable change: adjusted interventions are ranked lower under budget pressure.
  const failureClassifications = options?.failureClassifications;
  let failureClassificationsApplied = 0;
  let adjustedInterventions = interventions;

  if (failureClassifications && typeof failureClassifications === "object" && !Array.isArray(failureClassifications)) {
    adjustedInterventions = interventions.map((intervention) => {
      const classification = failureClassifications[intervention.role];
      if (!classification) return intervention;
      const adjustedSP = applyClassificationToSuccessProbability(intervention.successProbability, classification);
      if (adjustedSP === intervention.successProbability) return intervention;
      failureClassificationsApplied += 1;
      return { ...intervention, successProbability: adjustedSP };
    });
  }

  // Rank by descending EV (with confidence penalties applied)
  const ranked = rankInterventions(adjustedInterventions);

  // Reconcile all three budget constraints simultaneously
  const reconciled = reconcileBudgets(ranked, budget);

  return {
    schemaVersion:  OPTIMIZER_LOG_SCHEMA_VERSION,
    generatedAt,
    budgetUnit:     BUDGET_UNIT,
    failureClassificationsApplied,
    ...reconciled,
  };
}

// ── Prometheus plan → Intervention adapter ────────────────────────────────────

/**
 * Convert a Prometheus plan array into Intervention objects.
 *
 * Prometheus plans carry strategic metadata but not historical performance data.
 * This adapter applies configurable defaults for the probability/impact/cost fields.
 * sampleCount defaults to SPARSE_DATA_THRESHOLD (full confidence baseline) so that
 * newly planned interventions are ranked by their relative impact/priority rather
 * than being penalized for zero historical data. Override via config if needed.
 *
 * Wave parsing: Prometheus uses string wave ids ("wave-1", "wave-2", etc.).
 * The numeric wave is extracted from the trailing integer; defaults to 1 if unparseable.
 *
 * @param {object[]} plans   — Prometheus plans array (from prometheus_analysis.json)
 * @param {object}   config  — box.config.json config object
 * @returns {object[]}       — array of Intervention objects ready for the optimizer
 */
export function buildInterventionsFromPlan(plans, config) {
  if (!Array.isArray(plans) || plans.length === 0) return [];

  const opts = config?.interventionOptimizer ?? {};
  const defaultSuccessP   = Number(opts.defaultSuccessProbability ?? 0.8);
  const _defaultImpact    = Number(opts.defaultImpact ?? 0.7); // impact is derived from plan priority instead
  const defaultRiskCost   = Number(opts.defaultRiskCost ?? 0.3);
  const defaultSampleCount = Number.isInteger(opts.defaultSampleCount)
    ? opts.defaultSampleCount
    : SPARSE_DATA_THRESHOLD;

  return plans.map((plan, index) => {
    // Parse wave number from "wave-1", "wave-2", etc.
    const waveStr  = String(plan?.wave ?? "wave-1");
    const waveMatch = waveStr.match(/(\d+)/);
    const wave     = waveMatch ? Math.max(1, parseInt(waveMatch[1], 10)) : 1;

    // Derive impact from priority (1–10 → 0.1–1.0)
    const rawPriority = Number(plan?.priority ?? 5);
    const impact = Math.min(1.0, Math.max(0.1, rawPriority / 10));

    return {
      id:                  String(plan?.id ?? `plan-${index + 1}`),
      type:                INTERVENTION_TYPE.TASK,
      wave,
      role:                String(plan?.role ?? "unknown").trim() || "unknown",
      title:               String(plan?.task ?? plan?.title ?? `task-${index + 1}`).trim() || `task-${index + 1}`,
      successProbability:  defaultSuccessP,
      impact,
      riskCost:            defaultRiskCost,
      sampleCount:         defaultSampleCount,
      budgetCost:          1,
    };
  });
}

/**
 * Build a Budget object from a Prometheus requestBudget and box.config.json.
 *
 * Budget unit: workerSpawns (integer).
 * Sources (in priority order):
 *   1. requestBudget.hardCapTotal (from Prometheus AI output)
 *   2. config.runtime.runtimeBudget.maxWorkerSpawnsPerCycle
 *   3. config.runtime.runtimeBudget.maxTasksPerCycle (fallback)
 *   4. Hardcoded default: 12
 *
 * @param {object} requestBudget — Prometheus requestBudget object
 * @param {object} config        — box.config.json config object
 * @returns {object}             — Budget object for runInterventionOptimizer
 */
export function buildBudgetFromConfig(requestBudget, config) {
  const runtimeBudget = config?.runtime?.runtimeBudget ?? {};
  const plannerMaxWorkersPerWave = Math.max(
    1,
    Number(config?.planner?.defaultMaxWorkersPerWave ?? config?.maxParallelWorkers ?? 10),
  );

  // Derive total budget from requestBudget or runtime config
  const hardCap = Number(requestBudget?.hardCapTotal);
  const configSpawns = Number(runtimeBudget.maxWorkerSpawnsPerCycle);
  const configTasks  = Number(runtimeBudget.maxTasksPerCycle);
  const maxWorkerSpawns = (Number.isFinite(hardCap) && hardCap > 0)
    ? hardCap
    : (Number.isFinite(configSpawns) && configSpawns > 0)
      ? configSpawns
      : (Number.isFinite(configTasks) && configTasks > 0)
        ? configTasks
        : 12;

  // Per-wave budget from requestBudget.byWave or planner config
  let maxWorkersPerWave = plannerMaxWorkersPerWave;
  if (Array.isArray(requestBudget?.byWave) && requestBudget.byWave.length > 0) {
    const maxWaveEntry = requestBudget.byWave.reduce(
      (acc, w) => Math.max(acc, Number(w?.count ?? w?.budget ?? 0)),
      0,
    );
    if (maxWaveEntry > 0) maxWorkersPerWave = maxWaveEntry;
  }

  // Per-role budget from requestBudget.byRole or optimizer config
  const byRole: Record<string, any> = {};
  if (Array.isArray(requestBudget?.byRole)) {
    for (const entry of requestBudget.byRole) {
      const roleName = String(entry?.role ?? "");
      const cap = Number(entry?.count ?? entry?.budget ?? 0);
      if (roleName && Number.isFinite(cap) && cap > 0) {
        byRole[roleName] = cap;
      }
    }
  }

  return {
    maxWorkerSpawns: Math.max(1, Math.floor(maxWorkerSpawns)),
    maxWorkersPerWave: Math.max(1, Math.floor(maxWorkersPerWave)),
    ...(Object.keys(byRole).length > 0 ? { byRole } : {}),
  };
}

// ── Persistence ───────────────────────────────────────────────────────────────

/**
 * Append an optimizer result entry to state/intervention_optimizer_log.json.
 *
 * Called by prometheus.js integration after each optimizer run.
 * Never throws — all errors are returned in a result object so the caller can
 * log them without crashing the orchestration flow.
 *
 * Log file schema:
 *   { schemaVersion, updatedAt, entries: [...result objects] }
 *   Each entry conforms to OPTIMIZER_RESULT_SCHEMA (all required fields present).
 *   Maximum retained entries: 100 (LIFO trim).
 *
 * @param {string} stateDir — absolute path to state directory
 * @param {object} result   — optimizer result from runInterventionOptimizer
 * @returns {Promise<{ ok: boolean, reason?: string }>}
 */
export async function persistOptimizerLog(stateDir, result) {
  try {
    const logFile = path.join(stateDir, "intervention_optimizer_log.json");
    const existing = await readJson(logFile, {
      schemaVersion: OPTIMIZER_LOG_SCHEMA_VERSION,
      updatedAt:     new Date().toISOString(),
      entries:       [],
    });

    const entries = Array.isArray(existing.entries) ? existing.entries : [];
    entries.push({ ...result, savedAt: new Date().toISOString() });

    const trimmed = entries.length > 100 ? entries.slice(-100) : entries;

    await writeJson(logFile, {
      schemaVersion: OPTIMIZER_LOG_SCHEMA_VERSION,
      updatedAt:     new Date().toISOString(),
      entries:       trimmed,
    });

    return { ok: true };
  } catch (err) {
    return { ok: false, reason: String(err?.message || err) };
  }
}

```

### FILE: src/core/capability_pool.ts
```typescript
/**
 * capability_pool.js — Capability-based worker pool abstraction.
 *
 * Instead of routing all work to a single `evolution-worker`, this module
 * maps task requirements to worker capabilities and selects the best-fit worker.
 *
 * Capability tags are defined in verification_profiles.js (LANES) and can be
 * extended via box.config.json.
 *
 * Integration: called by orchestrator before worker dispatch to select the
 * optimal worker for each plan.
 */

import { LANE_WORKER_NAMES, WORKER_CAPABILITIES } from "./role_registry.js";

/**
 * Per-lane outcome accumulator.  Populated by callers (e.g. orchestrator or
 * evolution_executor) after each worker completes.  All fields are non-negative
 * integers / floats so arithmetic scoring never throws.
 */
export interface LaneOutcome {
  successes: number;
  failures:  number;
  totalMs:   number;
  lastUpdated: string; // ISO-8601
}

export type LanePerformanceLedger = Record<string, LaneOutcome>;

/**
 * Record a single worker outcome for a lane.
 * Returns a **new** ledger object — the input is never mutated.
 *
 * @param ledger — current ledger (may be empty `{}`)
 * @param lane   — lane name (e.g. "quality", "implementation")
 * @param outcome — { success, durationMs? }
 */
export function recordLaneOutcome(
  ledger: LanePerformanceLedger,
  lane: string,
  outcome: { success: boolean; durationMs?: number }
): LanePerformanceLedger {
  const existing: LaneOutcome = ledger[lane] ?? { successes: 0, failures: 0, totalMs: 0, lastUpdated: "" };
  return {
    ...ledger,
    [lane]: {
      successes:   existing.successes + (outcome.success ? 1 : 0),
      failures:    existing.failures  + (outcome.success ? 0 : 1),
      totalMs:     existing.totalMs   + Math.max(0, outcome.durationMs ?? 0),
      lastUpdated: new Date().toISOString(),
    },
  };
}

/**
 * Compute a 0–1 performance score for a lane.
 *
 * Formula: Laplace-smoothed success rate = (successes + 1) / (total + 2).
 * This means an unseen lane scores 0.5, a perfect lane scores close to 1,
 * and a consistently failing lane scores close to 0.
 *
 * The score is intentionally smooth so it acts as a soft nudge, not a hard
 * override — diversity controls remain authoritative over lane selection.
 *
 * @param ledger — accumulated lane outcomes
 * @param lane   — lane name to score
 * @returns      — value in [0, 1]
 */
export function getLaneScore(ledger: LanePerformanceLedger, lane: string): number {
  if (!ledger || !lane) return 0.5;
  const entry = ledger[lane];
  if (!entry) return 0.5; // no data → neutral score
  const total = entry.successes + entry.failures;
  if (total === 0) return 0.5;
  return (entry.successes + 1) / (total + 2);
}

/**
 * Default worker capabilities mapping.
 * Maps capability tags to preferred worker roles.
 */
const DEFAULT_CAPABILITY_MAP = Object.freeze({
  "planner-improvement":  { lane: "quality",         fallback: "evolution-worker" },
  "runtime-refactor":     { lane: "implementation",  fallback: "evolution-worker" },
  "test-infra":           { lane: "quality",         fallback: "evolution-worker" },
  "state-governance":     { lane: "governance",      fallback: "evolution-worker" },
  "integration":          { lane: "integration",     fallback: "evolution-worker" },
  "infrastructure":       { lane: "infrastructure",  fallback: "evolution-worker" },
  "observation":          { lane: "observation",     fallback: "evolution-worker" },
});

/**
 * @typedef {object} WorkerSelection
 * @property {string} role — selected worker role name
 * @property {string} lane — capability lane
 * @property {string} reason — why this worker was selected
 * @property {boolean} isFallback — true if using fallback worker
 * @property {number} performanceScore — Laplace-smoothed success rate (0–1); 0.5 when no data
 */
export interface WorkerSelection {
  role: string;
  lane: string;
  reason: string;
  isFallback: boolean;
  performanceScore: number;
}

/**
 * Infer capability tag from plan content.
 *
 * @param {object} plan — plan object with task, taskKind, role fields
 * @returns {string} capability tag
 */
export function inferCapabilityTag(plan) {
  if (!plan) return "runtime-refactor";

  const task = String(plan.task || "").toLowerCase();
  const kind = String(plan.taskKind || plan.kind || "").toLowerCase();
  const role = String(plan.role || "").toLowerCase();

  // Direct role match
  if (role.includes("governance") || role.includes("policy")) return "state-governance";
  if (role.includes("test") || role.includes("quality")) return "test-infra";
  if (role.includes("planner") || role.includes("prometheus")) return "planner-improvement";
  if (role.includes("infra") || role.includes("docker") || role.includes("ci")) return "infrastructure";
  if (role.includes("integration") || role.includes("wiring")) return "integration";
  if (role.includes("observ") || role.includes("monitor") || role.includes("dashboard")) return "observation";

  // Task content heuristics
  if (/test|spec|assert|coverage/.test(task)) return "test-infra";
  if (/governance|policy|freeze|canary/.test(task)) return "state-governance";
  if (/prometheus|plan|hypothesis|strategy/.test(task)) return "planner-improvement";
  if (/docker|ci|deploy|infra/.test(task)) return "infrastructure";
  if (/dashboard|metric|monitor|alert/.test(task)) return "observation";
  if (/wire|connect|integrate|import/.test(task)) return "integration";

  // Kind-based fallback
  if (kind === "governance") return "state-governance";
  if (kind === "test") return "test-infra";

  return "runtime-refactor";
}

/**
 * Select the best worker for a plan based on capability matching.
 *
 * When `lanePerformance` is provided, the returned `performanceScore` reflects
 * the lane's historical success rate.  If the primary lane has a score below
 * `LOW_PERFORMANCE_THRESHOLD` the selection falls back to the evolution-worker
 * while preserving the original lane label for diversity accounting.
 *
 * Diversity controls (`enforceLaneDiversity`, `diversityIndex`) are not
 * affected — they operate on the final assignment set after all selections.
 *
 * @param {object} plan — plan object
 * @param {object} [config] — BOX config for custom mappings
 * @param {LanePerformanceLedger} [lanePerformance] — optional historical lane outcomes
 * @returns {WorkerSelection}
 */
export function selectWorkerForPlan(plan, config?, lanePerformance?: LanePerformanceLedger) {
  const capTag = inferCapabilityTag(plan);
  const customMap = config?.workerPool?.capabilityMap;
  const mapping = customMap?.[capTag] || DEFAULT_CAPABILITY_MAP[capTag] || { lane: "implementation", fallback: "evolution-worker" };

  const score = getLaneScore(lanePerformance ?? {}, mapping.lane);

  // Resolve to the canonical lane worker name; fall back to configured fallback if lane is unknown.
  // When performance data indicates a consistently degraded lane (score < 0.25), route to the
  // fallback worker instead so throughput is not stuck behind a broken specialised lane.
  // The lane label is preserved in the selection so diversity accounting still counts it.
  const LOW_PERFORMANCE_THRESHOLD = 0.25;
  const laneWorkerName = LANE_WORKER_NAMES[mapping.lane] || mapping.fallback;
  const performanceDegraded = score < LOW_PERFORMANCE_THRESHOLD;
  const selectedRole = performanceDegraded ? mapping.fallback : laneWorkerName;
  const isFallback = !LANE_WORKER_NAMES[mapping.lane] || performanceDegraded;

  return {
    role: selectedRole,
    lane: mapping.lane,
    reason: performanceDegraded
      ? `Capability "${capTag}" → lane "${mapping.lane}" → performance score ${score.toFixed(2)} below threshold; falling back to "${selectedRole}"`
      : `Capability "${capTag}" → lane "${mapping.lane}" → worker "${selectedRole}"`,
    isFallback,
    performanceScore: score,
  };
}

/**
 * Options for {@link assignWorkersToPlans}.
 *
 * @property diversityThreshold — minimum number of distinct lanes required in the
 *   result.  When the computed `activeLaneCount` is below this value, `diversityCheck`
 *   in the return value will have `meetsMinimum: false`.  Defaults to 2.
 *   Set to 0 or 1 to disable the threshold check entirely.
 */
export interface AssignWorkersOptions {
  diversityThreshold?: number;
}

/**
 * Assign workers to all plans using capability matching.
 *
 * @param {object[]} plans — array of plan objects
 * @param {object} [config]
 * @param {LanePerformanceLedger} [lanePerformance] — optional historical lane outcomes
 * @param {AssignWorkersOptions} [opts] — optional diversity enforcement options
 * @returns {{ assignments: Array<{ plan: object, selection: WorkerSelection }>, diversityIndex: number, diversityCheck: object }}
 */
export function assignWorkersToPlans(
  plans,
  config?,
  lanePerformance?: LanePerformanceLedger,
  opts: AssignWorkersOptions = {}
) {
  if (!Array.isArray(plans)) return { assignments: [], diversityIndex: 0, diversityCheck: { meetsMinimum: true, activeLaneCount: 0, warning: "" } };

  const assignments = plans.map(plan => ({
    plan,
    selection: selectWorkerForPlan(plan, config, lanePerformance)
  }));

  // Compute diversity index: 1 - (maxWorkerShare)
  // Lower share of a single worker = higher diversity
  const roleCounts = new Map();
  const laneCounts = new Map();
  for (const a of assignments) {
    const role = a.selection.role;
    const lane = a.selection.lane;
    roleCounts.set(role, (roleCounts.get(role) || 0) + 1);
    laneCounts.set(lane, (laneCounts.get(lane) || 0) + 1);
  }
  const maxShare = assignments.length > 0
    ? Math.max(...roleCounts.values()) / assignments.length
    : 1;
  const diversityIndex = Math.round((1 - maxShare) * 100) / 100;
  const activeLaneCount = laneCounts.size;

  const pool = { assignments, diversityIndex, activeLaneCount, laneCounts: Object.fromEntries(laneCounts) };

  // Enforce diversity threshold: default 2 lanes minimum.
  // Returns meetsMinimum=false with a warning when the threshold is not met so
  // callers (orchestrator, buildRoleExecutionBatches) can gate or log accordingly.
  const minLanes = opts.diversityThreshold ?? 2;
  const diversityCheck = enforceLaneDiversity(pool, { minLanes });

  return { ...pool, diversityCheck };
}

/**
 * Enforce minimum lane diversity for high-leverage cycles (Packet 6).
 * Returns adjusted assignments that ensure at least minLanes distinct lanes.
 *
 * @param {{ assignments: Array, diversityIndex: number, activeLaneCount: number }} pool
 * @param {{ minLanes?: number }} opts
 * @returns {{ meetsMinimum: boolean, activeLaneCount: number, warning: string }}
 */
export function enforceLaneDiversity(pool, opts: any = {}) {
  const minLanes = opts.minLanes != null ? opts.minLanes : 2;
  const laneCount = pool.activeLaneCount || 0;
  if (laneCount >= minLanes) {
    return { meetsMinimum: true, activeLaneCount: laneCount, warning: "" };
  }
  return {
    meetsMinimum: false,
    activeLaneCount: laneCount,
    warning: `Only ${laneCount} lane(s) active, minimum is ${minLanes}. Worker topology may be monocultural.`,
  };
}

/**
 * Worker dispatch distribution metrics (Packet 12).
 * Tracks how work is distributed across workers and lanes over time.
 *
 * @param {{ assignments: Array<{ plan: object, selection: WorkerSelection }> }} pool
 * @returns {{ roleDistribution: Record<string, number>, laneDistribution: Record<string, number>, concentrationRatio: number, diversityScore: number }}
 */
export function computeDispatchMetrics(pool) {
  if (!pool || !Array.isArray(pool.assignments) || pool.assignments.length === 0) {
    return { roleDistribution: {}, laneDistribution: {}, concentrationRatio: 1, diversityScore: 0 };
  }

  const roleDistribution: Record<string, any> = {};
  const laneDistribution: Record<string, any> = {};

  for (const a of pool.assignments) {
    const role = a.selection?.role || "unknown";
    const lane = a.selection?.lane || "unknown";
    roleDistribution[role] = (roleDistribution[role] || 0) + 1;
    laneDistribution[lane] = (laneDistribution[lane] || 0) + 1;
  }

  const total = pool.assignments.length;
  const maxRoleCount = Math.max(...Object.values(roleDistribution));
  const concentrationRatio = Math.round((maxRoleCount / total) * 100) / 100;
  const uniqueRoles = Object.keys(roleDistribution).length;
  const diversityScore = Math.round((1 - concentrationRatio + (uniqueRoles / Math.max(total, 1))) / 2 * 100) / 100;

  return { roleDistribution, laneDistribution, concentrationRatio, diversityScore };
}

/**
 * Multi-worker chain topology for high-complexity tasks (Packet 13).
 *
 * Decomposes a high-complexity task into a sequential chain:
 *   architect → implementation → verification → (optional) learning
 *
 * Each stage produces a handoff artifact consumed by the next stage.
 *
 * @param {object} plan — the plan to decompose
 * @param {{ complexity?: string }} hints
 * @returns {{ isChained: boolean, chain: Array<{ stage: string, lane: string, task: string }> }}
 */
export function buildWorkerChain(plan, hints: any = {}) {
  const complexity = String(hints.complexity || plan.complexity || "").toLowerCase();
  const isHighComplexity = ["critical", "massive", "high"].includes(complexity);

  if (!isHighComplexity) {
    return { isChained: false, chain: [] };
  }

  const task = String(plan.task || "");

  return {
    isChained: true,
    chain: [
      {
        stage: "architect",
        lane: "quality",
        task: `[ARCHITECT] Decompose and plan implementation approach for: ${task}. Output a step-by-step implementation plan with file paths and acceptance criteria.`,
      },
      {
        stage: "implementation",
        lane: "implementation",
        task: `[IMPLEMENT] Execute the architect's plan for: ${task}. Follow the decomposed steps exactly. Output BOX_STATUS and VERIFICATION_REPORT.`,
      },
      {
        stage: "verification",
        lane: "quality",
        task: `[VERIFY] Validate the implementation of: ${task}. Run npm test, check edge cases, confirm acceptance criteria are met. Output pass/fail per criterion.`,
      },
    ],
  };
}

/**
 * Conflict descriptor for a pair of plans within the same lane that share target files.
 *
 * @typedef {object} LaneConflict
 * @property {string} lane — the shared capability lane
 * @property {string} plan1Task — task string of the first plan
 * @property {string} plan2Task — task string of the second plan
 * @property {string[]} sharedFiles — target files that both plans reference
 */

/**
 * Detect intra-lane conflicts: pairs of plans in the same capability lane
 * that reference at least one overlapping target file.
 *
 * Concurrent workers in the same lane touching the same files risk write
 * conflicts and merge failures. Callers should ensure such plans are placed
 * in separate waves or batches.
 *
 * @param {Array<{ plan: object, selection: WorkerSelection }>} assignments
 * @returns {Array<LaneConflict>}
 */
export function detectLaneConflicts(assignments) {
  if (!Array.isArray(assignments) || assignments.length < 2) return [];

  // Group plan indices by lane
  const laneMap = new Map();
  for (let i = 0; i < assignments.length; i++) {
    const lane = assignments[i]?.selection?.lane || "unknown";
    if (!laneMap.has(lane)) laneMap.set(lane, []);
    laneMap.get(lane).push(i);
  }

  const conflicts = [];

  for (const [lane, indices] of laneMap.entries()) {
    if (indices.length < 2) continue;

    // For each pair in this lane, check for file overlap
    for (let a = 0; a < indices.length - 1; a++) {
      for (let b = a + 1; b < indices.length; b++) {
        const planA = assignments[indices[a]]?.plan;
        const planB = assignments[indices[b]]?.plan;

        const filesA = new Set(
          Array.isArray(planA?.target_files) ? planA.target_files.map(String) :
          (Array.isArray(planA?.targetFiles) ? planA.targetFiles.map(String) : [])
        );
        if (filesA.size === 0) continue;

        const sharedFiles = (
          Array.isArray(planB?.target_files) ? planB.target_files.map(String) :
          (Array.isArray(planB?.targetFiles) ? planB.targetFiles.map(String) : [])
        ).filter(f => filesA.has(f));

        if (sharedFiles.length > 0) {
          conflicts.push({
            lane,
            plan1Task: String(planA?.task || "").slice(0, 80),
            plan2Task: String(planB?.task || "").slice(0, 80),
            sharedFiles,
          });
        }
      }
    }
  }

  return conflicts;
}

// ── Worker-task fit scoring ────────────────────────────────────────────────────

/**
 * Score a worker's fitness for a given plan on a 0–1 scale.
 *
 * Scoring components:
 *   1. Capability match (50%): 1.0 if the inferred capability tag is in the
 *      worker's declared capability list, 0 otherwise.
 *   2. Lane performance (40%): Laplace-smoothed historical success rate for
 *      the worker's primary lane (from the supplied ledger).
 *   3. Specialist bonus (10%): awarded when the worker declares exactly one
 *      capability AND that capability matches the plan's tag.
 *
 * Ties are broken deterministically by worker name (lexicographic ascending)
 * in the caller (selectWorkerByFitScore).
 *
 * @param workerName  — worker name (e.g. "quality-worker")
 * @param plan        — plan object passed to inferCapabilityTag
 * @param ledger      — optional historical lane outcomes for performance component
 * @returns score in [0, 1]
 */
export function scoreWorkerTaskFit(
  workerName: string,
  plan: object,
  ledger?: LanePerformanceLedger
): number {
  const capTag = inferCapabilityTag(plan);
  const workerCaps: readonly string[] = (WORKER_CAPABILITIES as Record<string, readonly string[]>)[workerName] ?? [];

  // Find the primary lane for this worker
  const workerLane = Object.entries(LANE_WORKER_NAMES).find(([, name]) => name === workerName)?.[0] ?? "";

  const capMatch = workerCaps.includes(capTag) ? 1.0 : 0.0;
  const laneScore = getLaneScore(ledger ?? {}, workerLane);
  const specialistBonus = workerCaps.length === 1 && capMatch > 0 ? 0.1 : 0;

  const raw = (capMatch * 0.5) + (laneScore * 0.4) + specialistBonus;
  return Math.min(1.0, Math.round(raw * 1000) / 1000);
}

/**
 * Select the best-fit worker for a plan using explicit fit scores.
 *
 * All registered workers (from LANE_WORKER_NAMES) are scored against the plan.
 * The highest-scoring worker is returned.  When two workers tie, the one that
 * sorts first alphabetically by name is chosen — guaranteeing deterministic
 * output for identical inputs.
 *
 * Falls back to "Evolution Worker" when no workers are registered.
 *
 * @param plan    — plan object to match against worker capabilities
 * @param config  — BOX config (unused currently; reserved for future custom registrations)
 * @param ledger  — optional historical lane outcomes for performance-aware scoring
 * @returns WorkerSelection extended with a `fitScore` field
 */
export function selectWorkerByFitScore(
  plan: object,
  config?: object,
  ledger?: LanePerformanceLedger
): WorkerSelection & { fitScore: number } {
  const workerNames = Object.values(LANE_WORKER_NAMES) as string[];

  const scored = workerNames
    .map(name => ({ name, score: scoreWorkerTaskFit(name, plan, ledger) }))
    // Higher score first; alphabetical name as deterministic tie-breaker
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  const best = scored[0] ?? { name: "Evolution Worker", score: 0 };
  const lane = Object.entries(LANE_WORKER_NAMES).find(([, n]) => n === best.name)?.[0] ?? "implementation";
  const capTag = inferCapabilityTag(plan);

  return {
    role: best.name,
    lane,
    reason: `fit-score: "${best.name}" scored ${best.score.toFixed(3)} for capability "${capTag}" (deterministic)`,
    isFallback: best.score === 0,
    performanceScore: getLaneScore(ledger ?? {}, lane),
    fitScore: best.score,
  };
}

/**
 * Convert a completion-yield ROI value to a Laplace-compatible lane performance
 * score in [0, 1].
 *
 * This lets callers translate tier-level ROI data (from computeRecentROIForTier)
 * into a score that can be used directly in `scoreWorkerTaskFit` performance
 * comparisons without requiring accumulated lane outcome counts.
 *
 * Mapping:
 *   roi <= 0   → 0.5  (no history, or invalid — matches getLaneScore default for unseen lanes)
 *   roi in (0, 2] → roi / 2  (linear scale; ROI=1 → 0.5, ROI=2 → 1.0)
 *   roi > 2    → 1.0  (capped at excellent)
 *
 * @param roi — completion-yield ROI (0-∞); 0 means no realized history
 * @returns score in [0, 1]
 */
export function roiToLaneScore(roi: number): number {
  if (!Number.isFinite(roi) || roi <= 0) return 0.5;
  return Math.min(1.0, Math.round((roi / 2) * 1000) / 1000);
}

```

### FILE: src/types/index.ts
```typescript
/**
 * BOX Orchestrator — Shared Type Definitions
 * Central type layer for the entire system.
 */

// ─── Config ────────────────────────────────────────────────────────
export interface Config {
  env: {
    githubToken: string | null;
    copilotGithubToken: string | null;
    targetRepo: string | null;
    targetBaseBranch: string;
    copilotCliCommand: string;
    budgetUsd: number;
    mode: string;
    [key: string]: unknown;
  };
  paths: {
    stateDir: string;
    policyFile: string;
    progressFile: string;
    copilotUsageFile: string;
    copilotUsageMonthlyFile: string;
    testsStateFile: string;
    [key: string]: string;
  };
  copilot: {
    strategy: string;
    allowOpusEscalation: boolean;
    allowedModels: string[];
    maxMultiplier: number;
    opusMinBudgetUsd: number;
    opusMonthlyMaxCalls: number;
  };
  git: {
    autoCreatePr: boolean;
    autoMergeOnGreen: boolean;
    autoMergeWaitSeconds: number;
    autoMergePollSeconds: number;
    autoMergeMethod: string;
    requiredCheckRuns: string[];
    requiredStatusContexts: string[];
  };
  runtime: {
    copilotAutoCompact: boolean;
    copilotRehydrateOnFail: boolean;
    copilotMaxRetries: number;
    stopOnError: boolean;
    reviewerProvider: string;
    autonomousMaxAttemptsPerTask: number;
    autonomousTaskSplitOnFailure: boolean;
    maxQueuedTasks: number;
    [key: string]: unknown;
  };
  roleRegistry?: {
    ceoSupervisor?: WorkerRoleConfig;
    planner?: WorkerRoleConfig;
    reviewer?: WorkerRoleConfig;
    workers?: Record<string, WorkerRoleConfig>;
  };
  canary?: {
    enabled?: boolean;
    defaultRatio?: number;
    governance?: {
      canaryRatio?: number;
      cohortSelectionAlgorithm?: string;
      [key: string]: unknown;
    };
  };
  gates?: {
    requireBuild?: boolean;
    requireTests?: boolean;
    requireSecurityScan?: boolean;
  };
  rollbackEngine?: {
    enabled?: boolean;
    oneCycleSlaMs?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface WorkerRoleConfig {
  id?: string;
  name: string;
  model?: string;
  kind?: string;
  [key: string]: unknown;
}

// ─── Generic result pattern ────────────────────────────────────────
export interface Result<T = unknown> {
  ok: boolean;
  code?: string;
  reason?: string;
  message?: string;
  data?: T;
  error?: unknown;
}

// ─── Worker ────────────────────────────────────────────────────────
export type WorkerStatus = "done" | "partial" | "blocked" | "error";

export interface WorkerInstruction {
  task: string;
  context?: string;
  verification?: string;
  taskKind?: string;
  estimatedLines?: number;
  estimatedDurationMinutes?: number;
  complexity?: string;
}

export interface ConversationMessage {
  from: string;
  content: string;
  timestamp?: string;
  status?: string;
}

export interface WorkerSessionState {
  currentBranch?: string | null;
  createdPRs?: string[];
  filesTouched?: string[];
  activityLog?: Array<{
    at?: string;
    status?: string;
    task?: string;
    files?: string[];
    pr?: string;
  }>;
}

export interface ParsedWorkerResponse {
  status: WorkerStatus;
  prUrl: string | null;
  currentBranch: string | null;
  filesTouched: string[];
  summary: string;
  fullOutput: string;
  verificationReport?: Record<string, unknown>;
  responsiveMatrix?: Record<string, string>;
}

export interface WorkerResult {
  roleName: string;
  status: string;
  pr: string | null;
  summary: string;
  [key: string]: unknown;
}

export interface WorkerSession {
  status: "idle" | "working";
  startedAt?: string;
  history?: ConversationMessage[];
}

// ─── Orchestrator ──────────────────────────────────────────────────
export type OrchestratorStatus = "operational" | "degraded";

export interface AuditCriticalStateFilesResult {
  sessions: Record<string, WorkerSession>;
  jesusDirective: JesusDirective | null;
  prometheusAnalysis: PrometheusAnalysis | null;
  degraded: boolean;
}

export interface JesusDirective {
  [key: string]: unknown;
}

export interface PrometheusAnalysis {
  [key: string]: unknown;
}

// ─── Verification ──────────────────────────────────────────────────
export type VerificationStatus = "pass" | "fail" | "n/a";
export type EvidenceRequirement = "required" | "optional" | "exempt";

export interface VerificationReport {
  build?: VerificationStatus;
  tests?: VerificationStatus;
  responsive?: VerificationStatus;
  api?: VerificationStatus;
  edgeCases?: VerificationStatus;
  security?: VerificationStatus;
}

export interface VerificationProfile {
  kind: string;
  label: string;
  lane: string;
  evidence: {
    build: EvidenceRequirement;
    tests: EvidenceRequirement;
    responsive: EvidenceRequirement;
    api: EvidenceRequirement;
    edgeCases: EvidenceRequirement;
    security: EvidenceRequirement;
    prUrl?: EvidenceRequirement;
  };
  responsiveRequired?: boolean;
  minViewports?: number;
  description: string;
}

export interface ValidationResult {
  passed: boolean;
  gaps: string[];
  evidence: {
    hasReport: boolean;
    report: Record<string, unknown>;
    responsiveMatrix: Record<string, string>;
    prUrl: string | null;
    profile: string;
    postMergeArtifact?: Record<string, unknown>;
  };
  reason?: string;
}

export interface ReworkInstruction {
  task: string;
  context: string;
  isFollowUp: boolean;
  isRework: boolean;
  reworkAttempt: number;
  maxReworkAttempts: number;
  taskKind: "rework";
}

// ─── Policy ────────────────────────────────────────────────────────
export interface Policy {
  protectedPaths?: string[];
  requireReviewerApprovalForProtectedPaths?: boolean;
  blockedCommands?: string[];
  rolePolicies?: Record<string, RolePolicy>;
  [key: string]: unknown;
}

export interface RolePolicy {
  allowedPaths?: string[];
  deniedPaths?: string[];
  blockedTaskPatterns?: string[];
  requiredTaskPatterns?: string[];
}

export interface RolePathViolation {
  role: string;
  deniedMatches: string[];
  outsideAllowed: string[];
  hasViolation: boolean;
}

// ─── Governance / Canary ───────────────────────────────────────────
export type CohortType = "canary" | "control";
export type GovernanceCanaryStatus = "running" | "promoted" | "rolled_back" | "failed";

export interface GovernanceCanaryConfig {
  enabled: boolean;
  canaryRatio: number;
  cohortSelectionAlgorithm: string;
  measurementWindowCycles: number;
  falseBlockRateMax: number;
  safetyScoreMin: number;
  falseBlockRateTrigger: number;
  safetyScoreTriggerLow: number;
  breachAction: string;
}

export interface CanaryLedgerEntry {
  canaryId: string;
  experimentId: string | null;
  policyRulePatch: Record<string, unknown>;
  canaryRatio: number;
  status: GovernanceCanaryStatus;
  statusReason: string | null;
  cohortStats: {
    canary: { cycleCount: number; falseBlockRate: number; safetyScore: number };
    control: { cycleCount: number; falseBlockRate: number; safetyScore: number };
  };
  cycleLog: Array<{
    cycleId: string;
    cohort: CohortType;
    timestamp: string;
    metrics: { falseBlockRate: number; safetyScore: number };
  }>;
  createdAt: string;
  promotedAt: string | null;
  rolledBackAt: string | null;
}

// ─── Events ────────────────────────────────────────────────────────
export type EventDomain =
  | "orchestration"
  | "planning"
  | "verification"
  | "policy"
  | "billing"
  | "governance";

export interface BoxEvent {
  event: string;
  version: number;
  correlationId: string;
  timestamp: string;
  domain: EventDomain;
  payload: Record<string, unknown>;
}

// ─── State Tracker ─────────────────────────────────────────────────
export type AlertSeverity = "low" | "medium" | "high" | "critical";

export interface Alert {
  severity?: AlertSeverity;
  source?: string;
  title?: string;
  message?: string;
  correlationId?: string;
}

export interface TestEntry {
  id: number | string;
  kind?: string;
  name?: string;
  title: string;
  status: string;
  notes?: string;
  updatedAt?: string;
}

export interface TestsState {
  tests: TestEntry[];
  totals: {
    passed: number;
    failed: number;
    running: number;
    queued: number;
  };
  updatedAt: string;
}

export interface LineageEntry {
  taskId: string;
  taskFingerprint: string;
  roleName: string;
  task: string;
  status: WorkerStatus;
  prUrl?: string | null;
  filesTouched?: string[];
  evidence?: Record<string, unknown>;
  timestamp: string;
}

// ─── Rollback ──────────────────────────────────────────────────────
export type RollbackLevel =
  | "config-only"
  | "state-schema"
  | "policy-set"
  | "orchestration-code-freeze"
  | "full-baseline-restore";

export type RollbackStatus =
  | "triggered"
  | "executing"
  | "completed"
  | "failed"
  | "sla_breach";

export interface RollbackIncident {
  schemaVersion: number;
  incidentId: string;
  level: string;
  trigger: string;
  triggeredAt: string;
  completedAt: string | null;
  status: RollbackStatus;
  stepsExecuted: string[];
  evidence: Record<string, unknown>;
  baselineRef?: string;
  healthCheckResult?: Record<string, unknown>;
  durationMs?: number;
}

// ─── Escalation ────────────────────────────────────────────────────
export type BlockingReasonClass =
  | "MAX_REWORK_EXHAUSTED"
  | "POLICY_VIOLATION"
  | "ACCESS_BLOCKED"
  | "WORKER_ERROR"
  | "VERIFICATION_GATE";

export type NextAction =
  | "RETRY"
  | "ESCALATE_TO_HUMAN"
  | "SKIP"
  | "REASSIGN";

export interface EscalationPayload {
  schemaVersion: 1;
  role: string;
  taskFingerprint: string;
  taskSnippet: string;
  blockingReasonClass: string;
  attempts: number;
  nextAction: string;
  summary: string;
  prUrl: string | null;
  resolved: boolean;
  createdAt: string;
}

// ─── Provider Reviewer Decision ─────────────────────────

/**
 * Indicates whether a reviewer provider decision was produced by the AI model
 * ("provider") or by the deterministic fallback path ("fallback").
 *
 * Carried as `_source` on every tagged decision. Callers should check this
 * field to distinguish AI-produced decisions from deterministic fallbacks.
 */
export type ReviewerDecisionSource = "provider" | "fallback";

// ─── Copilot Usage ─────────────────────────────────────────────────
export interface CopilotUsage {
  correlationId?: string;
  copilot?: {
    model: string;
    invocation: string;
    usedOpus?: boolean;
  };
}

```

## SYSTEM STATE DATA (live operational metrics)
These are the actual state files from the current BOX instance.
Use this data to identify bottlenecks, regressions, and improvement opportunities.

### Cycle Analytics (performance trends) (cycle_analytics.json)
```json
{
  "schemaVersion": 1,
  "lastCycle": {
    "cycleId": "2026-03-31T12:16:52.080Z",
    "generatedAt": "2026-03-31T18:57:21.900Z",
    "phase": "completed",
    "outcomes": {
      "tasksDispatched": 10,
      "tasksCompleted": 0,
      "tasksFailed": 0,
      "athenaApproved": true,
      "selfImprovementRan": null,
      "status": "success"
    },
    "kpis": {
      "decisionLatencyMs": 82598,
      "dispatchLatencyMs": 30,
      "verificationCompletionMs": 7227626,
      "systemHealthScore": null,
      "sloBreachCount": 1,
      "sloStatus": "degraded"
    },
    "funnel": {
      "generated": 10,
      "approved": 10,
      "dispatched": 10,
      "completed": 0,
      "approvalRate": 1,
      "dispatchRate": 1,
      "completionRate": 0
    },
    "confidence": {
      "level": "high",
      "reason": "all canonical events present",
      "missingFields": []
    },
    "causalLinks": [
      {
        "cause": "jesus_awakening",
        "effect": "jesus_decided",
        "metric": "decisionLatencyMs",
        "latencyMs": 82598,
        "anomaly": false,
        "anomalyReason": null
      },
      {
        "cause": "athena_approved",
        "effect": "workers_dispatching",
        "metric": "dispatchLatencyMs",
        "latencyMs": 30,
        "anomaly": false,
        "anomalyReason": null
      },
      {
        "cause": "workers_dispatching",
        "effect": "cycle_complete",
        "metric": "verificationCompletionMs",
        "latencyMs": 7227626,
        "anomaly": true,
        "anomalyReason": "verificationCompletionMs exceeded threshold: actual=7227626ms threshold=3600000ms"
      }
    ],
    "canonicalEvents": [
      {
        "name": "jesus_awakening",
        "timestamp": "2026-03-31T16:45:45.052Z",
        "present": true
      },
      {
        "name": "jesus_decided",
        "timestamp": "2026-03-31T16:47:07.650Z",
        "present": true
      },
      {
        "name": "athena_approved",
        "timestamp": "2026-03-31T16:56:54.213Z",
        "present": true
      },
      {
        "name": "workers_dispatching",
        "timestamp": "2026-03-31T16:56:54.243Z",
        "present": true
      },
      {
        "name": "cycle_complete",
        "timestamp": "2026-03-31T18:57:21.869Z",
        "present": true
      }
    ],
    "missingData": [],
    "parserBaselineRecovery": null,
    "stageTransitions": [],
    "dropReasons": []
  },
  "history": [
    {
      "cycleId": "2026-03-31T12:16:52.080Z",
      "generatedAt": "2026-03-31T18:57:21.900Z",
      "phase": "completed",
      "outcomes": {
        "tasksDispatched": 10,
        "tasksCompleted": 0,
        "tasksFailed": 0,
        "athenaApproved": true,
        "selfImprovementRan": null,
        "status": "success"
      },
      "kpis": {
        "decisionLatencyMs": 82598,
        "dispatchLatencyMs": 30,
        "verificationCompletionMs": 7227626,
        "systemHealthScore": null,
        "sloBreachCount": 1,
        "sloStatus": "degraded"
      },
      "funnel": {
        "generated": 10,
        "approved": 10,
        "dispatched": 10,
        "completed": 0,
        "approvalRate": 1,
        "dispatchRate": 1,
        "completionRate": 0
      },
      "confidence": {
        "level": "high",
        "reason": "all canonical events present",
        "missingFields": []
      },
      "causalLinks": [
        {
          "cause": "jesus_awakening",
          "effect": "jesus_decided",
          "metric": "decisionLatencyMs",
          "latencyMs": 82598,
          "anomaly": false,
          "anomalyReason": null
        },
        {
          "cause": "athena_approved",
          "effect": "workers_dispatching",
          "metric": "dispatchLatencyMs",
          "latencyMs": 30,
          "anomaly": false,
          "anomalyReason": null
        },
        {
          "cause": "workers_dispatching",
          "effect": "cycle_complete",
          "metric": "verificationCompletionMs",
          "latencyMs": 7227626,
          "anomaly": true,
          "anomalyReason": "verificationCompletionMs exceeded threshold: actual=7227626ms threshold=3600000ms"
        }
      ],
      "canonicalEvents": [
        {
          "name": "jesus_awakening",
          "timestamp": "2026-03-31T16:45:45.052Z",
          "present": true
        },
        {
          "name": "jesus_decided",
          "timestamp": "2026-03-31T16:47:07.650Z",
          "present": true
        },
        {
          "name": "athena_approved",
          "timestamp": "2026-03-31T16:56:54.213Z",
          "present": true
        },
        {
          "name": "workers_dispatching",
          "timestamp": "2026-03-31T16:56:54.243Z",
          "present": true
        },
        {
          "name": "cycle_complete",
          "timestamp": "2026-03-31T18:57:21.869Z",
          "present": true
        }
      ],
      "missingData": [],
      "parserBaselineRecovery": null,
      "stageTransitions": [],
      "dropReasons": []
    },
    {
      "cycleId": "2026-03-31T12:16:52.080Z",
      "generatedAt": "2026-03-31T16:43:43.447Z",
      "phase": "completed",
      "outcomes": {
        "tasksDispatched": 10,
        "tasksCompleted": 0,
        "tasksFailed": 0,
        "athenaApproved": true,
        "selfImprovementRan": null,
        "status": "success"
      },
      "kpis": {
        "decisionLatencyMs": 82921,
        "dispatchLatencyMs": 28,
        "verificationCompletionMs": 2401276,
        "systemHealthScore": null,
        "sloBreachCount": 0,
        "sloStatus": "ok"
      },
      "funnel": {
        "generated": 10,
        "approved": 10,
        "dispatched": 10,
        "completed": 0,
        "approvalRate": 1,
        "dispatchRate": 1,
        "completionRate": 0
      },
      "confidence": {
        "level": "high",
        "reason": "all canonical events present",
        "missingFields": []
      },
      "causalLinks": [
        {
          "cause": "jesus_awakening",
          "effect": "jesus_decided",
          "metric": "decisionLatencyMs",
          "latencyMs": 82921,
          "anomaly": false,
          "anomalyReason": null
        },
        {
          "cause": "athena_approved",
          "effect": "workers_dispatching",
          "metric": "dispatchLatencyMs",
          "latencyMs": 28,
          "anomaly": false,
          "anomalyReason": null
        },
        {
          "cause": "workers_dispatching",
          "effect": "cycle_complete",
          "metric": "verificationCompletionMs",
          "latencyMs": 2401276,
          "anomaly": false,
          "anomalyReason": null
        }
      ],
      "canonicalEvents": [
        {
          "name": "jesus_awakening",
          "timestamp": "2026-03-31T15:52:58.619Z",
          "present": true
        },
        {
          "name": "jesus_decided",
          "timestamp": "2026-03-31T15:54:21.540Z",
          "present": true
        },
        {
          "name": "athena_approved",
          "timestamp": "2026-03-31T16:03:42.090Z",
          "present": true
        },
        {
          "name": "workers_dispatching",
          "timestamp": "2026-03-31T16:03:42.118Z",
          "present": true
        },
        {
          "name": "cycle_complete",
          "timestamp": "2026-03-31T16:43:43.394Z",
          "present": true
        }
      ],
      "missingData": [],
      "parserBaselineRecovery": null,
      "stageTransitions": [],
      "dropReasons": []
    },
    {
      "cycleId": "2026-03-31T12:16:52.080Z",
      "generatedAt": "2026-03-31T13:53:15.097Z",
      "phase": "completed",
      "outcomes": {
        "tasksDispatched": 5,
        "tasksCompleted": 0,
        "tasksFailed": 0,
        "athenaApproved": true,
        "selfImprovementRan": null,
        "status": "success"
      },
      "kpis": {
        "decisionLatencyMs": 109465,
        "dispatchLatencyMs": 45,
        "verificationCompletionMs": 2945261,
        "systemHealthScore": null,
        "sloBreachCount": 0,
        "sloStatus": "ok"
      },
      "funnel": {
        "generated": 5,
        "approved": 5,
        "dispatched": 5,
        "completed": 0,
        "approvalRate": 1,
        "dispatchRate": 1,
        "completionRate": 0
      },
      "confidence": {
        "level": "high",
        "reason": "all canonical events present",
        "missingFields": []
      },
      "causalLinks": [
        {
          "cause": "jesus_awakening",
          "effect": "jesus_decided",
          "metric": "decisionLatencyMs",
          "latencyMs": 109465,
          "anomaly": false,
          "anomalyReason": null
        },
        {
          "cause": "athena_approved",
          "effect": "workers_dispatching",
          "metric": "dispatchLatencyMs",
          "latencyMs": 45,
          "anomaly": false,
          "anomalyReason": null
        },
        {
          "cause": "workers_dispatching",
          "effect": "cycle_complete",
          "metric": "verificationCompletionMs",
          "latencyMs": 2945261,
          "anomaly": false,
          "anomalyReason": null
        }
      ],
      "canonicalEvents": [
        {
          "name": "jesus_awakening",
          "timestamp": "2026-03-31T12:52:33.338Z",
          "present": true
        },
        {
          "name": "jesus_decided",
          "timestamp": "2026-03-31T12:54:22.803Z",
          "present": true
        },
        {
          "name": "athena_approved",
          "timestamp": "2026-03-31T13:04:09.762Z",
          "present": true
        },
        {
          "name": "workers_dispatching",
          "timestamp": "2026-03-31T13:04:09.807Z",
          "present": true
        },
        {
          "name": "cycle_complete",
          "timestamp": "2026-03-31T13:53:15.068Z",
          "present": true
        }
      ],
      "missingData": [],
      "parserBaselineRecovery": null,
      "stageTransitions": [],
      "dropReasons": []
    },
    {
      "cycleId": "2026-03-31T12:16:52.080Z",
      "generatedAt": "2026-03-31T12:50:31.916Z",
      "phase": "completed",
      "outcomes": {
        "tasksDispatched": 10,
        "tasksCompleted": 0,
        "tasksFailed": 0,
        "athenaApproved": true,
        "selfImprovementRan": null,
        "status": "success"
      },
      "kpis": {
        "decisionLatencyMs": 98050,
        "dispatchLatencyMs": 36,
        "verificationCompletionMs": 1220306,
        "systemHealthScore": null,
        "sloBreachCount": 0,
        "sloStatus": "ok"
      },
      "funnel": {
        "generated": 10,
        "approved": 10,
        "dispatched": 10,
        "completed": 0,
        "approvalRate": 1,
        "dispatchRate": 1,
        "completionRate": 0
      },
      "confidence": {
        "level": "high",
        "reason": "all canonical events present",
        "missingFields": []
      },
      "causalLinks": [
        {
          "cause": "jesus_awakening",
          "effect": "jesus_decided",
          "metric": "decisionLatencyMs",
          "latencyMs": 98050,
          "anomaly": false,
          "anomalyReason": null
        },
        {
          "cause": "athena_approved",
          "effect": "workers_dispatching",
          "metric": "dispatchLatencyMs",
          "latencyMs": 36,
          "anomaly": false,
          "anomalyReason": null
        },
        {
          "cause": "workers_dispatching",
          "effect": "cycle_complete",
          "metric": "verificationCompletionMs",
          "latencyMs": 1220306,
          "anomaly": false,
          "anomalyReason": null
        }
      ],
      "canonicalEvents": [
        {
          "name": "jesus_awakening",
          "timestamp": "2026-03-31T12:16:52.080Z",
          "present": true
        },
        {
          "name": "jesus_decided",
          "timestamp": "2026-03-31T12:18:30.130Z",
          "present": true
        },
        {
          "name": "athena_approved",
          "timestamp": "2026-03-31T12:30:11.528Z",
          "present": true
        },
        {
          "name": "workers_dispatching",
          "timestamp": "2026-03-31T12:30:11.564Z",
          "present": true
        },
        {
          "name": "cycle_complete",
          "timestamp": "2026-03-31T12:50:31.870Z",
          "present": true
        }
      ],
      "missingData": [],
      "parserBaselineRecovery": null,
      "stageTransitions": [],
      "dropReasons": []
    },
    {
      "cycleId": "2026-03-31T06:19:08.717Z",
      "generatedAt": "2026-03-31T07:58:29.305Z",
      "phase": "completed",
      "outcomes": {
        "tasksDispatched": 12,
        "tasksCompleted": 0,
        "tasksFailed": 0,
        "athenaApproved": true,
        "selfImprovementRan": null,
        "status": "success"
      },
      "kpis": {
        "decisionLatencyMs": 114266,
        "dispatchLatencyMs": 63,
        "verificationCompletionMs": 4762298,
        "systemHealthScore": null,
        "sloBreachCount": 1,
        "sloStatus": "degraded"
      },
      "funnel": {
        "generated": 12,
        "approved": 12,
        "dispatched": 12,
        "completed": 0,
        "approvalRate": 1,
        "dispatchRate": 1,
        "completionRate": 0
      },
      "confidence": {
        "level": "high",
        "reason": "all canonical events present",
        "missingFields": []
      },
      "causalLinks": [
        {
          "cause": "jesus_awakening",
          "effect": "jesus_decided",
          "metric": "decisionLatencyMs",
          "latencyMs": 114266,
          "anomaly": false,
          "anomalyReason": null
        },
        {
          "cause": "athena_approved",
          "effect": "workers_dispatching",
          "metric": "dispatchLatencyMs",
          "latencyMs": 63,
          "anomaly": false,
          "anomalyReason": null
        },
        {
          "cause": "workers_dispatching",
          "effect": "cycle_complete",
          "metric": "verificationCompletionMs",
          "latencyMs": 4762298,
          "anomaly": true,
          "anomalyReason": "verificationCompletionMs exceeded threshold: actual=4762298ms threshold=3600000ms"
        }
      ],
      "canonicalEvents": [
        {
          "name": "jesus_awakening",
          "timestamp": "2026-03-31T06:19:08.717Z",
          "present": true
        },
        {
          "name": "jesus_decided",
          "timestamp": "2026-03-31T06:21:02.983Z",
          "present": true
        },
        {
          "name": "athena_approved",
          "timestamp": "2026-03-31T06:39:06.910Z",
          "present": true
        },
        {
          "name": "workers_dispatching",
          "timestamp": "2026-03-31T06:39:06.973Z",
          "present": true
        },
        {
          "name": "cycle_complete",
          "timestamp": "2026-03-31T07:58:29.271Z",
          "present": true
        }
      ],
      "missingData": [],
      "parserBaselineRecovery": null,
      "stageTransitions": [],
      "dropReasons": []
    },
    {
      "cycleId": "2026-03-30T17:08:36.342Z",
      "generatedAt": "2026-03-30T19:02:30.642Z",
      "phase": "completed",
      "outcomes": {
        "tasksDispatched": 12,
        "tasksCompleted": 0,
        "tasksFailed": 0,
        "athenaApproved": true,
        "selfImprovementRan": null,
        "status": "success"
      },
      "kpis": {
        "decisionLatencyMs": 98965,
        "dispatchLatencyMs": 21,
        "verificationCompletionMs": 6034938,
        "systemHealthScore": null,
        "sloBreachCount": 1,
        "sloStatus": "degraded"
      },
      "funnel": {
        "generated": 12,
        "approved": 12,
        "dispatched": 12,
        "completed": 0,
        "approvalRate": 1,
        "dispatchRate": 1,
        "completionRate": 0
      },
      "confidence": {
        "level": "high",
        "reason": "all canonical events present",
        "missingFields": []
      },
      "causalLinks": [
        {
          "cause": "jesus_awakening",
          "effect": "jesus_decided",
          "metric": "decisionLatencyMs",
          "latencyMs": 98965,
          "anomaly": false,
          "anomalyReason": null
        },
        {
          "cause": "athena_approved",
          "effect": "workers_dispatching",
          "metric": "dispatchLatencyMs",
          "latencyMs": 21,
          "anomaly": false,
          "anomalyReason": null
        },
        {
          "cause": "workers_dispatching",
          "effect": "cycle_complete",
          "metric": "verificationCompletionMs",
          "latencyMs": 6034938,
          "anomaly": true,
          "anomalyReason": "verificationCompletionMs exceeded threshold: actual=6034938ms threshold=3600000ms"
        }
      ],
      "canonicalEvents": [
        {
          "name": "jesus_awakening",
          "timestamp": "2026-03-30T17:08:36.342Z",
          "present": true
        },
        {
          "name": "jesus_decided",
          "timestamp": "2026-03-30T17:10:15.307Z",
          "present": true
        },
        {
          "name": "athena_approved",
          "timestamp": "2026-03-30T17:21:55.645Z",
          "present": true
        },
        {
          "name": "workers_dispatching",
          "timestamp": "2026-03-30T17:21:55.666Z",
          "present": true
        },
        {
          "name": "cycle_complete",
          "timestamp": "2026-03-30T19:02:30.604Z",
          "present": true
        }
      ],
      "missingData": [],
      "parserBaselineRecovery": null
    },
    {
      "cycleId": "2026-03-29T20:14:34.991Z",
      "generatedAt": "2026-03-29T21:04:41.484Z",
      "phase": "completed",
      "outcomes": {
        "tasksDispatched": 2,
        "tasksCompleted": 0,
        "tasksFailed": 0,
        "athenaApproved": true,
        "selfImprovementRan": null,
        "status": "success"
      },
      "kpis": {
        "decisionLatencyMs": 55371,
        "dispatchLatencyMs": 54,
        "verificationCompletionMs": 783928,
        "systemHealthScore": null,
        "sloBreachCount": 0,
        "sloStatus": "ok"
      },
      "funnel": {
        "generated": 2,
        "approved": 2,
        "dispatched": 2,
        "completed": 0,
        "approvalRate": 1,
        "dispatchRate": 1,
        "completionRate": 0
      },
      "confidence": {
        "level": "high",
        "reason": "all canonical events present",
        "missingFields": []
      },
      "causalLinks": [
        {
          "cause": "jesus_awakening",
          "effect": "jesus_decided",
          "metric": "decisionLatencyMs",
          "latencyMs": 55371,
          "anomaly": false,
          "anomalyReason": null
        },
        {
          "cause": "athena_approved",
          "effect": "workers_dispatching",
          "metric": "dispatchLatencyMs",
          "latencyMs": 54,
          "anomaly": false,
          "anomalyReason": null
        },
        {
          "cause": "workers_dispatching",
          "effect": "cycle_complete",
          "metric": "verificationCompletionMs",
          "latencyMs": 783928,
          "anomaly": false,
          "anomalyReason": null
        }
      ],
      "canonicalEvents": [
        {
          "name": "jesus_awakening",
          "timestamp": "2026-03-29T20:14:34.991Z",
          "present": true
        },
        {
          "name": "jesus_decided",
          "timestamp": "2026-03-29T20:15:30.362Z",
          "present": true
        },
        {
          "name": "athena_approved",
          "timestamp": "2026-03-29T20:51:37.448Z",
          "present": true
        },
        {
          "name": "workers_dispatching",
          "timestamp": "2026-03-29T20:51:37.502Z",
          "present": true
        },
        {
          "name": "cycle_complete",
          "timestamp": "2026-03-29T21:04:41.430Z",
          "present": true
        }
      ],
      "missingData": [],
      "parserBaselineRecovery": null
    },
    {
      "cycleId": "2026-03-27T14:59:17.874Z",
      "generatedAt": "2026-03-28T08:23:43.498Z",
      "phase": "completed",
      "outcomes": {
        "tasksDispatched": 8,
        "tasksCompleted": null,
        "tasksFailed": null,
        "athenaApproved": true,
        "selfImprovementRan": null,
        "status": "unknown"
      },
      "kpis": {
        "decisionLatencyMs": 92655,
        "dispatchLatencyMs": 8,
        "verificationCompletionMs": 4870638,
        "systemHealthScore": null,
        "sloBreachCount": 1,
        "sloStatus": "degraded"
      },
      "confidence": {
        "level": "high",
        "reason": "all canonical events present",
        "missingFields": []
      },
      "causalLinks": [
        {
          "cause": "jesus_awakening",
          "effect": "jesus_decided",
          "metric": "decisionLatencyMs",
          "latencyMs": 92655,
          "anomaly": false,
          "anomalyReason": null
        },
        {
          "cause": "athena_approved",
          "effect": "workers_dispatching",
          "metric": "dispatchLatencyMs",
          "latencyMs": 8,
          "anomaly": false,
          "anomalyReason": null
        },
        {
          "cause": "workers_dispatching",
          "effect": "cycle_complete",
          "metric": "verificationCompletionMs",
          "latencyMs": 4870638,
          "anomaly": true,
          "anomalyReason": "verificationCompletionMs exceeded threshold: actual=4870638ms threshold=3600000ms"
        }
      ],
      "canonicalEvents": [
        {
          "name": "jesus_awakening",
          "timestamp": "2026-03-28T06:52:23.811Z",
          "present": true
        },
        {
          "name": "jesus_decided",
          "timestamp": "2026-03-28T06:53:56.466Z",
          "present": true
        },
        {
          "name": "athena_approved",
          "timestamp": "2026-03-28T07:02:32.803Z",
          "present": true
        },
        {
          "name": "workers_dispatching",
          "timestamp": "2026-03-28T07:02:32.811Z",
          "present": true
        },
        {
          "name": "cycle_complete",
          "timestamp": "2026-03-28T08:23:43.449Z",
          "present": true
        }
      ],
      "missingData": []
    },
    {
      "cycleId": "2026-03-27T14:59:17.874Z",
      "generatedAt": "2026-03-28T03:58:55.591Z",
      "phase": "completed",
      "outcomes": {
        "tasksDispatched": 12,
        "tasksCompleted": null,
        "tasksFailed": null,
        "athenaApproved": true,
        "selfImprovementRan": null,
        "status": "unknown"
      },
      "kpis": {
        "decisionLatencyMs": 88883,
        "dispatchLatencyMs": 5,
        "verificationCompletionMs": 7124749,
        "systemHealthScore": null,
        "sloBreachCount": 1,
        "sloStatus": "degraded"
      },
      "confidence": {
        "level": "high",
        "reason": "all canonical events present",
        "missingFields": []
      },
      "causalLinks": [
        {
          "cause": "jesus_awakening",
          "effect": "jesus_decided",
          "metric": "decisionLatencyMs",
          "latencyMs": 88883,
          "anomaly": false,
          "anomalyReason": null
        },
        {
          "cause": "athena_approved",
          "effect": "workers_dispatching",
          "metric": "dispatchLatencyMs",
          "latencyMs": 5,
          "anomaly": false,
          "anomalyReason": null
        },
        {
          "cause": "workers_dispatching",
          "effect": "cycle_complete",
          "metric": "verificationCompletionMs",
          "latencyMs": 7124749,
          "anomaly": true,
          "anomalyReason": "verificationCompletionMs exceeded threshold: actual=7124749ms threshold=3600000ms"
        }
      ],
      "canonicalEvents": [
        {
          "name": "jesus_awakening",
          "timestamp": "2026-03-28T01:45:38.517Z",
          "present": true
        },
        {
          "name": "jesus_decided",
          "timestamp": "2026-03-28T01:47:07.400Z",
          "present": true
        },
        {
          "name": "athena_approved",
          "timestamp": "2026-03-28T02:00:10.803Z",
          "present": true
        },
        {
          "name": "workers_dispatching",
          "timestamp": "2026-03-28T02:00:10.808Z",
          "present": true
        },
        {
          "name": "cycle_complete",
          "timestamp": "2026-03-28T03:58:55.557Z",
          "present": true
        }
      ],
      "missingData": []
    },
    {
      "cycleId": "2026-03-27T14:59:17.874Z",
      "generatedAt": "2026-03-28T00:39:26.134Z",
      "phase": "completed",
      "outcomes": {
        "tasksDispatched": 13,
        "tasksCompleted": null,
        "tasksFailed": null,
        "athenaApproved": true,
        "selfImprovementRan": null,
        "status": "unknown"
      },
      "kpis": {
        "decisionLatencyMs": 78696,
        "dispatchLatencyMs": 5,
        "verificationCompletionMs": 5612925,
        "systemHealthScore": null,
        "sloBreachCount": 1,
        "sloStatus": "degraded"
      },
      "confidence": {
        "level": "high",
        "reason": "all canonical events present",
        "missingFields": []
      },
      "causalLinks": [
        {
          "cause": "jesus_awakening",
          "effect": "jesus_decided",
          "metric": "decisionLatencyMs",
          "latencyMs": 78696,
          "anomaly": false,
          "anomalyReason": null
        },
        {
          "cause": "athena_approved",
          "effect": "workers_dispatching",
          "metric": "dispatchLatencyMs",
          "latencyMs": 5,
          "anomaly": false,
          "anomalyReason": null
        },
        {
          "cause": "workers_dispatching",
          "effect": "cycle_complete",
          "metric": "verificationCompletionMs",
          "latencyMs": 5612925,
          "anomaly": true,
          "anomalyReason": "verificationCompletionMs exceeded threshold: actual=5612925ms threshold=3600000ms"
        }
      ],
      "canonicalEvents": [
        {
          "name": "jesus_awakening",
          "timestamp": "2026-03-27T22:51:08.809Z",
          "present": true
        },
        {
          "name": "jesus_decided",
          "timestamp": "2026-03-27T22:52:27.505Z",
          "present": true
        },
        {
          "name": "athena_approved",
          "timestamp": "2026-03-27T23:05:53.181Z",
          "present": true
        },
        {
          "name": "workers_dispatching",
          "timestamp": "2026-03-27T23:05:53.186Z",
          "present": true
        },
        {
          "name": "cycle_complete",
          "timestamp": "2026-03-28T00:39:26.111Z",
          "present": true
        }
      ],
      "missingData": []
    },
    {
      "cycleId": "2026-03-27T14:59:17.874Z",
      "generatedAt": "2026-03-27T22:49:07.768Z",
      "phase": "completed",
      "outcomes": {
        "tasksDispatched": 8,
        "tasksCompleted": null,
        "tasksFailed": null,
        "athenaApproved": true,
        "selfImprovementRan": null,
        "status": "unknown"
      },
      "kpis": {
        "decisionLatencyMs": 85957,
        "dispatchLatencyMs": 3,
        "verificationCompletionMs": 3652170,
        "systemHealthScore": null,
        "sloBreachCount": 1,
        "sloStatus": "degraded"
      },
      "confidence": {
        "level": "high",
        "reason": "all canonical events present",
        "missingFields": []
      },
      "causalLinks": [
        {
          "cause": "jesus_awakening",
          "effect": "jesus_decided",
          "metric": "decisionLatencyMs",
          "latencyMs": 85957,
          "anomaly": false,
          "anomalyReason": null
        },
        {
          "cause": "athena_approved",
          "effect": "workers_dispatching",
          "metric": "dispatchLatencyMs",
          "latencyMs": 3,
          "anomaly": false,
          "anomalyReason": null
        },
        {
          "cause": "workers_dispatching",
          "effect": "cycle_complete",
          "metric": "verificationCompletionMs",
          "latencyMs": 3652170,
          "anomaly": true,
          "anomalyReason": "verificationCompletionMs exceeded threshold: actual=3652170ms threshold=3600000ms"
        }
      ],
      "canonicalEvents": [
        {
          "name": "jesus_awakening",
          "timestamp": "2026-03-27T21:37:47.373Z",
          "present": true
        },
        {
          "name": "jesus_decided",
          "timestamp": "2026-03-27T21:39:13.330Z",
          "present": true
        },
        {
          "name": "athena_approved",
          "timestamp": "2026-03-27T21:48:15.575Z",
          "present": true
        },
        {
          "name": "workers_dispatching",
          "timestamp": "2026-03-27T21:48:15.578Z",
          "present": true
        },
        {
          "name": "cycle_complete",
          "timestamp": "2026-03-27T22:49:07.748Z",
          "present": true
        }
      ],
      "missingData": []
    },
    {
      "cycleId": "2026-03-27T14:59:17.874Z",
      "generatedAt": "2026-03-27T21:35:46.289Z",
      "phase": "completed",
      "outcomes": {
        "tasksDispatched": 6,
        "tasksCompleted": null,
        "tasksFailed": null,
        "athenaApproved": true,
        "selfImprovementRan": null,
        "status": "unknown"
      },
      "kpis": {
        "decisionLatencyMs": 103154,
        "dispatchLatencyMs": 19,
        "verificationCompletionMs": 2788141,
        "systemHealthScore": null,
        "sloBreachCount": 0,
        "sloStatus": "ok"
      },
      "confidence": {
        "level": "high",
        "reason": "all canonical events present",
        "missingFields": []
      },
      "causalLinks": [
        {
          "cause": "jesus_awakening",
          "effect": "jesus_decided",
          "metric": "decisionLatencyMs",
          "latencyMs": 103154,
          "anomaly": false,
          "anomalyReason": null
        },
        {
          "cause": "athena_approved",
          "effect": "workers_dispatching",
          "metric": "dispatchLatencyMs",
          "latencyMs": 19,
          "anomaly": false,
          "anomalyReason": null
        },
        {
          "cause": "workers_dispatching",
          "effect": "cycle_complete",
          "metric": "verificationCompletionMs",
          "latencyMs": 2788141,
          "anomaly": false,
          "anomalyReason": null
        }
      ],
      "canonicalEvents": [
        {
          "name": "jesus_awakening",
          "timestamp": "2026-03-27T20:36:21.825Z",
          "present": true
        },
        {
          "name": "jesus_decided",
          "timestamp": "2026-03-27T20:38:04.979Z",
          "present": true
        },
        {
          "name": "athena_approved",
          "timestamp": "2026-03-27T20:49:18.095Z",
          "present": true
        },
        {
          "name": "workers_dispatching",
          "timestamp": "2026-03-27T20:49:18.114Z",
          "present": true
        },
        {
          "name": "cycle_complete",
          "timestamp": "2026-03-27T21:35:46.255Z",
          "present": true
        }
      ],
      "missingData": []
    },
    {
      "cycleId": "2026-03-27T14:59:17.874Z",
      "generatedAt": "2026-03-27T19:59:57.523Z",
      "phase": "completed",
      "outcomes": {
        "tasksDispatched": 11,
        "tasksCompleted": null,
        "tasksFailed": null,
        "athenaApproved": true,
        "selfImprovementRan": null,
        "status": "unknown"
      },
      "kpis": {
        "decisionLatencyMs": 105068,
        "dispatchLatencyMs": 33,
        "verificationCompletionMs": 8743200,
        "systemHealthScore": null,
        "sloBreachCount": 1,
        "sloStatus": "degraded"
      },
      "confidence": {
        "level": "high",
        "reason": "all canonical events present",
        "missingFields": []
      },
      "causalLinks": [
        {
          "cause": "jesus_awakening",
          "effect": "jesus_decided",
          "metric": "decisionLatencyMs",
          "latencyMs": 105068,
          "anomaly": false,
          "anomalyReason": null
        },
        {
          "cause": "athena_approved",
          "effect": "workers_dispatching",
          "metric": "dispatchLatencyMs",
          "latencyMs": 33,
          "anomaly": false,
          "anomalyReason": null
        },
        {
          "cause": "workers_dispatching",
          "effect": "cycle_complete",
          "metric": "verificationCompletionMs",
          "latencyMs": 8743200,
          "anomaly": true,
          "anomalyReason": "verificationCompletionMs exceeded threshold: actual=8743200ms threshold=3600000ms"
        }
      ],
      "canonicalEvents": [
        {
          "name": "jesus_awakening",
          "timestamp": "2026-03-27T17:20:13.262Z",
          "present": true
        },
        {
          "name": "jesus_decided",
          "timestamp": "2026-03-27T17:21:58.330Z",
          "present": true
        },
        {
          "name": "athena_approved",
          "timestamp": "2026-03-27T17:34:14.249Z",
          "present": true
        },
        {
          "name": "workers_dispatching",
          "timestamp": "2026-03-27T17:34:14.282Z",
          "present": true
        },
        {
          "name": "cycle_complete",
          "timestamp": "2026-03-27T19:59:57.482Z",
          "present": true
        }
      ],
      "missingData": []
    },
    {
      "cycleId": "2026-03-27T14:59:17.874Z",
      "generatedAt": "2026-03-27T17:18:11.535Z",
      "phase": "completed",
      "outcomes": {
        "tasksDispatched": 8,
        "tasksCompleted": null,
        "tasksFailed": null,
        "athenaApproved": true,
        "selfImprovementRan": null,
        "status": "unknown"
      },
      "kpis": {
        "decisionLatencyMs": 115002,
        "dispatchLatencyMs": 29,
        "verificationCompletionMs": 2860728,
        "systemHealthScore": null,
        "sloBreachCount": 0,
        "sloStatus": "ok"
      },
      "confidence": {
        "level": "high",
        "reason": "all canonical events present",
        "missingFields": []
      },
      "causalLinks": [
        {
          "cause": "jesus_awakening",
          "effect": "jesus_decided",
          "metric": "decisionLatencyMs",
          "latencyMs": 115002,
          "anomaly": false,
          "anomalyReason": null
        },
        {
          "cause": "athena_approved",
          "effect": "workers_dispatching",
          "metric": "dispatchLatencyMs",
          "latencyMs": 29,
          "anomaly": false,
          "anomalyReason": null
        },
        {
          "cause": "workers_dispatching",
          "effect": "cycle_complete",
          "metric": "verificationCompletionMs",
          "latencyMs": 2860728,
          "anomaly": false,
          "anomalyReason": null
        }
      ],
      "canonicalEvents": [
        {
          "name": "jesus_awakening",
          "timestamp": "2026-03-27T16:18:17.381Z",
          "present": true
        },
        {
          "name": "jesus_decided",
          "timestamp": "2026-03-27T16:20:12.383Z",
          "present": true
        },
        {
          "name": "athena_approved",
          "timestamp": "2026-03-27T16:30:30.743Z",
          "present": true
        },
        {
          "name": "workers_dispatching",
          "timestamp": "2026-03-27T16:30:30.772Z",
          "present": true
        },
        {
          "name": "cycle_complete",
          "timestamp": "2026-03-27T17:18:11.500Z",
          "present": true
        }
      ],
      "missingData": []
    },
    {
      "cycleId": "2026-03-27T14:59:17.874Z",
      "generatedAt": "2026-03-27T16:16:16.319Z",
      "phase": "completed",
      "outcomes": {
        "tasksDispatched": 9,
        "tasksCompleted": null,
        "tasksFailed": null,
        "athenaApproved": true,
        "selfImprovementRan": null,
        "status": "unknown"
      },
      "kpis": {
        "decisionLatencyMs": 63990,
        "dispatchLatencyMs": 14,
        "verificationCompletionMs": 3984150,
        "systemHealthScore": null,
        "sloBreachCount": 1,
        "sloStatus": "degraded"
      },
      "confidence": {
        "level": "high",
        "reason": "all canonical events present",
        "missingFields": []
      },
      "causalLinks": [
        {
          "cause": "jesus_awakening",
          "effect": "jesus_decided",
          "metric": "decisionLatencyMs",
          "latencyMs": 63990,
          "anomaly": false,
          "anomalyReason": null
        },
        {
          "cause": "athena_approved",
          "effect": "workers_dispatching",
          "metric": "dispatchLatencyMs",
          "latencyMs": 14,
          "anomaly": false,
          "anomalyReason": null
        },
        {
          "cause": "workers_dispatching",
          "effect": "cycle_complete",
          "metric": "verificationCompletionMs",
          "latencyMs": 3984150,
          "anomaly": true,
          "anomalyReason": "verificationCompletionMs exceeded threshold: actual=3984150ms threshold=3600000ms"
        }
      ],
      "canonicalEvents": [
        {
          "name": "jesus_awakening",
          "timestamp": "2026-03-27T14:59:17.874Z",
          "present": true
        },
        {
          "name": "jesus_decided",
          "timestamp": "2026-03-27T15:00:21.864Z",
          "present": true
        },
        {
          "name": "athena_approved",
          "timestamp": "2026-03-27T15:09:52.129Z",
          "present": true
        },
        {
          "name": "workers_dispatching",
          "timestamp": "2026-03-27T15:09:52.143Z",
          "present": true
        },
        {
          "name": "cycle_complete",
          "timestamp": "2026-03-27T16:16:16.293Z",
          "present": true
        }
      ],
      "missingData": []
    },
    {
      "cycleId": "2026-03-27T14:17:16.400Z",
      "generatedAt": "2026-03-27T14:49:59.954Z",
      "phase": "completed",
      "outcomes": {
        "tasksDispatched": 3,
        "tasksCompleted": null,
        "tasksFailed": null,
        "athenaApproved": true,
        "selfImprovementRan": null,
        "status": "unknown"
      },
      "kpis": {
        "decisionLatencyMs": 0,
        "dispatchLatencyMs": 10,
        "verificationCompletionMs": 1392385,
        "systemHealthScore": null,
        "sloBreachCount": 0,
        "sloStatus": "ok"
      },
      "confidence": {
        "level": "high",
        "reason": "all canonical events present",
        "missingFields": []
      },
      "causalLinks": [
        {
          "cause": "jesus_awakening",
          "effect": "jesus_decided",
          "metric": "decisionLatencyMs",
          "latencyMs": 0,
          "anomaly": false,
          "anomalyReason": null
        },
        {
          "cause": "athena_approved",
          "effect": "workers_dispatching",
          "metric": "dispatchLatencyMs",
          "latencyMs": 10,
          "anomaly": false,
          "anomalyReason": null
        },
        {
          "cause": "workers_dispatching",
          "effect": "cycle_complete",
          "metric": "verificationCompletionMs",
          "latencyMs": 1392385,
          "anomaly": false,
          "anomalyReason": null
        }
      ],
      "canonicalEvents": [
        {
          "name": "jesus_awakening",
          "timestamp": "2026-03-27T14:23:37.013Z",
          "present": true
        },
        {
          "name": "jesus_decided",
          "timestamp": "2026-03-27T14:19:26.700Z",
          "present": true
        },
        {
          "name": "athena_approved",
          "timestamp": "2026-03-27T14:26:47.526Z",
          "present": true
        },
        {
          "name": "workers_dispatching",
          "timestamp": "2026-03-27T14:26:47.536Z",
          "present": true
        },
        {
          "name": "cycle_complete",
          "timestamp": "2026-03-27T14:49:59.921Z",
          "present": true
        }
      ],
      "missingData": []
    },
    {
      "cycleId": "2026-03-26T17:55:34.803Z",
      "generatedAt": "2026-03-27T12:53:42.617Z",
      "phase": "completed",
      "outcomes": {
        "tasksDispatched": 10,
        "tasksCompleted": null,
        "tasksFailed": null,
        "athenaApproved": true,
        "selfImprovementRan": null,
        "status": "unknown"
      },
      "kpis": {
        "decisionLatencyMs": 88605,
        "dispatchLatencyMs": 11,
        "verificationCompletionMs": 3320892,
        "systemHealthScore": null,
        "sloBreachCount": 0,
        "sloStatus": "ok"
      },
      "confidence": {
        "level": "high",
        "reason": "all canonical events present",
        "missingFields": []
      },
      "causalLinks": [
        {
          "cause": "jesus_awakening",
          "effect": "jesus_decided",
          "metric": "decisionLatencyMs",
          "latencyMs": 88605,
          "anomaly": false,
          "anomalyReason": null
        },
        {
          "cause": "athena_approved",
          "effect": "workers_dispatching",
          "metric": "dispatchLatencyMs",
          "latencyMs": 11,
          "anomaly": false,
          "anomalyReason": null
        },
        {
          "cause": "workers_dispatching",
          "effect": "cycle_complete",
          "metric": "verificationCompletionMs",
          "latencyMs": 3320892,
          "anomaly": false,
          "anomalyReason": null
        }
      ],
      "canonicalEvents": [
        {
          "name": "jesus_awakening",
          "timestamp": "2026-03-27T11:47:26.171Z",
          "present": true
        },
        {
          "name": "jesus_decided",
          "timestamp": "2026-03-27T11:48:54.776Z",
          "present": true
        },
        {
          "name": "athena_approved",
          "timestamp": "2026-03-27T11:58:21.670Z",
          "present": true
        },
        {
          "name": "workers_dispatching",
          "timestamp": "2026-03-27T11:58:21.681Z",
          "present": true
        },
        {
          "name": "cycle_complete",
          "timestamp": "2026-03-27T12:53:42.573Z",
          "present": true
        }
      ],
      "missingData": []
    },
    {
      "cycleId": "2026-03-26T17:55:34.803Z",
      "generatedAt": "2026-03-27T10:07:11.428Z",
      "phase": "completed",
      "outcomes": {
        "tasksDispatched": 8,
        "tasksCompleted": null,
        "tasksFailed": null,
        "athenaApproved": true,
        "selfImprovementRan": null,
        "status": "unknown"
      },
      "kpis": {
        "decisionLatencyMs": 95525,
        "dispatchLatencyMs": 12,
        "verificationCompletionMs": 3368005,
        "systemHealthScore": null,
        "sloBreachCount": 0,
        "sloStatus": "ok"
      },
      "confidence": {
        "level": "high",
        "reason": "all canonical events present",
        "missingFields": []
      },
      "causalLinks": [
        {
          "cause": "jesus_awakening",
          "effect": "jesus_decided",
          "metric": "decisionLatencyMs",
          "latencyMs": 95525,
          "anomaly": false,
          "anomalyReason": null
        },
        {
          "cause": "athena_approved",
          "effect": "workers_dispatching",
          "metric": "dispatchLatencyMs",
          "latencyMs": 12,
          "anomaly": false,
          "anomalyReason": null
        },
        {
          "cause": "workers_dispatching",
          "effect": "cycle_complete",
          "metric": "verificationCompletionMs",
          "latencyMs": 3368005,
          "anomaly": false,
          "anomalyReason": null
        }
      ],
      "canonicalEvents": [
        {
          "name": "jesus_awakening",
          "timestamp": "2026-03-27T08:56:42.532Z",
          "present": true
        },
        {
          "name": "jesus_decided",
          "timestamp": "2026-03-27T08:58:18.057Z",
          "present": true
        },
        {
          "name": "athena_approved",
          "timestamp": "2026-03-27T09:11:03.376Z",
          "present": true
        },
        {
          "name": "workers_dispatching",
          "timestamp": "2026-03-27T09:11:03.388Z",
          "present": true
        },
        {
          "name": "cycle_complete",
          "timestamp": "2026-03-27T10:07:11.393Z",
          "present": true
        }
      ],
      "missingData": []
    },
    {
      "cycleId": "2026-03-24T12:55:34.815Z",
      "generatedAt": "2026-03-25T17:40:36.760Z",
      "phase": "completed",
      "outcomes": {
        "tasksDispatched": 10,
        "tasksCompleted": null,
        "tasksFailed": null,
        "athenaApproved": true,
        "selfImprovementRan": null,
        "status": "unknown"
      },
      "kpis": {
        "decisionLatencyMs": 121102,
        "dispatchLatencyMs": 14,
        "verificationCompletionMs": 1016069,
        "systemHealthScore": null,
        "sloBreachCount": 1,
        "sloStatus": "degraded"
      },
      "confidence": {
        "level": "high",
        "reason": "all canonical events present",
        "missingFields": []
      },
      "causalLinks": [
        {
          "cause": "jesus_awakening",
          "effect": "jesus_decided",
          "metric": "decisionLatencyMs",
          "latencyMs": 121102,
          "anomaly": true,
          "anomalyReason": "decisionLatencyMs exceeded threshold: actual=121102ms threshold=120000ms"
        },
        {
          "cause": "athena_approved",
          "effect": "workers_dispatching",
          "metric": "dispatchLatencyMs",
          "latencyMs": 14,
          "anomaly": false,
          "anomalyReason": null
        },
        {
          "cause": "workers_dispatching",
          "effect": "cycle_complete",
          "metric": "verificationCompletionMs",
          "latencyMs": 1016069,
          "anomaly": false,
          "anomalyReason": null
        }
      ],
      "canonicalEvents": [
        {
          "name": "jesus_awakening",
          "timestamp": "2026-03-25T17:05:43.046Z",
          "present": true
        },
        {
          "name": "jesus_decided",
          "timestamp": "2026-03-25T17:07:44.148Z",
          "present": true
        },
        {
          "name": "athena_approved",
          "timestamp": "2026-03-25T17:23:40.623Z",
          "present": true
        },
        {
          "name": "workers_dispatching",
          "timestamp": "2026-03-25T17:23:40.637Z",
          "present": true
        },
        {
          "name": "cycle_complete",
          "timestamp": "2026-03-25T17:40:36.706Z",
          "present": true
        }
      ],
      "missingData": []
    },
    {
      "cycleId": "2026-03-24T12:55:34.815Z",
      "generatedAt": "2026-03-24T18:01:30.014Z",
      "phase": "completed",
      "outcomes": {
        "tasksDispatched": 7,
        "tasksCompleted": null,
        "tasksFailed": null,
        "athenaApproved": true,
        "selfImprovementRan": null,
        "status": "unknown"
      },
      "kpis": {
        "decisionLatencyMs": 91036,
        "dispatchLatencyMs": 10,
        "verificationCompletionMs": 1828626,
        "systemHealthScore": null,
        "sloBreachCount": 0,
        "sloStatus": "ok"
      },
      "confidence": {
        "level": "high",
        "reason": "all canonical events present",
        "missingFields": []
      },
      "causalLinks": [
        {
          "cause": "jesus_awakening",
          "effect": "jesus_decided",
          "metric": "decisionLatencyMs",
          "latencyMs": 91036,
          "anomaly": false,
          "anomalyReason": null
        },
        {
          "cause": "athena_approved",
          "effect": "workers_dispatching",
          "metric": "dispatchLatencyMs",
          "latencyMs": 10,
          "anomaly": false,
          "anomalyReason": null
        },
        {
          "cause": "workers_dispatching",
          "effect": "cycle_complete",
          "metric": "verificationCompletionMs",
          "latencyMs": 1828626,
          "anomaly": false,
          "anomalyReason": null
        }
      ],
      "canonicalEvents": [
        {
          "name": "jesus_awakening",
          "timestamp": "2026-03-24T17:17:47.367Z",
          "present": true
        },
        {
          "name": "jesus_decided",
          "timestamp": "2026-03-24T17:19:18.403Z",
          "present": true
        },
        {
          "name": "athena_approved",
          "timestamp": "2026-03-24T17:31:01.344Z",
          "present": true
        },
        {
          "name": "workers_dispatching",
          "timestamp": "2026-03-24T17:31:01.354Z",
          "present": true
        },
        {
          "name": "cycle_complete",
          "timestamp": "2026-03-24T18:01:29.980Z",
          "present": true
        }
      ],
      "missingData": []
    }
  ],
  "updatedAt": "2026-03-31T18:57:21.901Z"
}

```

### Capacity Scoreboard (model utilization) (capacity_scoreboard.json)
```json
[
  {
    "parserConfidence": 1,
    "planCount": 7,
    "projectHealth": "critical",
    "optimizerStatus": "ok",
    "budgetUsed": 11,
    "budgetLimit": 14,
    "workersDone": 1,
    "recordedAt": "2026-03-24T18:01:30.073Z"
  },
  {
    "parserConfidence": 0.8,
    "planCount": 10,
    "projectHealth": "critical",
    "optimizerStatus": "ok",
    "budgetUsed": 10,
    "budgetLimit": 12,
    "workersDone": 10,
    "recordedAt": "2026-03-25T17:40:36.827Z"
  },
  {
    "parserConfidence": 0.8,
    "planCount": 8,
    "projectHealth": "critical",
    "optimizerStatus": "ok",
    "budgetUsed": 73,
    "budgetLimit": 88,
    "workersDone": 3,
    "recordedAt": "2026-03-27T10:07:11.510Z"
  },
  {
    "parserConfidence": 0.8,
    "planCount": 10,
    "projectHealth": "critical",
    "optimizerStatus": "ok",
    "budgetUsed": 26,
    "budgetLimit": 32,
    "workersDone": 4,
    "recordedAt": "2026-03-27T12:53:42.698Z"
  },
  {
    "parserConfidence": 0.8,
    "planCount": 3,
    "projectHealth": "needs-work",
    "optimizerStatus": "ok",
    "budgetUsed": 18,
    "budgetLimit": 22,
    "workersDone": 2,
    "recordedAt": "2026-03-27T14:49:59.979Z"
  },
  {
    "parserConfidence": 1,
    "planCount": 9,
    "projectHealth": "critical",
    "optimizerStatus": "ok",
    "budgetUsed": 17,
    "budgetLimit": 21,
    "workersDone": 6,
    "recordedAt": "2026-03-27T16:16:16.343Z"
  },
  {
    "parserConfidence": 1,
    "planCount": 8,
    "projectHealth": "critical",
    "optimizerStatus": "ok",
    "budgetUsed": 16,
    "budgetLimit": 20,
    "workersDone": 3,
    "recordedAt": "2026-03-27T17:18:11.580Z"
  },
  {
    "parserConfidence": 0.8,
    "planCount": 11,
    "projectHealth": "critical",
    "optimizerStatus": "ok",
    "budgetUsed": 17,
    "budgetLimit": 22,
    "workersDone": 9,
    "recordedAt": "2026-03-27T19:59:57.608Z"
  },
  {
    "parserConfidence": 1,
    "planCount": 6,
    "projectHealth": "critical",
    "optimizerStatus": "ok",
    "budgetUsed": 15,
    "budgetLimit": 18,
    "workersDone": 4,
    "recordedAt": "2026-03-27T21:35:46.369Z"
  },
  {
    "parserConfidence": 1,
    "planCount": 8,
    "projectHealth": "critical",
    "optimizerStatus": "ok",
    "budgetUsed": 30,
    "budgetLimit": 40,
    "workersDone": 5,
    "recordedAt": "2026-03-27T22:49:07.811Z"
  },
  {
    "parserConfidence": 0.8,
    "planCount": 13,
    "projectHealth": "critical",
    "optimizerStatus": "ok",
    "budgetUsed": 38,
    "budgetLimit": 45,
    "workersDone": 7,
    "recordedAt": "2026-03-28T00:39:26.157Z"
  },
  {
    "parserConfidence": 1,
    "planCount": 12,
    "projectHealth": "critical",
    "optimizerStatus": "ok",
    "budgetUsed": 35,
    "budgetLimit": 42,
    "workersDone": 6,
    "recordedAt": "2026-03-28T03:58:55.682Z"
  },
  {
    "parserConfidence": 0.8,
    "planCount": 8,
    "projectHealth": "critical",
    "optimizerStatus": "ok",
    "budgetUsed": 11,
    "budgetLimit": 14,
    "workersDone": 6,
    "recordedAt": "2026-03-28T08:23:43.666Z"
  },
  {
    "parserConfidence": 1,
    "parserCoreConfidence": 1,
    "parserContextPenalty": 0,
    "planCount": 2,
    "projectHealth": "good",
    "optimizerStatus": "ok",
    "budgetUsed": 5,
    "budgetLimit": 6,
    "workersDone": 1,
    "recordedAt": "2026-03-29T21:04:41.648Z"
  },
  {
    "parserConfidence": 1,
    "parserCoreConfidence": 1,
    "parserContextPenalty": 0,
    "planCount": 12,
    "projectHealth": "needs-work",
    "optimizerStatus": "ok",
    "budgetUsed": 5,
    "budgetLimit": 6,
    "workersDone": 5,
    "recordedAt": "2026-03-30T19:02:30.696Z"
  },
  {
    "parserConfidence": 1,
    "parserCoreConfidence": 1,
    "parserContextPenalty": 0,
    "planCount": 12,
    "projectHealth": "critical",
    "optimizerStatus": "ok",
    "budgetUsed": 5,
    "budgetLimit": 6,
    "workersDone": 4,
    "recordedAt": "2026-03-31T07:58:29.407Z"
  },
  {
    "parserConfidence": 1,
    "parserCoreConfidence": 1,
    "parserContextPenalty": 0,
    "planCount": 10,
    "projectHealth": "critical",
    "optimizerStatus": "ok",
    "budgetUsed": 4,
    "budgetLimit": 5,
    "workersDone": 1,
    "recordedAt": "2026-03-31T12:50:31.979Z"
  },
  {
    "parserConfidence": 1,
    "parserCoreConfidence": 1,
    "parserContextPenalty": 0,
    "planCount": 5,
    "projectHealth": "critical",
    "optimizerStatus": "ok",
    "budgetUsed": 6,
    "budgetLimit": 7,
    "workersDone": 4,
    "recordedAt": "2026-03-31T13:53:15.137Z"
  },
  {
    "parserConfidence": 1,
    "parserCoreConfidence": 1,
    "parserContextPenalty": 0,
    "planCount": 10,
    "projectHealth": "needs-work",
    "optimizerStatus": "ok",
    "budgetUsed": 4,
    "budgetLimit": 5,
    "workersDone": 2,
    "recordedAt": "2026-03-31T16:43:43.527Z"
  },
  {
    "parserConfidence": 1,
    "parserCoreConfidence": 1,
    "parserContextPenalty": 0,
    "planCount": 10,
    "projectHealth": "needs-work",
    "optimizerStatus": "ok",
    "budgetUsed": 7,
    "budgetLimit": 9,
    "workersDone": 7,
    "recordedAt": "2026-03-31T18:57:21.945Z"
  }
]

```

### Cycle Health (current health status) (cycle_health.json)
```json
{
  "divergenceState": "both_degraded",
  "pipelineStatus": "critical",
  "operationalStatus": "degraded",
  "plannerHealth": "needs-work",
  "isWarning": true,
  "recordedAt": "2026-03-31T18:57:21.948Z"
}

```

### Evolution Progress (self-improvement tracking) (evolution_progress.json)
```json
{
  "cycle_id": "SE-2026-03-21-001",
  "started_at": "2026-03-21T15:24:41.431Z",
  "current_task_index": 39,
  "tasks": {
    "T-001": {
      "status": "escalated",
      "attempts": 3,
      "worker_result": {
        "status": "partial",
        "prUrl": "https://github.com/CanerDoqdu/Box/pull/13",
        "filesTouched": [
          "src/core/worker_runner.js",
          "src/core/orchestrator.js",
          "tests/core/verification_gate.test.js"
        ],
        "verificationPassed": false
      },
      "verification_passed": null,
      "athena_verdict": null,
      "completed_at": null,
      "error": null
    },
    "T-002": {
      "status": "escalated",
      "attempts": 3,
      "worker_result": {
        "status": "partial",
        "prUrl": "https://github.com/CanerDoqdu/Box/pull/14",
        "filesTouched": [
          "src/core/athena_reviewer.js",
          "src/core/orchestrator.js",
          "src/core/state_tracker.js",
          "src/core/prometheus.js",
          "tests/core/athena_failclosed.test.js"
        ],
        "verificationPassed": false,
        "prChecks": {
          "ok": true,
          "passed": true,
          "failed": [],
          "pending": [],
          "total": 2
        }
      },
      "verification_passed": null,
      "athena_verdict": null,
      "completed_at": null,
      "error": null
    },
    "T-003": {
      "status": "escalated",
      "attempts": 1,
      "worker_result": {
        "status": "partial",
        "prUrl": "https://github.com/CanerDoqdu/Box/pull/15",
        "filesTouched": [
          "src/core/fs_utils.js",
          "src/core/orchestrator.js",
          "tests/core/fs_utils_read_errors.test.js"
        ],
        "verificationPassed": false,
        "prChecks": {
          "ok": true,
          "passed": true,
          "failed": [],
          "pending": [],
          "total": 2
        }
      },
      "verification_passed": null,
      "athena_verdict": null,
      "completed_at": null,
      "error": "Athena pre-review rejected: Plan is well-specified and implementable but AC8's verification grep is too broad and will always produce false positives, making its passing condition unreachable as written."
    },
    "T-004": {
      "status": "escalated",
      "attempts": 1,
      "worker_result": {
        "status": "partial",
        "prUrl": "https://github.com/CanerDoqdu/Box/pull/16",
        "filesTouched": [
          "src/core/athena_reviewer.js",
          "src/core/project_lifecycle.js",
          "tests/core/project_lifecycle.test.js"
        ],
        "verificationPassed": false,
        "prChecks": {
          "ok": true,
          "passed": true,
          "failed": [],
          "pending": [],
          "total": 2
        }
      },
      "verification_passed": null,
      "athena_verdict": null,
      "completed_at": null,
      "error": "Athena pre-review rejected: Core bug is precisely identified but AC2, AC3, and AC4 lack testable definitions and concrete verification paths, making three of five acceptance criteria unauditable."
    },
    "T-005": {
      "status": "escalated",
      "attempts": 1,
      "worker_result": {
        "status": "partial",
        "prUrl": "https://github.com/CanerDoqdu/Box/pull/17",
        "filesTouched": [
          "src/core/pipeline_progress.js",
          "src/core/orchestrator.js",
          "src/dashboard/live_dashboard.js",
          "tests/core/pipeline_progress.test.js",
          "tests/core/orchestrator_pipeline_progress.test.js"
        ],
        "verificationPassed": false,
        "prChecks": {
          "ok": true,
          "passed": true,
          "failed": [],
          "pending": [],
          "total": 2
        }
      },
      "verification_passed": null,
      "athena_verdict": null,
      "completed_at": null,
      "error": "Athena pre-review rejected: Task intent is valid but three of five acceptance criteria lack measurable definitions, the canonical state schema is absent, and the risk level is underestimated for orchestrator-level changes."
    },
    "T-006": {
      "status": "escalated",
      "attempts": 1,
      "worker_result": {
        "status": "partial",
        "prUrl": "https://github.com/CanerDoqdu/Box/pull/18",
        "filesTouched": [
          "src/core/escalation_queue.js",
          "src/core/worker_runner.js",
          "src/core/orchestrator.js",
          "src/dashboard/live_dashboard.js",
          "tests/core/escalation_queue.test.js"
        ],
        "verificationPassed": false,
        "prChecks": {
          "ok": true,
          "passed": true,
          "failed": [],
          "pending": [],
          "total": 2
        }
      },
      "verification_passed": null,
      "athena_verdict": null,
      "completed_at": null,
      "error": null
    },
    "T-007": {
      "status": "escalated",
      "attempts": 1,
      "worker_result": {
        "status": "partial",
        "prUrl": "https://github.com/CanerDoqdu/Box/pull/19",
        "filesTouched": [
          "src/core/policy_engine.js",
          "tests/core/policy_engine.test.js"
        ],
        "verificationPassed": false,
        "prChecks": {
          "ok": true,
          "passed": true,
          "failed": [],
          "pending": [],
          "total": 2
        }
      },
      "verification_passed": null,
      "athena_verdict": null,
      "completed_at": null,
      "error": null
    },
    "T-008": {
      "status": "escalated",
      "attempts": 1,
      "worker_result": {
        "status": "partial",
        "prUrl": "https://github.com/CanerDoqdu/Box/pull/20",
        "filesTouched": [
          "src/core/verification_gate.js",
          "tests/core/verification_profiles.test.js"
        ],
        "verificationPassed": false,
        "prChecks": {
          "ok": true,
          "passed": true,
          "failed": [],
          "pending": [],
          "total": 2
        }
      },
      "verification_passed": null,
      "athena_verdict": null,
      "completed_at": null,
      "error": null
    },
    "T-009": {
      "status": "escalated",
      "attempts": 1,
      "worker_result": {
        "status": "partial",
        "prUrl": "https://github.com/CanerDoqdu/Box/pull/21",
        "filesTouched": [
          "src/core/schema_registry.js",
          "src/core/prometheus.js",
          "src/core/athena_reviewer.js",
          "src/core/orchestrator.js",
          "src/core/moses_coordinator.js",
          "tests/core/schema_registry.test.js",
          "tests/fixtures/worker_sessions_v0.json",
          "tests/fixtures/prometheus_analysis_v0.json",
          "tests/fixtures/athena_postmortems_v0.json"
        ],
        "verificationPassed": false,
        "prChecks": {
          "ok": true,
          "passed": true,
          "failed": [],
          "pending": [],
          "total": 2
        }
      },
      "verification_passed": null,
      "athena_verdict": null,
      "completed_at": null,
      "error": null
    },
    "T-010": {
      "status": "escalated",
      "attempts": 1,
      "worker_result": {
        "status": "partial",
        "prUrl": "https://github.com/CanerDoqdu/Box/pull/22",
        "filesTouched": [
          "src/core/fs_utils.js",
          "src/core/checkpoint_engine.js",
          "src/core/orchestrator.js",
          "src/core/daemon_control.js",
          "tests/core/fs_utils_atomic_write.test.js"
        ],
        "verificationPassed": false,
        "prChecks": {
          "ok": true,
          "passed": true,
          "failed": [],
          "pending": [],
          "total": 2
        }
      },
      "verification_passed": null,
      "athena_verdict": null,
      "completed_at": null,
      "error": null
    },
    "T-011": {
      "status": "escalated",
      "attempts": 3,
      "worker_result": null,
      "verification_passed": null,
      "athena_verdict": null,
      "completed_at": null,
      "error": "Max attempts (3) exceeded"
    },
    "T-012": {
      "status": "escalated",
      "attempts": 2,
      "worker_result": {
        "status": "partial",
        "prUrl": "https://github.com/CanerDoqdu/Box/pull/25",
        "filesTouched": [
          "src/core/athena_reviewer.js",
          "src/core/self_improvement.js",
          "src/dashboard/live_dashboard.js",
          "tests/core/athena_decision_quality.test.js",
          "tests/fixtures/postmortem_legacy.json",
          ".github/agents/athena.agent.md",
          ".github/agents/evolution-worker.agent.md",
          ".github/agents/prometheus.agent.md"
        ],
        "verificationPassed": false,
        "prChecks": {
          "ok": true,
          "passed": true,
          "failed": [],
          "pending": [],
          "total": 2
        }
      },
      "verification_passed": null,
      "athena_verdict": null,
      "completed_at": null,
      "error": "pr-checks-not-green failed=[Lint & Test (Node 20)] pending=[none]"
    },
    "T-013": {
      "status": "escalated",
      "attempts": 1,
      "worker_result": {
        "status": "partial",
        "prUrl": "https://github.com/CanerDoqdu/Box/pull/26",
        "filesTouched": [
          "src/core/self_improvement.js",
          "src/core/moses_compat_map.json",
          "tests/core/self_improvement.test.js"
        ],
        "verificationPassed": false,
        "prChecks": {
          "ok": true,
          "passed": true,
          "failed": [],
          "pending": [],
          "total": 2
        }
      },
      "verification_passed": null,
      "athena_verdict": null,
      "completed_at": null,
      "error": null
    },
    "T-014": {
      "status": "escalated",
      "attempts": 2,
      "worker_result": {
        "status": "done",
        "prUrl": null,
        "filesTouched": [],
        "verificationPassed": false,
        "prChecks": {
          "ok": true,
          "passed": true,
          "failed": [],
          "pending": [],
          "total": 0
        }
      },
      "verification_passed": null,
      "athena_verdict": null,
      "completed_at": null,
      "error": null
    },
    "T-015": {
      "status": "escalated",
      "attempts": 1,
      "worker_result": {
        "status": "partial",
        "prUrl": "https://github.com/CanerDoqdu/Box/pull/28",
        "filesTouched": [
          "src/core/cycle_analytics.js",
          "src/core/orchestrator.js",
          "src/dashboard/live_dashboard.js",
          "tests/core/cycle_analytics.test.js"
        ],
        "verificationPassed": false,
        "prChecks": {
          "ok": true,
          "passed": true,
          "failed": [],
          "pending": [],
          "total": 2
        }
      },
      "verification_passed": null,
      "athena_verdict": null,
      "completed_at": null,
      "error": null
    },
    "T-016": {
      "status": "escalated",
      "attempts": 1,
      "worker_result": {
        "status": "partial",
        "prUrl": "https://github.com/CanerDoqdu/Box/pull/29",
        "filesTouched": [
          "src/core/experiment_registry.js",
          "src/core/self_improvement.js",
          "tests/core/experiment_registry.test.js"
        ],
        "verificationPassed": false,
        "prChecks": {
          "ok": true,
          "passed": true,
          "failed": [],
          "pending": [],
          "total": 2
        }
      },
      "verification_passed": null,
      "athena_verdict": null,
      "completed_at": null,
      "error": null
    },
    "T-017": {
      "status": "escalated",
      "attempts": 1,
      "worker_result": {
        "status": "partial",
        "prUrl": "https://github.com/CanerDoqdu/Box/pull/30",
        "filesTouched": [
          "src/core/shadow_policy_evaluator.js",
          "src/core/policy_engine.js",
          "src/core/self_improvement.js",
          "box.config.json",
          "tests/core/shadow_policy_evaluator.test.js"
        ],
        "verificationPassed": false,
        "prChecks": {
          "ok": true,
          "passed": true,
          "failed": [],
          "pending": [],
          "total": 2
        }
      },
      "verification_passed": null,
      "athena_verdict": null,
      "completed_at": null,
      "error": null
    },
    "T-018": {
      "status": "escalated",
      "attempts": 1,
      "worker_result": {
        "status": "partial",
        "prUrl": "https://github.com/CanerDoqdu/Box/pull/31",
        "filesTouched": [
          "src/core/lineage_graph.js",
          "src/core/task_schema.js",
          "src/core/state_tracker.js",
          "src/core/worker_runner.js",
          "tests/core/lineage_graph.test.js"
        ],
        "verificationPassed": false,
        "prChecks": {
          "ok": true,
          "passed": true,
          "failed": [],
          "pending": [],
          "total": 2
        }
      },
      "verification_passed": null,
      "athena_verdict": null,
      "completed_at": null,
      "error": null
    },
    "T-019": {
      "status": "escalated",
      "attempts": 1,
      "worker_result": {
        "status": "partial",
        "prUrl": "https://github.com/CanerDoqdu/Box/pull/33",
        "filesTouched": [
          "src/core/athena_reviewer.js",
          "tests/fixtures/calibration/good_plan.json",
          "tests/fixtures/calibration/ambiguous_plan.json",
          "tests/fixtures/calibration/bad_plan.json",
          "scripts/athena_calibration.js",
          "tests/core/athena_calibration.test.js",
          "box.config.json"
        ],
        "verificationPassed": false,
        "prChecks": {
          "ok": true,
          "passed": true,
          "failed": [],
          "pending": [],
          "total": 2
        }
      },
      "verification_passed": null,
      "athena_verdict": null,
      "completed_at": null,
      "error": null
    },
    "T-020": {
      "status": "escalated",
      "attempts": 1,
      "worker_result": {
        "status": "partial",
        "prUrl": "https://github.com/CanerDoqdu/Box/pull/34",
        "filesTouched": [
          "src/core/pipeline_progress.js",
          "src/dashboard/live_dashboard.js",
          "tests/dashboard/live_dashboard.test.js"
        ],
        "verificationPassed": false,
        "prChecks": {
          "ok": true,
          "passed": true,
          "failed": [],
          "pending": [],
          "total": 2
        }
      },
      "verification_passed": null,
      "athena_verdict": null,
      "completed_at": null,
      "error": null
    },
    "T-021": {
      "status": "escalated",
      "attempts": 1,
      "worker_result": {
        "status": "partial",
        "prUrl": "https://github.com/CanerDoqdu/Box/pull/35",
        "filesTouched": [
          "src/core/hypothesis_scheduler.js",
          "tests/core/hypothesis_scheduler.test.js",
          "box.config.json"
        ],
        "verificationPassed": false,
        "prChecks": {
          "ok": true,
          "passed": true,
          "failed": [],
          "pending": [],
          "total": 2
        }
      },
      "verification_passed": null,
      "athena_verdict": null,
      "completed_at": null,
      "error": null
    },
    "T-022": {
      "status": "escalated",
      "attempts": 1,
      "worker_result": {
        "status": "partial",
        "prUrl": "https://github.com/CanerDoqdu/Box/pull/36",
        "filesTouched": [
          "src/core/canary_metrics.js",
          "src/core/canary_ledger.js",
          "src/core/canary_engine.js",
          "src/core/self_improvement.js",
          "box.config.json",
          "tests/core/canary_engine.test.js"
        ],
        "verificationPassed": false,
        "prChecks": {
          "ok": true,
          "passed": true,
          "failed": [],
          "pending": [],
          "total": 2
        }
      },
      "verification_passed": null,
      "athena_verdict": null,
      "completed_at": null,
      "error": null
    },
    "T-023": {
      "status": "escalated",
      "attempts": 1,
      "worker_result": {
        "status": "partial",
        "prUrl": "https://github.com/CanerDoqdu/Box/pull/37",
        "filesTouched": [
          "src/core/replay_harness.js",
          "tests/core/replay_harness.test.js"
        ],
        "verificationPassed": false,
        "prChecks": {
          "ok": true,
          "passed": true,
          "failed": [],
          "pending": [],
          "total": 2
        }
      },
      "verification_passed": null,
      "athena_verdict": null,
      "completed_at": null,
      "error": null
    },
    "T-024": {
      "status": "escalated",
      "attempts": 1,
      "worker_result": {
        "status": "partial",
        "prUrl": "https://github.com/CanerDoqdu/Box/pull/38",
        "filesTouched": [
          "src/core/intervention_optimizer.js",
          "tests/core/intervention_optimizer.test.js",
          "src/core/event_schema.js",
          "src/core/state_tracker.js",
          "src/core/prometheus.js",
          "box.config.json"
        ],
        "verificationPassed": false,
        "prChecks": {
          "ok": true,
          "passed": true,
          "failed": [],
          "pending": [],
          "total": 2
        }
      },
      "verification_passed": null,
      "athena_verdict": null,
      "completed_at": null,
      "error": null
    },
    "T-025": {
      "status": "escalated",
      "attempts": 1,
      "worker_result": {
        "status": "partial",
        "prUrl": "https://github.com/CanerDoqdu/Box/pull/39",
        "filesTouched": [
          "src/core/failure_classifier.js",
          "src/core/state_tracker.js",
          "src/core/worker_runner.js",
          "src/core/intervention_optimizer.js",
          "tests/core/failure_classifier.test.js",
          "docs/failure_taxonomy.md"
        ],
        "verificationPassed": false,
        "prChecks": {
          "ok": true,
          "passed": true,
          "failed": [],
          "pending": [],
          "total": 2
        }
      },
      "verification_passed": null,
      "athena_verdict": null,
      "completed_at": null,
      "error": null
    },
    "T-026": {
      "status": "escalated",
      "attempts": 1,
      "worker_result": {
        "status": "partial",
        "prUrl": "https://github.com/CanerDoqdu/Box/pull/40",
        "filesTouched": [
          "src/core/athena_reviewer.js",
          "src/core/prometheus.js",
          "src/core/self_improvement.js",
          "tests/core/premortem.test.js"
        ],
        "verificationPassed": false,
        "prChecks": {
          "ok": true,
          "passed": true,
          "failed": [],
          "pending": [],
          "total": 2
        }
      },
      "verification_passed": null,
      "athena_verdict": null,
      "completed_at": null,
      "error": null
    },
    "T-027": {
      "status": "escalated",
      "attempts": 1,
      "worker_result": {
        "status": "partial",
        "prUrl": "https://github.com/CanerDoqdu/Box/pull/41",
        "filesTouched": [
          "src/core/dependency_graph_resolver.js",
          "src/core/prometheus.js",
          "tests/core/dependency_graph_resolver.test.js"
        ],
        "verificationPassed": false,
        "prChecks": {
          "ok": true,
          "passed": true,
          "failed": [],
          "pending": [],
          "total": 2
        }
      },
      "verification_passed": null,
      "athena_verdict": null,
      "completed_at": null,
      "error": null
    },
    "T-028": {
      "status": "escalated",
      "attempts": 1,
      "worker_result": {
        "status": "partial",
        "prUrl": "https://github.com/CanerDoqdu/Box/pull/42",
        "filesTouched": [
          "src/core/retry_strategy.js",
          "tests/core/retry_strategy.test.js",
          "src/core/worker_runner.js",
          "box.config.json"
        ],
        "verificationPassed": false,
        "prChecks": {
          "ok": true,
          "passed": true,
          "failed": [],
          "pending": [],
          "total": 2
        }
      },
      "verification_passed": null,
      "athena_verdict": null,
      "completed_at": null,
      "error": null
    },
    "T-029": {
      "status": "escalated",
      "attempts": 1,
      "worker_result": {
        "status": "partial",
        "prUrl": "https://github.com/CanerDoqdu/Box/pull/43",
        "filesTouched": [
          "src/core/hypothesis_scorecard.js",
          "src/dashboard/live_dashboard.js",
          "tests/dashboard/hypothesis_scorecard.test.js"
        ],
        "verificationPassed": false,
        "prChecks": {
          "ok": true,
          "passed": true,
          "failed": [],
          "pending": [],
          "total": 2
        }
      },
      "verification_passed": null,
      "athena_verdict": null,
      "completed_at": null,
      "error": null
    },
    "T-030": {
      "status": "escalated",
      "attempts": 1,
      "worker_result": {
        "status": "partial",
        "prUrl": "https://github.com/CanerDoqdu/Box/pull/44",
        "filesTouched": [
          "src/core/self_improvement.js",
          "src/core/state_tracker.js",
          "tests/core/monthly_postmortem.test.js"
        ],
        "verificationPassed": false,
        "prChecks": {
          "ok": true,
          "passed": true,
          "failed": [],
          "pending": [],
          "total": 2
        }
      },
      "verification_passed": null,
      "athena_verdict": null,
      "completed_at": null,
      "error": null
    },
    "T-031": {
      "status": "escalated",
      "attempts": 3,
      "worker_result": {
        "status": "partial",
        "prUrl": "https://github.com/CanerDoqdu/Box/pull/45",
        "filesTouched": [
          "src/core/governance_contract.js",
          "policy.json",
          "src/core/policy_engine.js",
          "src/core/self_improvement.js",
          "tests/core/governance_contract.test.js",
          "docs/governance_contract.md"
        ],
        "verificationPassed": false,
        "prChecks": {
          "ok": true,
          "passed": true,
          "failed": [],
          "pending": [],
          "total": 2
        }
      },
      "verification_passed": null,
      "athena_verdict": null,
      "completed_at": null,
      "error": "pr-checks-unavailable:invalid-pr-url"
    },
    "T-032": {
      "status": "escalated",
      "attempts": 1,
      "worker_result": {
        "status": "partial",
        "prUrl": "https://github.com/CanerDoqdu/Box/pull/46",
        "filesTouched": [
          "src/core/catastrophe_detector.js",
          "src/core/event_schema.js",
          "src/core/orchestrator.js",
          "tests/core/catastrophe_detector.test.js",
          "tests/fixtures/catastrophe_scenarios/positive/runaway_retries.json",
          "tests/fixtures/catastrophe_scenarios/positive/mass_blocked_tasks.json",
          "tests/fixtures/catastrophe_scenarios/positive/stale_critical_state.json",
          "tests/fixtures/catastrophe_scenarios/positive/repeated_ai_parse_failures.json",
          "tests/fixtures/catastrophe_scenarios/positive/budget_exhaustion_spiral.json",
          "tests/fixtures/catastrophe_scenarios/positive/slo_cascading_breach.json",
          "tests/fixtures/catastrophe_scenarios/negative/healthy_baseline.json",
          "tests/fixtures/catastrophe_scenarios/negative/near_threshold_no_trigger.json"
        ],
        "verificationPassed": false,
        "prChecks": {
          "ok": true,
          "passed": true,
          "failed": [],
          "pending": [],
          "total": 2
        }
      },
      "verification_passed": null,
      "athena_verdict": null,
      "completed_at": null,
      "error": null
    },
    "T-033": {
      "status": "escalated",
      "attempts": 2,
      "worker_result": {
        "status": "partial",
        "prUrl": "https://github.com/CanerDoqdu/Box/pull/48",
        "filesTouched": [
          "src/core/orchestrator.js",
          "src/core/self_improvement.js",
          "tests/core/guardrail_integration.test.js"
        ],
        "verificationPassed": false,
        "prChecks": {
          "ok": true,
          "passed": true,
          "failed": [],
          "pending": [],
          "total": 2
        }
      },
      "verification_passed": null,
      "athena_verdict": null,
      "completed_at": null,
      "error": "worker-error"
    },
    "T-034": {
      "status": "escalated",
      "attempts": 1,
      "worker_result": {
        "status": "partial",
        "prUrl": "https://github.com/CanerDoqdu/Box/pull/49",
        "filesTouched": [
          "src/core/rollback_engine.js",
          "tests/core/rollback_engine.test.js",
          "box.config.json"
        ],
        "verificationPassed": false,
        "prChecks": {
          "ok": true,
          "passed": true,
          "failed": [],
          "pending": [],
          "total": 2
        }
      },
      "verification_passed": null,
      "athena_verdict": null,
      "completed_at": null,
      "error": null
    },
    "T-035": {
      "status": "escalated",
      "attempts": 1,
      "worker_result": {
        "status": "partial",
        "prUrl": "https://github.com/CanerDoqdu/Box/pull/50",
        "filesTouched": [
          "src/core/governance_canary.js",
          "src/core/policy_engine.js",
          "src/core/orchestrator.js",
          "box.config.json",
          "tests/core/governance_canary.test.js"
        ],
        "verificationPassed": false,
        "prChecks": {
          "ok": true,
          "passed": true,
          "failed": [],
          "pending": [],
          "total": 2
        }
      },
      "verification_passed": null,
      "athena_verdict": null,
      "completed_at": null,
      "error": null
    },
    "T-036": {
      "status": "escalated",
      "attempts": 1,
      "worker_result": {
        "status": "partial",
        "prUrl": "https://github.com/CanerDoqdu/Box/pull/51",
        "filesTouched": [
          "src/schemas/leadership.schema.json",
          "src/core/trust_boundary.js",
          "src/core/prometheus.js",
          "src/core/athena_reviewer.js",
          "src/core/jesus_supervisor.js",
          "tests/core/trust_boundary.test.js"
        ],
        "verificationPassed": false,
        "prChecks": {
          "ok": true,
          "passed": true,
          "failed": [],
          "pending": [],
          "total": 2
        }
      },
      "verification_passed": null,
      "athena_verdict": null,
      "completed_at": null,
      "error": null
    },
    "T-037": {
      "status": "escalated",
      "attempts": 1,
      "worker_result": {
        "status": "partial",
        "prUrl": "https://github.com/CanerDoqdu/Box/pull/52",
        "filesTouched": [
          "src/core/resilience_drill.js",
          "tests/core/resilience_drill.test.js"
        ],
        "verificationPassed": false,
        "prChecks": {
          "ok": true,
          "passed": true,
          "failed": [],
          "pending": [],
          "total": 2
        }
      },
      "verification_passed": null,
      "athena_verdict": null,
      "completed_at": null,
      "error": null
    },
    "T-038": {
      "status": "escalated",
      "attempts": 1,
      "worker_result": {
        "status": "partial",
        "prUrl": "https://github.com/CanerDoqdu/Box/pull/53",
        "filesTouched": [
          "src/core/compounding_effects_analyzer.js",
          "src/core/state_tracker.js",
          "src/dashboard/live_dashboard.js",
          "tests/core/compounding_effects_analyzer.test.js"
        ],
        "verificationPassed": false,
        "prChecks": {
          "ok": true,
          "passed": true,
          "failed": [],
          "pending": [],
          "total": 2
        }
      },
      "verification_passed": null,
      "athena_verdict": null,
      "completed_at": null,
      "error": null
    },
    "T-039": {
      "status": "escalated",
      "attempts": 1,
      "worker_result": {
        "status": "partial",
        "prUrl": "https://github.com/CanerDoqdu/Box/pull/54",
        "filesTouched": [
          "src/core/governance_review_packet.js",
          "scripts/generate-governance-packet.mjs",
          "tests/core/governance_review_packet.test.js"
        ],
        "verificationPassed": false,
        "prChecks": {
          "ok": true,
          "passed": true,
          "failed": [],
          "pending": [],
          "total": 2
        }
      },
      "verification_passed": null,
      "athena_verdict": null,
      "completed_at": null,
      "error": null
    },
    "T-040": {
      "status": "escalated",
      "attempts": 1,
      "worker_result": {
        "status": "partial",
        "prUrl": "https://github.com/CanerDoqdu/Box/pull/55",
        "filesTouched": [
          "src/core/governance_freeze.js",
          "src/core/self_improvement.js",
          "src/core/orchestrator.js",
          "src/core/policy_engine.js",
          "box.config.json",
          "tests/core/governance_freeze.test.js"
        ],
        "verificationPassed": false,
        "prChecks": {
          "ok": true,
          "passed": true,
          "failed": [],
          "pending": [],
          "total": 2
        }
      },
      "verification_passed": null,
      "athena_verdict": null,
      "completed_at": null,
      "error": null
    }
  }
}

```

### SLO Metrics (service-level objectives) (slo_metrics.json)
```json
{
  "schemaVersion": 1,
  "lastCycle": {
    "cycleId": "2026-03-31T12:16:52.080Z",
    "startedAt": "2026-03-31T12:16:52.080Z",
    "completedAt": "2026-03-31T18:57:21.869Z",
    "metrics": {
      "decisionLatencyMs": 82598,
      "dispatchLatencyMs": 30,
      "verificationCompletionMs": 7227626
    },
    "missingTimestamps": [],
    "thresholdValidationErrors": [],
    "sloBreaches": [
      {
        "metric": "verificationCompletionMs",
        "threshold": 3600000,
        "actual": 7227626,
        "severity": "critical",
        "reason": "VERIFICATIONCOMPLETION_BREACH"
      }
    ],
    "status": "degraded",
    "statusReason": "BREACH_DETECTED"
  },
  "history": [
    {
      "cycleId": "2026-03-31T12:16:52.080Z",
      "startedAt": "2026-03-31T12:16:52.080Z",
      "completedAt": "2026-03-31T18:57:21.869Z",
      "metrics": {
        "decisionLatencyMs": 82598,
        "dispatchLatencyMs": 30,
        "verificationCompletionMs": 7227626
      },
      "missingTimestamps": [],
      "thresholdValidationErrors": [],
      "sloBreaches": [
        {
          "metric": "verificationCompletionMs",
          "threshold": 3600000,
          "actual": 7227626,
          "severity": "critical",
          "reason": "VERIFICATIONCOMPLETION_BREACH"
        }
      ],
      "status": "degraded",
      "statusReason": "BREACH_DETECTED"
    },
    {
      "cycleId": "2026-03-31T12:16:52.080Z",
      "startedAt": "2026-03-31T12:16:52.080Z",
      "completedAt": "2026-03-31T16:43:43.394Z",
      "metrics": {
        "decisionLatencyMs": 82921,
        "dispatchLatencyMs": 28,
        "verificationCompletionMs": 2401276
      },
      "missingTimestamps": [],
      "thresholdValidationErrors": [],
      "sloBreaches": [],
      "status": "ok",
      "statusReason": "OK"
    },
    {
      "cycleId": "2026-03-31T12:16:52.080Z",
      "startedAt": "2026-03-31T12:16:52.080Z",
      "completedAt": "2026-03-31T13:53:15.068Z",
      "metrics": {
        "decisionLatencyMs": 109465,
        "dispatchLatencyMs": 45,
        "verificationCompletionMs": 2945261
      },
      "missingTimestamps": [],
      "thresholdValidationErrors": [],
      "sloBreaches": [],
      "status": "ok",
      "statusReason": "OK"
    },
    {
      "cycleId": "2026-03-31T12:16:52.080Z",
      "startedAt": "2026-03-31T12:16:52.080Z",
      "completedAt": "2026-03-31T12:50:31.870Z",
      "metrics": {
        "decisionLatencyMs": 98050,
        "dispatchLatencyMs": 36,
        "verificationCompletionMs": 1220306
      },
      "missingTimestamps": [],
      "thresholdValidationErrors": [],
      "sloBreaches": [],
      "status": "ok",
      "statusReason": "OK"
    },
    {
      "cycleId": "2026-03-31T06:19:08.717Z",
      "startedAt": "2026-03-31T06:19:08.717Z",
      "completedAt": "2026-03-31T07:58:29.271Z",
      "metrics": {
        "decisionLatencyMs": 114266,
        "dispatchLatencyMs": 63,
        "verificationCompletionMs": 4762298
      },
      "missingTimestamps": [],
      "thresholdValidationErrors": [],
      "sloBreaches": [
        {
          "metric": "verificationCompletionMs",
          "threshold": 3600000,
          "actual": 4762298,
          "severity": "critical",
          "reason": "VERIFICATIONCOMPLETION_BREACH"
        }
      ],
      "status": "degraded",
      "statusReason": "BREACH_DETECTED"
    },
    {
      "cycleId": "2026-03-30T17:08:36.342Z",
      "startedAt": "2026-03-30T17:08:36.342Z",
      "completedAt": "2026-03-30T19:02:30.604Z",
      "metrics": {
        "decisionLatencyMs": 98965,
        "dispatchLatencyMs": 21,
        "verificationCompletionMs": 6034938
      },
      "missingTimestamps": [],
      "thresholdValidationErrors": [],
      "sloBreaches": [
        {
          "metric": "verificationCompletionMs",
          "threshold": 3600000,
          "actual": 6034938,
          "severity": "critical",
          "reason": "VERIFICATIONCOMPLETION_BREACH"
        }
      ],
      "status": "degraded",
      "statusReason": "BREACH_DETECTED"
    },
    {
      "cycleId": "2026-03-29T20:14:34.991Z",
      "startedAt": "2026-03-29T20:14:34.991Z",
      "completedAt": "2026-03-29T21:04:41.430Z",
      "metrics": {
        "decisionLatencyMs": 55371,
        "dispatchLatencyMs": 54,
        "verificationCompletionMs": 783928
      },
      "missingTimestamps": [],
      "thresholdValidationErrors": [],
      "sloBreaches": [],
      "status": "ok",
      "statusReason": "OK"
    },
    {
      "cycleId": "2026-03-27T14:59:17.874Z",
      "startedAt": "2026-03-27T14:59:17.874Z",
      "completedAt": "2026-03-28T08:23:43.449Z",
      "metrics": {
        "decisionLatencyMs": 92655,
        "dispatchLatencyMs": 8,
        "verificationCompletionMs": 4870638
      },
      "missingTimestamps": [],
      "thresholdValidationErrors": [],
      "sloBreaches": [
        {
          "metric": "verificationCompletionMs",
          "threshold": 3600000,
          "actual": 4870638,
          "severity": "critical",
          "reason": "VERIFICATIONCOMPLETION_BREACH"
        }
      ],
      "status": "degraded",
      "statusReason": "BREACH_DETECTED"
    },
    {
      "cycleId": "2026-03-27T14:59:17.874Z",
      "startedAt": "2026-03-27T14:59:17.874Z",
      "completedAt": "2026-03-28T03:58:55.557Z",
      "metrics": {
        "decisionLatencyMs": 88883,
        "dispatchLatencyMs": 5,
        "verificationCompletionMs": 7124749
      },
      "missingTimestamps": [],
      "thresholdValidationErrors": [],
      "sloBreaches": [
        {
          "metric": "verificationCompletionMs",
          "threshold": 3600000,
          "actual": 7124749,
          "severity": "critical",
          "reason": "VERIFICATIONCOMPLETION_BREACH"
        }
      ],
      "status": "degraded",
      "statusReason": "BREACH_DETECTED"
    },
    {
      "cycleId": "2026-03-27T14:59:17.874Z",
      "startedAt": "2026-03-27T14:59:17.874Z",
      "completedAt": "2026-03-28T00:39:26.111Z",
      "metrics": {
        "decisionLatencyMs": 78696,
        "dispatchLatencyMs": 5,
        "verificationCompletionMs": 5612925
      },
      "missingTimestamps": [],
      "thresholdValidationErrors": [],
      "sloBreaches": [
        {
          "metric": "verificationCompletionMs",
          "threshold": 3600000,
          "actual": 5612925,
          "severity": "critical",
          "reason": "VERIFICATIONCOMPLETION_BREACH"
        }
      ],
      "status": "degraded",
      "statusReason": "BREACH_DETECTED"
    },
    {
      "cycleId": "2026-03-27T14:59:17.874Z",
      "startedAt": "2026-03-27T14:59:17.874Z",
      "completedAt": "2026-03-27T22:49:07.748Z",
      "metrics": {
        "decisionLatencyMs": 85957,
        "dispatchLatencyMs": 3,
        "verificationCompletionMs": 3652170
      },
      "missingTimestamps": [],
      "thresholdValidationErrors": [],
      "sloBreaches": [
        {
          "metric": "verificationCompletionMs",
          "threshold": 3600000,
          "actual": 3652170,
          "severity": "critical",
          "reason": "VERIFICATIONCOMPLETION_BREACH"
        }
      ],
      "status": "degraded",
      "statusReason": "BREACH_DETECTED"
    },
    {
      "cycleId": "2026-03-27T14:59:17.874Z",
      "startedAt": "2026-03-27T14:59:17.874Z",
      "completedAt": "2026-03-27T21:35:46.255Z",
      "metrics": {
        "decisionLatencyMs": 103154,
        "dispatchLatencyMs": 19,
        "verificationCompletionMs": 2788141
      },
      "missingTimestamps": [],
      "thresholdValidationErrors": [],
      "sloBreaches": [],
      "status": "ok",
      "statusReason": "OK"
    },
    {
      "cycleId": "2026-03-27T14:59:17.874Z",
      "startedAt": "2026-03-27T14:59:17.874Z",
      "completedAt": "2026-03-27T19:59:57.482Z",
      "metrics": {
        "decisionLatencyMs": 105068,
        "dispatchLatencyMs": 33,
        "verificationCompletionMs": 8743200
      },
      "missingTimestamps": [],
      "thresholdValidationErrors": [],
      "sloBreaches": [
        {
          "metric": "verificationCompletionMs",
          "threshold": 3600000,
          "actual": 8743200,
          "severity": "critical",
          "reason": "VERIFICATIONCOMPLETION_BREACH"
        }
      ],
      "status": "degraded",
      "statusReason": "BREACH_DETECTED"
    },
    {
      "cycleId": "2026-03-27T14:59:17.874Z",
      "startedAt": "2026-03-27T14:59:17.874Z",
      "completedAt": "2026-03-27T17:18:11.500Z",
      "metrics": {
        "decisionLatencyMs": 115002,
        "dispatchLatencyMs": 29,
        "verificationCompletionMs": 2860728
      },
      "missingTimestamps": [],
      "thresholdValidationErrors": [],
      "sloBreaches": [],
      "status": "ok",
      "statusReason": "OK"
    },
    {
      "cycleId": "2026-03-27T14:59:17.874Z",
      "startedAt": "2026-03-27T14:59:17.874Z",
      "completedAt": "2026-03-27T16:16:16.293Z",
      "metrics": {
        "decisionLatencyMs": 63990,
        "dispatchLatencyMs": 14,
        "verificationCompletionMs": 3984150
      },
      "missingTimestamps": [],
      "thresholdValidationErrors": [],
      "sloBreaches": [
        {
          "metric": "verificationCompletionMs",
          "threshold": 3600000,
          "actual": 3984150,
          "severity": "critical",
          "reason": "VERIFICATIONCOMPLETION_BREACH"
        }
      ],
      "status": "degraded",
      "statusReason": "BREACH_DETECTED"
    },
    {
      "cycleId": "2026-03-27T14:17:16.400Z",
      "startedAt": "2026-03-27T14:17:16.400Z",
      "completedAt": "2026-03-27T14:49:59.921Z",
      "metrics": {
        "decisionLatencyMs": 0,
        "dispatchLatencyMs": 10,
        "verificationCompletionMs": 1392385
      },
      "missingTimestamps": [],
      "thresholdValidationErrors": [],
      "sloBreaches": [],
      "status": "ok",
      "statusReason": "OK"
    },
    {
      "cycleId": "2026-03-26T17:55:34.803Z",
      "startedAt": "2026-03-26T17:55:34.803Z",
      "completedAt": "2026-03-27T12:53:42.573Z",
      "metrics": {
        "decisionLatencyMs": 88605,
        "dispatchLatencyMs": 11,
        "verificationCompletionMs": 3320892
      },
      "missingTimestamps": [],
      "thresholdValidationErrors": [],
      "sloBreaches": [],
      "status": "ok",
      "statusReason": "OK"
    },
    {
      "cycleId": "2026-03-26T17:55:34.803Z",
      "startedAt": "2026-03-26T17:55:34.803Z",
      "completedAt": "2026-03-27T10:07:11.393Z",
      "metrics": {
        "decisionLatencyMs": 95525,
        "dispatchLatencyMs": 12,
        "verificationCompletionMs": 3368005
      },
      "missingTimestamps": [],
      "thresholdValidationErrors": [],
      "sloBreaches": [],
      "status": "ok",
      "statusReason": "OK"
    },
    {
      "cycleId": "2026-03-24T12:55:34.815Z",
      "startedAt": "2026-03-24T12:55:34.815Z",
      "completedAt": "2026-03-25T17:40:36.706Z",
      "metrics": {
        "decisionLatencyMs": 121102,
        "dispatchLatencyMs": 14,
        "verificationCompletionMs": 1016069
      },
      "missingTimestamps": [],
      "thresholdValidationErrors": [],
      "sloBreaches": [
        {
          "metric": "decisionLatencyMs",
          "threshold": 120000,
          "actual": 121102,
          "severity": "high",
          "reason": "DECISIONLATENCY_BREACH"
        }
      ],
      "status": "degraded",
      "statusReason": "BREACH_DETECTED"
    },
    {
      "cycleId": "2026-03-24T12:55:34.815Z",
      "startedAt": "2026-03-24T12:55:34.815Z",
      "completedAt": "2026-03-24T18:01:29.980Z",
      "metrics": {
        "decisionLatencyMs": 91036,
        "dispatchLatencyMs": 10,
        "verificationCompletionMs": 1828626
      },
      "missingTimestamps": [],
      "thresholdValidationErrors": [],
      "sloBreaches": [],
      "status": "ok",
      "statusReason": "OK"
    }
  ],
  "updatedAt": "2026-03-31T18:57:21.884Z"
}

```

### Orchestrator Health (orchestrator_health.json)
```json
{
  "orchestratorStatus": "operational",
  "reason": null,
  "details": null,
  "recordedAt": "2026-04-01T13:07:37.576Z"
}

```

## EXISTING REPOSITORY FILES
You MUST only reference paths from this list in target_files. Do NOT invent new module names.
### src/core/ (core modules)
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
src/core/context_usage.js
src/core/context_usage.ts
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
src/core/medic_agent.ts
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
src/core/research_scout.ts
src/core/research_synthesizer.ts
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
### src/workers/
src/workers/contract_health.ts
src/workers/run_task.ts
### src/dashboard/
src/dashboard/auth.ts
src/dashboard/live_dashboard.ts
src/dashboard/render.ts
### src/types/
src/types/index.ts
### src/ (root)
src/cli.ts
src/config.ts
### tests/core/ (test files)
tests/core/ac_compiler.test.ts
tests/core/agent_loader.test.ts
tests/core/architecture_drift.test.ts
tests/core/athena_calibration.test.ts
tests/core/athena_decision_quality.test.ts
tests/core/athena_failclosed.test.ts
tests/core/athena_reviewer_precision_recall.test.ts
tests/core/athena_review_normalization.test.ts
tests/core/athena_task_class_calibration.test.ts
tests/core/budget_controller.test.ts
tests/core/canary_engine.test.ts
tests/core/canary_metrics.test.ts
tests/core/capability_pool.test.ts
tests/core/capacity_scoreboard.test.ts
tests/core/carry_forward_ledger.test.ts
tests/core/catastrophe_detector.test.ts
tests/core/checkpoint_engine.test.ts
tests/core/closure_validator.test.ts
tests/core/compounding_effects_analyzer.test.ts
tests/core/contract_health.test.ts
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
tests/core/jesus_supervisor.test.ts
tests/core/learning_policy_compiler.test.ts
tests/core/lineage_graph.test.ts
tests/core/medic_agent.test.ts
tests/core/model_policy.test.ts
tests/core/monthly_postmortem.test.ts
tests/core/orchestration_integration.test.ts
tests/core/orchestrator_drift_debt_gate.test.ts
tests/core/orchestrator_gate_precedence.test.ts
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