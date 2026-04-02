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

### FILE: src/core/dependency_graph_resolver.ts
```typescript
/**
 * dependency_graph_resolver.js — Cross-task dependency graph resolver for BOX.
 *
 * Resolves cross-task dependencies to maximize safe parallelism and prevent
 * contradictory policy updates.
 *
 * ── Risk level: HIGH ─────────────────────────────────────────────────────────
 * This module feeds directly into prometheus.js and orchestrator.js scheduling.
 * Silent regression risk is significant. All execution paths are explicit.
 *
 * ── Conflict detection model (AC2 — deterministic, implementer-independent) ──
 * Two tasks are considered CONFLICTING when their `filesInScope` arrays share at
 * least one normalized file path. Conflicting tasks are placed in different
 * execution waves (serialized) to prevent contradictory policy updates.
 * Normalization: lowercase, forward slashes, no leading "./".
 *
 * ── GraphTask input schema ────────────────────────────────────────────────────
 * Each task descriptor must have:
 *   id           {string}   — unique identifier within the task set (required)
 *   dependsOn    {string[]} — IDs of tasks this task depends on (optional, default [])
 *   filesInScope {string[]} — repo-relative file paths for conflict detection (optional, default [])
 *
 * ── Parallel-track output schema (AC3) ───────────────────────────────────────
 * resolveDependencyGraph returns a GraphResolution object:
 * {
 *   schemaVersion:  1
 *   resolvedAt:     ISO timestamp
 *   status:         GRAPH_STATUS enum value
 *   reasonCode:     GRAPH_REASON enum value
 *   waves:          Wave[]
 *   conflictPairs:  ConflictPair[]
 *   cycles:         string[][]     — each entry is a cycle path of task IDs
 *   totalTasks:     integer
 *   parallelTasks:  integer        — tasks that share a wave with at least one other
 *   serializedTasks: integer       — tasks alone in their wave, or bumped by conflict
 *   errorMessage:   string|null
 * }
 *
 * Wave:
 * {
 *   wave:     integer   — 1-indexed wave number
 *   taskIds:  string[]  — IDs of tasks in this wave
 *   gates:    Gate[]    — prerequisites that must complete before this wave starts
 * }
 *
 * Gate:
 * {
 *   afterTaskId: string     — task that must complete before this gate opens
 *   reason:      GATE_REASON enum value
 *   sharedFiles: string[]   — populated when reason=file_conflict
 * }
 *
 * ConflictPair:
 * {
 *   taskA:       string
 *   taskB:       string
 *   reason:      CONFLICT_REASON enum value
 *   sharedFiles: string[]
 * }
 *
 * ── Diagnostics persistence (AC5) ────────────────────────────────────────────
 * persistGraphDiagnostics writes to: state/dependency_graph_diagnostics.json
 * The file is appended (line-delimited NDJSON) so history is preserved.
 * Callers must never fail if persistence fails — use the non-blocking wrapper.
 *
 * ── Error handling policy ─────────────────────────────────────────────────────
 * - Missing input (null/undefined tasks)   → status=invalid_input, reasonCode=MISSING_INPUT
 * - Wrong type (not an array)             → status=invalid_input, reasonCode=INVALID_INPUT
 * - Invalid task entry                     → status=invalid_input, reasonCode=INVALID_INPUT
 * - Empty array                            → status=ok,           reasonCode=EMPTY_INPUT (waves=[])
 * - Cycle detected in explicit deps        → status=cycle_detected, reasonCode=CYCLE_DETECTED
 * - All constraints satisfied              → status=ok,           reasonCode=VALID
 *
 * No silent fallback: every degraded/failure path sets an explicit status + reasonCode.
 */

import path from "node:path";
import fs from "node:fs/promises";

// ── Schema version ────────────────────────────────────────────────────────────

/** Schema version for dependency_graph_diagnostics.json entries. */
export const GRAPH_DIAGNOSTICS_SCHEMA_VERSION = 1;

// ── Status enum (AC10) ────────────────────────────────────────────────────────

/**
 * Top-level status codes for a GraphResolution result.
 * Written to the `status` field in every persisted diagnostics entry.
 *
 * Callers must inspect this field — no silent fallback allowed.
 */
export const GRAPH_STATUS = Object.freeze({
  /** DAG resolved; all constraints satisfied. Waves and gates are valid. */
  OK:             "ok",
  /** A cycle was found in explicit dependencies. Scheduling aborted. */
  CYCLE_DETECTED: "cycle_detected",
  /** Input validation failed — no graph was built. */
  INVALID_INPUT:  "invalid_input",
  /** Resolver entered an unexpected error state; partial results only. */
  DEGRADED:       "degraded",
});

// ── Reason code enum (AC9) ────────────────────────────────────────────────────

/**
 * Machine-readable reason codes for the top-level resolver result.
 * Callers must inspect this field; silent fallback is not allowed.
 */
export const GRAPH_REASON = Object.freeze({
  /** Graph resolved successfully; all tasks scheduled. */
  VALID:          "VALID",
  /** Input tasks array was provided but empty — no waves generated. */
  EMPTY_INPUT:    "EMPTY_INPUT",
  /** Required input (tasks) was null/undefined. */
  MISSING_INPUT:  "MISSING_INPUT",
  /** Input was provided but structurally invalid (wrong type or bad task). */
  INVALID_INPUT:  "INVALID_INPUT",
  /** At least one cycle was detected in explicit dependencies. */
  CYCLE_DETECTED: "CYCLE_DETECTED",
});

// ── Gate reason enum ──────────────────────────────────────────────────────────

/**
 * Reason codes for wave gate entries.
 */
export const GATE_REASON = Object.freeze({
  /** Gate caused by an explicit `dependsOn` relationship. */
  EXPLICIT_DEPENDENCY: "explicit_dependency",
  /** Gate caused by overlapping filesInScope between two tasks. */
  FILE_CONFLICT:       "file_conflict",
});

// ── Conflict reason enum ──────────────────────────────────────────────────────

/**
 * Reason codes for conflict pair entries.
 */
export const CONFLICT_REASON = Object.freeze({
  /** Two tasks share at least one file path in their filesInScope arrays. */
  OVERLAPPING_FILES_IN_SCOPE: "overlapping_files_in_scope",
});

// ── Task validation error codes ───────────────────────────────────────────────

/**
 * Reason codes for individual task validation failures.
 * Distinguishes missing/null input from structurally invalid input.
 */
export const TASK_ERROR_CODE = Object.freeze({
  /** Input is null/undefined. */
  MISSING_INPUT: "MISSING_INPUT",
  /** Input is not a plain object. */
  INVALID_TYPE:  "INVALID_TYPE",
  /** A required field is absent. */
  MISSING_FIELD: "MISSING_FIELD",
  /** A field is present but its value fails validation. */
  INVALID_FIELD: "INVALID_FIELD",
});

// ── Normalization ─────────────────────────────────────────────────────────────

/**
 * Normalize a file path for conflict comparison.
 * Lowercases, converts backslashes to forward slashes, strips leading "./".
 *
 * @param {string} filePath
 * @returns {string}
 */
export function normalizeFilePath(filePath) {
  return String(filePath || "")
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .trim()
    .toLowerCase();
}

// ── Validation ────────────────────────────────────────────────────────────────

/**
 * Validate a single GraphTask descriptor.
 *
 * Distinguishes missing input from invalid input:
 *   null/undefined input  → ok=false, code=MISSING_INPUT
 *   non-object input      → ok=false, code=INVALID_TYPE
 *   absent 'id' field     → ok=false, code=MISSING_FIELD
 *   invalid field value   → ok=false, code=INVALID_FIELD
 *   fully valid           → ok=true,  code=null
 *
 * @param {any} task
 * @returns {{ ok: boolean, code: string|null, field?: string, message: string }}
 */
export function validateGraphTask(task) {
  if (task === null || task === undefined) {
    return { ok: false, code: TASK_ERROR_CODE.MISSING_INPUT, message: "task is required (got null/undefined)" };
  }
  if (typeof task !== "object" || Array.isArray(task)) {
    return { ok: false, code: TASK_ERROR_CODE.INVALID_TYPE, message: "task must be a plain object" };
  }
  if (!("id" in task)) {
    return { ok: false, code: TASK_ERROR_CODE.MISSING_FIELD, field: "id", message: "required field 'id' is missing" };
  }
  if (typeof task.id !== "string" || task.id.trim() === "") {
    return { ok: false, code: TASK_ERROR_CODE.INVALID_FIELD, field: "id", message: "task.id must be a non-empty string" };
  }
  if (task.dependsOn !== undefined) {
    if (!Array.isArray(task.dependsOn)) {
      return { ok: false, code: TASK_ERROR_CODE.INVALID_FIELD, field: "dependsOn", message: "task.dependsOn must be an array when provided" };
    }
    for (let i = 0; i < task.dependsOn.length; i++) {
      if (typeof task.dependsOn[i] !== "string" || task.dependsOn[i].trim() === "") {
        return { ok: false, code: TASK_ERROR_CODE.INVALID_FIELD, field: `dependsOn[${i}]`, message: `dependsOn[${i}] must be a non-empty string` };
      }
    }
  }
  if (task.filesInScope !== undefined) {
    if (!Array.isArray(task.filesInScope)) {
      return { ok: false, code: TASK_ERROR_CODE.INVALID_FIELD, field: "filesInScope", message: "task.filesInScope must be an array when provided" };
    }
    for (let i = 0; i < task.filesInScope.length; i++) {
      if (typeof task.filesInScope[i] !== "string") {
        return { ok: false, code: TASK_ERROR_CODE.INVALID_FIELD, field: `filesInScope[${i}]`, message: `filesInScope[${i}] must be a string` };
      }
    }
  }
  return { ok: true, code: null, message: "valid" };
}

// ── Cycle detection ───────────────────────────────────────────────────────────

/**
 * Detect cycles in the explicit dependency graph using iterative DFS
 * (white/gray/black coloring).
 *
 * @param {Map<string, string[]>} dependsOnMap - taskId → [dependency IDs]
 * @param {string[]} taskIds
 * @returns {string[][]} - array of cycle paths; empty if no cycles
 */
function detectCycles(dependsOnMap, taskIds) {
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map(taskIds.map((id) => [id, WHITE]));
  const cycles = [];

  for (const startId of taskIds) {
    if (color.get(startId) !== WHITE) continue;

    // Iterative DFS with explicit stack
    const stack = [{ id: startId, path: [startId], depIndex: 0 }];
    color.set(startId, GRAY);

    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      const deps = dependsOnMap.get(frame.id) || [];

      if (frame.depIndex >= deps.length) {
        color.set(frame.id, BLACK);
        stack.pop();
        continue;
      }

      const depId = deps[frame.depIndex];
      frame.depIndex++;

      if (!color.has(depId)) {
        // Dependency references a task not in the input set — skip
        continue;
      }

      if (color.get(depId) === GRAY) {
        // Back edge → cycle found
        const cycleStart = frame.path.indexOf(depId);
        if (cycleStart >= 0) {
          cycles.push([...frame.path.slice(cycleStart), depId]);
        } else {
          cycles.push([...frame.path, depId]);
        }
        // Continue scanning for additional cycles
        continue;
      }

      if (color.get(depId) === WHITE) {
        color.set(depId, GRAY);
        stack.push({ id: depId, path: [...frame.path, depId], depIndex: 0 });
      }
    }
  }

  return cycles;
}

// ── Conflict detection ────────────────────────────────────────────────────────

/**
 * Detect all conflicting task pairs by comparing normalized filesInScope.
 * Two tasks conflict when they share at least one file path.
 *
 * @param {{ id: string, filesInScope: string[] }[]} tasks
 * @returns {{ taskA: string, taskB: string, reason: string, sharedFiles: string[] }[]}
 */
function detectConflicts(tasks) {
  const conflicts = [];

  for (let i = 0; i < tasks.length; i++) {
    const a = tasks[i];
    const aFiles = new Set((a.filesInScope || []).map(normalizeFilePath).filter(Boolean));
    if (aFiles.size === 0) continue;

    for (let j = i + 1; j < tasks.length; j++) {
      const b = tasks[j];
      const bFiles = (b.filesInScope || []).map(normalizeFilePath).filter(Boolean);
      const shared = bFiles.filter((f) => aFiles.has(f));

      if (shared.length > 0) {
        conflicts.push({
          taskA: a.id,
          taskB: b.id,
          reason: CONFLICT_REASON.OVERLAPPING_FILES_IN_SCOPE,
          sharedFiles: shared,
        });
      }
    }
  }

  return conflicts;
}

// ── Wave assignment ───────────────────────────────────────────────────────────

/**
 * Assign execution waves to tasks respecting:
 *   1. Explicit dependency ordering (task after all its dependsOn tasks)
 *   2. Conflict serialization (conflicting tasks must not share a wave)
 *
 * Algorithm: iterative relaxation (Bellman-Ford style).
 * Each iteration either propagates a dependency constraint or bumps a conflict.
 * Terminates when neither changes anything. Bounded by O(n^2) iterations.
 *
 * @param {string[]} taskIds
 * @param {Map<string, string[]>} dependsOnMap  - taskId → [dependency IDs]
 * @param {{ taskA: string, taskB: string, sharedFiles: string[] }[]} conflicts
 * @returns {Map<string, number>} - taskId → wave number (1-indexed)
 */
function assignWaves(taskIds, dependsOnMap, conflicts) {
  const waveOf = new Map(taskIds.map((id) => [id, 1]));

  let changed = true;
  while (changed) {
    changed = false;

    // Phase A: propagate explicit dependency constraints
    for (const id of taskIds) {
      const deps = dependsOnMap.get(id) || [];
      for (const depId of deps) {
        if (!waveOf.has(depId)) continue;
        const required = ((waveOf.get(depId) as number) ?? 0) + 1;
        if (required > ((waveOf.get(id) as number) ?? 1)) {
          waveOf.set(id, required);
          changed = true;
        }
      }
    }

    // Phase B: apply one conflict bump (restart after each bump for correctness)
    for (const conflict of conflicts) {
      const wA = waveOf.get(conflict.taskA);
      const wB = waveOf.get(conflict.taskB);
      if (wA === wB) {
        // Deterministic tie-break: bump the lexicographically larger ID
        const toBump = conflict.taskA < conflict.taskB ? conflict.taskB : conflict.taskA;
        waveOf.set(toBump, (wA as number) + 1);
        changed = true;
        break; // Restart so dependency propagation runs again
      }
    }
  }

  return waveOf;
}

// ── Gate computation ──────────────────────────────────────────────────────────

/**
 * Build gate entries for each task with wave > 1.
 * Gates are grouped per wave (the set of prerequisites for a wave to start).
 *
 * @param {string[]} taskIds
 * @param {Map<string, number>} waveOf
 * @param {Map<string, string[]>} dependsOnMap
 * @param {{ taskA: string, taskB: string, sharedFiles: string[] }[]} conflicts
 * @returns {Map<string, { afterTaskId: string, reason: string, sharedFiles: string[] }[]>}
 *   taskId → gates that must clear before this task runs
 */
function computeTaskGates(taskIds, waveOf, dependsOnMap, conflicts) {
  const taskGates = new Map(taskIds.map((id) => [id, []]));

  // Explicit dependency gates
  for (const id of taskIds) {
    const deps = dependsOnMap.get(id) || [];
    for (const depId of deps) {
      if (!waveOf.has(depId)) continue;
      (taskGates.get(id) as any)!.push({
        afterTaskId: depId,
        reason: GATE_REASON.EXPLICIT_DEPENDENCY,
        sharedFiles: [],
      });
    }
  }

  // Conflict-induced serialization gates
  for (const conflict of conflicts) {
    const wA = waveOf.get(conflict.taskA) ?? 1;
    const wB = waveOf.get(conflict.taskB) ?? 1;

    if (wA < wB) {
      (taskGates.get(conflict.taskB) as any)!.push({
        afterTaskId: conflict.taskA,
        reason: GATE_REASON.FILE_CONFLICT,
        sharedFiles: conflict.sharedFiles,
      });
    } else if (wB < wA) {
      (taskGates.get(conflict.taskA) as any)!.push({
        afterTaskId: conflict.taskB,
        reason: GATE_REASON.FILE_CONFLICT,
        sharedFiles: conflict.sharedFiles,
      });
    }
    // If same wave after resolution that's a bug, but we treat it as no gate needed
  }

  return taskGates;
}

// ── Main resolver ─────────────────────────────────────────────────────────────

/**
 * Resolve the dependency graph for a set of task descriptors.
 *
 * Validates DAG constraints, detects conflicts, assigns parallel waves, and
 * produces explicit gates. Returns a fully specified GraphResolution object.
 *
 * @param {any} tasks - Array of GraphTask descriptors
 * @returns {GraphResolution} - Always returns a valid object; never throws.
 */
export function resolveDependencyGraph(tasks) {
  const resolvedAt = new Date().toISOString();

  // ── Input validation: missing ──────────────────────────────────────────────
  if (tasks === null || tasks === undefined) {
    return {
      schemaVersion: GRAPH_DIAGNOSTICS_SCHEMA_VERSION,
      resolvedAt,
      status: GRAPH_STATUS.INVALID_INPUT,
      reasonCode: GRAPH_REASON.MISSING_INPUT,
      waves: [],
      conflictPairs: [],
      cycles: [],
      totalTasks: 0,
      parallelTasks: 0,
      serializedTasks: 0,
      errorMessage: "tasks is required (got null/undefined)",
    };
  }

  // ── Input validation: wrong type ───────────────────────────────────────────
  if (!Array.isArray(tasks)) {
    return {
      schemaVersion: GRAPH_DIAGNOSTICS_SCHEMA_VERSION,
      resolvedAt,
      status: GRAPH_STATUS.INVALID_INPUT,
      reasonCode: GRAPH_REASON.INVALID_INPUT,
      waves: [],
      conflictPairs: [],
      cycles: [],
      totalTasks: 0,
      parallelTasks: 0,
      serializedTasks: 0,
      errorMessage: `tasks must be an array; got ${typeof tasks}`,
    };
  }

  // ── Empty input ────────────────────────────────────────────────────────────
  if (tasks.length === 0) {
    return {
      schemaVersion: GRAPH_DIAGNOSTICS_SCHEMA_VERSION,
      resolvedAt,
      status: GRAPH_STATUS.OK,
      reasonCode: GRAPH_REASON.EMPTY_INPUT,
      waves: [],
      conflictPairs: [],
      cycles: [],
      totalTasks: 0,
      parallelTasks: 0,
      serializedTasks: 0,
      errorMessage: null,
    };
  }

  // ── Validate each task entry ───────────────────────────────────────────────
  for (let i = 0; i < tasks.length; i++) {
    const validation = validateGraphTask(tasks[i]);
    if (!validation.ok) {
      return {
        schemaVersion: GRAPH_DIAGNOSTICS_SCHEMA_VERSION,
        resolvedAt,
        status: GRAPH_STATUS.INVALID_INPUT,
        reasonCode: GRAPH_REASON.INVALID_INPUT,
        waves: [],
        conflictPairs: [],
        cycles: [],
        totalTasks: tasks.length,
        parallelTasks: 0,
        serializedTasks: 0,
        errorMessage: `tasks[${i}]: ${validation.message} (code=${validation.code})`,
      };
    }
  }

  // ── Check for duplicate IDs ────────────────────────────────────────────────
  const seenIds = new Set();
  for (const task of tasks) {
    if (seenIds.has(task.id)) {
      return {
        schemaVersion: GRAPH_DIAGNOSTICS_SCHEMA_VERSION,
        resolvedAt,
        status: GRAPH_STATUS.INVALID_INPUT,
        reasonCode: GRAPH_REASON.INVALID_INPUT,
        waves: [],
        conflictPairs: [],
        cycles: [],
        totalTasks: tasks.length,
        parallelTasks: 0,
        serializedTasks: 0,
        errorMessage: `duplicate task id: '${task.id}'`,
      };
    }
    seenIds.add(task.id);
  }

  const taskIds = tasks.map((t) => t.id);
  const dependsOnMap = new Map(tasks.map((t) => [t.id, (t.dependsOn || []).map(String)]));

  // ── DAG validation: cycle detection ───────────────────────────────────────
  const cycles = detectCycles(dependsOnMap, taskIds);
  if (cycles.length > 0) {
    return {
      schemaVersion: GRAPH_DIAGNOSTICS_SCHEMA_VERSION,
      resolvedAt,
      status: GRAPH_STATUS.CYCLE_DETECTED,
      reasonCode: GRAPH_REASON.CYCLE_DETECTED,
      waves: [],
      conflictPairs: [],
      cycles,
      totalTasks: tasks.length,
      parallelTasks: 0,
      serializedTasks: 0,
      errorMessage: `dependency graph contains ${cycles.length} cycle(s): ${cycles.map((c) => c.join(" → ")).join("; ")}`,
    };
  }

  // ── Conflict detection ─────────────────────────────────────────────────────
  const conflictPairs = detectConflicts(tasks);

  // ── Wave assignment ────────────────────────────────────────────────────────
  const waveOf = assignWaves(taskIds, dependsOnMap, conflictPairs);

  // ── Gate computation ───────────────────────────────────────────────────────
  const taskGates = computeTaskGates(taskIds, waveOf, dependsOnMap, conflictPairs);

  // ── Build wave groups ──────────────────────────────────────────────────────
  const maxWave = Math.max(...(waveOf.values() as any));
  const waveGroups = [];
  for (let w = 1; w <= maxWave; w++) {
    const taskIdsInWave = taskIds.filter((id) => waveOf.get(id) === w);
    if (taskIdsInWave.length === 0) continue;

    // Collect all gates for tasks in this wave (deduplicated by afterTaskId+reason)
    const gateSet = new Map();
    for (const id of taskIdsInWave) {
      for (const gate of ((taskGates.get(id) || []) as any[])) {
        const key = `${gate.afterTaskId}::${gate.reason}`;
        if (!gateSet.has(key)) {
          gateSet.set(key, gate);
        }
      }
    }

    waveGroups.push({
      wave: w,
      taskIds: taskIdsInWave,
      gates: Array.from(gateSet.values()),
    });
  }

  // ── Parallelism statistics ─────────────────────────────────────────────────
  const waveSizes = waveGroups.map((w) => w.taskIds.length);
  const parallelTasks = waveSizes.filter((s) => s > 1).reduce((sum, s) => sum + s, 0);
  const serializedTasks = tasks.length - parallelTasks;

  return {
    schemaVersion: GRAPH_DIAGNOSTICS_SCHEMA_VERSION,
    resolvedAt,
    status: GRAPH_STATUS.OK,
    reasonCode: GRAPH_REASON.VALID,
    waves: waveGroups,
    conflictPairs,
    cycles: [],
    totalTasks: tasks.length,
    parallelTasks,
    serializedTasks,
    errorMessage: null,
  };
}

// ── Readiness gate ────────────────────────────────────────────────────────────

/**
 * Confidence dimension field names expected on each graph task.
 * Plans produced by Prometheus may carry any or all of these fields.
 * Presence of a dimension with a numeric value opts that task into readiness checking.
 */
export const READINESS_CONFIDENCE_DIMENSION = Object.freeze({
  SHAPE:       "shapeConfidence",
  BUDGET:      "budgetConfidence",
  DEPENDENCY:  "dependencyConfidence",
} as const);

/**
 * Default minimum confidence value required for a task dimension to be considered
 * "ready" for dispatch.  Values below this threshold cause the readiness gate to block.
 * Configurable via options.minConfidence passed to computeReadinessGate.
 */
export const READINESS_CONFIDENCE_THRESHOLD_DEFAULT = 0.5;

/**
 * Status codes for ReadinessGateResult.
 */
export const READINESS_STATUS = Object.freeze({
  /** All tasks with confidence metadata meet the minimum threshold. */
  READY:         "ready",
  /** One or more tasks have confidence below threshold or carry invalid values. */
  INCOMPLETE:    "incomplete",
  /** The tasks input itself was invalid (not an array). */
  INVALID_INPUT: "invalid_input",
} as const);

/**
 * Reason codes for ReadinessGateResult.
 */
export const READINESS_REASON = Object.freeze({
  /** Gate passed — all tasks are ready for dispatch. */
  READY:              "READY",
  /** One or more tasks carry a confidence dimension with a non-numeric (invalid) value. */
  MISSING_CONFIDENCE: "MISSING_CONFIDENCE",
  /** One or more tasks have a confidence dimension below the minimum threshold. */
  BELOW_THRESHOLD:    "BELOW_THRESHOLD",
  /** Tasks input was not an array. */
  INVALID_INPUT:      "INVALID_INPUT",
} as const);

/** Typed result produced by computeReadinessGate. */
export interface ReadinessGateResult {
  /** True when all tasks with confidence metadata meet the minimum threshold. */
  ready: boolean;
  /** One of READINESS_STATUS values. */
  status: string;
  /** One of READINESS_REASON values. */
  reason: string;
  /** Dimension names that carried non-numeric (invalid) confidence values. */
  missingDimensions: string[];
  /** Tasks whose numeric confidence values are below the threshold. */
  belowThresholdTasks: Array<{ id: string; dimension: string; value: number; threshold: number }>;
  /** Number of tasks evaluated. */
  checkedTasks: number;
}

/**
 * Evaluate whether all tasks in a plan set have valid and sufficient confidence
 * metadata for dispatch.
 *
 * Confidence dimensions checked (all optional per-task):
 *   shapeConfidence      — confidence in the task's scope/shape definition
 *   budgetConfidence     — confidence in the effort/budget estimate
 *   dependencyConfidence — confidence in the dependency ordering
 *
 * Blocking rules:
 *   - A dimension is present with a NON-numeric value → reason=MISSING_CONFIDENCE
 *   - A dimension is present with a numeric value BELOW minConfidence → reason=BELOW_THRESHOLD
 *   - A dimension is ABSENT from a task → no constraint (opt-in metric; absence is allowed)
 *
 * The gate is fail-open for tasks that simply don't carry confidence fields.
 * It only blocks when confidence is explicitly declared but invalid or insufficient.
 *
 * @param tasks   — array of graph task descriptors (must have `id` string field)
 * @param options — optional { minConfidence: number } (default 0.5)
 * @returns ReadinessGateResult — never throws
 */
export function computeReadinessGate(
  tasks: any[],
  options?: { minConfidence?: number }
): ReadinessGateResult {
  if (!Array.isArray(tasks)) {
    return {
      ready: false,
      status: READINESS_STATUS.INVALID_INPUT,
      reason: READINESS_REASON.INVALID_INPUT,
      missingDimensions: [],
      belowThresholdTasks: [],
      checkedTasks: 0,
    };
  }

  if (tasks.length === 0) {
    return {
      ready: true,
      status: READINESS_STATUS.READY,
      reason: READINESS_REASON.READY,
      missingDimensions: [],
      belowThresholdTasks: [],
      checkedTasks: 0,
    };
  }

  const minConfidence =
    typeof options?.minConfidence === "number" && options.minConfidence >= 0
      ? options.minConfidence
      : READINESS_CONFIDENCE_THRESHOLD_DEFAULT;

  const dimensions = Object.values(READINESS_CONFIDENCE_DIMENSION);
  const missingDimensionSet = new Set<string>();
  const belowThresholdTasks: Array<{ id: string; dimension: string; value: number; threshold: number }> = [];

  for (const task of tasks) {
    const id = String(task?.id || "");
    for (const dim of dimensions) {
      const value = (task as any)?.[dim];
      // Absent dimension → opt-in, skip (no constraint)
      if (value === undefined || value === null) continue;

      const numValue = Number(value);
      if (!Number.isFinite(numValue)) {
        // Present but not a valid number → missing/corrupt confidence data
        missingDimensionSet.add(dim);
        continue;
      }

      if (numValue < minConfidence) {
        belowThresholdTasks.push({ id, dimension: dim, value: numValue, threshold: minConfidence });
      }
    }
  }

  if (missingDimensionSet.size > 0) {
    return {
      ready: false,
      status: READINESS_STATUS.INCOMPLETE,
      reason: READINESS_REASON.MISSING_CONFIDENCE,
      missingDimensions: Array.from(missingDimensionSet),
      belowThresholdTasks,
      checkedTasks: tasks.length,
    };
  }

  if (belowThresholdTasks.length > 0) {
    const dims = [...new Set(belowThresholdTasks.map(t => t.dimension))];
    return {
      ready: false,
      status: READINESS_STATUS.INCOMPLETE,
      reason: READINESS_REASON.BELOW_THRESHOLD,
      missingDimensions: dims,
      belowThresholdTasks,
      checkedTasks: tasks.length,
    };
  }

  return {
    ready: true,
    status: READINESS_STATUS.READY,
    reason: READINESS_REASON.READY,
    missingDimensions: [],
    belowThresholdTasks: [],
    checkedTasks: tasks.length,
  };
}

// ── Persistence (AC5) ─────────────────────────────────────────────────────────

/**
 * Persist a GraphResolution diagnostic entry to:
 *   <stateDir>/dependency_graph_diagnostics.json  (NDJSON append log)
 *
 * The file grows one line per invocation. Callers should wrap this in a
 * try/catch — persistence failures must never block orchestration.
 *
 * @param {string} stateDir - absolute or repo-relative path to state directory
 * @param {object} resolution - result from resolveDependencyGraph
 * @param {object} [meta] - optional metadata (correlationId, etc.)
 * @returns {Promise<void>}
 */
export async function persistGraphDiagnostics(stateDir, resolution, meta: any = {}) {
  const diagnosticsPath = path.join(stateDir, "dependency_graph_diagnostics.json");
  const entry = JSON.stringify({
    schemaVersion: GRAPH_DIAGNOSTICS_SCHEMA_VERSION,
    persistedAt: new Date().toISOString(),
    ...meta,
    status: resolution.status,
    reasonCode: resolution.reasonCode,
    resolvedAt: resolution.resolvedAt,
    totalTasks: resolution.totalTasks,
    parallelTasks: resolution.parallelTasks,
    serializedTasks: resolution.serializedTasks,
    waveCount: Array.isArray(resolution.waves) ? resolution.waves.length : 0,
    conflictCount: Array.isArray(resolution.conflictPairs) ? resolution.conflictPairs.length : 0,
    cycleCount: Array.isArray(resolution.cycles) ? resolution.cycles.length : 0,
    errorMessage: resolution.errorMessage ?? null,
    waves: resolution.waves,
    conflictPairs: resolution.conflictPairs,
    cycles: resolution.cycles,
  });

  await fs.appendFile(diagnosticsPath, entry + "\n", "utf8");
}

```

### FILE: src/core/prompt_compiler.ts
```typescript
/**
 * prompt_compiler.js — Assembles agent prompts from reusable sections.
 *
 * Instead of monolithic prompt strings scattered across modules, this compiler
 * builds prompts from named sections that can be shared, tested, and versioned.
 *
 * Usage:
 *   const prompt = compilePrompt([
 *     section("role", "You are Athena — BOX Quality Gate."),
 *     section("context", `TARGET REPO: ${repo}`),
 *     section("mission", missionText),
 *     section("format", outputFormat),
 *   ]);
 */

/**
 * Budget partition labels for prompt sections.
 *
 * Partitions define how sections are treated under global token-budget pressure:
 *
 *   INVARIANT  — Always included in full. Never trimmed by section-level maxTokens
 *                or dropped by global budget. Use for core identity sections (role,
 *                output format, evolution directive) that must survive any token pressure.
 *
 *   REQUIRED   — Always included. Section-level maxTokens truncation applies, but the
 *                section is never dropped regardless of the global budget. Use for
 *                cycle-delta sections (carry-forward, behavior patterns, research)
 *                that must be present but whose token cost can be capped.
 *
 *   EXPANDABLE — Fill remaining budget after invariant + required sections have been
 *                allocated. Dropped in order when budget is exhausted. Use for large
 *                optional context (repo file listing, drift reports, repair feedback)
 *                that enrich the prompt but are not critical to correctness.
 *
 * Backward compatibility: sections with `required: true` and no explicit
 * `partitionBudget` are treated as REQUIRED. Sections without either field
 * are treated as EXPANDABLE.
 */
export const PROMPT_BUDGET_PARTITION = Object.freeze({
  INVARIANT:  "invariant"  as const,
  REQUIRED:   "required"   as const,
  EXPANDABLE: "expandable" as const,
});

export type PromptBudgetPartition = "invariant" | "required" | "expandable";

/**
 * Resolve the effective budget partition for a section.
 * Checks `partitionBudget` first, then falls back to `required: true` → REQUIRED,
 * and the absence of either → EXPANDABLE.
 */
function resolvePartition(s: {
  partitionBudget?: string;
  required?: boolean;
}): PromptBudgetPartition {
  if (s.partitionBudget === PROMPT_BUDGET_PARTITION.INVARIANT)  return PROMPT_BUDGET_PARTITION.INVARIANT;
  if (s.partitionBudget === PROMPT_BUDGET_PARTITION.REQUIRED)   return PROMPT_BUDGET_PARTITION.REQUIRED;
  if (s.partitionBudget === PROMPT_BUDGET_PARTITION.EXPANDABLE) return PROMPT_BUDGET_PARTITION.EXPANDABLE;
  if (s.required === true) return PROMPT_BUDGET_PARTITION.REQUIRED;
  return PROMPT_BUDGET_PARTITION.EXPANDABLE;
}

/**
 * Create a named prompt section.
 *
 * @param {string} name — section identifier for debugging/tracing
 * @param {string} content — the text content of this section
 * @returns {{ name: string, content: string }}
 */
export function section(name, content) {
  return { name, content: String(content || "").trim() };
}

/**
 * Compile an array of prompt sections into a single prompt string.
 * Empty sections are omitted. Each section is separated by a double newline.
 *
 * With section-level caps: each section can have a maxTokens limit.
 * If a section exceeds its cap, it is truncated from the end.
 * Invariant sections bypass section-level caps and are never truncated.
 *
 * Three-pass budget trimming (when tokenBudget > 0):
 *   Pass 1 — INVARIANT: included in full, never trimmed.
 *   Pass 2 — REQUIRED:  included after per-section maxTokens truncation, never dropped.
 *   Pass 3 — EXPANDABLE: fill remaining budget in original order; dropped when exhausted.
 *
 * Backward compatibility: sections with `required: true` and no explicit
 * `partitionBudget` are treated as REQUIRED. Sections without either field
 * are treated as EXPANDABLE.
 *
 * @param {Array<{ name: string, content: string, maxTokens?: number, required?: boolean, partitionBudget?: PromptBudgetPartition }>} sections
 * @param {{ separator?: string, includeHeaders?: boolean, tokenBudget?: number }} opts
 * @returns {string}
 */
export function compilePrompt(sections, opts: any = {}) {
  const sep = opts.separator || "\n\n";
  const includeHeaders = opts.includeHeaders || false;
  const budget = opts.tokenBudget || 0;

  // Pair each non-empty section with its original index for stable ordering
  const tagged = sections
    .map((s, idx) => ({ s, idx }))
    .filter(({ s }) => s && s.content && s.content.length > 0)
    .map(({ s, idx }) => {
      const partition = resolvePartition(s);
      let content = s.content;
      // Section-level cap: truncate if section exceeds its own maxTokens.
      // Invariant sections bypass this cap — their content is always used in full.
      if (partition !== PROMPT_BUDGET_PARTITION.INVARIANT && s.maxTokens && s.maxTokens > 0) {
        const sectionTokens = estimateTokens(content);
        if (sectionTokens > s.maxTokens) {
          const maxChars = s.maxTokens * 4;
          content = content.slice(0, maxChars) + "\n[...truncated to section budget]";
        }
      }
      const piece = includeHeaders ? `## ${s.name}\n${content}` : content;
      return { piece, idx, required: s.required === true, partition };
    });

  let pieces: string[];

  // If a global token budget is specified, enforce three-pass deterministic trimming.
  if (budget > 0) {
    const invariantItems  = tagged.filter(t => t.partition === PROMPT_BUDGET_PARTITION.INVARIANT);
    const requiredItems   = tagged.filter(t => t.partition === PROMPT_BUDGET_PARTITION.REQUIRED);
    const expandableItems = tagged.filter(t => t.partition === PROMPT_BUDGET_PARTITION.EXPANDABLE);

    // Deduct invariant + required token cost unconditionally
    const invariantTokens = invariantItems.reduce((sum, t) => sum + estimateTokens(t.piece), 0);
    const requiredTokens  = requiredItems.reduce((sum, t)  => sum + estimateTokens(t.piece), 0);
    let remainingBudget = budget - invariantTokens - requiredTokens;

    // Fill remaining budget with expandable sections in original order
    const keptExpandable: typeof tagged = [];
    for (const item of expandableItems) {
      const t = estimateTokens(item.piece);
      if (remainingBudget - t < 0) break;
      keptExpandable.push(item);
      remainingBudget -= t;
    }

    // Merge all three partitions, preserving original section order
    pieces = [...invariantItems, ...requiredItems, ...keptExpandable]
      .sort((a, b) => a.idx - b.idx)
      .map(t => t.piece);
  } else {
    pieces = tagged.map(t => t.piece);
  }

  return pieces.join(sep);
}

/**
 * Common reusable sections.
 */
export const COMMON_SECTIONS = Object.freeze({
  singlePromptMode: section(
    "single-prompt-mode",
    "EXECUTION MODE: Single-prompt, single-turn. You get ONE shot — no follow-ups, no continues. Make it count."
  ),
  jsonOutputMarkers: section(
    "json-output-markers",
    "Wrap your structured JSON output with:\n===DECISION===\n{ ... }\n===END==="
  ),
  noVagueGoals: section(
    "no-vague-goals",
    "Every goal must be measurable and specific. Do NOT use vague verbs like 'improve', 'optimize', or 'enhance' without a concrete metric."
  ),
  leverageRankedAlternatives: section(
    "leverage-ranked-alternatives",
    [
      "LEVERAGE-RANKED ALTERNATIVES (required for every proposed change):",
      "For each improvement you propose, provide at least 2 concrete alternatives ranked by leverage",
      "(capacity increase per unit effort). State which you recommend and why.",
      "Format each alternative as: [RANK N] <approach> — leverage: <high|medium|low> — rationale: <why>.",
      "Do NOT propose only a single approach. The highest-leverage option must address the system bottleneck directly.",
      "Alternatives that merely re-order existing behavior without measurable capacity gain are NOT valid."
    ].join("\n")
  ),
});

/**
 * Estimate token count for a text string.
 * Uses the ~4 chars per token heuristic (accurate ±10% for English/code).
 *
 * @param {string} text
 * @returns {number}
 */
export function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(String(text).length / 4);
}

/**
 * Estimate per-section and total token usage for an array of sections.
 *
 * @param {Array<{ name: string, content: string }>} sections
 * @returns {{ total: number, sections: Array<{ name: string, tokens: number }> }}
 */
export function estimatePromptTokens(sections) {
  const result = [];
  let total = 0;
  for (const s of (sections || [])) {
    if (!s || !s.content) continue;
    const t = estimateTokens(s.content);
    result.push({ name: s.name, tokens: t });
    total += t;
  }
  return { total, sections: result };
}

// ─── Packet 18 — Prompt Compiler Tiering by Task Complexity ────────────

/**
 * Complexity tiers matching model_policy.js classifications.
 * Each tier defines: max total tokens, section budgets, and anti-fluff strictness.
 */
export const PROMPT_TIERS = Object.freeze({
  T1: { label: "trivial", maxTokens: 800, antiFluff: false },
  T2: { label: "moderate", maxTokens: 2000, antiFluff: true },
  T3: { label: "complex", maxTokens: 4000, antiFluff: true },
});

/**
 * Vague verbs that add no measurable value to prompts.
 * Used by the anti-fluff filter in T2/T3 prompts.
 */
const FLUFF_PATTERNS = [
  /\b(significantly|drastically|greatly|massively)\s+(improve|enhance|optimize|boost)\b/gi,
  /\bstrive\s+to\b/gi,
  /\bas\s+(?:much|needed|appropriate)\s+as\s+possible\b/gi,
  /\btry\s+(?:to\s+)?(?:improve|enhance|optimize)\b/gi,
];

/**
 * Strip anti-fluff patterns from text.
 * Replaces vague verb phrases with empty string and collapses whitespace.
 *
 * @param {string} text
 * @returns {string}
 */
export function stripFluff(text) {
  if (!text) return "";
  let cleaned = text;
  for (const pat of FLUFF_PATTERNS) {
    cleaned = cleaned.replace(pat, "");
  }
  return cleaned.replace(/\s{2,}/g, " ").trim();
}

/**
 * Compile a tiered prompt — applies complexity-based token budget and anti-fluff.
 *
 * @param {Array<{ name: string, content: string, maxTokens?: number }>} sections
 * @param {{ tier?: "T1"|"T2"|"T3", separator?: string, includeHeaders?: boolean }} opts
 * @returns {string}
 */
export function compileTieredPrompt(sections, opts: any = {}) {
  const tier = PROMPT_TIERS[opts.tier] || PROMPT_TIERS.T2;

  let processed = sections;
  if (tier.antiFluff) {
    // Preserve all section properties (including `required`) when stripping fluff
    processed = sections.map(s => ({
      ...s,
      content: stripFluff(s.content),
    }));
  }

  return compilePrompt(processed, {
    separator: opts.separator,
    includeHeaders: opts.includeHeaders,
    tokenBudget: tier.maxTokens,
  });
}

// ─── Actionable Packet Contract Validation ──────────────────────────────────

/**
 * Required output-contract terms for actionable packet prompts.
 *
 * Every prompt that instructs an AI to produce an actionable packet (a structured
 * response consumed by the dispatch pipeline) MUST reference these terms in the
 * output format section so the AI knows which fields to populate.
 *
 * Absence of any term from the compiled prompt is a completeness gap — the AI
 * may omit that field entirely, causing downstream failures in plan review,
 * normalization, and dispatch.
 *
 * Terms are checked case-insensitively against the full compiled section content.
 */
export const ACTIONABLE_PACKET_CONTRACT_TERMS = Object.freeze([
  "approved",
  "patchedPlans",
  "planReviews",
  "acceptance_criteria",
  "verification",
]);

/**
 * Status codes returned by validateActionablePacketCompleteness.
 *
 * @enum {string}
 */
export const COMPLETENESS_STATUS = Object.freeze({
  /** All required contract terms are present in the sections. */
  COMPLETE: "complete",
  /** One or more required contract terms are absent from the sections. */
  INCOMPLETE: "incomplete",
});

/**
 * Validate that a compiled set of prompt sections provides adequate coverage for
 * an actionable packet response. Checks whether all required contract terms appear
 * in the combined section content so the AI knows which output fields to populate.
 *
 * Terms are checked case-insensitively. A section must have non-empty content to
 * contribute to coverage — empty sections are skipped.
 *
 * @param {Array<{ name: string, content: string }>} sections
 * @returns {{ status: string, complete: boolean, completenessScore: number, missingTerms: string[] }}
 */
export function validateActionablePacketCompleteness(sections) {
  const combinedContent = (sections || [])
    .filter(s => s && typeof s.content === "string" && s.content.trim().length > 0)
    .map(s => s.content)
    .join(" ")
    .toLowerCase();

  const missingTerms = (ACTIONABLE_PACKET_CONTRACT_TERMS as readonly string[]).filter(
    term => !combinedContent.includes(term.toLowerCase())
  );

  const presentCount = ACTIONABLE_PACKET_CONTRACT_TERMS.length - missingTerms.length;
  const completenessScore = ACTIONABLE_PACKET_CONTRACT_TERMS.length > 0
    ? Math.round((presentCount / ACTIONABLE_PACKET_CONTRACT_TERMS.length) * 10000) / 10000
    : 1.0;

  const complete = missingTerms.length === 0;
  return {
    status: complete ? COMPLETENESS_STATUS.COMPLETE : COMPLETENESS_STATUS.INCOMPLETE,
    complete,
    completenessScore,
    missingTerms,
  };
}

// ─── Packet — Cache-eligible segment marking ──────────────────────────────────

/**
 * Section names that are structurally stable across calls — suitable for
 * prompt-caching layers that avoid re-tokenising unchanged prefixes.
 *
 * Dynamic sections (task context, plan details, per-call data) must NOT appear
 * here; only content that is effectively constant for a given system/model build.
 */
export const CACHE_STABLE_SECTION_NAMES: ReadonlySet<string> = new Set([
  "role",
  "system",
  "instructions",
  "single-prompt-mode",
  "json-output-markers",
  "no-vague-goals",
  "leverage-ranked-alternatives",
]);

/**
 * Mark prompt sections as cache-eligible based on naming heuristics.
 *
 * A section is marked `cacheable: true` when:
 *   (a) its name is in CACHE_STABLE_SECTION_NAMES, or
 *   (b) `opts.stableNames` includes its name, or
 *   (c) the section already carries `cacheable: true`.
 *
 * Sections that vary per-call (task context, plan details) are left
 * `cacheable: false` so callers know not to include them in a cached prefix.
 *
 * Original section objects are never mutated — a new array is returned.
 *
 * @param sections - prompt sections to process
 * @param opts     - optional additional stable names to treat as cacheable
 * @returns new array with `cacheable` field set on every element
 */
export function markCacheableSegments(
  sections: Array<{ name: string; content: string; cacheable?: boolean; [key: string]: any }>,
  opts: { stableNames?: string[] } = {}
): Array<{ name: string; content: string; cacheable: boolean; [key: string]: any }> {
  const extra = new Set((opts.stableNames || []).map(n => String(n).toLowerCase()));
  return (sections || []).map(s => {
    const name = String(s?.name || "").toLowerCase();
    const isStable = CACHE_STABLE_SECTION_NAMES.has(name) || extra.has(name) || s?.cacheable === true;
    return { ...s, cacheable: isStable };
  });
}

/**
 * Mark sections whose names appear in a cycle-delta name set as `required: true`
 * and `partitionBudget: PROMPT_BUDGET_PARTITION.REQUIRED`, guaranteeing they
 * survive token-budget trimming in compilePrompt.
 *
 * Cycle-delta sections carry per-cycle reasoning context (research intelligence,
 * topic memory, carry-forward state) that must not be dropped under token pressure
 * — unlike large static context that can be safely truncated.
 *
 * Original section objects are never mutated — a new array is returned.
 * Sections not in the cycle-delta set retain their existing `required` field
 * and `partitionBudget` (defaulting to EXPANDABLE via resolvePartition).
 *
 * @param sections       - prompt sections to process
 * @param cycleDeltaNames - set of section names that must be marked required
 * @returns new array with `required: true` and `partitionBudget: "required"` on every cycle-delta section
 */
export function markCycleDeltaSectionsRequired<
  T extends { name: string; content: string; required?: boolean; partitionBudget?: PromptBudgetPartition; [key: string]: any }
>(
  sections: T[],
  cycleDeltaNames: ReadonlySet<string>
): Array<T & { required: boolean; partitionBudget: PromptBudgetPartition }> {
  return (sections || []).map(s => {
    const name = String(s?.name || "").toLowerCase();
    if (cycleDeltaNames.has(name)) {
      return { ...s, required: true, partitionBudget: PROMPT_BUDGET_PARTITION.REQUIRED };
    }
    return {
      ...s,
      required: s?.required === true,
      partitionBudget: (s?.partitionBudget as PromptBudgetPartition | undefined) ?? PROMPT_BUDGET_PARTITION.EXPANDABLE,
    };
  });
}

/**
 * Compile an actionable packet prompt with integrated completeness validation.
 *
 * Wraps compileTieredPrompt and runs validateActionablePacketCompleteness before
 * returning. The caller receives both the compiled prompt string and the completeness
 * result so it can decide whether to proceed or reject the prompt before submission.
 *
 * This is the preferred entry point when building prompts that expect structured
 * actionable packet responses (e.g., Athena plan review, governance decisions).
 *
 * @param {Array<{ name: string, content: string, maxTokens?: number, required?: boolean }>} sections
 * @param {{ tier?: "T1"|"T2"|"T3", separator?: string, includeHeaders?: boolean }} opts
 * @returns {{ prompt: string, completeness: { status, complete, completenessScore, missingTerms } }}
 */
export function compileActionablePacketPrompt(sections, opts: any = {}) {
  const completeness = validateActionablePacketCompleteness(sections);
  const prompt = compileTieredPrompt(sections, opts);
  return { prompt, completeness };
}

```

### FILE: src/core/self_improvement.ts
```typescript
/**
 * Self-Improvement Engine
 *
 * Runs after each complete cycle to analyze outcomes and generate system improvements.
 * NOT deterministic — uses AI to analyze what worked, what failed, and what to change.
 *
 * Responsibilities:
 *   1. Analyze cycle outcomes (worker results, timeouts, PR quality, retries)
 *   2. Generate improvement proposals via AI (prompt tweaks, config adjustments, strategy changes)
 *   3. Store learnings in knowledge memory (state/knowledge_memory.json)
 *   4. Apply safe improvements automatically (config tuning, prompt hints)
 *   5. Flag risky improvements for human review
 *
 * Reads: selfImprovement config from box.config.json
 * Writes: state/knowledge_memory.json, state/improvement_reports.json
 */

import path from "node:path";
import fs from "node:fs/promises";
import { readJson, readJsonSafe, READ_JSON_REASON, writeJson, spawnAsync } from "./fs_utils.js";
import { appendProgress } from "./state_tracker.js";
import { buildAgentArgs, parseAgentOutput } from "./agent_loader.js";
import { chatLog, warn } from "./logger.js";
import { normalizeDecisionQualityLabel, DECISION_QUALITY_LABEL, PREMORTEM_RISK_LEVEL, computeReviewerPrecisionRecall } from "./athena_reviewer.js";
import { extractPostmortemEntries, migrateData, STATE_FILE_TYPE } from "./schema_registry.js";
import { loadRegistry, getRunningExperimentsForPath } from "./experiment_registry.js";
import { getCanaryConfig, startCanary, processRunningCanaries } from "./canary_engine.js";
import { runShadowEvaluation, SHADOW_STATUS } from "./shadow_policy_evaluator.js";
import {
  enforceGovernance,
  recordApprovalEvidence,
  GOVERNANCE_CONTRACT_VERSION
} from "./governance_contract.js";
import {
  evaluateFreezeGate,
  FREEZE_GATE_RESULT
} from "./governance_freeze.js";
import { isGuardrailActive } from "./guardrail_executor.js";
import { GUARDRAIL_ACTION } from "./catastrophe_detector.js";
import {
  loadLedgerMeta,
  prioritizeStaleDebts,
} from "./carry_forward_ledger.js";

// ── Decision Quality Weights ──────────────────────────────────────────────────

/**
 * Explicit weights for each decision quality label.
 * Used to compute a weighted quality score from recent postmortems.
 *
 * correct         = 1.0  — plan succeeded exactly as expected
 * delayed-correct = 0.6  — plan succeeded after an extra iteration
 * incorrect       = 0.0  — plan was executed but result was rolled back
 * inconclusive    = 0.3  — outcome was unknown (timeout, missing data)
 */
export const DECISION_QUALITY_WEIGHTS = Object.freeze({
  [DECISION_QUALITY_LABEL.CORRECT]:         1.0,
  [DECISION_QUALITY_LABEL.DELAYED_CORRECT]: 0.6,
  [DECISION_QUALITY_LABEL.INCORRECT]:       0.0,
  [DECISION_QUALITY_LABEL.INCONCLUSIVE]:    0.3
});

/**
 * Compute a weighted decision quality score from an array of postmortem entries.
 * Returns a value in [0, 1] or null if no entries with labels are present.
 *
 * @param {Array<object>} postmortems
 * @returns {{ score: number|null, labelCounts: Record<string, number>, total: number }}
 */
export function computeWeightedDecisionScore(postmortems) {
  if (!Array.isArray(postmortems) || postmortems.length === 0) {
    return { score: null, labelCounts: {}, total: 0 };
  }
  const labelCounts: Record<string, any> = {};
  for (const label of Object.values(DECISION_QUALITY_LABEL)) {
    labelCounts[label] = 0;
  }
  let weightedSum = 0;
  let count = 0;
  for (const pm of postmortems) {
    const label = normalizeDecisionQualityLabel(pm);
    labelCounts[label] = (labelCounts[label] || 0) + 1;
    weightedSum += DECISION_QUALITY_WEIGHTS[label] ?? DECISION_QUALITY_WEIGHTS[DECISION_QUALITY_LABEL.INCONCLUSIVE];
    count++;
  }
  return {
    score: count > 0 ? weightedSum / count : null,
    labelCounts,
    total: count
  };
}

// ── Outcome Degraded Reason Codes ────────────────────────────────────────────

/**
 * Machine-readable reason codes for degraded outcome collection.
 * Returned in the `degradedReason` field of collectCycleOutcomes when `degraded: true`.
 *
 * Distinguishes missing input (ABSENT) from invalid input (INVALID).
 *
 *   PROMETHEUS_ABSENT   — prometheus_analysis.json not found (ENOENT)
 *   PROMETHEUS_INVALID  — prometheus_analysis.json found but fails structure validation
 *   EVOLUTION_ABSENT    — evolution_progress.json not found (ENOENT)
 *   EVOLUTION_INVALID   — evolution_progress.json found but fails structure validation
 *   NO_ACTIVE_DATA      — both prometheus plans and evolution progress are empty
 */
export const OUTCOME_DEGRADED_REASON = Object.freeze({
  PROMETHEUS_ABSENT:  "PROMETHEUS_ABSENT",
  PROMETHEUS_INVALID: "PROMETHEUS_INVALID",
  EVOLUTION_ABSENT:   "EVOLUTION_ABSENT",
  EVOLUTION_INVALID:  "EVOLUTION_INVALID",
  NO_ACTIVE_DATA:     "NO_ACTIVE_DATA"
});

// shouldTriggerSelfImprovement stub removed — real implementation is below

// ── Pre-mortem Quality Scoring ────────────────────────────────────────────────

/**
 * Explicit scoring rubric for pre-mortem quality.
 * Each key maps to its max points and a description of the pass condition.
 * Total max score: 10 points.
 *
 * Rubric:
 *   scenario        (2 pts) — string with >= 20 chars describing what could go wrong
 *   failurePaths    (2 pts) — array with >= 2 discrete failure modes enumerated
 *   mitigations     (2 pts) — array with >= failurePaths.length mitigation strategies
 *   detectionSignals (1 pt) — array with >= 1 observable failure signal
 *   guardrails      (1 pt)  — array with >= 1 check preventing cascading failure
 *   rollbackPlan    (2 pts) — string with >= 10 chars describing safe rollback
 */
export const PREMORTEM_QUALITY_RUBRIC = Object.freeze({
  scenario:         { maxPoints: 2, description: "scenario string with >= 20 characters" },
  failurePaths:     { maxPoints: 2, description: "failurePaths array with >= 2 items" },
  mitigations:      { maxPoints: 2, description: "mitigations array with >= failurePaths.length items" },
  detectionSignals: { maxPoints: 1, description: "detectionSignals array with >= 1 item" },
  guardrails:       { maxPoints: 1, description: "guardrails array with >= 1 item" },
  rollbackPlan:     { maxPoints: 2, description: "rollbackPlan string with >= 10 characters" }
});

/** Maximum possible pre-mortem quality score. */
export const PREMORTEM_MAX_SCORE = 10;

/**
 * Score a pre-mortem object against the PREMORTEM_QUALITY_RUBRIC.
 * Returns a deterministic score in [0, PREMORTEM_MAX_SCORE].
 *
 * Status values:
 *   "blocked"    — input is null/undefined/not-an-object (score=0)
 *   "inadequate" — score < 6  (fails minimum quality threshold)
 *   "adequate"   — score >= 6 (meets minimum threshold)
 *   "complete"   — score = 10 (all rubric criteria met)
 *
 * @param {unknown} premortem
 * @returns {{ score: number, maxScore: number, scorePercent: number, status: string, details: Array }}
 */
export function scorePremortemQuality(premortem) {
  if (!premortem || typeof premortem !== "object") {
    return { score: 0, maxScore: PREMORTEM_MAX_SCORE, scorePercent: 0, status: "blocked", details: [] };
  }

  let score = 0;
  const details = [];

  // scenario: string >= 20 chars → 2 pts
  const scenarioOk = typeof premortem.scenario === "string" && premortem.scenario.trim().length >= 20;
  details.push({ key: "scenario", pass: scenarioOk, points: scenarioOk ? 2 : 0, maxPoints: 2 });
  if (scenarioOk) score += 2;

  // failurePaths: array >= 2 items → 2 pts
  const fpLen = Array.isArray(premortem.failurePaths) ? premortem.failurePaths.length : 0;
  const failurePathsOk = fpLen >= 2;
  details.push({ key: "failurePaths", pass: failurePathsOk, points: failurePathsOk ? 2 : 0, maxPoints: 2 });
  if (failurePathsOk) score += 2;

  // mitigations: array >= max(1, failurePaths.length) → 2 pts
  const mitLen = Array.isArray(premortem.mitigations) ? premortem.mitigations.length : 0;
  const mitigationsOk = mitLen >= Math.max(1, fpLen);
  details.push({ key: "mitigations", pass: mitigationsOk, points: mitigationsOk ? 2 : 0, maxPoints: 2 });
  if (mitigationsOk) score += 2;

  // detectionSignals: array >= 1 → 1 pt
  const dsOk = Array.isArray(premortem.detectionSignals) && premortem.detectionSignals.length >= 1;
  details.push({ key: "detectionSignals", pass: dsOk, points: dsOk ? 1 : 0, maxPoints: 1 });
  if (dsOk) score += 1;

  // guardrails: array >= 1 → 1 pt
  const grOk = Array.isArray(premortem.guardrails) && premortem.guardrails.length >= 1;
  details.push({ key: "guardrails", pass: grOk, points: grOk ? 1 : 0, maxPoints: 1 });
  if (grOk) score += 1;

  // rollbackPlan: string >= 10 chars → 2 pts
  const rpOk = typeof premortem.rollbackPlan === "string" && premortem.rollbackPlan.trim().length >= 10;
  details.push({ key: "rollbackPlan", pass: rpOk, points: rpOk ? 2 : 0, maxPoints: 2 });
  if (rpOk) score += 2;

  const status = score === PREMORTEM_MAX_SCORE ? "complete"
    : score >= 6 ? "adequate"
    : "inadequate";

  return {
    score,
    maxScore: PREMORTEM_MAX_SCORE,
    scorePercent: Math.round((score / PREMORTEM_MAX_SCORE) * 100),
    status,
    details
  };
}

/**
 * Score all high-risk plan pre-mortems from a Prometheus analysis and persist results.
 *
 * Reads high-risk plans (riskLevel="high") with premortem sections from prometheusAnalysis.
 * Scores each pre-mortem using scorePremortemQuality and appends to state/premortem_scores.json.
 *
 * Storage schema: { scores: [...], lastScoredAt: string }
 * Each score entry: { planIndex, taskId, score, maxScore, scorePercent, status, details, scoredAt }
 *
 * @param {object} config
 * @param {object|null} prometheusAnalysis — result from prometheus_analysis.json
 * @returns {Promise<{ scores: Array, averageScore: number|null }>}
 */
export async function scoreAndStorePremortemQuality(config, prometheusAnalysis) {
  const stateDir = config.paths?.stateDir || "state";

  const plans = Array.isArray(prometheusAnalysis?.plans) ? prometheusAnalysis.plans : [];
  const highRiskPlans = plans.filter(p =>
    p && typeof p === "object" && p.riskLevel === PREMORTEM_RISK_LEVEL.HIGH && p.premortem
  );

  if (highRiskPlans.length === 0) {
    return { scores: [], averageScore: null };
  }

  const scores = highRiskPlans.map((plan, idx) => ({
    planIndex: idx,
    taskId: plan.taskId || plan.task || `plan-${idx}`,
    ...scorePremortemQuality(plan.premortem),
    scoredAt: new Date().toISOString()
  }));

  // Persist to state/premortem_scores.json — append-only, capped at 200
  const scoresPath = path.join(stateDir, "premortem_scores.json");
  const existing = await readJson(scoresPath, { scores: [], lastScoredAt: null });
  existing.scores.push(...scores);
  if (existing.scores.length > 200) {
    existing.scores = existing.scores.slice(-200);
  }
  existing.lastScoredAt = new Date().toISOString();
  await writeJson(scoresPath, existing);

  const totalScore = scores.reduce((sum, s) => sum + s.score, 0);
  const averageScore = scores.length > 0 ? totalScore / scores.length : null;

  return { scores, averageScore };
}

// ── Knowledge Memory ─────────────────────────────────────────────────────────

async function loadKnowledgeMemory(stateDir) {
  return readJson(path.join(stateDir, "knowledge_memory.json"), {
    lessons: [],
    configTunings: [],
    promptHints: [],
    lastUpdated: null
  });
}

async function saveKnowledgeMemory(stateDir, memory) {
  memory.lastUpdated = new Date().toISOString();
  await writeJson(path.join(stateDir, "knowledge_memory.json"), memory);
}

// ── Cycle Outcome Collector ──────────────────────────────────────────────────

/**
 * Normalized outcome collector — Athena-gated architecture.
 *
 * Primary state sources (replaces stale legacy artifacts):
 *   prometheus_analysis.json  — plans, projectHealth, requestBudget, waves
 *   evolution_progress.json   — completed task IDs
 *   worker_sessions.json      — per-worker status (unchanged)
 *   worker_${role}.json       — per-worker activityLog → dispatches
 *
 * Return contract:
 *   { totalPlans, completedCount, projectHealth, workerOutcomes, waves, dispatches,
 *     requestBudget, decisionQuality, athenaPlanReview, timestamp, metricsSource,
 *     degraded, degradedReason }
 *
 *   degraded:      true when a critical source file is absent or invalid.
 *   degradedReason: OUTCOME_DEGRADED_REASON code or null.
 *   metricsSource: pipe-joined list of files that contributed data.
 *
 * @param {object} config
 * @returns {Promise<object>}
 */
export async function collectCycleOutcomes(config) {
  const stateDir = config.paths?.stateDir || "state";

  // ── Primary state sources (Athena-gated architecture) ────────────────────
  // Use readJsonSafe to distinguish MISSING (ENOENT) from INVALID (parse error).
  const [prometheusResult, evolutionResult] = await Promise.all([
    readJsonSafe(path.join(stateDir, "prometheus_analysis.json")),
    readJsonSafe(path.join(stateDir, "evolution_progress.json"))
  ]);
  const workerSessions = await readJson(path.join(stateDir, "worker_sessions.json"), {});

  // ── Input validation — distinguish missing vs invalid ─────────────────────
  let degraded = false;
  let degradedReason = null;

  let plans = [];
  let projectHealth = "unknown";
  let requestBudget: Record<string, any> = {};
  let waves = [];

  if (!prometheusResult.ok) {
    degraded = true;
    degradedReason = prometheusResult.reason === READ_JSON_REASON.MISSING
      ? OUTCOME_DEGRADED_REASON.PROMETHEUS_ABSENT
      : OUTCOME_DEGRADED_REASON.PROMETHEUS_INVALID;
  } else if (!Array.isArray(prometheusResult.data?.plans)) {
    // File present but missing required `plans` array — treat as invalid structure.
    degraded = true;
    degradedReason = OUTCOME_DEGRADED_REASON.PROMETHEUS_INVALID;
  } else {
    plans = prometheusResult.data.plans;
    projectHealth = prometheusResult.data.projectHealth || "unknown";
    requestBudget = prometheusResult.data.requestBudget || {};
    waves = Array.isArray(prometheusResult.data.executionStrategy?.waves)
      ? prometheusResult.data.executionStrategy.waves
      : [];
  }

  // Derive completed task IDs from evolution_progress.tasks.
  let completedFromEvolution = [];
  if (!evolutionResult.ok) {
    if (!degraded) {
      degraded = true;
      degradedReason = evolutionResult.reason === READ_JSON_REASON.MISSING
        ? OUTCOME_DEGRADED_REASON.EVOLUTION_ABSENT
        : OUTCOME_DEGRADED_REASON.EVOLUTION_INVALID;
    }
  } else if (evolutionResult.data?.tasks !== null && typeof evolutionResult.data?.tasks !== "object") {
    if (!degraded) {
      degraded = true;
      degradedReason = OUTCOME_DEGRADED_REASON.EVOLUTION_INVALID;
    }
  } else {
    const taskMap = evolutionResult.data?.tasks || {};
    completedFromEvolution = Object.entries(taskMap)
      .filter(([, t]) => (t as any).status === "completed" || (t as any).status === "done")
      .map(([id]) => id);
  }

  const completedTasks = completedFromEvolution;

  // ── Determine metrics source ──────────────────────────────────────────────
  const sourceFiles = ["worker_sessions"];
  if (prometheusResult.ok) sourceFiles.unshift("prometheus_analysis");
  if (evolutionResult.ok)  sourceFiles.push("evolution_progress");
  const metricsSource = sourceFiles.join("+");

  // ── Per-worker outcome analysis ───────────────────────────────────────────
  const workerOutcomes = [];
  const workerActivityByRole: Record<string, any> = {};

  for (const [role, session] of Object.entries(workerSessions) as any[]) {
    const workerFile = await readJson(
      path.join(stateDir, `worker_${role.replace(/\s+/g, "_")}.json`),
      null
    );
    const activityLog = Array.isArray(workerFile?.activityLog) ? workerFile.activityLog : [];
    workerActivityByRole[role] = activityLog;

    const lastEntry = activityLog[activityLog.length - 1];
    const timeouts  = activityLog.filter(e => e.status === "timeout").length;
    const failures  = activityLog.filter(e => e.status === "error" || e.status === "failed").length;
    const successes = activityLog.filter(e => e.status === "done").length;
    const totalDispatches = activityLog.length;
    const hasPR = Boolean(lastEntry?.pr);

    workerOutcomes.push({
      role,
      status:          String(session?.status || lastEntry?.status || "unknown"),
      totalDispatches,
      timeouts,
      failures,
      successes,
      hasPR,
      pr:        lastEntry?.pr || null,
      lastError: activityLog.filter(e => e.error).pop()?.error || null
    });
  }

  // ── Build dispatch log from worker activityLog entries ───────────────────
  // Each worker's activityLog is the source of dispatch data.
  const allActivityEntries = [];
  for (const [role, activityLog] of Object.entries(workerActivityByRole)) {
    for (const entry of activityLog) {
      allActivityEntries.push({ role, ...entry });
    }
  }
  const dispatches = allActivityEntries.slice(-20);

  // ── Decision quality from recent postmortems ──────────────────────────────
  let decisionQuality = { score: null, labelCounts: {}, total: 0 };
  try {
    const rawPostmortems = await readJson(path.join(stateDir, "athena_postmortems.json"), null);
    if (rawPostmortems !== null) {
      const migrated = migrateData(rawPostmortems, STATE_FILE_TYPE.ATHENA_POSTMORTEMS);
      if (migrated.ok) {
        const entries = extractPostmortemEntries(migrated.data);
        decisionQuality = computeWeightedDecisionScore(entries.slice(-20));
      }
    }
  } catch { /* no postmortem data — degrade gracefully */ }

  // ── Latest approved/rejected Athena plan review feedback ─────────────────
  let athenaPlanReview = null;
  try {
    const rawPlanReview = await readJson(path.join(stateDir, "athena_plan_review.json"), null);
    if (rawPlanReview && typeof rawPlanReview === "object") {
      athenaPlanReview = {
        approved: rawPlanReview.approved === true,
        overallScore: Number.isFinite(Number(rawPlanReview.overallScore))
          ? Number(rawPlanReview.overallScore)
          : null,
        summary: String(rawPlanReview.summary || ""),
        corrections: Array.isArray(rawPlanReview.corrections)
          ? rawPlanReview.corrections.map((item) => String(item || "").trim()).filter(Boolean)
          : [],
        reviewedAt: rawPlanReview.reviewedAt || null,
      };
    }
  } catch { /* no plan-review data — degrade gracefully */ }

  return {
    totalPlans:      plans.length,
    completedCount:  completedTasks.length,
    projectHealth,
    workerOutcomes,
    waves: waves.map(w => ({
      id: w.id,
      workers: w.workers,
      completedTasks: completedTasks.filter(t =>
        String(t).toLowerCase().includes(String(w.id).toLowerCase())
      )
    })),
    dispatches,
    requestBudget,
    decisionQuality,
    athenaPlanReview,
    timestamp: new Date().toISOString(),
    // Athena-gated metadata fields
    metricsSource,
    degraded,
    degradedReason
  };
}

// ── AI-Driven Analysis ───────────────────────────────────────────────────────

async function analyzeWithAI(config, outcomes, knowledgeMemory) {
  const command = config.env?.copilotCliCommand || "copilot";
  const previousLessons = (knowledgeMemory.lessons || []).slice(-5)
    .map(l => `- [${l.source}] ${l.lesson}`).join("\n") || "None yet.";
  const previousGaps = (knowledgeMemory.capabilityGaps || []).slice(-5)
    .map(g => `- [${g.severity}] ${g.gap} → ${g.proposedFix || "no fix proposed"}`).join("\n") || "None yet.";

  // Load health audit findings if available
  const stateDir = config.paths?.stateDir || "state";
  let healthAuditSection = "";
  try {
    const auditData = JSON.parse(
      await fs.readFile(path.join(stateDir, "health_audit_findings.json"), "utf8")
    );
    if (Array.isArray(auditData?.findings) && auditData.findings.length > 0) {
      healthAuditSection = `\n## JESUS HEALTH AUDIT FINDINGS (hierarchical detection)\n${JSON.stringify(auditData.findings, null, 2)}\nAnalyze these findings — they represent issues that WORKERS and ATHENA missed but JESUS caught.\nFor each finding, determine if the system is MISSING A CAPABILITY that caused the gap.\n`;
    }
  } catch { /* no audit data */ }

  const prompt = `You are the BOX self-improvement analyzer. Your job is to analyze the results of a completed
automation cycle and produce actionable improvements for the next cycle.

## CYCLE OUTCOMES
${JSON.stringify(outcomes, null, 2)}

## DECISION QUALITY SIGNALS (weighted)
Score: ${outcomes.decisionQuality?.score !== null ? (outcomes.decisionQuality.score * 100).toFixed(1) + "%" : "N/A"}
Label counts: ${JSON.stringify(outcomes.decisionQuality?.labelCounts || {})}
Total postmortems analyzed: ${outcomes.decisionQuality?.total || 0}
Weight table: correct=1.0, delayed-correct=0.6, incorrect=0.0, inconclusive=0.3

Use the decision quality score as a weighted signal in your health assessment and next-cycle priorities.
A score below 0.5 (50%) signals systematic execution problems; incorrect labels deserve root-cause analysis.

## PREVIOUS LESSONS LEARNED
${previousLessons}

## PREVIOUSLY DETECTED CAPABILITY GAPS
${previousGaps}
${healthAuditSection}

## ANALYSIS REQUIREMENTS
Analyze the cycle outcomes and produce a JSON response with these fields:

1. "lessons" — Array of objects with { "lesson": string, "source": string, "category": string, "severity": "info"|"warning"|"critical" }
   Categories: "timeout", "prompt-quality", "worker-efficiency", "wave-ordering", "retry-strategy", "config-tuning", "missing-tooling"
   Each lesson should be a concrete, actionable insight. Not generic advice.

2. "configSuggestions" — Array of objects with { "path": string, "currentValue": any, "suggestedValue": any, "reason": string, "autoApply": boolean }
   Only suggest config changes that are SAFE to auto-apply. Set autoApply=true only for:
   - Timeout adjustments within reasonable bounds (5-60 min)
   - Worker retry count changes (1-5)
   - Polling interval changes
   Set autoApply=false for anything that changes system behavior significantly.

3. "promptHints" — Array of objects with { "targetAgent": string, "hint": string, "reason": string }
  These hints will be injected into the next cycle's prompts for the specified agent (trump, athena, or worker names).

4. "workerFeedback" — Array of objects with { "worker": string, "assessment": "excellent"|"good"|"needs-improvement"|"poor", "reason": string, "suggestion": string }

5. "systemHealthScore" — Number 0-100 representing overall cycle health.

6. "nextCyclePriorities" — Array of strings describing what the next cycle should focus on.

7. "capabilityGaps" — CRITICAL: Array of objects describing what the system was STRUCTURALLY MISSING.
   Each object: { "gap": string, "severity": "critical"|"important"|"minor", "capability": string, "proposedFix": string, "appliesToAllRepos": boolean }
   
   Examples of capability gaps:
   - "Workers had no prompt for managing GitHub Actions variables" → proposedFix: "Add GitHub variable management instructions to worker context"
   - "System did not detect stale branches after PR merge" → proposedFix: "Add post-merge branch cleanup to orchestrator"
   - "No worker was assigned GitHub repo settings (branch protection)" → proposedFix: "Add repo-settings task to Noah's capabilities"
   - "Workers couldn't fix CI because they didn't know the failing test" → proposedFix: "Inject CI failure logs into worker context"
   
   IMPORTANT: Think about what went WRONG or what was MISSED in this cycle.
   What problem existed that NO part of the system (workers, Athena, Trump, Jesus) addressed?
   What capability would have prevented the issue?
   Would this gap appear in OTHER repositories too? Set appliesToAllRepos=true if so.

Respond with ONLY valid JSON. No markdown, no explanation before or after.`;

  const args = buildAgentArgs({ agentSlug: "self-improvement", prompt, allowAll: false, noAskUser: true });
  const result: any = await spawnAsync(command, args, { env: process.env });
  const stdout = String(result?.stdout || "");
  const stderr = String(result?.stderr || "");
  const raw = stdout || stderr;

  const parsed = parseAgentOutput(raw);
  if (parsed?.ok && parsed.parsed) {
    return parsed.parsed;
  }

  // Try direct JSON parse from raw
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch { /* fall through */ }
  }

  return null;
}

// ── Apply Safe Improvements ──────────────────────────────────────────────────

/**
 * Apply auto-approved config suggestions and tag each change with active experiment IDs.
 *
 * AC1 enforcement modes:
 *   soft (default): changes are applied and tagged with experiment IDs when available;
 *     a warning is logged if no experiment covers the path, but the change is NOT blocked.
 *   hard: changes are blocked (skipped with explicit warning) if no running experiment
 *     covers the config path. Enable via selfImprovement.experimentEnforcement = "hard".
 *
 * Applied change objects include `experimentIds: string[]` for traceability.
 * Blocked changes include `status: "blocked"` and `blockReason` for observability.
 */
async function applyConfigSuggestions(config, suggestions) {
  if (!Array.isArray(suggestions)) return [];
  const applied = [];
  const configPath = path.join(config.rootDir || ".", "box.config.json");

  let boxConfig;
  try {
    boxConfig = JSON.parse(await fs.readFile(configPath, "utf8"));
  } catch {
    return applied;
  }

  const coreProtected = config.selfImprovement?.coreProtectedModules || [];
  const stateDir = config.paths?.stateDir || "state";

  // ── Shadow policy evaluation before applying any changes (T-017) ──────────
  // Map auto-apply suggestions to shadow change descriptors.
  const shadowChanges = suggestions
    .filter(s => s?.autoApply)
    .map(s => ({
      type:     "config",
      path:     String(s.path || ""),
      oldValue: s.currentValue,
      newValue: s.suggestedValue,
    }));

  let shadowEvalResult = null;
  if (shadowChanges.length > 0) {
    try {
      const shadowPolicy  = config.selfImprovement?.shadowPolicy  || {};
      const currentPolicy = await import("./policy_engine.js").then(m => m.loadPolicy(config));
      shadowEvalResult = await runShadowEvaluation(currentPolicy, shadowChanges, {
        stateDir,
        threshold:   typeof shadowPolicy.threshold   === "number" ? shadowPolicy.threshold   : undefined,
        cycleWindow: typeof shadowPolicy.cycleWindow === "number" ? shadowPolicy.cycleWindow : undefined,
        owner:       "self-improvement",
      });

      const shadowStatus = shadowEvalResult.status;
      if (shadowStatus === SHADOW_STATUS.BLOCKED) {
        warn(`[self-improvement] shadow policy evaluation blocked config promotion — blockReason=${shadowEvalResult.blockReason} delta=${shadowEvalResult.delta}`);
        // Record all candidate changes as shadow-blocked (explicit status, no silent fallback).
        for (const s of suggestions.filter(s => s?.autoApply)) {
          applied.push({
            path:        String(s.path || ""),
            status:      "shadow-blocked",
            blockReason: shadowEvalResult.blockReason,
            shadowEval:  {
              delta:          shadowEvalResult.delta,
              confidence:     shadowEvalResult.confidence,
              sampleSize:     shadowEvalResult.sampleSize,
              successCriteria: shadowEvalResult.successCriteria,
            },
            suggestedValue: s.suggestedValue,
            reason:         s.reason,
          });
        }
        return applied;
      }

      if (shadowStatus === SHADOW_STATUS.DEGRADED) {
        warn(`[self-improvement] shadow policy evaluation degraded — degradedReason=${shadowEvalResult.degradedReason} — proceeding with soft enforcement`);
      }
    } catch (err) {
      // Shadow eval is advisory — a thrown error must not block config application.
      warn(`[self-improvement] shadow policy evaluation error (non-fatal): ${String(err?.message || err)}`);
    }
  }

  // ── Governance contract enforcement (T-031) ───────────────────────────────
  // Load policy once for governance classification of all config changes.
  let governancePolicy;
  try {
    governancePolicy = await import("./policy_engine.js").then(m => m.loadPolicy(config));
  } catch {
    // Non-fatal: policy unavailable → governance classification uses safe defaults
    governancePolicy = {};
  }

  // AC1: load registry once; mode is "soft" unless explicitly set to "hard"
  const enforcementMode = config.selfImprovement?.experimentEnforcement === "hard" ? "hard" : "soft";
  let registry;
  try {
    registry = await loadRegistry(stateDir);
  } catch {
    // Registry not yet initialised — treat as empty; soft mode continues normally
    registry = { schemaVersion: 1, experiments: [] };
  }

  // AC1: determine if canary routing is enabled for staged config changes
  const canaryConfig = getCanaryConfig(config);

  for (const suggestion of suggestions) {
    if (!suggestion.autoApply) continue;

    const configKey = String(suggestion.path || "");

    // Safety: never auto-modify core protected paths
    if (coreProtected.some(mod => configKey.includes(mod))) continue;

    // Safety: only allow specific known-safe config paths
    const safeConfigPaths = [
      "workerTimeoutMinutes",
      "maxRetries",
      "workers.pollIntervalMs",
      "planner.stalledWaveEscalationCycles",
      "systemGuardian.staleWorkerMinutes",
      "systemGuardian.cooldownMinutes"
    ];
    if (!safeConfigPaths.some(safe => configKey.includes(safe))) continue;

    // ── Governance enforcement gate (T-031) ─────────────────────────────────
    // Classify risk and hard-block high/critical changes without dual approval.
    const governanceChange = {
      riskScore:    0.3, // config suggestions via self-improvement are generally low/medium risk
      changeType:   "config",
      filesChanged: [configPath]
    };
    const approvalEvidence = suggestion.approvalEvidence || {};
    const govResult = enforceGovernance(governanceChange, approvalEvidence, governancePolicy);
    if (!govResult.ok) {
      // Hard-block — no silent fallback (AC3, AC10 resolved)
      warn(`[self-improvement] governance contract hard-blocked config change at ${configKey} — ${govResult.blockReason}`);
      applied.push({
        path:        configKey,
        status:      "governance-blocked",
        blockReason: govResult.blockReason,
        riskLevel:   govResult.riskLevel,
        suggestedValue: suggestion.suggestedValue,
        reason:      suggestion.reason
      });
      continue;
    }

    // AC1: tag with running experiment IDs covering this config path
    const experimentIds = getRunningExperimentsForPath(registry, configKey);

    if (enforcementMode === "hard" && experimentIds.length === 0) {
      // Hard mode: block the change and record it with an explicit status
      warn(`[self-improvement] hard enforcement blocked config change at ${configKey} — no running experiment covers this path`);
      applied.push({
        path: configKey,
        status: "blocked",
        blockReason: "NO_EXPERIMENT_COVERAGE",
        experimentIds: [],
        suggestedValue: suggestion.suggestedValue,
        reason: suggestion.reason
      });
      continue;
    }

    if (experimentIds.length === 0) {
      // Soft mode: log warning but apply
      warn(`[self-improvement] no experiment covers config path ${configKey} — applying without experiment tag (soft enforcement)`);
    }

    // AC1 / T-022: route through canary when enabled (staged rollout before global promotion)
    if (canaryConfig.enabled) {
      // Resolve current (control) value from the in-memory boxConfig for provenance
      const keys = configKey.split(".");
      let   ctrl = boxConfig;
      for (const k of keys) {
        ctrl = (ctrl && typeof ctrl === "object") ? ctrl[k] : undefined;
      }
      const controlValue = ctrl;

      const primaryExperimentId = experimentIds.length > 0 ? experimentIds[0] : null;
      try {
        const canaryResult = await startCanary(
          config, configKey, controlValue, suggestion.suggestedValue, primaryExperimentId
        );
        if (canaryResult.ok) {
          applied.push({
            path:          configKey,
            status:        "canary_started",
            canaryId:      canaryResult.canaryId,
            controlValue,
            canaryValue:   suggestion.suggestedValue,
            reason:        suggestion.reason,
            experimentIds
          });
          continue;
        }
        // If canary is ALREADY_RUNNING for this path, fall through to direct apply
        if (canaryResult.status !== "ALREADY_RUNNING") {
          warn(`[self-improvement] canary start failed for ${configKey}: ${canaryResult.status}`);
          applied.push({
            path:         configKey,
            status:       "canary_start_failed",
            failReason:   canaryResult.status,
            experimentIds,
            suggestedValue: suggestion.suggestedValue,
            reason:       suggestion.reason
          });
          continue;
        }
      } catch (err) {
        warn(`[self-improvement] canary routing error for ${configKey}: ${String(err?.message || err)}`);
        // Fall through to direct apply on unexpected error
      }
    }

    // Direct apply (canary disabled, or canary already running for this path)
    const keys = configKey.split(".");
    let target = boxConfig;
    for (let i = 0; i < keys.length - 1; i++) {
      if (target && typeof target === "object" && keys[i] in target) {
        target = target[keys[i]];
      } else {
        target = null;
        break;
      }
    }

    if (target && typeof target === "object") {
      const lastKey = keys[keys.length - 1];
      const oldValue = target[lastKey];
      target[lastKey] = suggestion.suggestedValue;

      const appliedEntry = {
        path: configKey,
        status: "applied",
        oldValue,
        newValue: suggestion.suggestedValue,
        reason: suggestion.reason,
        experimentIds,
        riskLevel: govResult.riskLevel,
        shadowEval: shadowEvalResult ? {
          delta:           shadowEvalResult.delta,
          confidence:      shadowEvalResult.confidence,
          sampleSize:      shadowEvalResult.sampleSize,
          successCriteria: shadowEvalResult.successCriteria,
        } : null,
      };
      applied.push(appliedEntry);

      // Record approval evidence for audit (T-031 AC4)
      const evidence = {
        changeId:        `si-${Date.now()}-${configKey.replace(/[^a-z0-9]/gi, "_")}`,
        changedBy:       "self-improvement",
        changedAt:       new Date().toISOString(),
        riskLevel:       govResult.riskLevel,
        filesChanged:    [configPath],
        approvals:       Array.isArray(approvalEvidence.approvals) ? approvalEvidence.approvals : [],
        contractVersion: GOVERNANCE_CONTRACT_VERSION
      };
      recordApprovalEvidence(evidence, config).catch(err => {
        warn(`[self-improvement] approval evidence record failed (non-fatal): ${String(err?.message || err)}`);
      });
    }
  }

  const actuallyApplied = applied.filter(c => c.status === "applied");
  if (actuallyApplied.length > 0) {
    await fs.writeFile(configPath, JSON.stringify(boxConfig, null, 2) + "\n", "utf8");
  }

  return applied;
}

// ── Main Self-Improvement Cycle ──────────────────────────────────────────────

// ── Monthly Postmortem Generator ─────────────────────────────────────────────

/**
 * Risk: MEDIUM (mislabeled "low" in original task brief).
 * A faulty postmortem that corrupts next-quarter strategy seeds is a medium-risk outcome.
 * All generated output is validated before write; status="degraded" when data is partial.
 */

/**
 * Status values for a monthly postmortem document.
 * @enum {string}
 */
export const MONTHLY_POSTMORTEM_STATUS = Object.freeze({
  OK:                "ok",
  INSUFFICIENT_DATA: "insufficient_data",
  DEGRADED:          "degraded"
});

/**
 * Deterministic reason codes for degraded postmortem sources.
 *
 * Used in the `degradedSources` array of a degraded postmortem.
 * Distinguishes absent (ENOENT) from invalid (bad JSON / schema) inputs,
 * and covers all three source files read by generateMonthlyPostmortem.
 *
 * @enum {string}
 */
export const POSTMORTEM_DEGRADED_REASON = Object.freeze({
  /** improvement_reports.json not found on disk. */
  IMPROVEMENT_REPORTS_ABSENT:           "IMPROVEMENT_REPORTS_ABSENT",
  /** improvement_reports.json found but fails structural validation. */
  IMPROVEMENT_REPORTS_INVALID:          "IMPROVEMENT_REPORTS_INVALID",
  /** experiment_registry.json not found on disk. */
  EXPERIMENT_REGISTRY_ABSENT:           "EXPERIMENT_REGISTRY_ABSENT",
  /** experiment_registry.json found but fails structural validation. */
  EXPERIMENT_REGISTRY_INVALID:          "EXPERIMENT_REGISTRY_INVALID",
  /** athena_postmortems.json not found on disk. */
  ATHENA_POSTMORTEMS_ABSENT:            "ATHENA_POSTMORTEMS_ABSENT",
  /** athena_postmortems.json found but fails structural validation. */
  ATHENA_POSTMORTEMS_INVALID:           "ATHENA_POSTMORTEMS_INVALID",
  /** Schema migration of athena_postmortems.json returned ok=false. */
  ATHENA_POSTMORTEMS_MIGRATION_FAILED:  "ATHENA_POSTMORTEMS_MIGRATION_FAILED",
  /** Schema migration of athena_postmortems.json threw an exception. */
  ATHENA_POSTMORTEMS_MIGRATION_ERROR:   "ATHENA_POSTMORTEMS_MIGRATION_ERROR",
});

/**
 * Decision quality trend values for a monthly postmortem.
 * Computed deterministically from first-half vs second-half weighted scores.
 * @enum {string}
 */
export const POSTMORTEM_DECISION_TREND = Object.freeze({
  IMPROVING:         "improving",
  STABLE:            "stable",
  DEGRADING:         "degrading",
  INSUFFICIENT_DATA: "insufficient_data"
});

/**
 * Severity weights used in the compounding-effect score formula.
 * score = occurrences × severityWeight × recencyFactor
 * @type {Readonly<Record<string, number>>}
 */
export const COMPOUNDING_SEVERITY_WEIGHT = Object.freeze({
  critical: 3,
  warning:  2,
  info:     1
});

/**
 * Canonical schema for monthly_postmortem_YYYY-MM.json.
 *
 * Required top-level fields, enum values, counterfactual template fields,
 * and seed question format rules are all specified here for machine-checkable
 * validation (Athena AC1–AC5 resolved).
 *
 * Output file: state/monthly_postmortem_{monthKey}.json
 */
export const MONTHLY_POSTMORTEM_SCHEMA = Object.freeze({
  schemaVersion: 1,

  /** Minimum recorded cycles before status="ok" is set (vs "insufficient_data"). */
  minCycleCount: 3,

  /** Maximum compounding effects returned. */
  maxCompoundingEffects: 5,

  /** Time window for decision quality trend (days). */
  trendTimeWindowDays: 30,

  required: Object.freeze([
    "schemaVersion", "monthKey", "generatedAt", "status",
    "cycleCount", "experimentOutcomes", "compoundingEffects",
    "decisionQualityTrend", "seedQuestion"
  ]),

  statusEnum:                      Object.freeze(["ok", "insufficient_data", "degraded"]),
  trendEnum:                       Object.freeze(["improving", "stable", "degrading", "insufficient_data"]),
  confidenceLevelEnum:             Object.freeze(["high", "medium", "low"]),
  compoundingEffectSeverityEnum:   Object.freeze(["critical", "warning", "info"]),

  /** Required fields on each counterfactual note (Athena AC3 resolved). */
  counterfactualRequiredFields: Object.freeze([
    "experimentId", "hypothesis", "failureReason", "alternative", "preventionStrategy"
  ]),

  /** Required fields on the seedQuestion object (Athena AC5 resolved). */
  seedQuestionRequiredFields: Object.freeze(["question", "rationale", "dataPoints"]),

  /** Confidence level thresholds based on total postmortem count. */
  trendConfidenceThresholds: Object.freeze({ HIGH: 10, MEDIUM: 5 }),

  /**
   * Minimum score delta (absolute) required to classify trend as improving/degrading.
   * Below this threshold → "stable".
   */
  trendDeltaThreshold: 0.05,

  /** Seed question format rule: must end in "?" and have >= this many characters. */
  seedQuestionMinLength: 20,

  /**
   * Minimum required fields on each compounding-effect record (AC13).
   * Validated by validateCompoundingEffect().
   */
  compoundingEffectRequiredFields: Object.freeze([
    "pattern", "score", "occurrences", "severity", "evidence"
  ]),

  /** Each item in the evidence array must be a non-empty string (cycleAt timestamp). */
  evidenceItemMinLength: 1,
});

// ── Evidence schema validation ─────────────────────────────────────────────────

/**
 * Validate a single compounding-effect object against the minimum evidence schema
 * defined in MONTHLY_POSTMORTEM_SCHEMA.compoundingEffectRequiredFields.
 *
 * Returns { ok: true } when all required fields are present and evidence is a valid array.
 * Returns { ok: false, violations: string[] } when any field is missing or malformed.
 *
 * @param {unknown} effect
 * @returns {{ ok: boolean, violations: string[] }}
 */
export function validateCompoundingEffect(effect: unknown): { ok: boolean; violations: string[] } {
  const violations: string[] = [];
  if (effect === null || effect === undefined || typeof effect !== "object" || Array.isArray(effect)) {
    return { ok: false, violations: ["effect must be a non-null object"] };
  }
  const e = effect as Record<string, unknown>;
  for (const field of MONTHLY_POSTMORTEM_SCHEMA.compoundingEffectRequiredFields) {
    if (!(field in e)) {
      violations.push(`missing required field: ${field}`);
    }
  }
  // evidence must be an array of non-empty strings
  if ("evidence" in e) {
    if (!Array.isArray(e.evidence)) {
      violations.push("evidence must be an array");
    } else {
      for (let i = 0; i < e.evidence.length; i++) {
        if (typeof e.evidence[i] !== "string" || (e.evidence[i] as string).length < MONTHLY_POSTMORTEM_SCHEMA.evidenceItemMinLength) {
          violations.push(`evidence[${i}] must be a non-empty string`);
        }
      }
    }
  }
  return { ok: violations.length === 0, violations };
}

// ── Compounding Effect Scoring ─────────────────────────────────────────────────

/**
 * Compute recency factor for a lesson based on its addedAt timestamp
 * relative to the end of the given month.
 *
 * recencyFactor:
 *   1.0 — within last 7 days of the month
 *   0.7 — 8–14 days before end of month
 *   0.5 — older than 14 days before end of month
 *
 * @param {string|null|undefined} addedAt — ISO timestamp
 * @param {Date} monthEnd
 * @returns {number}
 */
function computeRecencyFactor(addedAt, monthEnd) {
  if (!addedAt) return 0.5;
  const ts = new Date(addedAt).getTime();
  if (!Number.isFinite(ts)) return 0.5;
  const daysDiff = (monthEnd.getTime() - ts) / (1000 * 60 * 60 * 24);
  if (daysDiff <= 7)  return 1.0;
  if (daysDiff <= 14) return 0.7;
  return 0.5;
}

/**
 * Compute top-N compounding effects from monthly improvement reports.
 *
 * Scoring formula (Athena AC2 resolved):
 *   score = occurrences × severityWeight × recencyFactor
 *   severityWeight : critical=3, warning=2, info=1  (COMPOUNDING_SEVERITY_WEIGHT)
 *   recencyFactor  : 1.0 last 7 days of month, 0.7 8–14 days, 0.5 older
 *
 * Grouping: lessons are grouped by their `category` field.
 * Pattern = "<category>: <most common lesson text in that group>" (capped at 200 chars).
 * Evidence = array of report cycleAt timestamps where the category appeared (capped at 10).
 *
 * @param {object[]} reports — improvement_reports entries for the month
 * @param {string}   monthKey — "YYYY-MM"
 * @param {number}   [maxN]
 * @returns {object[]}
 */
export function computeCompoundingEffects(reports, monthKey, maxN = MONTHLY_POSTMORTEM_SCHEMA.maxCompoundingEffects) {
  if (!Array.isArray(reports) || reports.length === 0) return [];

  const [year, month] = monthKey.split("-").map(Number);
  const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

  /** @type {Map<string, { occurrences: number, severity: string, evidence: string[], lessonTexts: string[], scoreSum: number }>} */
  const categoryMap = new Map();

  for (const report of reports) {
    const cycleAt = String(report?.cycleAt || "");
    const lessons = Array.isArray(report?.analysis?.lessons) ? report.analysis.lessons : [];

    for (const lesson of lessons) {
      const category     = String(lesson?.category || "unknown");
      const severity     = String(lesson?.severity  || "info");
      const lessonText   = String(lesson?.lesson    || "");
      const addedAt      = lesson?.addedAt || cycleAt;
      const recency      = computeRecencyFactor(addedAt, monthEnd);
      const severityW    = COMPOUNDING_SEVERITY_WEIGHT[severity] ?? COMPOUNDING_SEVERITY_WEIGHT.info;
      const itemScore    = severityW * recency;

      if (!categoryMap.has(category)) {
        categoryMap.set(category, {
          occurrences: 0, severity, evidence: [], lessonTexts: [], scoreSum: 0
        });
      }

      const entry = categoryMap.get(category);
      entry.occurrences += 1;
      entry.scoreSum    += itemScore;

      if (cycleAt && !entry.evidence.includes(cycleAt)) entry.evidence.push(cycleAt);
      if (lessonText && !entry.lessonTexts.includes(lessonText)) entry.lessonTexts.push(lessonText);

      // Promote to highest severity seen in this category
      const existingW = COMPOUNDING_SEVERITY_WEIGHT[entry.severity] ?? 1;
      if (severityW > existingW) entry.severity = severity;
    }
  }

  const effects = [];
  for (const [category, data] of categoryMap) {
    const domSeverityW = COMPOUNDING_SEVERITY_WEIGHT[data.severity] ?? 1;
    const avgRecency   = data.occurrences > 0
      ? data.scoreSum / (data.occurrences * domSeverityW)
      : 0.5;
    const score = data.occurrences * domSeverityW * avgRecency;

    effects.push({
      pattern:     `${category}: ${data.lessonTexts[0] || "No details"}`.slice(0, 200),
      score:       Math.round(score * 100) / 100,
      occurrences: data.occurrences,
      severity:    data.severity,
      recentAt:    data.evidence[data.evidence.length - 1] || null,
      evidence:    data.evidence.slice(-10)
    });
  }

  effects.sort((a, b) => b.score - a.score || b.occurrences - a.occurrences);
  return effects.slice(0, maxN);
}

// ── Counterfactual Notes ───────────────────────────────────────────────────────

/**
 * Build counterfactual notes for rolled-back experiments.
 *
 * Template fields (Athena AC3 resolved — any string no longer satisfies criterion):
 *   experimentId       — stable experiment ID
 *   hypothesis         — hypothesisId of what we expected to be true
 *   failureReason      — statusReason from the experiment record, or "UNKNOWN"
 *   alternative        — deterministically derived counterfactual statement
 *   preventionStrategy — deterministically derived prevention advice
 *
 * @param {object[]} experiments
 * @returns {object[]}
 */
export function buildCounterfactuals(experiments) {
  if (!Array.isArray(experiments)) return [];

  return experiments
    .filter(e => e.status === "rolled_back")
    .map(exp => {
      const failureReason  = String(exp.statusReason || "UNKNOWN");
      const hypo           = String(exp.hypothesisId  || "unknown-hypothesis");

      const alternative = failureReason === "UNKNOWN"
        ? `Test "${hypo}" with a narrower interventionScope limited to a single config key`
        : `Instead of "${hypo}", address the root cause (${failureReason.slice(0, 80)}) first, then re-test`;

      const preventionStrategy = failureReason === "UNKNOWN"
        ? "Define explicit stop conditions and measurable success criteria before starting next experiment"
        : `Resolve "${failureReason.slice(0, 100)}" before attempting a similar intervention`;

      return {
        experimentId:       String(exp.experimentId || ""),
        hypothesis:         hypo,
        failureReason,
        alternative,
        preventionStrategy
      };
    });
}

// ── Decision Quality Trend for Month ──────────────────────────────────────────

/**
 * Compute decision quality trend for a given calendar month.
 *
 * Time window: all postmortems whose timestamp falls within the month (AC4 resolved).
 *
 * Trend computation:
 *   Split postmortems at day 15 (month midpoint).
 *   scoreBefore = weighted score of entries in days 1–14.
 *   scoreAfter  = weighted score of entries in days 15–end.
 *   trend = "improving"        if scoreAfter  > scoreBefore + trendDeltaThreshold
 *           "degrading"        if scoreBefore > scoreAfter  + trendDeltaThreshold
 *           "stable"           otherwise (both halves present, delta within threshold)
 *           "insufficient_data" if < 2 postmortems in window
 *
 * Confidence scale (AC4 resolved):
 *   "high"   — ≥ 10 postmortems in window
 *   "medium" — 5–9
 *   "low"    — 1–4
 *
 * @param {object[]} postmortems — athena postmortem entries
 * @param {string}   monthKey    — "YYYY-MM"
 * @returns {object}
 */
export function computeDecisionQualityTrendForMonth(postmortems, monthKey) {
  const timeWindowDays  = MONTHLY_POSTMORTEM_SCHEMA.trendTimeWindowDays;
  const deltaThreshold  = MONTHLY_POSTMORTEM_SCHEMA.trendDeltaThreshold;
  const { HIGH, MEDIUM } = MONTHLY_POSTMORTEM_SCHEMA.trendConfidenceThresholds;

  const empty = (trend) => ({
    trend,
    confidence: "low",
    timeWindowDays,
    scoreBefore: null,
    scoreAfter:  null,
    totalPostmortems: 0
  });

  if (!Array.isArray(postmortems) || postmortems.length === 0) {
    return empty(POSTMORTEM_DECISION_TREND.INSUFFICIENT_DATA);
  }

  const [year, month] = monthKey.split("-").map(Number);
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd   = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  const midpoint   = new Date(Date.UTC(year, month - 1, 15));

  function pmTimestamp(pm) {
    const raw = pm?.timestamp || pm?.reviewedAt || pm?.addedAt || null;
    if (!raw) return null;
    const t = new Date(raw).getTime();
    return Number.isFinite(t) ? t : null;
  }

  const inMonth = postmortems.filter(pm => {
    const t = pmTimestamp(pm);
    return t !== null && t >= monthStart.getTime() && t <= monthEnd.getTime();
  });

  const total      = inMonth.length;
  const confidence = total >= HIGH ? "high" : total >= MEDIUM ? "medium" : "low";

  if (total < 2) {
    return { ...empty(POSTMORTEM_DECISION_TREND.INSUFFICIENT_DATA), confidence, totalPostmortems: total };
  }

  const midMs     = midpoint.getTime();
  const firstHalf = inMonth.filter(pm => pmTimestamp(pm) <  midMs);
  const secHalf   = inMonth.filter(pm => pmTimestamp(pm) >= midMs);

  const { score: scoreBefore } = computeWeightedDecisionScore(firstHalf);
  const { score: scoreAfter  } = computeWeightedDecisionScore(secHalf);

  let trend;
  if (scoreBefore === null && scoreAfter === null) {
    trend = POSTMORTEM_DECISION_TREND.INSUFFICIENT_DATA;
  } else if (scoreBefore !== null && scoreAfter !== null) {
    if      (scoreAfter  > scoreBefore + deltaThreshold) trend = POSTMORTEM_DECISION_TREND.IMPROVING;
    else if (scoreBefore > scoreAfter  + deltaThreshold) trend = POSTMORTEM_DECISION_TREND.DEGRADING;
    else                                                  trend = POSTMORTEM_DECISION_TREND.STABLE;
  } else {
    // One half has no labeled postmortems — not enough data to call direction
    trend = POSTMORTEM_DECISION_TREND.STABLE;
  }

  return {
    trend,
    confidence,
    timeWindowDays,
    scoreBefore: scoreBefore !== null ? Math.round(scoreBefore * 10000) / 10000 : null,
    scoreAfter:  scoreAfter  !== null ? Math.round(scoreAfter  * 10000) / 10000 : null,
    totalPostmortems: total
  };
}

// ── Seed Question Generator ────────────────────────────────────────────────────

/**
 * Generate a next-cycle strategy seed question from computed postmortem data.
 *
 * Format rules (Athena AC5 resolved — distinguishes from static no-op strings):
 *   - question must end in "?"
 *   - question must be >= MONTHLY_POSTMORTEM_SCHEMA.seedQuestionMinLength characters
 *   - dataPoints must contain >= 1 entry referencing an actual computed value
 *   - rationale must explain why this specific question was generated
 *
 * Priority order:
 *   1. Degrading decision quality  → ask about root cause of the regression
 *   2. Top compounding effect       → ask about structural fix for the pattern
 *   3. Rolled-back experiments      → ask about the best counterfactual intervention
 *   4. Default throughput question  → ask about cycle completion rate improvement
 *
 * @param {object[]} compoundingEffects
 * @param {object}   decisionQualityTrend
 * @param {object}   experimentOutcomes
 * @param {string}   monthKey
 * @returns {{ question: string, rationale: string, dataPoints: string[] }}
 */
export function generateSeedQuestion(compoundingEffects, decisionQualityTrend, experimentOutcomes, monthKey) {
  const minLen    = MONTHLY_POSTMORTEM_SCHEMA.seedQuestionMinLength;
  const topEffect = Array.isArray(compoundingEffects) ? compoundingEffects[0] : null;
  const trend     = decisionQualityTrend?.trend;
  const rolledBackCount = Array.isArray(experimentOutcomes?.counterfactuals)
    ? experimentOutcomes.counterfactuals.length
    : 0;

  let question;
  let rationale;
  const dataPoints = [];

  if (trend === POSTMORTEM_DECISION_TREND.DEGRADING
      && decisionQualityTrend.scoreBefore !== null
      && decisionQualityTrend.scoreAfter  !== null) {
    const pct1 = (decisionQualityTrend.scoreBefore * 100).toFixed(1);
    const pct2 = (decisionQualityTrend.scoreAfter  * 100).toFixed(1);
    question   = `What specific failure mode caused decision quality to degrade from ${pct1}% to ${pct2}% in ${monthKey}?`;
    rationale  = `Decision quality trended ${trend} (scoreBefore=${pct1}%, scoreAfter=${pct2}%); root-cause identification is highest priority for next quarter.`;
    dataPoints.push(
      `decisionQualityTrend.scoreBefore=${pct1}%`,
      `decisionQualityTrend.scoreAfter=${pct2}%`,
      `trend=${trend}`
    );
  } else if (topEffect) {
    const patSnip = topEffect.pattern.slice(0, 80);
    question  = `What structural change would eliminate the "${patSnip}" pattern that recurred ${topEffect.occurrences} time(s) in ${monthKey}?`;
    rationale = `Top compounding effect "${topEffect.pattern.slice(0, 60)}" scored ${topEffect.score} (occurrences=${topEffect.occurrences}, severity=${topEffect.severity}); structural remediation is the priority.`;
    dataPoints.push(
      `compoundingEffects[0].pattern=${topEffect.pattern.slice(0, 60)}`,
      `compoundingEffects[0].occurrences=${topEffect.occurrences}`,
      `compoundingEffects[0].score=${topEffect.score}`
    );
  } else if (rolledBackCount > 0) {
    const first = experimentOutcomes.counterfactuals[0];
    const frSnip = String(first.failureReason || "UNKNOWN").slice(0, 60);
    question  = `Given that experiment "${first.experimentId}" failed due to "${frSnip}", what alternative intervention should be trialled next quarter?`;
    rationale = `${rolledBackCount} experiment(s) were rolled back in ${monthKey}; counterfactual analysis indicates alternative approach required.`;
    dataPoints.push(
      `experimentOutcomes.counterfactuals[0].experimentId=${first.experimentId}`,
      `experimentOutcomes.counterfactuals[0].failureReason=${frSnip}`,
      `experimentOutcomes.rolled_back=${rolledBackCount}`
    );
  } else {
    const completed = Number(experimentOutcomes?.completed ?? 0);
    const total     = Number(experimentOutcomes?.total     ?? 0);
    const pct       = total > 0 ? Math.round((completed / total) * 100) : 0;
    question  = `What process improvement would increase the ${monthKey} experiment completion rate beyond ${pct}%?`;
    rationale = `No degrading quality trend or compounding effects detected; default throughput question generated for ${monthKey}.`;
    dataPoints.push(
      `experimentOutcomes.completed=${completed}`,
      `experimentOutcomes.total=${total}`,
      `monthKey=${monthKey}`
    );
  }

  // Enforce format rules
  if (!question.endsWith("?")) question = `${question}?`;
  if (question.length < minLen) {
    question = `${question} (${monthKey})`;
    if (!question.endsWith("?")) question = `${question}?`;
  }

  return { question, rationale, dataPoints };
}

// ── Main Monthly Postmortem Generator ─────────────────────────────────────────

/**
 * Generate a monthly evolution postmortem for the specified month.
 *
 * Scope: BUILD step — this generator did not previously exist in self_improvement.js
 * or state_tracker.js (Athena missing item #1 resolved).
 *
 * Reads:
 *   state/improvement_reports.json  — cycle lessons and analytics
 *   state/experiment_registry.json  — experiments (for counterfactuals)
 *   state/athena_postmortems.json   — decision quality postmortems
 *
 * Returns a structured result; caller must pass postmortem to persistMonthlyPostmortem
 * to write state/monthly_postmortem_{monthKey}.json.
 *
 * Status values:
 *   "ok"               — sufficient data, full report generated
 *   "insufficient_data" — cycleCount < minCycleCount (3); stub returned, no write recommended
 *   "degraded"          — generated with partial data; degradedSources lists affected fields
 *
 * Validation: missing vs invalid input produces distinct reason codes (degradedSources).
 * No silent fallback: degraded state sets explicit status + degradedSources array.
 *
 * @param {object}  config
 * @param {string}  [monthKey] — "YYYY-MM"; defaults to current month
 * @returns {Promise<{ ok: boolean, status: string, postmortem: object|null, reason?: string }>}
 */
export async function generateMonthlyPostmortem(config, monthKey) {
  const stateDir          = config?.paths?.stateDir || "state";
  const now               = new Date();
  const defaultMonthKey   = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const resolvedMonthKey  = monthKey || defaultMonthKey;

  const [reportsRaw, registryRaw, postmortemsRaw] = await Promise.all([
    readJsonSafe(path.join(stateDir, "improvement_reports.json")),
    readJsonSafe(path.join(stateDir, "experiment_registry.json")),
    readJsonSafe(path.join(stateDir, "athena_postmortems.json"))
  ]);

  const degradedSources = [];

  // ── Improvement reports ────────────────────────────────────────────────────
  let allReports = [];
  if (!reportsRaw.ok) {
    degradedSources.push(
      reportsRaw.reason === READ_JSON_REASON.MISSING
        ? POSTMORTEM_DEGRADED_REASON.IMPROVEMENT_REPORTS_ABSENT
        : POSTMORTEM_DEGRADED_REASON.IMPROVEMENT_REPORTS_INVALID
    );
  } else {
    allReports = Array.isArray(reportsRaw.data?.reports) ? reportsRaw.data.reports : [];
  }

  // Filter to the target month
  const [year, month] = resolvedMonthKey.split("-").map(Number);
  const monthStart    = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd      = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

  const monthlyReports = allReports.filter(r => {
    if (!r?.cycleAt) return false;
    const ts = new Date(r.cycleAt).getTime();
    return Number.isFinite(ts) && ts >= monthStart.getTime() && ts <= monthEnd.getTime();
  });

  const cycleCount = monthlyReports.length;

  // ── Insufficient data check (Athena missing item #7 resolved) ─────────────
  const minCycles = MONTHLY_POSTMORTEM_SCHEMA.minCycleCount;
  if (cycleCount < minCycles) {
    const insufficiencyReason =
      `INSUFFICIENT_CYCLES:${cycleCount}_recorded_minimum_${minCycles}_required`;
    const stub = {
      schemaVersion:       MONTHLY_POSTMORTEM_SCHEMA.schemaVersion,
      monthKey:            resolvedMonthKey,
      generatedAt:         new Date().toISOString(),
      status:              MONTHLY_POSTMORTEM_STATUS.INSUFFICIENT_DATA,
      insufficiencyReason,
      cycleCount,
      experimentOutcomes:  { total: 0, completed: 0, rolled_back: 0, counterfactuals: [] },
      compoundingEffects:  [],
      decisionQualityTrend: {
        trend:            POSTMORTEM_DECISION_TREND.INSUFFICIENT_DATA,
        confidence:       "low",
        timeWindowDays:   MONTHLY_POSTMORTEM_SCHEMA.trendTimeWindowDays,
        scoreBefore:      null,
        scoreAfter:       null,
        totalPostmortems: 0
      },
      seedQuestion: null
    };
    return { ok: true, status: MONTHLY_POSTMORTEM_STATUS.INSUFFICIENT_DATA, postmortem: stub };
  }

  // ── Experiment outcomes and counterfactuals ────────────────────────────────
  let allExperiments = [];
  if (!registryRaw.ok) {
    degradedSources.push(
      registryRaw.reason === READ_JSON_REASON.MISSING
        ? POSTMORTEM_DEGRADED_REASON.EXPERIMENT_REGISTRY_ABSENT
        : POSTMORTEM_DEGRADED_REASON.EXPERIMENT_REGISTRY_INVALID
    );
  } else {
    allExperiments = Array.isArray(registryRaw.data?.experiments) ? registryRaw.data.experiments : [];
  }

  const monthlyExperiments = allExperiments.filter(e => {
    const ts = new Date(e?.createdAt || e?.startedAt || 0).getTime();
    return Number.isFinite(ts) && ts >= monthStart.getTime() && ts <= monthEnd.getTime();
  });

  const counterfactuals = buildCounterfactuals(monthlyExperiments);
  const experimentOutcomes = {
    total:          monthlyExperiments.length,
    completed:      monthlyExperiments.filter(e => e.status === "completed").length,
    rolled_back:    monthlyExperiments.filter(e => e.status === "rolled_back").length,
    counterfactuals
  };

  // ── Compounding effects ────────────────────────────────────────────────────
  const compoundingEffects = computeCompoundingEffects(monthlyReports, resolvedMonthKey);

  // ── Decision quality trend ─────────────────────────────────────────────────
  let postmortems = [];
  if (!postmortemsRaw.ok) {
    degradedSources.push(
      postmortemsRaw.reason === READ_JSON_REASON.MISSING
        ? POSTMORTEM_DEGRADED_REASON.ATHENA_POSTMORTEMS_ABSENT
        : POSTMORTEM_DEGRADED_REASON.ATHENA_POSTMORTEMS_INVALID
    );
  } else {
    try {
      const migrated = migrateData(postmortemsRaw.data, STATE_FILE_TYPE.ATHENA_POSTMORTEMS);
      if (migrated.ok) {
        postmortems = extractPostmortemEntries(migrated.data);
      } else {
        degradedSources.push(POSTMORTEM_DEGRADED_REASON.ATHENA_POSTMORTEMS_MIGRATION_FAILED);
      }
    } catch {
      degradedSources.push(POSTMORTEM_DEGRADED_REASON.ATHENA_POSTMORTEMS_MIGRATION_ERROR);
    }
  }

  const decisionQualityTrend = computeDecisionQualityTrendForMonth(postmortems, resolvedMonthKey);

  // ── Seed question ──────────────────────────────────────────────────────────
  const seedQuestion = generateSeedQuestion(
    compoundingEffects, decisionQualityTrend, experimentOutcomes, resolvedMonthKey
  );

  // ── Stale unresolved carry-forward debts ───────────────────────────────────
  // Surface top N open debt items sorted by priority (critical+overdue first).
  // Non-fatal: failure to read ledger does not degrade the postmortem status.
  let staleUnresolvedDebts: any[] = [];
  try {
    const { entries: debtLedger, cycleCounter } = await loadLedgerMeta(config);
    staleUnresolvedDebts = prioritizeStaleDebts(debtLedger, cycleCounter).slice(0, 5).map(e => ({
      id:         e.id,
      lesson:     e.lesson,
      severity:   e.severity,
      owner:      e.owner,
      openedCycle: e.openedCycle,
      dueCycle:   e.dueCycle,
      cyclesOpen: e.cyclesOpen,
    }));
  } catch { /* no ledger data — omit stale debts from report */ }

  // ── Final status ───────────────────────────────────────────────────────────
  const status = degradedSources.length > 0
    ? MONTHLY_POSTMORTEM_STATUS.DEGRADED
    : MONTHLY_POSTMORTEM_STATUS.OK;

  const postmortem = {
    schemaVersion:       MONTHLY_POSTMORTEM_SCHEMA.schemaVersion,
    monthKey:            resolvedMonthKey,
    generatedAt:         new Date().toISOString(),
    status,
    insufficiencyReason: null,
    ...(degradedSources.length > 0 ? { degradedSources } : {}),
    cycleCount,
    experimentOutcomes,
    compoundingEffects,
    decisionQualityTrend,
    seedQuestion,
    staleUnresolvedDebts,
  };

  return { ok: true, status, postmortem };
}

/**
 * Quality-signal gate for self-improvement.
 * Returns true only if recent decision quality is degraded, escalation was recommended,
 * or enough cycles have elapsed since the last self-improvement run.
 *
 * @param {object} config
 * @param {string} stateDir
 * @returns {Promise<{ shouldRun: boolean, reason: string }>}
 */
export async function shouldTriggerSelfImprovement(config, stateDir) {
  const siConfig = config.selfImprovement || {};

  // Config override: always run if forceEveryComplete is true
  if (siConfig.forceEveryComplete === true) {
    return { shouldRun: true, reason: "forceEveryComplete=true" };
  }

  // Read recent postmortems
  const { readJson } = await import("./fs_utils.js");
  const postmortemsFilePath = path.join(stateDir, "athena_postmortems.json");
  const rawPms = await readJson(postmortemsFilePath, null);
  let recentPms = [];
  if (rawPms !== null) {
    const { migrateData, extractPostmortemEntries, STATE_FILE_TYPE } = await import("./schema_registry.js");
    const migrated = migrateData(rawPms, STATE_FILE_TYPE.ATHENA_POSTMORTEMS);
    recentPms = migrated.ok ? extractPostmortemEntries(migrated.data).slice(-5) : [];
  }

  // (a) Weighted decision score < 0.75 over last 5 postmortems
  const scoreResult = computeWeightedDecisionScore(recentPms);
  if (scoreResult.score !== null && scoreResult.score < 0.75) {
    return { shouldRun: true, reason: `decision_quality_low (score=${scoreResult.score.toFixed(2)})` };
  }

  // (b) Any postmortem recommended escalation
  const hasEscalation = recentPms.some(pm => pm.recommendation === "escalate");
  if (hasEscalation) {
    return { shouldRun: true, reason: "escalation_recommended" };
  }

  // (c) 3+ cycles since last self-improvement run
  const siStatePath = path.join(stateDir, "self_improvement_state.json");
  const siState = await readJson(siStatePath, {});
  const cyclesSinceLast = typeof siState.cyclesSinceLastRun === "number" ? siState.cyclesSinceLastRun : Infinity;
  if (cyclesSinceLast >= 3) {
    return { shouldRun: true, reason: `cycles_elapsed (${cyclesSinceLast} >= 3)` };
  }

  return { shouldRun: false, reason: `quality_ok (score=${scoreResult.score?.toFixed(2) ?? "n/a"}, cycles=${cyclesSinceLast})` };
}

export async function runSelfImprovementCycle(config) {
  const siConfig = config.selfImprovement || {};
  if (!siConfig.enabled) return null;

  const stateDir = config.paths?.stateDir || "state";

  // Guardrail gate: halt self-improvement if FREEZE_SELF_IMPROVEMENT guardrail is active.
  // This is set automatically when a catastrophe scenario (e.g. RUNAWAY_RETRIES,
  // MASS_BLOCKED_TASKS) is detected. Gated by systemGuardian.enabled for rollback safety.
  if (config.systemGuardian?.enabled !== false) {
    try {
      const frozen = await isGuardrailActive(config, GUARDRAIL_ACTION.FREEZE_SELF_IMPROVEMENT);
      if (frozen) {
        warn("[self-improvement] FREEZE_SELF_IMPROVEMENT guardrail active — skipping cycle");
        await appendProgress(config,
          "[SELF-IMPROVEMENT] Skipped: FREEZE_SELF_IMPROVEMENT guardrail is active (catastrophe scenario detected). Revert guardrail to resume."
        );
        return null;
      }
    } catch (err) {
      // Non-fatal: guardrail check failure must not block; continue with improvement
      warn(`[self-improvement] FREEZE_SELF_IMPROVEMENT guardrail check failed (non-fatal): ${String(err?.message || err)}`);
    }
  }

  // Governance freeze gate (T-040): self-improvement cycles are high-risk by default.
  // Blocked during month-12 freeze unless a critical incident override is provided.
  const freezeCheck = evaluateFreezeGate(config, {
    riskLevel:       "high",
    taskType:        "self_improvement",
    criticalOverride: siConfig.criticalOverride || null
  });
  if (!freezeCheck.allowed) {
    warn(`[self-improvement] governance freeze blocked cycle: ${freezeCheck.reason}`);
    await appendProgress(config,
      `[SELF-IMPROVEMENT] Skipped: governance freeze is active (result=${freezeCheck.result} reason=${freezeCheck.reason}). Provide criticalOverride to proceed.`
    );
    return { status: "freeze_blocked", reason: freezeCheck.reason, result: freezeCheck.result };
  }
  if (freezeCheck.result === FREEZE_GATE_RESULT.ALLOWED && freezeCheck.overrideApproved) {
    await appendProgress(config,
      `[SELF-IMPROVEMENT] Critical override granted: incidentId=${freezeCheck.overrideApproved.incidentId}`
    );
  }

  await appendProgress(config, "[SELF-IMPROVEMENT] Starting post-cycle analysis...");

  // 1. Collect cycle outcomes
  const outcomes = await collectCycleOutcomes(config);

  // Log degraded state explicitly — no silent fallback for critical state.
  if (outcomes.degraded) {
    warn(`[self-improvement] outcome collection degraded: ${outcomes.degradedReason} — source=${outcomes.metricsSource}`);
    await appendProgress(config,
      `[SELF-IMPROVEMENT] Degraded outcome collection: reason=${outcomes.degradedReason} source=${outcomes.metricsSource}`
    );
  }

  if (outcomes.totalPlans === 0 && outcomes.completedCount === 0) {
    await appendProgress(config, "[SELF-IMPROVEMENT] No plans or progress found — skipping analysis");
    return null;
  }

  // 2. Load existing knowledge
  const knowledgeMemory = await loadKnowledgeMemory(stateDir);

  // 3. Analyze with AI
  let analysis;
  try {
    analysis = await analyzeWithAI(config, outcomes, knowledgeMemory);
  } catch (err) {
    warn(`[self-improvement] AI analysis failed: ${String(err?.message || err)}`);
    await appendProgress(config, `[SELF-IMPROVEMENT] AI analysis failed: ${String(err?.message || err).slice(0, 200)}`);
    return null;
  }

  if (!analysis) {
    await appendProgress(config, "[SELF-IMPROVEMENT] AI returned no usable analysis");
    return null;
  }

  // 4. Store lessons in knowledge memory
  const newLessons = Array.isArray(analysis.lessons) ? analysis.lessons : [];
  for (const lesson of newLessons) {
    lesson.addedAt = new Date().toISOString();
    knowledgeMemory.lessons.push(lesson);
  }

  // Cap knowledge memory size
  const maxLessons = siConfig.maxReports || 200;
  if (knowledgeMemory.lessons.length > maxLessons) {
    knowledgeMemory.lessons = knowledgeMemory.lessons.slice(-maxLessons);
  }

  // Store prompt hints for next cycle
  if (Array.isArray(analysis.promptHints)) {
    knowledgeMemory.promptHints = analysis.promptHints;
  }

  // Store capability gaps — these feed back into Jesus's health audit
  const newGaps = Array.isArray(analysis.capabilityGaps) ? analysis.capabilityGaps : [];
  if (newGaps.length > 0) {
    if (!Array.isArray(knowledgeMemory.capabilityGaps)) knowledgeMemory.capabilityGaps = [];
    for (const gap of newGaps) {
      gap.detectedAt = new Date().toISOString();
      // Avoid duplicate gaps
      const isDuplicate = knowledgeMemory.capabilityGaps.some(
        existing => existing.gap === gap.gap
      );
      if (!isDuplicate) {
        knowledgeMemory.capabilityGaps.push(gap);
      }
    }
    // Cap capability gaps
    if (knowledgeMemory.capabilityGaps.length > 50) {
      knowledgeMemory.capabilityGaps = knowledgeMemory.capabilityGaps.slice(-50);
    }
    await appendProgress(config, `[SELF-IMPROVEMENT] ${newGaps.length} capability gap(s) detected: ${newGaps.map(g => g.gap).join("; ").slice(0, 300)}`);
  }

  await saveKnowledgeMemory(stateDir, knowledgeMemory);

  // 5. Apply safe config suggestions
  let appliedChanges = [];
  if (Array.isArray(analysis.configSuggestions)) {
    try {
      appliedChanges = await applyConfigSuggestions(config, analysis.configSuggestions);
    } catch (err) {
      warn(`[self-improvement] config apply error: ${String(err?.message || err)}`);
    }
  }

  // 5a. Process running canary experiments — record metrics and advance state
  let canaryResults = [];
  try {
    canaryResults = await processRunningCanaries(config, outcomes, `si-${Date.now()}`);
    if (canaryResults.length > 0) {
      const summary = canaryResults.map(r => `${r.canaryId}→${r.action}`).join(", ");
      await appendProgress(config, `[SELF-IMPROVEMENT] Canary cycle results: ${summary}`);
    }
  } catch (err) {
    warn(`[self-improvement] canary processing error: ${String(err?.message || err)}`);
  }

  // 6. Save improvement report
  const appliedCount = appliedChanges.filter(c => c.status === "applied").length;
  const blockedCount = appliedChanges.filter(c => c.status === "blocked").length;
  const canaryStartedCount = appliedChanges.filter(c => c.status === "canary_started").length;
  const report = {
    cycleAt: new Date().toISOString(),
    outcomes: {
      totalPlans: outcomes.totalPlans,
      completedCount: outcomes.completedCount,
      workerOutcomes: outcomes.workerOutcomes.map(w => ({
        role: w.role,
        status: w.status,
        timeouts: w.timeouts,
        failures: w.failures,
        hasPR: w.hasPR
      })),
      decisionQuality: outcomes.decisionQuality,
      athenaPlanReview: outcomes.athenaPlanReview,
      metricsSource: outcomes.metricsSource,
      degraded: outcomes.degraded,
      degradedReason: outcomes.degradedReason
    },
    analysis: {
      systemHealthScore: analysis.systemHealthScore || 0,
      lessonsCount: newLessons.length,
      capabilityGapsCount: newGaps.length,
      configChangesApplied: appliedCount,
      configChangesBlocked: blockedCount,
      configChangesCanaryStarted: canaryStartedCount,
      nextCyclePriorities: analysis.nextCyclePriorities || [],
      workerFeedback: analysis.workerFeedback || [],
      capabilityGaps: newGaps
    },
    appliedChanges,
    canaryResults
  };

  // 7. Score pre-mortem quality for high-risk plans (AC5: post-cycle pre-mortem scoring)
  // Reads prometheus_analysis.json and scores any high-risk plan pre-mortems.
  // Results are stored in state/premortem_scores.json and summarized in the report.
  let premortemScoring = { scores: [], averageScore: null };
  try {
    const prometheusResult = await readJsonSafe(path.join(stateDir, "prometheus_analysis.json"));
    const prometheusData = prometheusResult.ok ? prometheusResult.data : null;
    premortemScoring = await scoreAndStorePremortemQuality(config, prometheusData);
    if (premortemScoring.scores.length > 0) {
      await appendProgress(config,
        `[SELF-IMPROVEMENT] Pre-mortem quality scored: ${premortemScoring.scores.length} high-risk plan(s) | averageScore=${premortemScoring.averageScore?.toFixed(1) ?? "N/A"}/${PREMORTEM_MAX_SCORE}`
      );
    }
  } catch (err) {
    // Non-fatal: pre-mortem scoring failure must not block the improvement report
    warn(`[self-improvement] pre-mortem scoring failed: ${String(err?.message || err)}`);
  }
  (report as any).premortemScoring = {
    scoredCount: premortemScoring.scores.length,
    averageScore: premortemScoring.averageScore,
    maxScore: PREMORTEM_MAX_SCORE
  };

  // Append to reports log
  const reportsPath = path.join(stateDir, "improvement_reports.json");
  const existingReports = await readJson(reportsPath, { reports: [] });
  existingReports.reports.push(report);

  // Cap reports
  if (existingReports.reports.length > (siConfig.maxReports || 200)) {
    existingReports.reports = existingReports.reports.slice(-(siConfig.maxReports || 200));
  }
  await writeJson(reportsPath, existingReports);

  // 8. Compute reviewer precision/recall and feed into policy tuning
  // Reads the full athena_postmortems history to compute precision, recall,
  // and FP rate. Derives policy adjustment signals and persists to reviewer_metrics.json.
  let reviewerMetrics = null;
  try {
    const rawPmsForPR = await readJson(path.join(stateDir, "athena_postmortems.json"), null);
    if (rawPmsForPR !== null) {
      const migratedForPR = migrateData(rawPmsForPR, STATE_FILE_TYPE.ATHENA_POSTMORTEMS);
      if (migratedForPR.ok) {
        const entriesForPR = extractPostmortemEntries(migratedForPR.data);
        reviewerMetrics = computeReviewerPrecisionRecall(entriesForPR);
        await persistReviewerMetrics(config, reviewerMetrics);
        const policyAdj = deriveReviewerPolicyAdjustment(reviewerMetrics);
        if (policyAdj.lessons.length > 0) {
          for (const lesson of policyAdj.lessons) {
            lesson.addedAt = new Date().toISOString();
            knowledgeMemory.lessons.push(lesson);
          }
          if (knowledgeMemory.lessons.length > (siConfig.maxReports || 200)) {
            knowledgeMemory.lessons = knowledgeMemory.lessons.slice(-(siConfig.maxReports || 200));
          }
          await saveKnowledgeMemory(stateDir, knowledgeMemory);
        }
        if (policyAdj.warnings.length > 0) {
          await appendProgress(config,
            `[SELF-IMPROVEMENT] Reviewer precision/recall: precision=${reviewerMetrics.precision !== null ? (reviewerMetrics.precision * 100).toFixed(1) + "%" : "N/A"} fpr=${reviewerMetrics.falsePositiveRate !== null ? (reviewerMetrics.falsePositiveRate * 100).toFixed(1) + "%" : "N/A"} signal=${policyAdj.policySignal}`
          );
        }
      }
    }
  } catch (err) {
    warn(`[self-improvement] reviewer precision/recall computation failed: ${String((err as any)?.message || err)}`);
  }
  (report as any).reviewerMetrics = reviewerMetrics !== null ? {
    precision: reviewerMetrics.precision,
    recall: reviewerMetrics.recall,
    falsePositiveRate: reviewerMetrics.falsePositiveRate,
    reworkRate: reviewerMetrics.reworkRate,
    f1: reviewerMetrics.f1,
    knownOutcomes: reviewerMetrics.knownOutcomes
  } : null;
  const healthScore = analysis.systemHealthScore || 0;
  const lessonsStr = newLessons.map(l => `[${l.severity}] ${l.lesson}`).join("; ").slice(0, 300);
  await appendProgress(config,
    `[SELF-IMPROVEMENT] Analysis complete — health=${healthScore}/100 | lessons=${newLessons.length} | config-changes=${appliedCount} | config-blocked=${blockedCount} | canary-started=${canaryStartedCount} | ${lessonsStr}`
  );

  chatLog(stateDir, "SelfImprovement",
    `Cycle analysis: health=${healthScore}/100, lessons=${newLessons.length}, applied=${appliedCount}, blocked=${blockedCount}`
  );

  return report;
}

// ── Reviewer Precision/Recall Policy Tuning ───────────────────────────────────

/**
 * Thresholds used by deriveReviewerPolicyAdjustment.
 * Conservative defaults — override via config if needed.
 *
 * FP_RATE_HIGH     — max acceptable false positive rate (approved plans that failed)
 * REWORK_RATE_HIGH — max acceptable rework rate (approved plans that needed rework)
 * PRECISION_LOW    — min acceptable precision; below this emits a critical lesson
 */
export const REVIEWER_POLICY_THRESHOLDS = Object.freeze({
  FP_RATE_HIGH:    0.25,
  REWORK_RATE_HIGH: 0.35,
  PRECISION_LOW:   0.65,
});

/**
 * Derive policy adjustment signals from reviewer precision/recall metrics.
 *
 * Returns:
 *   suggestedMinScore — recommended planQualityMinScore (null = no change)
 *   warnings          — human-readable warning strings
 *   lessons           — lesson objects to inject into knowledge memory
 *   policySignal      — "tighten" | "deepen" | "ok"
 *
 * Logic:
 *   falsePositiveRate > FP_RATE_HIGH  -> signal=tighten, raise planQualityMinScore
 *   reworkRate > REWORK_RATE_HIGH     -> signal=deepen, improve verification depth
 *   precision < PRECISION_LOW         -> emit critical lesson
 *
 * @param {object} metrics - result from computeReviewerPrecisionRecall
 * @returns {{ suggestedMinScore: number|null, warnings: string[], lessons: object[], policySignal: string }}
 */
export function deriveReviewerPolicyAdjustment(metrics: any): {
  suggestedMinScore: number | null;
  warnings: string[];
  lessons: any[];
  policySignal: "tighten" | "deepen" | "ok";
} {
  if (!metrics || metrics.knownOutcomes === 0) {
    return { suggestedMinScore: null, warnings: [], lessons: [], policySignal: "ok" };
  }
  const warnings: string[] = [];
  const lessons: any[] = [];
  let suggestedMinScore: number | null = null;
  let policySignal: "tighten" | "deepen" | "ok" = "ok";
  const fp   = typeof metrics.falsePositiveRate === "number" ? metrics.falsePositiveRate : null;
  const rw   = typeof metrics.reworkRate       === "number" ? metrics.reworkRate        : null;
  const prec = typeof metrics.precision        === "number" ? metrics.precision         : null;

  if (fp !== null && fp > REVIEWER_POLICY_THRESHOLDS.FP_RATE_HIGH) {
    policySignal = "tighten";
    suggestedMinScore = 55;
    warnings.push(
      `Reviewer false positive rate ${(fp * 100).toFixed(1)}% exceeds threshold ` +
      `${(REVIEWER_POLICY_THRESHOLDS.FP_RATE_HIGH * 100).toFixed(0)}% — recommend raising planQualityMinScore`
    );
    lessons.push({
      lesson: `Athena approved ${(fp * 100).toFixed(1)}% of plans that failed — tighten plan quality gate (planQualityMinScore)`,
      source: "reviewer_precision_recall",
      category: "prompt-quality",
      severity: "warning"
    });
  }

  if (rw !== null && rw > REVIEWER_POLICY_THRESHOLDS.REWORK_RATE_HIGH) {
    if (policySignal === "ok") policySignal = "deepen";
    warnings.push(
      `Reviewer rework rate ${(rw * 100).toFixed(1)}% exceeds threshold ` +
      `${(REVIEWER_POLICY_THRESHOLDS.REWORK_RATE_HIGH * 100).toFixed(0)}% — plans need more iteration than expected`
    );
    lessons.push({
      lesson: `${(rw * 100).toFixed(1)}% of successful plans required rework — improve verification depth in plan review`,
      source: "reviewer_precision_recall",
      category: "prompt-quality",
      severity: "info"
    });
  }

  if (prec !== null && prec < REVIEWER_POLICY_THRESHOLDS.PRECISION_LOW) {
    if (policySignal === "ok") policySignal = "tighten";
    lessons.push({
      lesson: `Reviewer precision ${(prec * 100).toFixed(1)}% is below threshold ` +
        `${(REVIEWER_POLICY_THRESHOLDS.PRECISION_LOW * 100).toFixed(0)}% — review acceptance criteria and plan quality standards`,
      source: "reviewer_precision_recall",
      category: "prompt-quality",
      severity: "critical"
    });
  }

  return { suggestedMinScore, warnings, lessons, policySignal };
}

/**
 * Persist reviewer precision/recall metrics to state/reviewer_metrics.json.
 * Appends to a rolling history capped at 100 entries.
 * Non-fatal: errors are logged but do not throw.
 *
 * @param {object} config
 * @param {object} metrics - result from computeReviewerPrecisionRecall
 * @returns {Promise<void>}
 */
export async function persistReviewerMetrics(config: any, metrics: any): Promise<void> {
  const stateDir = config?.paths?.stateDir || "state";
  const metricsPath = path.join(stateDir, "reviewer_metrics.json");
  try {
    const existing = await readJson(metricsPath, { history: [] });
    existing.history.push({ ...metrics, computedAt: metrics.computedAt || new Date().toISOString() });
    if (existing.history.length > 100) existing.history = existing.history.slice(-100);
    existing.updatedAt = new Date().toISOString();
    await writeJson(metricsPath, existing);
  } catch (err) {
    warn(`[self-improvement] failed to persist reviewer metrics: ${String((err as any)?.message || err)}`);
  }
}

```

### FILE: src/core/carry_forward_ledger.ts
```typescript
/**
 * carry_forward_ledger.js — Carry-forward debt tracking (Packet 11)
 *
 * Tracks unresolved postmortem lessons as debt items with owner,
 * due-cycle, and closure evidence. Integrates with Athena plan gates
 * to block acceptance when critical debt exceeds SLA.
 */

import path from "node:path";
import { createHash } from "node:crypto";
import { readJson, writeJson } from "./fs_utils.js";

/**
 * @typedef {object} DebtEntry
 * @property {string} id — unique debt ID
 * @property {string} lesson — the original lesson text
 * @property {string} fingerprint — deterministic SHA-256 fingerprint of the canonical lesson text
 * @property {string} owner — who should fix this
 * @property {number} openedCycle — cycle number when first detected
 * @property {number} dueCycle — cycle number by which it must be closed
 * @property {string} severity — "critical" | "warning"
 * @property {string|null} closedAt — ISO timestamp when closed, null if open
 * @property {string|null} closureEvidence — evidence that it was fixed
 * @property {number} cyclesOpen — how many cycles this has been open
 */

/**
 * Canonical form used for fingerprinting — strips prompt boilerplate phrases
 * so that semantically identical lessons produce the same fingerprint regardless
 * of preamble wording. Mirrors the normalisation in prometheus.ts.
 */
function canonicalize(text: string): string {
  const s = String(text || "").toLowerCase();
  return s
    .replace(/[`'"(){}]|\[|\]/g, " ")
    .replace(/create\s+and\s+complete\s+a\s+task\s+to\s+/g, "")
    .replace(/create\s+a\s+dedicated\s+task\s+to\s+/g, "")
    .replace(/this\s+is\s+now\s+a\s+gate\s*-?\s*blocking\s+item[^.]*\.?/g, "")
    .replace(/athena\s+must\s+(block|reject)[^.]*\.?/g, "")
    .replace(/this\s+fix\s+must\s+ship[^.]*\.?/g, "")
    .replace(/blocking\s+defect[^:]*:\s*/g, "")
    .replace(/\b(five|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen)\s+consecutive\s+postmortem\s+audit\s+records\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Compute a deterministic 16-hex-char SHA-256 fingerprint of a lesson/task text.
 * The fingerprint is based on the canonical form so that the same semantic content
 * always maps to the same fingerprint regardless of boilerplate preamble.
 * Returns null if the canonical text is too short to be meaningful.
 *
 * @param {string} text
 * @returns {string|null}
 */
export function computeFingerprint(text: string): string | null {
  const canonical = canonicalize(text);
  if (canonical.length < 5) return null;
  return createHash("sha256").update(canonical).digest("hex").slice(0, 16);
}

const LEDGER_FILE = "carry_forward_ledger.json";

/**
 * Load the carry-forward ledger from state.
 *
 * @param {object} config
 * @returns {Promise<DebtEntry[]>}
 */
export async function loadLedger(config) {
  const stateDir = config?.paths?.stateDir || "state";
  const data = await readJson(path.join(stateDir, LEDGER_FILE), { entries: [] });
  return Array.isArray(data.entries) ? data.entries : [];
}

/**
 * Load the carry-forward ledger and its cycle counter from state.
 * The cycleCounter is a persistent integer that is incremented once per
 * orchestration cycle so that debt SLA deadlines stay anchored to a
 * monotonic sequence that is independent of wall-clock timestamps.
 *
 * @param {object} config
 * @returns {Promise<{ entries: DebtEntry[], cycleCounter: number }>}
 */
export async function loadLedgerMeta(config): Promise<{ entries: any[], cycleCounter: number }> {
  const stateDir = config?.paths?.stateDir || "state";
  const data = await readJson(path.join(stateDir, LEDGER_FILE), { entries: [], cycleCounter: 1 });
  const entries = Array.isArray(data.entries) ? data.entries : [];
  const cycleCounter = typeof data.cycleCounter === "number" && data.cycleCounter > 0
    ? data.cycleCounter
    : 1;
  return { entries, cycleCounter };
}

/**
 * Save the ledger to state.
 *
 * @param {object} config
 * @param {DebtEntry[]} entries
 */
export async function saveLedger(config, entries) {
  const stateDir = config?.paths?.stateDir || "state";
  await writeJson(path.join(stateDir, LEDGER_FILE), {
    entries,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Save the ledger with an explicit cycle counter.
 * Use this when advancing the cycle (end-of-cycle accumulation path).
 *
 * @param {object} config
 * @param {DebtEntry[]} entries
 * @param {number} cycleCounter
 */
export async function saveLedgerFull(config, entries, cycleCounter: number) {
  const stateDir = config?.paths?.stateDir || "state";
  await writeJson(path.join(stateDir, LEDGER_FILE), {
    entries,
    cycleCounter,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Add new debt entries from postmortem follow-ups.
 * Deduplicates by normalized lesson text.
 * When a new item matches an existing open entry (same fingerprint), increments
 * `recurrenceCount` on the canonical entry rather than adding a duplicate.
 *
 * @param {DebtEntry[]} ledger — existing entries
 * @param {Array<{ followUpTask: string, workerName?: string, severity?: string }>} newItems
 * @param {number} currentCycle
 * @param {{ slaMaxCycles?: number }} opts
 * @returns {DebtEntry[]} — updated ledger
 */
export function addDebtEntries(ledger, newItems, currentCycle, opts: any = {}) {
  const sla = opts.slaMaxCycles || 3;
  const existing = [...ledger];

  // Build fingerprint → open entry map so we can increment recurrenceCount in-place.
  const openByFingerprint = new Map<string, any>();
  for (const e of existing) {
    if (e.closedAt) continue;
    const fp = e.fingerprint || computeFingerprint(String(e.lesson || ""));
    if (fp && !openByFingerprint.has(fp)) {
      openByFingerprint.set(fp, e);
    }
  }

  for (const item of (newItems || [])) {
    const lesson = String(item.followUpTask || "").trim();
    if (!lesson || lesson.length < 10) continue;
    const fingerprint = computeFingerprint(lesson);
    if (!fingerprint) continue;

    const canonicalEntry = openByFingerprint.get(fingerprint);
    if (canonicalEntry) {
      // Duplicate: bump recurrence count on the existing canonical entry instead
      // of creating a new debt item.
      canonicalEntry.recurrenceCount = (canonicalEntry.recurrenceCount || 1) + 1;
      canonicalEntry.lastRecurredCycle = currentCycle;
      continue;
    }

    const newEntry: any = {
      id: `debt-${currentCycle}-${existing.length}`,
      lesson,
      fingerprint,
      owner: item.workerName || "evolution-worker",
      openedCycle: currentCycle,
      dueCycle: currentCycle + sla,
      severity: item.severity || "warning",
      closedAt: null,
      closureEvidence: null,
      cyclesOpen: 0,
      recurrenceCount: 1,
    };
    existing.push(newEntry);
    openByFingerprint.set(fingerprint, newEntry);
  }

  return existing;
}

/**
 * Increment cycle counters for open entries and flag overdue items.
 * Also identifies entries that are approaching their due cycle (within 1 cycle)
 * as an early-warning tier so callers can escalate before the hard SLA breach.
 *
 * @param {DebtEntry[]} ledger
 * @param {number} currentCycle
 * @returns {{ ledger: DebtEntry[], overdue: DebtEntry[], earlyWarning: DebtEntry[] }}
 */
export function tickCycle(ledger, currentCycle) {
  const overdue = [];
  const earlyWarning = [];
  for (const entry of ledger) {
    if (entry.closedAt) continue;
    entry.cyclesOpen = currentCycle - entry.openedCycle;
    if (currentCycle > entry.dueCycle) {
      overdue.push(entry);
    } else if (currentCycle >= entry.dueCycle - 1) {
      // One cycle before the SLA deadline — surface as early warning.
      earlyWarning.push(entry);
    }
  }
  return { ledger, overdue, earlyWarning };
}

/**
 * Close a debt entry with evidence.
 *
 * @param {DebtEntry[]} ledger
 * @param {string} debtId
 * @param {string} evidence
 * @returns {boolean} — true if found and closed
 */
export function closeDebt(ledger, debtId, evidence) {
  const entry = ledger.find(e => e.id === debtId);
  if (!entry || entry.closedAt) return false;
  entry.closedAt = new Date().toISOString();
  entry.closureEvidence = evidence;
  return true;
}

/**
 * Get all open (unclosed) debt entries.
 *
 * @param {DebtEntry[]} ledger
 * @returns {DebtEntry[]}
 */
export function getOpenDebts(ledger) {
  return ledger.filter(e => !e.closedAt);
}

/**
 * Auto-close open debt entries that have been verified as resolved.
 *
 * A debt entry is considered resolved when a completed worker task has a
 * canonical fingerprint that matches the entry's fingerprint AND the worker
 * supplied non-trivial verification evidence (>= 5 characters).
 *
 * Entries without a matching resolved item remain open and continue to block
 * future cycles via shouldBlockOnDebt. This is intentional: we never close
 * debt speculatively — evidence is required.
 *
 * @param {DebtEntry[]} ledger — carry-forward ledger (mutated in place)
 * @param {Array<{ taskText: string, verificationEvidence: string }>} resolvedItems
 * @returns {number} — count of newly closed entries
 */
export function autoCloseVerifiedDebt(
  ledger: any[],
  resolvedItems: Array<{ taskText: string; verificationEvidence: string }>
): number {
  if (!Array.isArray(resolvedItems) || resolvedItems.length === 0) return 0;

  // Build fingerprint → evidence map for all resolved items with real evidence.
  const resolvedFingerprints = new Map<string, string>();
  for (const item of resolvedItems) {
    const evidence = String(item.verificationEvidence || "").trim();
    if (evidence.length < 5) continue;
    const fingerprint = computeFingerprint(String(item.taskText || ""));
    if (!fingerprint) continue;
    if (!resolvedFingerprints.has(fingerprint)) {
      resolvedFingerprints.set(fingerprint, evidence);
    }
  }

  if (resolvedFingerprints.size === 0) return 0;

  let closedCount = 0;
  for (const entry of ledger) {
    if (entry.closedAt) continue;
    const entryFp = entry.fingerprint || computeFingerprint(String(entry.lesson || ""));
    if (!entryFp) continue;
    const evidence = resolvedFingerprints.get(entryFp);
    if (evidence !== undefined) {
      entry.closedAt = new Date().toISOString();
      entry.closureEvidence = evidence.slice(0, 500);
      closedCount++;
    }
  }

  return closedCount;
}

/**
 * Return open debt entries sorted by priority for operator attention.
 *
 * Sort order (highest priority first):
 *   1. critical + overdue (currentCycle > dueCycle)
 *   2. warning  + overdue
 *   3. critical + approaching-SLA (within 1 cycle of due)
 *   4. warning  + not-yet-overdue
 *
 * Within each tier, entries are sorted by cyclesOpen descending (stalest first).
 *
 * Side-effect: updates `cyclesOpen` on each returned open entry.
 * Closed entries are excluded.
 *
 * @param {DebtEntry[]} ledger
 * @param {number} currentCycle
 * @returns {DebtEntry[]}
 */
export function prioritizeStaleDebts(ledger: any[], currentCycle: number): any[] {
  const open = ledger.filter(e => !e.closedAt);
  for (const entry of open) {
    entry.cyclesOpen = currentCycle - entry.openedCycle;
  }
  return open.sort((a, b) => {
    const aOverdue = currentCycle > a.dueCycle;
    const bOverdue = currentCycle > b.dueCycle;
    const aCritical = a.severity === "critical";
    const bCritical = b.severity === "critical";
    // Priority tiers: critical+overdue=4, warning+overdue=3, critical+pending=2, warning+pending=1
    const aScore = (aCritical ? 2 : 1) + (aOverdue ? 2 : 0);
    const bScore = (bCritical ? 2 : 1) + (bOverdue ? 2 : 0);
    if (aScore !== bScore) return bScore - aScore;
    // Tiebreak: stalest first
    return b.cyclesOpen - a.cyclesOpen;
  });
}

/**
 * Check if critical overdue debt should block plan acceptance.
 * Returns a structured `reasonCode` so callers can react programmatically
 * without parsing the free-form reason string.
 *
 * @param {DebtEntry[]} ledger
 * @param {number} currentCycle
 * @param {{ maxCriticalOverdue?: number }} opts
 * @returns {{ shouldBlock: boolean, reason: string, reasonCode: string|null, overdueCount: number, earlyWarningCount: number }}
 */
export function shouldBlockOnDebt(ledger, currentCycle, opts: any = {}) {
  const maxCritical = opts.maxCriticalOverdue ?? 3;
  const { overdue, earlyWarning } = tickCycle(ledger, currentCycle);
  const criticalOverdue = overdue.filter(e => e.severity === "critical");
  const criticalEarlyWarning = earlyWarning.filter(e => e.severity === "critical");

  if (criticalOverdue.length >= maxCritical) {
    return {
      shouldBlock: true,
      reason: `${criticalOverdue.length} critical debt items overdue (limit: ${maxCritical})`,
      reasonCode: "DEBT_SLA_EXCEEDED",
      overdueCount: criticalOverdue.length,
      earlyWarningCount: criticalEarlyWarning.length,
    };
  }
  return {
    shouldBlock: false,
    reason: criticalEarlyWarning.length > 0
      ? `${criticalEarlyWarning.length} critical debt item(s) approaching SLA deadline`
      : "",
    reasonCode: criticalEarlyWarning.length > 0 ? "DEBT_APPROACHING_SLA" : null,
    overdueCount: criticalOverdue.length,
    earlyWarningCount: criticalEarlyWarning.length,
  };
}



// ── Reviewer Debt Tracking ────────────────────────────────────────────────────

/**
 * Create a carry-forward debt entry if the reviewer false positive rate is
 * persistently high (exceeds threshold AND we have enough known outcomes).
 *
 * Guards:
 *   - knownOutcomes < 5 -> no action (too sparse to be meaningful)
 *   - An open debt with the "reviewer-high-fpr" marker already exists -> no duplicate
 *   - falsePositiveRate <= threshold -> no action
 *
 * @param {DebtEntry[]} ledger - existing carry-forward ledger
 * @param {{ falsePositiveRate: number|null, knownOutcomes: number }} metrics
 * @param {number} currentCycle
 * @param {{ fpRateThreshold?: number, slaMaxCycles?: number }} opts
 * @returns {DebtEntry[]} - updated ledger (new array; original is not mutated)
 */
export function createReviewerDebtIfNeeded(
  ledger: any[],
  metrics: { falsePositiveRate: number | null; knownOutcomes: number },
  currentCycle: number,
  opts: any = {}
): any[] {
  const threshold  = typeof opts.fpRateThreshold === "number" ? opts.fpRateThreshold : 0.3;
  const sla        = typeof opts.slaMaxCycles    === "number" ? opts.slaMaxCycles    : 3;
  const fpr        = metrics?.falsePositiveRate;
  const known      = metrics?.knownOutcomes ?? 0;

  // Require minimum sample before raising debt
  if (fpr === null || fpr === undefined || known < 5 || fpr <= threshold) return [...ledger];

  const existing = [...ledger];
  const alreadyOpen = existing.some(
    e => !e.closedAt && typeof e.lesson === "string" && e.lesson.includes("reviewer-high-fpr")
  );
  if (alreadyOpen) return existing;

  const lesson = `reviewer-high-fpr: Athena approved ${(fpr * 100).toFixed(1)}% of plans that failed ` +
    `(threshold ${(threshold * 100).toFixed(0)}%) — review and tighten plan quality gate`;
  const fingerprint = computeFingerprint(lesson);
  if (!fingerprint) return existing;

  existing.push({
    id:              `debt-reviewer-${currentCycle}`,
    lesson,
    fingerprint,
    owner:           "governance-worker",
    openedCycle:     currentCycle,
    dueCycle:        currentCycle + sla,
    severity:        "critical",
    closedAt:        null,
    closureEvidence: null,
    cyclesOpen:      0,
  });
  return existing;
}

// ── Duplicate clustering and ledger compression ───────────────────────────────

/**
 * Cluster open debt entries by their fingerprint.
 *
 * Returns a Map from fingerprint → array of open entries with that fingerprint,
 * limited to clusters that contain more than one entry (true duplicates).
 * Entries without a fingerprint are ignored (they cannot be deduplicated safely).
 *
 * @param {any[]} ledger
 * @returns {Map<string, any[]>} fingerprint → array of duplicate open entries
 */
export function clusterDuplicateDebts(ledger: any[]): any[][] {
  const map = new Map<string, any[]>();

  for (const entry of (ledger || [])) {
    if (entry.closedAt) continue; // only cluster open entries
    const fp = entry.fingerprint || computeFingerprint(String(entry.lesson || ""));
    if (!fp) continue;

    if (!map.has(fp)) {
      map.set(fp, []);
    }
    map.get(fp)!.push(entry);
  }

  // Remove singletons — only return actual duplicates
  for (const [fp, entries] of map) {
    if (entries.length <= 1) map.delete(fp);
  }

  return Array.from(map.values());
}

/**
 * Compress unresolved debt by collapsing duplicate open entries (same fingerprint)
 * into a single canonical item and retiring the redundant copies.
 *
 * Algorithm:
 *   1. Group open entries by fingerprint.
 *   2. For each group with ≥ 2 open entries:
 *      - Keep the oldest entry (lowest openedCycle, then first insertion order).
 *        The canonical entry is annotated with recurrence metadata:
 *          - `recurrenceCount`   total number of times this lesson has been recorded
 *          - `firstSeenCycle`    the earliest openedCycle in the cluster
 *          - `lastRecurredCycle` the most recent openedCycle in the cluster
 *          - `clusterSize`       synonym for recurrenceCount (operator visibility)
 *          - `clusterFingerprint` stable fingerprint linking all members
 *      - Close the remaining entries with strict retirement evidence that
 *        embeds the canonical ID, canonical lesson text (first 120 chars),
 *        and cluster-fingerprint so entries are fully traceable without
 *        cross-referencing the rest of the ledger.
 *   3. Return the mutated ledger (in-place), a count of retired entries, and
 *      a summary of clusters processed.
 *
 * This operation is idempotent: running twice produces the same result because
 * the redundant entries are already closed after the first run.
 *
 * @param {any[]} ledger — carry-forward ledger (mutated in place)
 * @returns {{ compressedCount: number, clustersProcessed: number, retirementIds: string[] }}
 */
export function compressLedger(ledger: any[]): {
  compressedCount: number;
  clustersProcessed: number;
  retirementIds: string[];
} {
  if (!Array.isArray(ledger) || ledger.length === 0) {
    return { compressedCount: 0, clustersProcessed: 0, retirementIds: [] };
  }

  const clusters = clusterDuplicateDebts(ledger);
  let compressedCount = 0;
  let clustersProcessed = 0;
  const retirementIds: string[] = [];
  const retiredAt = new Date().toISOString();

  for (const entries of clusters) {
    // Sort by openedCycle ascending, then by array index (first insertion wins)
    const sorted = [...entries].sort((a, b) => {
      const cycleDiff = (a.openedCycle || 0) - (b.openedCycle || 0);
      return cycleDiff !== 0 ? cycleDiff : ledger.indexOf(a) - ledger.indexOf(b);
    });

    const canonical = sorted[0];
    const duplicates = sorted.slice(1);
    const fp = canonical.fingerprint || canonical.clusterFingerprint || "";
    const clusterSize = duplicates.length + 1;

    // Recurrence metadata: reflect how many times this lesson has appeared across
    // cycles, and the full cycle range to give operators a recurrence timeline.
    const allCycles = sorted.map(e => e.openedCycle || 0);
    const firstSeenCycle = Math.min(...allCycles);
    const lastRecurredCycle = Math.max(...allCycles);
    // Preserve the highest recurrenceCount already accumulated via addDebtEntries.
    const priorRecurrence = Math.max(...sorted.map(e => e.recurrenceCount || 1));
    const resolvedRecurrenceCount = Math.max(clusterSize, priorRecurrence);

    canonical.clusterSize = clusterSize;
    canonical.clusterFingerprint = fp;
    canonical.recurrenceCount = resolvedRecurrenceCount;
    canonical.firstSeenCycle = firstSeenCycle;
    canonical.lastRecurredCycle = lastRecurredCycle;

    // Strict closure evidence: include canonical lesson text so retired entries
    // are fully traceable without a secondary ledger lookup.
    const canonicalLessonSnippet = String(canonical.lesson || "").slice(0, 120);

    // Retire each duplicate with strict retirement evidence
    for (const dup of duplicates) {
      dup.closedAt = retiredAt;
      dup.closureEvidence = [
        `retired-by-compression:`,
        `canonical-id=${canonical.id}`,
        `cluster-fingerprint=${fp}`,
        `cluster-size=${clusterSize}`,
        `recurrence-count=${resolvedRecurrenceCount}`,
        `first-seen-cycle=${firstSeenCycle}`,
        `last-recurred-cycle=${lastRecurredCycle}`,
        `canonical-lesson="${canonicalLessonSnippet}"`,
      ].join(" ");
      retirementIds.push(dup.id);
      compressedCount++;
    }

    clustersProcessed++;
  }

  return { compressedCount, clustersProcessed, retirementIds };
}

/**
 * Classify carry-forward pending entries by recurrence count.
 *
 * High-recurrence items (appearing >= recurrenceThreshold times across all
 * postmortem entries) are always surfaced in prompts; low-recurrence items
 * can be capped to reduce prompt bulk.
 *
 * @param pendingEntries  - carry-forward entries with followUpNeeded=true (already deduped)
 * @param allPostmortemEntries - full postmortem entry list used to count recurrences
 * @param opts.recurrenceThreshold - minimum count to classify as high-recurrence (default: 3)
 * @returns {{ highRecurrence: any[], lowRecurrence: any[] }}
 */
export function classifyCarryForwardByRecurrence(
  pendingEntries: any[],
  allPostmortemEntries: any[],
  opts: { recurrenceThreshold?: number } = {}
): { highRecurrence: any[]; lowRecurrence: any[] } {
  const threshold = opts.recurrenceThreshold ?? 3;
  const pending = Array.isArray(pendingEntries) ? pendingEntries : [];
  const allEntries = Array.isArray(allPostmortemEntries) ? allPostmortemEntries : [];

  if (pending.length === 0) return { highRecurrence: [], lowRecurrence: [] };

  // Count how many times each pending task fingerprint appears in all postmortem entries.
  const recurrenceMap = new Map<string, number>();
  for (const entry of allEntries) {
    const text = String(entry.followUpTask || entry.lessonLearned || "");
    const fp = computeFingerprint(text);
    if (fp) recurrenceMap.set(fp, (recurrenceMap.get(fp) ?? 0) + 1);
  }

  const highRecurrence: any[] = [];
  const lowRecurrence: any[] = [];

  for (const entry of pending) {
    const fp = computeFingerprint(String(entry.followUpTask || ""));
    const count = fp ? (recurrenceMap.get(fp) ?? 1) : 1;
    if (count >= threshold) {
      highRecurrence.push({ ...entry, _recurrenceCount: count });
    } else {
      lowRecurrence.push({ ...entry, _recurrenceCount: count });
    }
  }

  return { highRecurrence, lowRecurrence };
}

```

### FILE: src/core/cycle_analytics.ts
```typescript
/**
 * BOX Cycle Analytics
 *
 * Generates cycle_analytics.json per orchestration loop with normalized KPIs,
 * confidence assessment, and causal links between pipeline stages.
 *
 * Differentiation boundary with slo_metrics.json (Athena AC14 resolved):
 *   slo_metrics.json  — SLO compliance: raw latency values, breach records, threshold
 *                       violations. Written by slo_checker.js. Compliance tracking.
 *   cycle_analytics.json — Cycle performance: high-level KPIs aggregated from SLO results
 *                          + outcomes + health scores + causal attribution.
 *                          References sloBreachCount/sloStatus, does NOT duplicate raw
 *                          breach records or threshold details.
 *
 * Canonical events (Athena AC13 resolved):
 *   KPIs are computed exclusively from the 5 SLO_TIMESTAMP_STAGES defined in
 *   pipeline_progress.js. No other events are treated as canonical inputs.
 *
 * Confidence levels (Athena AC11 resolved):
 *   Confidence uses the existing codebase enum ("high"|"medium"|"low") computed
 *   deterministically from data completeness — NOT invented statistical intervals.
 *   high:   All 5 canonical events present AND sloRecord provided.
 *   medium: 3–4 canonical events present OR sloRecord missing.
 *   low:    ≤2 canonical events present OR no pipeline progress.
 *
 * Causal links (Athena AC12 resolved):
 *   Deterministic model: the 3 SLO-measured spans (decision, dispatch, verification).
 *   Each link records cause→effect stage names, measured latencyMs, and whether the
 *   span exceeded its configured threshold (anomaly=true). No invented causality.
 *
 * Schema (Athena AC16 resolved):
 *   See CYCLE_ANALYTICS_SCHEMA for required fields and explicit enums.
 *
 * Retention policy (Athena AC17 resolved):
 *   Defaults to 50 history entries (configurable via config.cycleAnalytics.maxHistoryEntries).
 *   slo_checker uses 100; cycle records are larger so a lower cap is appropriate.
 *
 * Missing data sentinel (Athena AC18 resolved):
 *   Numeric fields use null (not 0) when data is absent.
 *   All absent fields are documented in the missingData[] array with reason codes.
 *
 * Risk (Athena AC19 resolved):
 *   Per-cycle file I/O is added to the runSingleCycle hot path.
 *   The call is wrapped in try/catch — analytics failure never blocks orchestration.
 */

import path from "node:path";
import { readJson, writeJson } from "./fs_utils.js";
import { SLO_TIMESTAMP_CONTRACT, SLO_METRIC } from "./slo_checker.js";

// ── Funnel helpers ─────────────────────────────────────────────────────────────

/**
 * Safely divide two nullable numbers, returning null when the denominator is
 * zero or either value is absent.  Rounded to 3 decimal places.
 */
function safeRatio(numerator: number | null | undefined, denominator: number | null | undefined): number | null {
  if (typeof numerator !== "number" || typeof denominator !== "number" || denominator === 0) return null;
  return Math.round((numerator / denominator) * 1000) / 1000;
}

// ── Deterministic guard helpers ────────────────────────────────────────────────

/**
 * Return the value only if it is a finite number; otherwise null.
 * Prevents non-numeric values (e.g. strings, booleans) from leaking into KPI
 * channels when sloRecord fields carry unexpected types after schema evolution.
 */
function toFiniteNumberOrNull(v: unknown): number | null {
  return (typeof v === "number" && isFinite(v)) ? v : null;
}

/**
 * Allowed values for the sloStatus KPI field.
 * Any value outside this set is clamped to "unknown" so health-channel
 * derivation logic always receives a recognised status token.
 */
const ALLOWED_SLO_STATUSES = new Set(["ok", "degraded", "unknown"]);

/**
 * Sanitize a single worker-result entry so that only the two fields consumed
 * by computeCycleAnalytics ({roleName, status}) are propagated.
 * This prevents EvidenceEnvelope fields (verificationEvidence, prChecks, etc.)
 * from silently bleeding into the analytics record as the envelope evolves.
 */
function sanitizeWorkerResult(w: unknown): { roleName: string; status: string } {
  if (!w || typeof w !== "object") return { roleName: "unknown", status: "unknown" };
  const obj = w as Record<string, unknown>;
  return {
    roleName: typeof obj.roleName === "string" ? obj.roleName : "unknown",
    status:   typeof obj.status   === "string" ? obj.status   : "unknown",
  };
}

// ── Enums ──────────────────────────────────────────────────────────────────────

/** Pipeline phase at the time analytics were generated. */
export const CYCLE_PHASE = Object.freeze({
  COMPLETED: "completed",
  FAILED: "failed",
  INCOMPLETE: "incomplete",
});

/** Aggregate outcome status for the cycle. */
export const CYCLE_OUTCOME_STATUS = Object.freeze({
  SUCCESS: "success",
  PARTIAL: "partial",
  FAILED: "failed",
  NO_PLANS: "no_plans",
  REJECTED: "rejected",
  UNKNOWN: "unknown",
});

/**
 * Confidence level for the analytics record.
 * Uses the existing codebase enum — NOT statistical confidence intervals.
 * Computed deterministically from data completeness.
 */
export const CONFIDENCE_LEVEL = Object.freeze({
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
});

/** Reason codes for entries in the missingData[] array. */
export const MISSING_DATA_REASON = Object.freeze({
  /** The source file or object was not provided (null/undefined). */
  MISSING_SOURCE: "MISSING_SOURCE",
  /** The source was provided but the specific timestamp field was absent. */
  MISSING_TIMESTAMP: "MISSING_TIMESTAMP",
  /** The source was provided but a computation step raised an error. */
  COMPUTATION_ERROR: "COMPUTATION_ERROR",
});

/** Which part of the analytics record is affected by a missing data entry. */
export const MISSING_DATA_IMPACT = Object.freeze({
  KPI: "kpi",
  OUTCOME: "outcome",
  CAUSAL_LINK: "causal_link",
});

// ── Schema contract ────────────────────────────────────────────────────────────

/**
 * Canonical schema for cycle_analytics.json (Athena AC16 resolved).
 *
 * Required fields and enums are fully specified.
 * cycleId = pipeline_progress.startedAt (ISO 8601 string) — same as slo_metrics.json.
 *
 * stageTransitions — per-packet stage transition records from PLANNING_STAGE_TRANSITION
 *   span events.  Array; empty when no transitions were recorded.
 * dropReasons      — task drop summaries from PLANNING_TASK_DROPPED span events.
 *   Array; empty when no tasks were dropped.
 */
export const CYCLE_ANALYTICS_SCHEMA = Object.freeze({
  schemaVersion: 1,
  required: ["schemaVersion", "lastCycle", "history", "updatedAt"],
  cycleRecord: Object.freeze({
    required: [
      "cycleId",
      "generatedAt",
      "phase",
      "outcomes",
      "kpis",
      "funnel",
      "tierCounts",
      "fastPathCounts",
      "confidence",
      "causalLinks",
      "canonicalEvents",
      "missingData",
      "stageTransitions",
      "dropReasons",
    ],
    cycleIdSource: "pipeline_progress.startedAt",
    phaseEnum: Object.freeze([...Object.values(CYCLE_PHASE)]),
    outcomeStatusEnum: Object.freeze([...Object.values(CYCLE_OUTCOME_STATUS)]),
    confidenceLevelEnum: Object.freeze([...Object.values(CONFIDENCE_LEVEL)]),
    missingDataReasonEnum: Object.freeze([...Object.values(MISSING_DATA_REASON)]),
    missingDataImpactEnum: Object.freeze([...Object.values(MISSING_DATA_IMPACT)]),
  }),
  /** Configurable via config.cycleAnalytics.maxHistoryEntries. */
  defaultMaxHistoryEntries: 50,
});

/**
 * The 5 canonical pipeline stage names used as KPI inputs.
 * Source: SLO_TIMESTAMP_STAGES in pipeline_progress.js.
 * These are the ONLY events treated as canonical for KPI computation (AC2 / AC13).
 */
export const CANONICAL_EVENT_NAMES = Object.freeze([
  "jesus_awakening",
  "jesus_decided",
  "athena_approved",
  "workers_dispatching",
  "cycle_complete",
]);

/**
 * The 3 causal spans, each mapping directly to an SLO metric.
 * Deterministic model — no invented causality (Athena AC12 resolved).
 */
const CAUSAL_SPANS = Object.freeze([
  Object.freeze({
    metric: SLO_METRIC.DECISION_LATENCY,
    cause: SLO_TIMESTAMP_CONTRACT[SLO_METRIC.DECISION_LATENCY].start,
    effect: SLO_TIMESTAMP_CONTRACT[SLO_METRIC.DECISION_LATENCY].end,
    defaultThresholdMs: 120000,
  }),
  Object.freeze({
    metric: SLO_METRIC.DISPATCH_LATENCY,
    cause: SLO_TIMESTAMP_CONTRACT[SLO_METRIC.DISPATCH_LATENCY].start,
    effect: SLO_TIMESTAMP_CONTRACT[SLO_METRIC.DISPATCH_LATENCY].end,
    defaultThresholdMs: 30000,
  }),
  Object.freeze({
    metric: SLO_METRIC.VERIFICATION_COMPLETION,
    cause: SLO_TIMESTAMP_CONTRACT[SLO_METRIC.VERIFICATION_COMPLETION].start,
    effect: SLO_TIMESTAMP_CONTRACT[SLO_METRIC.VERIFICATION_COMPLETION].end,
    defaultThresholdMs: 3600000,
  }),
]);

// ── Path helper ────────────────────────────────────────────────────────────────

function cycleAnalyticsPath(config) {
  const stateDir = config?.paths?.stateDir || "state";
  return path.join(stateDir, "cycle_analytics.json");
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Resolve the threshold for a given metric from config or fall back to default.
 * Does NOT emit errors — this is analytics, not compliance.
 */
function resolveThreshold(config, metric, defaultMs) {
  const configured = config?.slo?.thresholds?.[metric];
  if (typeof configured === "number" && isFinite(configured) && configured > 0) {
    return configured;
  }
  return defaultMs;
}

/**
 * Build the canonicalEvents array from stage timestamps.
 * Each entry records name, timestamp (or null), and present flag.
 */
function buildCanonicalEvents(stageTimestamps) {
  return CANONICAL_EVENT_NAMES.map(name => ({
    name,
    timestamp: (stageTimestamps && typeof stageTimestamps[name] === "string")
      ? stageTimestamps[name]
      : null,
    present: !!(stageTimestamps && typeof stageTimestamps[name] === "string"),
  }));
}

/**
 * Build causal links from stage timestamps and config thresholds.
 * Each link corresponds to one SLO span (Athena AC12 resolved).
 */
function buildCausalLinks(config, stageTimestamps, missingData) {
  return CAUSAL_SPANS.map(span => {
    const causeTs = stageTimestamps?.[span.cause];
    const effectTs = stageTimestamps?.[span.effect];

    if (!causeTs || !effectTs) {
      missingData.push({
        field: `causalLinks[${span.cause}→${span.effect}].latencyMs`,
        reason: MISSING_DATA_REASON.MISSING_TIMESTAMP,
        impact: MISSING_DATA_IMPACT.CAUSAL_LINK,
      });
      return {
        cause: span.cause,
        effect: span.effect,
        metric: span.metric,
        latencyMs: null,
        anomaly: false,
        anomalyReason: null,
      };
    }

    const latencyMs = Math.max(0, new Date(effectTs).getTime() - new Date(causeTs).getTime());
    const threshold = resolveThreshold(config, span.metric, span.defaultThresholdMs);
    const anomaly = latencyMs > threshold;
    const anomalyReason = anomaly
      ? `${span.metric} exceeded threshold: actual=${latencyMs}ms threshold=${threshold}ms`
      : null;

    return {
      cause: span.cause,
      effect: span.effect,
      metric: span.metric,
      latencyMs,
      anomaly,
      anomalyReason,
    };
  });
}

/**
 * Compute confidence level deterministically from data completeness.
 * Uses the codebase enum ("high"|"medium"|"low") — not statistical intervals.
 * (Athena AC11 resolved)
 *
 * Rules:
 *   high:   All 5 canonical events present AND sloRecord provided.
 *   medium: 3–4 canonical events present OR sloRecord absent.
 *   low:    ≤2 canonical events present OR pipelineProgress null.
 */
function computeConfidence(canonicalEvents, sloRecord, pipelineProgress) {
  const presentCount = canonicalEvents.filter(e => e.present).length;
  const missingFields = canonicalEvents
    .filter(e => !e.present)
    .map(e => `canonicalEvents.${e.name}`);

  if (pipelineProgress === null) {
    if (sloRecord === null) missingFields.push("sloRecord");
    return {
      level: CONFIDENCE_LEVEL.LOW,
      reason: "pipelineProgress not available",
      missingFields,
    };
  }

  if (sloRecord === null) {
    missingFields.push("sloRecord");
  }

  if (presentCount >= 5 && sloRecord !== null) {
    return { level: CONFIDENCE_LEVEL.HIGH, reason: "all canonical events present", missingFields };
  }
  if (presentCount >= 3) {
    return {
      level: CONFIDENCE_LEVEL.MEDIUM,
      reason: sloRecord === null
        ? `${presentCount}/5 canonical events present; sloRecord absent`
        : `${presentCount}/5 canonical events present`,
      missingFields,
    };
  }
  return {
    level: CONFIDENCE_LEVEL.LOW,
    reason: `only ${presentCount}/5 canonical events present`,
    missingFields,
  };
}

/**
 * Derive outcome status from workerResults and planCount.
 * Handles null inputs explicitly (missing data sentinel = null, not 0).
 */
function computeOutcomeStatus(phase, workerResults, planCount) {
  if (phase === CYCLE_PHASE.INCOMPLETE) {
    // Distinguish specific incomplete reasons
    if (planCount === 0) return CYCLE_OUTCOME_STATUS.NO_PLANS;
    return CYCLE_OUTCOME_STATUS.UNKNOWN;
  }
  if (phase === CYCLE_PHASE.FAILED) return CYCLE_OUTCOME_STATUS.FAILED;

  if (!Array.isArray(workerResults) || workerResults.length === 0) {
    return CYCLE_OUTCOME_STATUS.UNKNOWN;
  }

  const failed = workerResults.filter(w => w.status === "error" || w.status === "failed").length;
  const done = workerResults.filter(w => w.status === "done" || w.status === "success").length;

  if (failed === 0) return CYCLE_OUTCOME_STATUS.SUCCESS;
  if (done > 0) return CYCLE_OUTCOME_STATUS.PARTIAL;
  return CYCLE_OUTCOME_STATUS.FAILED;
}

// ── Core computation ──────────────────────────────────────────────────────────

/**
 * Compute a cycle analytics record from available inputs.
 * Pure function — no file I/O. All inputs may be null (missing data handled explicitly).
 *
 * @param {object} config
 * @param {object} opts
 * @param {object|null} opts.sloRecord              Output of computeCycleSLOs(). May be null.
 * @param {object|null} opts.pipelineProgress        pipeline_progress.json content. May be null.
 * @param {Array|null}  opts.workerResults           [{roleName, status}] per dispatched worker. May be null.
 * @param {number|null} opts.planCount               Total plans dispatched this cycle. May be null.
 * @param {string}      opts.phase                   CYCLE_PHASE value.
 * @param {object|null} opts.parserBaselineRecovery  Output of computeBaselineRecoveryState(). May be null.
 * @param {object|null} opts.funnelCounts            Prometheus→Athena→Dispatch→Complete funnel. May be null.
 * @param {number|null} opts.funnelCounts.generated  Plans produced by Prometheus.
 * @param {number|null} opts.funnelCounts.approved   Plans approved by Athena (before quality/freeze gate).
 * @param {number|null} opts.funnelCounts.dispatched Plans actually dispatched (after all gates).
 * @param {number|null} opts.funnelCounts.completed  Plans completed successfully.
 * @param {Array}       opts.stageTransitions        Per-packet stage transition records from
 *                                                   PLANNING_STAGE_TRANSITION span events.
 *                                                   Each entry: {taskId,stageFrom,stageTo,durationMs,spanId}.
 * @param {Array}       opts.dropReasons             Task drop summaries from PLANNING_TASK_DROPPED
 *                                                   span events.
 *                                                   Each entry: {taskId,stageWhenDropped,reason,dropCode,spanId}.
 * @param {object|null} opts.tierCounts              Per-tier dispatch counts for this cycle.
 *                                                   Shape: { T1: number|null, T2: number|null, T3: number|null }.
 *                                                   T1 = routine, T2 = medium, T3 = architectural.
 *                                                   null when not tracked by the caller.
 * @param {object|null} opts.fastPathCounts          Athena plan-review fast-path counts for this cycle.
 *                                                   Shape: { athenaAutoApproved: number|null, athenaFullReview: number|null }.
 *                                                   fastPathRate is derived from these two values.
 *                                                   null when not tracked by the caller.
 * @returns {object} Analytics record conforming to CYCLE_ANALYTICS_SCHEMA.cycleRecord.
 */
export function computeCycleAnalytics(config, {
  sloRecord = null,
  pipelineProgress = null,
  workerResults = null,
  planCount = null,
  phase = CYCLE_PHASE.COMPLETED,
  parserBaselineRecovery = null,
  funnelCounts = null,
  tierCounts = null,
  fastPathCounts = null,
  stageTransitions = [],
  dropReasons = [],
}: any = {}) {
  const missingData = [];
  const stageTimestamps = pipelineProgress?.stageTimestamps || null;

  if (pipelineProgress === null) {
    missingData.push({
      field: "pipelineProgress",
      reason: MISSING_DATA_REASON.MISSING_SOURCE,
      impact: MISSING_DATA_IMPACT.KPI,
    });
  }
  if (sloRecord === null) {
    missingData.push({
      field: "sloRecord",
      reason: MISSING_DATA_REASON.MISSING_SOURCE,
      impact: MISSING_DATA_IMPACT.KPI,
    });
  }

  // Canonical events inventory
  const canonicalEvents = buildCanonicalEvents(stageTimestamps);

  // Causal links (deterministic, SLO-span aligned)
  const causalLinks = buildCausalLinks(config, stageTimestamps, missingData);

  // Sanitize worker results: strip any extra EvidenceEnvelope fields so that
  // only {roleName, status} can influence outcome computation.
  const safeWorkerResults = Array.isArray(workerResults)
    ? workerResults.map(sanitizeWorkerResult)
    : workerResults;

  // KPIs — reference sloRecord for latency values; do NOT duplicate raw breach records.
  // toFiniteNumberOrNull guards against non-numeric values if sloRecord schema evolves.
  const kpis = {
    decisionLatencyMs: toFiniteNumberOrNull(sloRecord?.metrics?.decisionLatencyMs),
    dispatchLatencyMs: toFiniteNumberOrNull(sloRecord?.metrics?.dispatchLatencyMs),
    verificationCompletionMs: toFiniteNumberOrNull(sloRecord?.metrics?.verificationCompletionMs),
    systemHealthScore: null,   // populated externally if self-improvement ran
    sloBreachCount: Array.isArray(sloRecord?.sloBreaches) ? sloRecord.sloBreaches.length : 0,
    sloStatus: sloRecord?.status ?? "unknown",
  };

  if (sloRecord === null) {
    // Already noted in missingData above; no silent zero-fill for latency fields
    missingData.push(
      { field: "kpis.decisionLatencyMs", reason: MISSING_DATA_REASON.MISSING_SOURCE, impact: MISSING_DATA_IMPACT.KPI },
      { field: "kpis.dispatchLatencyMs", reason: MISSING_DATA_REASON.MISSING_SOURCE, impact: MISSING_DATA_IMPACT.KPI },
      { field: "kpis.verificationCompletionMs", reason: MISSING_DATA_REASON.MISSING_SOURCE, impact: MISSING_DATA_IMPACT.KPI },
    );
  }

  // Outcomes
  const tasksDispatched = planCount !== null ? planCount : null;
  const tasksCompleted = Array.isArray(safeWorkerResults)
    ? safeWorkerResults.filter(w => w.status === "done" || w.status === "success").length
    : null;
  const tasksFailed = Array.isArray(safeWorkerResults)
    ? safeWorkerResults.filter(w => w.status === "error" || w.status === "failed").length
    : null;

  if (planCount === null) {
    missingData.push({
      field: "outcomes.tasksDispatched",
      reason: MISSING_DATA_REASON.MISSING_SOURCE,
      impact: MISSING_DATA_IMPACT.OUTCOME,
    });
  }

  if (!Array.isArray(safeWorkerResults)) {
    missingData.push(
      { field: "outcomes.tasksCompleted", reason: MISSING_DATA_REASON.MISSING_SOURCE, impact: MISSING_DATA_IMPACT.OUTCOME },
      { field: "outcomes.tasksFailed",    reason: MISSING_DATA_REASON.MISSING_SOURCE, impact: MISSING_DATA_IMPACT.OUTCOME },
    );
  }

  const outcomeStatus = computeOutcomeStatus(phase, safeWorkerResults, planCount);

  const outcomes = {
    tasksDispatched,
    tasksCompleted,
    tasksFailed,
    athenaApproved: pipelineProgress
      ? !!(stageTimestamps?.athena_approved)
      : null,
    selfImprovementRan: null,  // set externally after self-improvement cycle
    status: outcomeStatus,
  };

  // Explicit reason code when outcome status is UNKNOWN (no silent ambiguity).
  if (outcomeStatus === CYCLE_OUTCOME_STATUS.UNKNOWN) {
    const unknownReason = !Array.isArray(safeWorkerResults)
      ? "workerResults not provided"
      : (safeWorkerResults.length === 0
          ? "no worker results recorded"
          : "unrecognized worker status values");
    missingData.push({
      field: "outcomes.status",
      reason: MISSING_DATA_REASON.MISSING_SOURCE,
      impact: MISSING_DATA_IMPACT.OUTCOME,
      unknownReason,
    });
  }

  // Confidence (deterministic, not statistical)
  const confidence = computeConfidence(canonicalEvents, sloRecord, pipelineProgress);

  const cycleId = pipelineProgress?.startedAt ?? sloRecord?.cycleId ?? null;

  // ── Funnel: Prometheus→Athena→Dispatch→Complete counts and conversion rates ──
  // Rates are null when the denominator stage count is absent (no silent zero-fill).
  const rawGenerated  = (funnelCounts && typeof funnelCounts.generated  === "number") ? funnelCounts.generated  : null;
  const rawApproved   = (funnelCounts && typeof funnelCounts.approved   === "number") ? funnelCounts.approved   : null;
  const rawDispatched = (funnelCounts && typeof funnelCounts.dispatched === "number") ? funnelCounts.dispatched : null;
  const rawCompleted  = (funnelCounts && typeof funnelCounts.completed  === "number") ? funnelCounts.completed  : null;

  const funnel = {
    generated:      rawGenerated,
    approved:       rawApproved,
    dispatched:     rawDispatched,
    completed:      rawCompleted,
    approvalRate:   safeRatio(rawApproved,   rawGenerated),
    dispatchRate:   safeRatio(rawDispatched, rawApproved),
    completionRate: safeRatio(rawCompleted,  rawDispatched),
  };

  // ── Tier counts: T1/T2/T3 dispatch distribution ───────────────────────────
  // null when not provided by caller — missing data sentinel follows AC3.
  const rawT1 = (tierCounts && typeof tierCounts.T1 === "number") ? tierCounts.T1 : null;
  const rawT2 = (tierCounts && typeof tierCounts.T2 === "number") ? tierCounts.T2 : null;
  const rawT3 = (tierCounts && typeof tierCounts.T3 === "number") ? tierCounts.T3 : null;
  const tierCountsRecord = { T1: rawT1, T2: rawT2, T3: rawT3 };

  if (tierCounts === null || tierCounts === undefined) {
    missingData.push({
      field: "tierCounts",
      reason: MISSING_DATA_REASON.MISSING_SOURCE,
      impact: MISSING_DATA_IMPACT.KPI,
    });
  }

  // ── Fast-path counts: Athena auto-approve vs full-review ──────────────────
  // fastPathRate is derived from the two counts; null when either is absent.
  const rawAutoApproved = (fastPathCounts && typeof fastPathCounts.athenaAutoApproved === "number") ? fastPathCounts.athenaAutoApproved : null;
  const rawFullReview   = (fastPathCounts && typeof fastPathCounts.athenaFullReview   === "number") ? fastPathCounts.athenaFullReview   : null;
  const totalReviews = (rawAutoApproved !== null && rawFullReview !== null)
    ? rawAutoApproved + rawFullReview
    : null;
  const fastPathCountsRecord = {
    athenaAutoApproved: rawAutoApproved,
    athenaFullReview:   rawFullReview,
    fastPathRate:       safeRatio(rawAutoApproved, totalReviews),
  };

  if (fastPathCounts === null || fastPathCounts === undefined) {
    missingData.push({
      field: "fastPathCounts",
      reason: MISSING_DATA_REASON.MISSING_SOURCE,
      impact: MISSING_DATA_IMPACT.KPI,
    });
  }

  return {
    cycleId,
    generatedAt: new Date().toISOString(),
    phase,
    outcomes,
    kpis,
    funnel,
    tierCounts: tierCountsRecord,
    fastPathCounts: fastPathCountsRecord,
    confidence,
    causalLinks,
    canonicalEvents,
    missingData,
    parserBaselineRecovery: parserBaselineRecovery ?? null,
    stageTransitions: Array.isArray(stageTransitions) ? stageTransitions : [],
    dropReasons:      Array.isArray(dropReasons) ? dropReasons : [],
  };
}

// ── Persistence ───────────────────────────────────────────────────────────────

/**
 * Persist a computed cycle analytics record to state/cycle_analytics.json.
 * Maintains a rolling history capped at config.cycleAnalytics.maxHistoryEntries
 * (default: CYCLE_ANALYTICS_SCHEMA.defaultMaxHistoryEntries = 50).
 *
 * Append-only: new record is prepended; oldest entries are evicted when cap is reached.
 *
 * @param {object} config
 * @param {object} record - output of computeCycleAnalytics()
 */
export async function persistCycleAnalytics(config, record) {
  const filePath = cycleAnalyticsPath(config);
  const maxEntries = Number(
    config?.cycleAnalytics?.maxHistoryEntries
    || CYCLE_ANALYTICS_SCHEMA.defaultMaxHistoryEntries
  );

  const existing = await readJson(filePath, {
    schemaVersion: CYCLE_ANALYTICS_SCHEMA.schemaVersion,
    lastCycle: null,
    history: [],
    updatedAt: null,
  });

  const history = Array.isArray(existing.history) ? existing.history : [];
  history.unshift(record);
  if (history.length > maxEntries) {
    history.length = maxEntries;
  }

  await writeJson(filePath, {
    schemaVersion: CYCLE_ANALYTICS_SCHEMA.schemaVersion,
    lastCycle: record,
    history,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Read the current cycle_analytics.json snapshot.
 * Returns the parsed object or null if the file does not exist yet.
 *
 * @param {object} config
 * @returns {Promise<object|null>}
 */
export async function readCycleAnalytics(config) {
  const filePath = cycleAnalyticsPath(config);
  const data = await readJson(filePath, null);
  return data;
}

// ── Dual analytics channels ────────────────────────────────────────────────────
//
// WHY TWO CHANNELS:
//   cycle_analytics.json  — performance/semantic channel.  Contains KPI timings,
//     funnel counts, outcomes, and confidence.  Values here change whenever the
//     metric definition or pipeline behaviour changes.
//
//   cycle_health.json     — degradation channel.  Contains ONLY threshold-relative
//     signals: SLO breach status, anomaly flags from causal links, and a derived
//     health score.  This file changes exclusively when the system is degrading —
//     not when metric semantics are updated.
//
//   Keeping the channels separate ensures that:
//     • a change in metric definition (semantic) does not look like degradation,
//     • genuine runtime degradation is always surfaced in cycle_health.json, and
//     • consumers can subscribe to cycle_health.json alone for alert routing.

/** Derived runtime health score for a cycle. */
export const HEALTH_SCORE = Object.freeze({
  /** No SLO breach and no causal-link threshold anomalies. */
  HEALTHY:  "healthy",
  /** At least one causal-link anomaly OR an SLO breach. */
  DEGRADED: "degraded",
  /** SLO status is "degraded" AND two or more causal-link anomalies. */
  CRITICAL: "critical",
});

/**
 * Canonical schema for cycle_health.json.
 *
 * This is the degradation channel.  It is written alongside cycle_analytics.json
 * and reflects only threshold-relative runtime signals — not raw latency values.
 */
export const CYCLE_HEALTH_SCHEMA = Object.freeze({
  schemaVersion: 1,
  required: ["schemaVersion", "lastCycle", "history", "updatedAt"],
  healthRecord: Object.freeze({
    required: [
      "cycleId",
      "generatedAt",
      "sloStatus",
      "sloBreachCount",
      "anomalyCount",
      "anomalies",
      "healthScore",
      "healthReason",
      "sustainedBreachSignatures",
      "coupledAlerts",
    ],
    healthScoreEnum: Object.freeze([...Object.values(HEALTH_SCORE)]),
  }),
  /** Same default cap as cycle_analytics — configurable via config.cycleAnalytics.maxHistoryEntries. */
  defaultMaxHistoryEntries: 50,
});

// ── Internal path helper ──────────────────────────────────────────────────────

function cycleHealthPath(config) {
  const stateDir = config?.paths?.stateDir || "state";
  return path.join(stateDir, "cycle_health.json");
}

// ── Health-score derivation ───────────────────────────────────────────────────

function deriveHealthScore(sloStatus: string, anomalyCount: number): string {
  if (sloStatus === "degraded" && anomalyCount >= 2) return HEALTH_SCORE.CRITICAL;
  if (sloStatus === "degraded" || anomalyCount >= 1) return HEALTH_SCORE.DEGRADED;
  return HEALTH_SCORE.HEALTHY;
}

function deriveHealthReason(
  healthScore: string,
  sloStatus: string,
  anomalyCount: number,
): string {
  if (healthScore === HEALTH_SCORE.CRITICAL) {
    return `SLO status is "${sloStatus}" and ${anomalyCount} causal-link anomaly(ies) detected`;
  }
  if (healthScore === HEALTH_SCORE.DEGRADED) {
    const parts: string[] = [];
    if (sloStatus === "degraded") parts.push(`SLO status is "degraded"`);
    if (anomalyCount >= 1) parts.push(`${anomalyCount} causal-link anomaly(ies) detected`);
    return parts.join("; ");
  }
  return "all SLO checks passed and no causal-link anomalies detected";
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Extract runtime health/degradation signals from a cycle analytics record.
 *
 * Pure function — no file I/O.  The result is written to cycle_health.json via
 * persistCycleHealth() and is intentionally kept free of raw latency values so
 * that metric-semantic changes do not pollute the degradation channel.
 *
 * @param {object}   analyticsRecord           — output of computeCycleAnalytics()
 * @param {object[]} [sustainedBreachSignatures=[]] — output of detectSustainedBreachSignatures();
 *                                               included for retune provenance but not used to
 *                                               derive healthScore (SLO record already covers it)
 * @param {object[]} [coupledAlerts=[]]         — output of detectCoupledAlerts(); correlated
 *                                               multi-signal alerts (e.g. yield collapse + SLO breach)
 * @returns {object} Health record conforming to CYCLE_HEALTH_SCHEMA.healthRecord
 */
export function computeCycleHealth(analyticsRecord: any, sustainedBreachSignatures: any[] = [], coupledAlerts: any[] = []) {
  // Guard sloStatus against invalid enum values: only "ok", "degraded", "unknown"
  // are meaningful to health derivation; anything else is clamped to "unknown".
  const rawSloStatus = analyticsRecord?.kpis?.sloStatus ?? "unknown";
  const sloStatus = (typeof rawSloStatus === "string" && ALLOWED_SLO_STATUSES.has(rawSloStatus))
    ? rawSloStatus
    : "unknown";
  const sloBreachCount = typeof analyticsRecord?.kpis?.sloBreachCount === "number"
    ? analyticsRecord.kpis.sloBreachCount
    : 0;

  const causalLinks: any[] = Array.isArray(analyticsRecord?.causalLinks)
    ? analyticsRecord.causalLinks
    : [];

  const anomalies = causalLinks
    .filter(l => l.anomaly === true)
    .map(l => ({
      metric:        l.metric        ?? null,
      cause:         l.cause         ?? null,
      effect:        l.effect        ?? null,
      latencyMs:     l.latencyMs     ?? null,
      anomalyReason: l.anomalyReason ?? null,
    }));

  const anomalyCount  = anomalies.length;
  const healthScore   = deriveHealthScore(sloStatus, anomalyCount);
  const healthReason  = deriveHealthReason(healthScore, sloStatus, anomalyCount);

  // Ensure sustainedBreachSignatures is always a well-typed array in the record
  const safeSustainedSignatures = Array.isArray(sustainedBreachSignatures)
    ? sustainedBreachSignatures
    : [];

  // Ensure coupledAlerts is always a well-typed array in the record
  const safeCoupledAlerts = Array.isArray(coupledAlerts) ? coupledAlerts : [];

  return {
    cycleId:                  analyticsRecord?.cycleId  ?? null,
    generatedAt:              new Date().toISOString(),
    sloStatus,
    sloBreachCount,
    anomalyCount,
    anomalies,
    healthScore,
    healthReason,
    sustainedBreachSignatures: safeSustainedSignatures,
    coupledAlerts: safeCoupledAlerts,
  };
}

/**
 * Persist a computed cycle health record to state/cycle_health.json.
 * Maintains the same rolling-history semantics as persistCycleAnalytics.
 *
 * @param {object} config
 * @param {object} healthRecord — output of computeCycleHealth()
 */
export async function persistCycleHealth(config, healthRecord) {
  const filePath  = cycleHealthPath(config);
  const maxEntries = Number(
    config?.cycleAnalytics?.maxHistoryEntries
    || CYCLE_HEALTH_SCHEMA.defaultMaxHistoryEntries,
  );

  const existing = await readJson(filePath, {
    schemaVersion: CYCLE_HEALTH_SCHEMA.schemaVersion,
    lastCycle: null,
    history: [],
    updatedAt: null,
  });

  const history = Array.isArray(existing.history) ? existing.history : [];
  history.unshift(healthRecord);
  if (history.length > maxEntries) {
    history.length = maxEntries;
  }

  await writeJson(filePath, {
    schemaVersion: CYCLE_HEALTH_SCHEMA.schemaVersion,
    lastCycle:     healthRecord,
    history,
    updatedAt:     new Date().toISOString(),
  });
}

/**
 * Read the current cycle_health.json snapshot.
 * Returns the parsed object or null if the file does not exist yet.
 *
 * @param {object} config
 * @returns {Promise<object|null>}
 */
export async function readCycleHealth(config) {
  return readJson(cycleHealthPath(config), null);
}

```

### FILE: src/core/slo_checker.ts
```typescript
/**
 * BOX Cycle-level SLO Checker
 *
 * Computes, evaluates, and persists Service Level Objective (SLO) metrics
 * for each completed orchestration cycle.
 *
 * cycle_id contract (Athena missing item resolved):
 *   pipeline_progress.startedAt is the canonical cycle identifier.
 *   It is an ISO 8601 timestamp written when the first non-idle stage begins.
 *
 * SLO input field contract (Athena missing item resolved):
 *   All latency timestamps are read from pipeline_progress.json.stageTimestamps.
 *   - Decision latency:          jesus_awakening → jesus_decided
 *   - Dispatch latency:          athena_approved → workers_dispatching
 *   - Verification completion:   workers_dispatching → cycle_complete
 *   Timestamps from jesus_directive.json are NOT used — stageTimestamps is
 *   the single authoritative source to eliminate field ambiguity.
 *
 * slo_metrics.json schema (Athena missing item resolved — see SLO_METRICS_SCHEMA):
 *   Required fields, enums, and cycle key are fully specified below.
 *
 * Dashboard degraded path (Athena missing item resolved):
 *   A breach writes orchestratorStatus=degraded via writeOrchestratorHealth (orchestrator.js),
 *   NOT via appendAlert alone. The orchestrator calls writeOrchestratorHealth explicitly.
 */

import path from "node:path";
import { readJson, writeJson } from "./fs_utils.js";

// ── Enums ─────────────────────────────────────────────────────────────────────

/** SLO metric identifiers. */
export const SLO_METRIC = Object.freeze({
  DECISION_LATENCY: "decisionLatencyMs",
  DISPATCH_LATENCY: "dispatchLatencyMs",
  VERIFICATION_COMPLETION: "verificationCompletionMs",
});

/** SLO health status written to slo_metrics.json. */
export const SLO_STATUS = Object.freeze({
  OK: "ok",
  DEGRADED: "degraded",
});

/**
 * Machine-readable statusReason codes.
 * Never use free-form strings for SLO status reasons.
 */
export const SLO_REASON = Object.freeze({
  OK: "OK",
  BREACH_DETECTED: "BREACH_DETECTED",
  MISSING_TIMESTAMPS: "MISSING_TIMESTAMPS",
});

/**
 * Reason codes for individual missing timestamp cases.
 * Distinguishes missing-input from invalid-input (AC9).
 */
export const SLO_MISSING_REASON = Object.freeze({
  MISSING_TIMESTAMP_DECISION: "MISSING_TIMESTAMP_DECISION",
  MISSING_TIMESTAMP_DISPATCH: "MISSING_TIMESTAMP_DISPATCH",
  MISSING_TIMESTAMP_VERIFICATION: "MISSING_TIMESTAMP_VERIFICATION",
});

/**
 * Reason codes for threshold validation errors (AC1, AC9, AC10).
 * THRESHOLD_MISSING: key absent from the configured slo.thresholds object.
 * THRESHOLD_INVALID: key present but value is not a positive finite number.
 * Neither case is a silent fallback — both are recorded in thresholdValidationErrors.
 */
export const SLO_THRESHOLD_REASON = Object.freeze({
  THRESHOLD_MISSING: "THRESHOLD_MISSING",
  THRESHOLD_INVALID: "THRESHOLD_INVALID",
});

/** Breach alert severity levels. Aligns with ALERT_SEVERITY in state_tracker.js. */
export const SLO_BREACH_SEVERITY = Object.freeze({
  HIGH: "high",
  CRITICAL: "critical",
});

// ── Field contract ────────────────────────────────────────────────────────────

/**
 * Defines which stageTimestamps fields are required for each SLO metric.
 * Source for all timestamps: pipeline_progress.json.stageTimestamps.
 * This is the authoritative field contract (Athena AC12 resolved).
 */
export const SLO_TIMESTAMP_CONTRACT = Object.freeze({
  [SLO_METRIC.DECISION_LATENCY]: Object.freeze({
    start: "jesus_awakening",
    end: "jesus_decided",
    missingReason: SLO_MISSING_REASON.MISSING_TIMESTAMP_DECISION,
  }),
  [SLO_METRIC.DISPATCH_LATENCY]: Object.freeze({
    start: "athena_approved",
    end: "workers_dispatching",
    missingReason: SLO_MISSING_REASON.MISSING_TIMESTAMP_DISPATCH,
  }),
  [SLO_METRIC.VERIFICATION_COMPLETION]: Object.freeze({
    start: "workers_dispatching",
    end: "cycle_complete",
    missingReason: SLO_MISSING_REASON.MISSING_TIMESTAMP_VERIFICATION,
  }),
});

// ── Schema ────────────────────────────────────────────────────────────────────

/**
 * Canonical schema for slo_metrics.json (Athena AC13 resolved).
 * Required fields, enums, and cycle key are fully specified.
 *
 * cycleId = pipeline_progress.startedAt (ISO 8601 string).
 */
export const SLO_METRICS_SCHEMA = Object.freeze({
  schemaVersion: 1,
  required: ["schemaVersion", "lastCycle", "history", "updatedAt"],
  cycleRecord: Object.freeze({
    required: [
      "cycleId",
      "startedAt",
      "completedAt",
      "metrics",
      "missingTimestamps",
      "thresholdValidationErrors",
      "sloBreaches",
      "status",
      "statusReason",
    ],
    /** cycleId is pipeline_progress.startedAt — the canonical cycle identifier. */
    cycleIdSource: "pipeline_progress.startedAt",
    statusEnum: Object.freeze([...Object.values(SLO_STATUS)]),
    statusReasonEnum: Object.freeze([...Object.values(SLO_REASON)]),
    metricNames: Object.freeze([...Object.values(SLO_METRIC)]),
    breachSeverityEnum: Object.freeze([...Object.values(SLO_BREACH_SEVERITY)]),
    missingReasonEnum: Object.freeze([...Object.values(SLO_MISSING_REASON)]),
    thresholdReasonEnum: Object.freeze([...Object.values(SLO_THRESHOLD_REASON)]),
  }),
  maxHistoryEntries: 100,
});

// ── Default thresholds ────────────────────────────────────────────────────────

const DEFAULT_THRESHOLDS = Object.freeze({
  [SLO_METRIC.DECISION_LATENCY]: 120000,       // 2 min
  [SLO_METRIC.DISPATCH_LATENCY]: 30000,         // 30 s
  [SLO_METRIC.VERIFICATION_COMPLETION]: 3600000, // 1 hr
});

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Validate config-driven thresholds and return explicit validation errors (AC1, AC9, AC10).
 *
 * Rules:
 *   - If config.slo.thresholds is absent/null → use all defaults, no errors (expected first-run).
 *   - If config.slo.thresholds is an object and a key is absent → THRESHOLD_MISSING (explicit).
 *   - If a value is present but not a positive finite number → THRESHOLD_INVALID (explicit).
 * Neither case is silent: validation errors are returned and persisted in the cycle record.
 *
 * @param {object} config
 * @returns {{ thresholds: object, validationErrors: Array }}
 */
function resolveThresholds(config) {
  const configured = config?.slo?.thresholds;
  const validationErrors = [];
  const thresholds: Record<string, any> = {};

  for (const metric of Object.values(SLO_METRIC)) {
    const fallback = DEFAULT_THRESHOLDS[metric];

    if (!configured || typeof configured !== "object") {
      // No thresholds object configured — use defaults without emitting errors (first-run expected).
      thresholds[metric] = fallback;
      continue;
    }

    if (!(metric in configured)) {
      // Key absent from an explicitly provided thresholds object — record explicitly (AC10).
      validationErrors.push({
        metric,
        reason: SLO_THRESHOLD_REASON.THRESHOLD_MISSING,
        configured: undefined,
        fallback,
      });
      thresholds[metric] = fallback;
      continue;
    }

    const raw = configured[metric];
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) {
      // Value present but invalid — never silently coerce; record reason (AC9, AC10).
      validationErrors.push({
        metric,
        reason: SLO_THRESHOLD_REASON.THRESHOLD_INVALID,
        configured: raw,
        fallback,
      });
      thresholds[metric] = fallback;
    } else {
      thresholds[metric] = value;
    }
  }

  return { thresholds, validationErrors };
}

function resolveBreachSeverity(config, metric, actual, threshold) {
  const configured = String(config?.slo?.breachSeverity?.[metric] || "").toLowerCase();
  if (configured === SLO_BREACH_SEVERITY.CRITICAL) return SLO_BREACH_SEVERITY.CRITICAL;
  if (configured === SLO_BREACH_SEVERITY.HIGH) return SLO_BREACH_SEVERITY.HIGH;
  // Auto-escalate to critical when actual exceeds 2× threshold
  return actual > threshold * 2 ? SLO_BREACH_SEVERITY.CRITICAL : SLO_BREACH_SEVERITY.HIGH;
}

/**
 * Validate and parse a raw timestamp string.
 * Distinguishes missing input from invalid input (AC9).
 *
 * @param {any} raw
 * @returns {{ ms: number, valid: true } | { valid: false, reason: "missing"|"invalid" }}
 */
function parseTimestamp(raw) {
  if (raw === null || raw === undefined || String(raw).trim() === "") {
    return { valid: false, reason: "missing" };
  }
  const ms = Date.parse(String(raw));
  if (!Number.isFinite(ms)) {
    return { valid: false, reason: "invalid" };
  }
  return { valid: true, ms };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Compute SLO metrics for a completed cycle.
 *
 * This is a pure function — it reads no files and performs no I/O.
 * Call this after `cycle_complete` to evaluate latencies against thresholds.
 *
 * @param {object} config         - BOX config (used for slo.thresholds, slo.enabled)
 * @param {object} stageTimestamps - pipeline_progress.json.stageTimestamps
 * @param {string|null} startedAt  - pipeline_progress.json.startedAt (= cycleId)
 * @param {string|null} completedAt - pipeline_progress.json.completedAt
 * @returns {object} cycleRecord conforming to SLO_METRICS_SCHEMA.cycleRecord
 */
export function computeCycleSLOs(config, stageTimestamps, startedAt, completedAt) {
  const sloEnabled = config?.slo?.enabled !== false;
  const timestamps = stageTimestamps && typeof stageTimestamps === "object" ? stageTimestamps : {};
  const { thresholds, validationErrors: thresholdValidationErrors } = resolveThresholds(config);

  const metrics = {
    [SLO_METRIC.DECISION_LATENCY]: null,
    [SLO_METRIC.DISPATCH_LATENCY]: null,
    [SLO_METRIC.VERIFICATION_COMPLETION]: null,
  };
  const missingTimestamps = [];
  const sloBreaches = [];

  if (sloEnabled) {
    for (const [metric, contract] of Object.entries(SLO_TIMESTAMP_CONTRACT)) {
      const startResult = parseTimestamp(timestamps[contract.start]);
      const endResult = parseTimestamp(timestamps[contract.end]);

      if (!startResult.valid || !endResult.valid) {
        missingTimestamps.push(contract.missingReason);
        // No SLO calculation on missing mandatory timestamps (AC5)
        continue;
      }

      const latencyMs = endResult.ms - startResult.ms;
      // Clamp to 0 — negative latency (clock skew) is treated as 0
      metrics[metric] = Math.max(0, latencyMs);

      const threshold = thresholds[metric];
      if (metrics[metric] > threshold) {
        sloBreaches.push({
          metric,
          threshold,
          actual: metrics[metric],
          severity: resolveBreachSeverity(config, metric, metrics[metric], threshold),
          reason: `${metric.toUpperCase().replace(/MS$/, "")}_BREACH`,
        });
      }
    }
  }

  const hasBreach = sloBreaches.length > 0;
  const hasMissing = missingTimestamps.length > 0;

  let status, statusReason;
  if (hasBreach && config?.slo?.degradedOnBreach !== false) {
    status = SLO_STATUS.DEGRADED;
    statusReason = SLO_REASON.BREACH_DETECTED;
  } else if (!sloEnabled || (!hasBreach && !hasMissing)) {
    status = SLO_STATUS.OK;
    statusReason = SLO_REASON.OK;
  } else if (hasMissing && !hasBreach) {
    status = SLO_STATUS.OK;
    statusReason = SLO_REASON.MISSING_TIMESTAMPS;
  } else {
    status = SLO_STATUS.OK;
    statusReason = SLO_REASON.OK;
  }

  return {
    cycleId: startedAt || null,
    startedAt: startedAt || null,
    completedAt: completedAt || null,
    metrics,
    missingTimestamps,
    thresholdValidationErrors,
    sloBreaches,
    status,
    statusReason,
  };
}

function sloMetricsPath(config) {
  const stateDir = config?.paths?.stateDir || "state";
  return path.join(stateDir, "slo_metrics.json");
}

/**
 * Persist a computed cycle SLO record to slo_metrics.json.
 * Maintains a rolling history of up to SLO_METRICS_SCHEMA.maxHistoryEntries cycles.
 *
 * @param {object} config
 * @param {object} cycleRecord - output of computeCycleSLOs()
 */
export async function persistSloMetrics(config, cycleRecord) {
  const filePath = sloMetricsPath(config);
  const existing = await readJson(filePath, {
    schemaVersion: SLO_METRICS_SCHEMA.schemaVersion,
    lastCycle: null,
    history: [],
    updatedAt: null,
  });

  const history = Array.isArray(existing.history) ? existing.history : [];
  history.unshift(cycleRecord);
  if (history.length > SLO_METRICS_SCHEMA.maxHistoryEntries) {
    history.length = SLO_METRICS_SCHEMA.maxHistoryEntries;
  }

  await writeJson(filePath, {
    schemaVersion: SLO_METRICS_SCHEMA.schemaVersion,
    lastCycle: cycleRecord,
    history,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Read the most recent SLO metrics from slo_metrics.json.
 * Returns null for lastCycle and empty history if the file does not exist.
 *
 * @param {object} config
 * @returns {object}
 */
export async function readSloMetrics(config) {
  return readJson(sloMetricsPath(config), {
    schemaVersion: SLO_METRICS_SCHEMA.schemaVersion,
    lastCycle: null,
    history: [],
    updatedAt: null,
  });
}

// ── Coupled alert detection ───────────────────────────────────────────────────

/**
 * Coupled alert type codes.
 * A coupled alert fires when two correlated failure signals are active simultaneously.
 */
export const COUPLED_ALERT_TYPE = Object.freeze({
  /**
   * Fires when verificationCompletionMs has an active SLO breach AND completion
   * yield (funnel.completionRate) collapses below the configured threshold in the
   * same cycle.  Both signals together indicate a systemic pipeline degradation —
   * jobs take too long AND fewer complete successfully.
   */
  YIELD_COLLAPSE_WITH_VERIFICATION_BREACH: "YIELD_COLLAPSE_WITH_VERIFICATION_BREACH",
});

/** Default completion yield threshold (0–1). Yield below this value is treated as collapsed. */
export const COUPLED_ALERT_DEFAULT_YIELD_THRESHOLD = 0.5;

/**
 * @typedef {object} CoupledAlert
 * @property {string} type                          - COUPLED_ALERT_TYPE value
 * @property {number} verificationBreachActualMs    - Actual verificationCompletionMs from the breach
 * @property {number} verificationBreachThresholdMs - Threshold that was exceeded
 * @property {string} verificationBreachSeverity    - SLO breach severity (SLO_BREACH_SEVERITY)
 * @property {number} completionYield               - Funnel completionRate at the time of alert
 * @property {number} yieldCollapseThreshold        - Threshold used for yield-collapse detection
 * @property {string|null} cycleId                  - Cycle identifier from sloRecord
 */

/**
 * Detect coupled alerts for the current cycle.
 *
 * Fires YIELD_COLLAPSE_WITH_VERIFICATION_BREACH when:
 *   1. sloRecord contains an active SLO breach for verificationCompletionMs, AND
 *   2. completionYield is below the configured yieldCollapseThreshold.
 *
 * Pure function — no file I/O.
 *
 * @param {object|null} sloRecord       - Output of computeCycleSLOs(). May be null.
 * @param {number|null} completionYield - funnel.completionRate (0–1) from computeCycleAnalytics(). May be null.
 * @param {object}      opts
 * @param {number}      [opts.yieldCollapseThreshold] - Collapse threshold (default: COUPLED_ALERT_DEFAULT_YIELD_THRESHOLD)
 * @returns {CoupledAlert[]}
 */
export function detectCoupledAlerts(
  sloRecord: any,
  completionYield: number | null,
  opts: { yieldCollapseThreshold?: number } = {},
): any[] {
  if (!sloRecord || typeof sloRecord !== "object") return [];

  const breaches: any[] = Array.isArray(sloRecord.sloBreaches) ? sloRecord.sloBreaches : [];
  const verificationBreach = breaches.find(b => b?.metric === SLO_METRIC.VERIFICATION_COMPLETION);
  if (!verificationBreach) return [];

  const yieldValue = (typeof completionYield === "number" && Number.isFinite(completionYield))
    ? completionYield
    : null;
  if (yieldValue === null) return [];

  const threshold = (typeof opts?.yieldCollapseThreshold === "number" && Number.isFinite(opts.yieldCollapseThreshold))
    ? opts.yieldCollapseThreshold
    : COUPLED_ALERT_DEFAULT_YIELD_THRESHOLD;

  if (yieldValue >= threshold) return [];

  return [{
    type: COUPLED_ALERT_TYPE.YIELD_COLLAPSE_WITH_VERIFICATION_BREACH,
    verificationBreachActualMs: verificationBreach.actual,
    verificationBreachThresholdMs: verificationBreach.threshold,
    verificationBreachSeverity: verificationBreach.severity,
    completionYield: yieldValue,
    yieldCollapseThreshold: threshold,
    cycleId: sloRecord.cycleId ?? null,
  }];
}

// ── Sustained breach detection ────────────────────────────────────────────────

/** Default configuration for sustained breach signature detection. */
export const SLO_SUSTAINED_BREACH_DEFAULTS = Object.freeze({
  minConsecutiveBreaches: 3,
});

/**
 * A sustained breach signature produced when one SLO metric has breached
 * in at least minConsecutiveBreaches consecutive cycles (most-recent-first).
 *
 * @typedef {object} SustainedBreachSignature
 * @property {string}   metric               - SLO metric identifier (SLO_METRIC value)
 * @property {number}   consecutiveBreaches  - How many consecutive leading cycles breached
 * @property {string[]} affectedCycleIds     - Provenance: cycleId of each contributing cycle
 * @property {number}   averageExcessMs      - Mean excess above threshold across contributing cycles
 * @property {number}   maxExcessMs          - Worst-case excess above threshold
 * @property {string}   severity             - Highest severity seen across the run (SLO_BREACH_SEVERITY)
 */

/**
 * Detect sustained SLO breach signatures from a history array.
 *
 * A signature is produced for each metric that has breached in the most-recent
 * consecutive N cycles where N >= minConsecutiveBreaches.  History is expected
 * most-recent-first (as returned by readSloMetrics().history).
 *
 * Pure function — performs no file I/O.
 *
 * @param {object[]} history - SLO cycle records (most-recent-first)
 * @param {object}   opts
 * @param {number}   [opts.minConsecutiveBreaches=3] - consecutive breach threshold
 * @returns {SustainedBreachSignature[]}
 */
export function detectSustainedBreachSignatures(history, opts: { minConsecutiveBreaches?: number } = {}): any[] {
  const min = Number(
    opts?.minConsecutiveBreaches ?? SLO_SUSTAINED_BREACH_DEFAULTS.minConsecutiveBreaches
  );
  if (!Array.isArray(history) || history.length === 0) return [];
  if (!Number.isFinite(min) || min < 1) return [];

  const metrics = Object.values(SLO_METRIC);

  // Per-metric accumulator: only consecutive from the start of history
  const acc: Record<string, {
    done: boolean;
    count: number;
    cycleIds: string[];
    excesses: number[];
    maxSeverity: string;
  }> = {};

  for (const m of metrics) {
    acc[m] = {
      done: false,
      count: 0,
      cycleIds: [],
      excesses: [],
      maxSeverity: SLO_BREACH_SEVERITY.HIGH,
    };
  }

  for (const record of history) {
    const breaches: any[] = Array.isArray(record?.sloBreaches) ? record.sloBreaches : [];
    const byMetric = new Map<string, any>();
    for (const b of breaches) {
      if (typeof b?.metric === "string") byMetric.set(b.metric, b);
    }

    for (const m of metrics) {
      const state = acc[m];
      if (state.done) continue; // streak already broken for this metric

      if (byMetric.has(m)) {
        const breach = byMetric.get(m);
        state.count++;
        const id = record?.cycleId ?? record?.startedAt ?? null;
        if (id != null) state.cycleIds.push(String(id));
        const excess =
          typeof breach.actual === "number" && typeof breach.threshold === "number"
            ? Math.max(0, breach.actual - breach.threshold)
            : 0;
        state.excesses.push(excess);
        if (breach.severity === SLO_BREACH_SEVERITY.CRITICAL) {
          state.maxSeverity = SLO_BREACH_SEVERITY.CRITICAL;
        }
      } else {
        // No breach for this metric in this cycle — consecutive streak broken
        state.done = true;
      }
    }
  }

  const signatures: any[] = [];
  for (const m of metrics) {
    const state = acc[m];
    if (state.count >= min) {
      const totalExcess = state.excesses.reduce((s, v) => s + v, 0);
      const avgExcess = state.excesses.length > 0
        ? Math.round(totalExcess / state.excesses.length)
        : 0;
      const maxExcess = state.excesses.length > 0
        ? Math.max(...state.excesses)
        : 0;
      signatures.push({
        metric: m,
        consecutiveBreaches: state.count,
        affectedCycleIds: state.cycleIds,
        averageExcessMs: avgExcess,
        maxExcessMs: maxExcess,
        severity: state.maxSeverity,
      });
    }
  }

  return signatures;
}

```

### FILE: src/core/rollback_engine.ts
```typescript
/**
 * rollback_engine.js — Multi-level rollback engine for BOX orchestrator.
 *
 * ## Rollback levels and trigger conditions (AC-1 / Athena item #1)
 *
 *   config-only
 *     TRIGGER: CONFIG_PARSE_FAILURE — box.config.json fails JSON.parse
 *     TRIGGER: CONFIG_KEY_MISSING   — required config key absent
 *     TRIGGER: CANARY_ROLLBACK      — canary engine signals rollback
 *
 *   state-schema
 *     TRIGGER: STATE_SCHEMA_VIOLATION  — state file fails required-field validation
 *     TRIGGER: STATE_VERSION_MISMATCH  — state file schemaVersion unknown
 *
 *   policy-set
 *     TRIGGER: POLICY_PARSE_FAILURE    — policy.json fails JSON.parse
 *     TRIGGER: POLICY_GATE_MISSING     — required policy gate absent
 *     TRIGGER: POLICY_VERSION_MISMATCH — policy version incompatible
 *
 *   orchestration-code-freeze
 *     TRIGGER: CORE_FILE_MODIFIED      — critical file modified outside self-dev guard
 *     TRIGGER: SELF_DEV_GUARD_BREACH   — self-dev guard signals unauthorized core edit
 *
 *   full-baseline-restore
 *     TRIGGER: MULTI_LEVEL_FAILURE     — ≥2 rollback levels triggered in the same cycle
 *     TRIGGER: HEALTH_SCORE_CRITICAL   — health score < 0.3 after another level's rollback
 *
 * ## Incident record schema (AC-2 / Athena item #2)
 *   Storage: state/rollback_incidents.jsonl (append-only JSONL — immutable by design)
 *   Required fields: schemaVersion, incidentId, level, trigger, triggeredAt,
 *                    completedAt, status, stepsExecuted, evidence, baselineRef,
 *                    healthCheckResult, durationMs
 *
 * ## One-cycle SLA (AC-3 / Athena item #3)
 *   "One cycle" = config.rollbackEngine.oneCycleSlaMs (default: 5000ms)
 *   config-only and policy-set rollbacks must complete within this window.
 *   durationMs is recorded; SLA breach is flagged in the incident record.
 *
 * ## Baseline tag format (AC-4 / Athena item #4)
 *   Format: `box/baseline-YYYY-MM-DD`
 *   Storage: state/project_baseline.json (already set by project_lifecycle.js)
 *   Verification checks: CONFIG_PARSE, POLICY_PARSE, STATE_DIR_WRITABLE,
 *                        INCIDENT_LOG_PRESENT, FREEZE_LOCK_CONSISTENT
 *
 * ## Health validation (AC-5 / Athena item #5)
 *   Five deterministic checks, each with an explicit pass/fail contract:
 *     CONFIG_PARSE         — box.config.json parses without error
 *     POLICY_PARSE         — policy.json parses without error
 *     STATE_DIR_WRITABLE   — state/ accepts a sentinel write
 *     INCIDENT_LOG_PRESENT — rollback_incidents.jsonl is accessible
 *     FREEZE_LOCK_CONSISTENT — rollback_lock.json is absent or valid
 *
 * ## Orchestration-code freeze semantics (Athena item #6)
 *   Freeze:   write state/rollback_lock.json { frozen:true, frozenAt, frozenBy, scope }
 *   Scope:    selfDev.criticalFiles from box.config.json
 *   Unfreeze: set frozen=false with unfrozenAt, or delete the file
 *   No writes to files in scope are permitted while frozen (callers must check isFrozen()).
 *
 * ## State/ mutation boundary (Athena item #7)
 *   Rollback is permitted to write ONLY:
 *     state/rollback_incidents.jsonl — incident log (append-only)
 *     state/rollback_lock.json       — code freeze lock
 *     box.config.json                — config-only rollback target
 *     policy.json                    — policy-set rollback target
 *
 * ## No silent fallback (AC-10)
 *   Every public function returns { ok, status, reason } on failure.
 *   Critical state failures always set an explicit status field with a reason code.
 */

import path from "node:path";
import fs   from "node:fs/promises";
import { createHash } from "node:crypto";
import { readJson, readJsonSafe, writeJson, ensureParent } from "./fs_utils.js";
import { warn } from "./logger.js";

// ── Schema version ────────────────────────────────────────────────────────────

/** Integer schema version for rollback incident records. Bump on incompatible change. */
export const ROLLBACK_ENGINE_SCHEMA_VERSION = 1;

// ── Rollback level enum ───────────────────────────────────────────────────────

/**
 * All five rollback levels, in ascending severity order.
 * Each level has a discrete, deterministic trigger condition table (see module header).
 */
export const ROLLBACK_LEVEL = Object.freeze({
  CONFIG_ONLY:               "config-only",
  STATE_SCHEMA:              "state-schema",
  POLICY_SET:                "policy-set",
  ORCHESTRATION_CODE_FREEZE: "orchestration-code-freeze",
  FULL_BASELINE_RESTORE:     "full-baseline-restore"
});

// ── Trigger code enum ─────────────────────────────────────────────────────────

/**
 * Exhaustive set of machine-readable trigger codes, one-to-one with the
 * trigger condition table in the module header (resolves Athena item #1).
 *
 * Missing input (the trigger argument was absent):  MISSING_TRIGGER
 * Invalid input (the trigger value is not in this enum): INVALID_TRIGGER
 */
export const ROLLBACK_TRIGGER = Object.freeze({
  // config-only
  CONFIG_PARSE_FAILURE:    "CONFIG_PARSE_FAILURE",
  CONFIG_KEY_MISSING:      "CONFIG_KEY_MISSING",
  CANARY_ROLLBACK:         "CANARY_ROLLBACK",

  // state-schema
  STATE_SCHEMA_VIOLATION:  "STATE_SCHEMA_VIOLATION",
  STATE_VERSION_MISMATCH:  "STATE_VERSION_MISMATCH",

  // policy-set
  POLICY_PARSE_FAILURE:    "POLICY_PARSE_FAILURE",
  POLICY_GATE_MISSING:     "POLICY_GATE_MISSING",
  POLICY_VERSION_MISMATCH: "POLICY_VERSION_MISMATCH",

  // orchestration-code-freeze
  CORE_FILE_MODIFIED:      "CORE_FILE_MODIFIED",
  SELF_DEV_GUARD_BREACH:   "SELF_DEV_GUARD_BREACH",

  // full-baseline-restore
  MULTI_LEVEL_FAILURE:     "MULTI_LEVEL_FAILURE",
  HEALTH_SCORE_CRITICAL:   "HEALTH_SCORE_CRITICAL"
});

// ── Trigger-to-level mapping (deterministic dispatch table) ──────────────────

/**
 * Canonical trigger → level dispatch table.
 * executeRollback() uses this to validate trigger + level coherence.
 */
export const TRIGGER_LEVEL_MAP = Object.freeze({
  [ROLLBACK_TRIGGER.CONFIG_PARSE_FAILURE]:    ROLLBACK_LEVEL.CONFIG_ONLY,
  [ROLLBACK_TRIGGER.CONFIG_KEY_MISSING]:      ROLLBACK_LEVEL.CONFIG_ONLY,
  [ROLLBACK_TRIGGER.CANARY_ROLLBACK]:         ROLLBACK_LEVEL.CONFIG_ONLY,
  [ROLLBACK_TRIGGER.STATE_SCHEMA_VIOLATION]:  ROLLBACK_LEVEL.STATE_SCHEMA,
  [ROLLBACK_TRIGGER.STATE_VERSION_MISMATCH]:  ROLLBACK_LEVEL.STATE_SCHEMA,
  [ROLLBACK_TRIGGER.POLICY_PARSE_FAILURE]:    ROLLBACK_LEVEL.POLICY_SET,
  [ROLLBACK_TRIGGER.POLICY_GATE_MISSING]:     ROLLBACK_LEVEL.POLICY_SET,
  [ROLLBACK_TRIGGER.POLICY_VERSION_MISMATCH]: ROLLBACK_LEVEL.POLICY_SET,
  [ROLLBACK_TRIGGER.CORE_FILE_MODIFIED]:      ROLLBACK_LEVEL.ORCHESTRATION_CODE_FREEZE,
  [ROLLBACK_TRIGGER.SELF_DEV_GUARD_BREACH]:   ROLLBACK_LEVEL.ORCHESTRATION_CODE_FREEZE,
  [ROLLBACK_TRIGGER.MULTI_LEVEL_FAILURE]:     ROLLBACK_LEVEL.FULL_BASELINE_RESTORE,
  [ROLLBACK_TRIGGER.HEALTH_SCORE_CRITICAL]:   ROLLBACK_LEVEL.FULL_BASELINE_RESTORE
});

// ── Incident status enum ──────────────────────────────────────────────────────

export const ROLLBACK_STATUS = Object.freeze({
  TRIGGERED:  "triggered",
  EXECUTING:  "executing",
  COMPLETED:  "completed",
  FAILED:     "failed",
  SLA_BREACH: "sla_breach"
});

// ── Health check enum ─────────────────────────────────────────────────────────

/**
 * Exhaustive set of post-rollback health check identifiers (AC-5 / Athena item #5).
 * Each maps to a deterministic pass/fail predicate in runHealthValidation().
 */
export const HEALTH_CHECK = Object.freeze({
  CONFIG_PARSE:           "CONFIG_PARSE",
  POLICY_PARSE:           "POLICY_PARSE",
  STATE_DIR_WRITABLE:     "STATE_DIR_WRITABLE",
  INCIDENT_LOG_PRESENT:   "INCIDENT_LOG_PRESENT",
  FREEZE_LOCK_CONSISTENT: "FREEZE_LOCK_CONSISTENT"
});

// ── Validation reason codes ──────────────────────────────────────────────────

/**
 * Machine-readable reason codes for input validation.
 * Distinguishes missing input from invalid input (AC-9).
 */
export const ROLLBACK_REASON = Object.freeze({
  OK:                   "OK",
  MISSING_TRIGGER:      "MISSING_TRIGGER",    // trigger argument absent
  INVALID_TRIGGER:      "INVALID_TRIGGER",    // trigger not in ROLLBACK_TRIGGER enum
  MISSING_LEVEL:        "MISSING_LEVEL",      // level argument absent
  INVALID_LEVEL:        "INVALID_LEVEL",      // level not in ROLLBACK_LEVEL enum
  TRIGGER_LEVEL_MISMATCH: "TRIGGER_LEVEL_MISMATCH", // trigger not valid for level
  MISSING_CONFIG:       "MISSING_CONFIG",     // config object absent
  NO_ROLLBACK_TARGET:   "NO_ROLLBACK_TARGET"  // no value to roll back to
});

// ── State mutation boundary ───────────────────────────────────────────────────

/**
 * Exhaustive list of state/ paths that rollback is permitted to write.
 * Any write outside this set by rollback code is a protocol violation (Athena item #7).
 */
export const ROLLBACK_PERMITTED_WRITES = Object.freeze([
  "state/rollback_incidents.jsonl",
  "state/rollback_lock.json"
]);

/**
 * Files outside state/ that rollback is permitted to write (level-specific):
 *   config-only  → box.config.json
 *   policy-set   → policy.json
 */
export const ROLLBACK_PERMITTED_EXTERNAL_WRITES = Object.freeze({
  [ROLLBACK_LEVEL.CONFIG_ONLY]: ["box.config.json"],
  [ROLLBACK_LEVEL.POLICY_SET]:  ["policy.json"]
});

// ── Default configuration ─────────────────────────────────────────────────────

/**
 * Default rollback engine configuration.
 * Corresponds to box.config.json#rollbackEngine.
 */
export const ROLLBACK_ENGINE_DEFAULTS = Object.freeze({
  enabled:          true,
  oneCycleSlaMs:    5000,               // AC-3: one-cycle SLA wall-clock budget
  incidentLogPath:  "state/rollback_incidents.jsonl",
  lockFilePath:     "state/rollback_lock.json",
  baselineRefPath:  "state/project_baseline.json",
  configFilePath:   "box.config.json",
  policyFilePath:   "policy.json"
});

// ── Incident ID generation ────────────────────────────────────────────────────

/**
 * Generate a deterministic, collision-resistant incident ID.
 * Format: rollback-<sha1-12> derived from level+trigger+timestamp.
 */
function buildIncidentId(level, trigger, ts) {
  const hash = createHash("sha1")
    .update(`${level}:${trigger}:${ts}`)
    .digest("hex")
    .slice(0, 12);
  return `rollback-${hash}`;
}

// ── Input validation ─────────────────────────────────────────────────────────

/**
 * Validate a rollback request before execution.
 * Distinguishes missing input from invalid input (AC-9).
 *
 * @param {{ level: string, trigger: string, evidence: object }} params
 * @returns {{ ok: boolean, reason: string, message: string }}
 */
export function validateRollbackRequest(params) {
  if (!params || typeof params !== "object") {
    return { ok: false, reason: ROLLBACK_REASON.MISSING_TRIGGER, message: "params object is required" };
  }

  const { level, trigger } = params;

  if (trigger === undefined || trigger === null || trigger === "") {
    return { ok: false, reason: ROLLBACK_REASON.MISSING_TRIGGER, message: "trigger is required" };
  }
  if (!Object.values(ROLLBACK_TRIGGER).includes(trigger)) {
    return { ok: false, reason: ROLLBACK_REASON.INVALID_TRIGGER, message: `trigger '${trigger}' is not a valid ROLLBACK_TRIGGER value` };
  }

  if (level === undefined || level === null || level === "") {
    return { ok: false, reason: ROLLBACK_REASON.MISSING_LEVEL, message: "level is required" };
  }
  if (!Object.values(ROLLBACK_LEVEL).includes(level)) {
    return { ok: false, reason: ROLLBACK_REASON.INVALID_LEVEL, message: `level '${level}' is not a valid ROLLBACK_LEVEL value` };
  }

  const expectedLevel = TRIGGER_LEVEL_MAP[trigger];
  if (expectedLevel !== level) {
    return {
      ok: false,
      reason: ROLLBACK_REASON.TRIGGER_LEVEL_MISMATCH,
      message: `trigger '${trigger}' belongs to level '${expectedLevel}', not '${level}'`
    };
  }

  return { ok: true, reason: ROLLBACK_REASON.OK, message: "valid" };
}

// ── Incident record helpers ───────────────────────────────────────────────────

/**
 * Append a single incident record to the append-only JSONL incident log.
 * Immutability is enforced by append-only file operations (O_APPEND).
 *
 * The log is one JSON object per line — never a JSON array.
 * Schema (all fields required, AC-2 / Athena item #2):
 *   schemaVersion {number}    = ROLLBACK_ENGINE_SCHEMA_VERSION
 *   incidentId    {string}    — rollback-<sha1-12>
 *   level         {string}    — one of ROLLBACK_LEVEL
 *   trigger       {string}    — one of ROLLBACK_TRIGGER
 *   triggeredAt   {string}    — ISO 8601
 *   completedAt   {string|null}
 *   status        {string}    — one of ROLLBACK_STATUS
 *   stepsExecuted {string[]}  — ordered list of executed step descriptions
 *   evidence      {object}    — level-specific context provided by caller
 *   baselineRef   {string|null} — box/baseline-YYYY-MM-DD or null
 *   healthCheckResult {object|null}
 *   durationMs    {number|null}
 *   slaBreach     {boolean}
 */
async function appendIncident(logPath, record) {
  await ensureParent(logPath);
  const line = `${JSON.stringify(record)}\n`;
  // Use append flag — this is the immutability enforcement mechanism
  await fs.appendFile(logPath, line, { encoding: "utf8", flag: "a" });
}

// ── Freeze lock helpers ───────────────────────────────────────────────────────

/**
 * Write the orchestration-code-freeze lock file.
 * Scope = criticalFiles from box.config.json#selfDev.criticalFiles.
 */
async function writeFreezelock(lockPath, trigger, criticalFiles) {
  const lock = {
    frozen:    true,
    frozenAt:  new Date().toISOString(),
    frozenBy:  trigger,
    scope:     Array.isArray(criticalFiles) ? criticalFiles : [],
    unfrozenAt: null
  };
  await writeJson(lockPath, lock);
  return lock;
}

/**
 * Read the current freeze lock state, or return null if no lock file exists.
 * @param {string} lockPath
 * @returns {Promise<object|null>}
 */
export async function readFreezeLock(lockPath) {
  const result = await readJsonSafe(lockPath);
  if (!result.ok) return null;
  return result.data;
}

/**
 * Check whether the orchestration-code-freeze is currently active.
 * @param {string} lockPath
 * @returns {Promise<boolean>}
 */
export async function isFrozen(lockPath) {
  const lock = await readFreezeLock(lockPath);
  return lock?.frozen === true;
}

/**
 * Lift a previously applied code freeze by marking it unfrozen.
 * Does NOT delete the file — preserves audit trail.
 * @param {string} lockPath
 * @returns {Promise<{ ok: boolean, reason: string }>}
 */
export async function unfreeze(lockPath) {
  const lock = await readFreezeLock(lockPath);
  if (!lock) {
    return { ok: false, reason: "no lock file found" };
  }
  if (!lock.frozen) {
    return { ok: true, reason: "already unfrozen" };
  }
  lock.frozen = false;
  lock.unfrozenAt = new Date().toISOString();
  await writeJson(lockPath, lock);
  return { ok: true, reason: "unfrozen" };
}

// ── Post-rollback health validation ─────────────────────────────────────────

/**
 * Run all five post-rollback health checks (AC-5 / Athena item #5).
 *
 * Check list:
 *   CONFIG_PARSE         — box.config.json is valid JSON
 *   POLICY_PARSE         — policy.json is valid JSON
 *   STATE_DIR_WRITABLE   — state/ directory accepts a sentinel write + cleanup
 *   INCIDENT_LOG_PRESENT — rollback_incidents.jsonl exists and is accessible
 *   FREEZE_LOCK_CONSISTENT — rollback_lock.json is absent, or frozen is a boolean
 *
 * Returns:
 *   { ok: boolean, checks: Array<{ check, pass, reason }>, summary: string }
 *
 * Pass condition: ALL checks pass → ok=true.
 * The output surface is a structured object, never a raw string.
 *
 * @param {object} paths — { configFile, policyFile, stateDir, incidentLog, lockFile }
 * @returns {Promise<{ ok: boolean, checks: Array, summary: string }>}
 */
export async function runHealthValidation(paths) {
  const checks = [];

  // 1. CONFIG_PARSE
  {
    const r = await readJsonSafe(paths.configFile);
    checks.push({
      check: HEALTH_CHECK.CONFIG_PARSE,
      pass:  r.ok,
      reason: r.ok ? "parsed" : `${r.reason}: ${r.error?.message || "unknown"}`
    });
  }

  // 2. POLICY_PARSE
  {
    const r = await readJsonSafe(paths.policyFile);
    checks.push({
      check: HEALTH_CHECK.POLICY_PARSE,
      pass:  r.ok,
      reason: r.ok ? "parsed" : `${r.reason}: ${r.error?.message || "unknown"}`
    });
  }

  // 3. STATE_DIR_WRITABLE
  {
    const sentinel = path.join(paths.stateDir, ".rollback-health-sentinel");
    let pass = false;
    let reason;
    try {
      await ensureParent(sentinel);
      await fs.writeFile(sentinel, "ok", "utf8");
      await fs.rm(sentinel, { force: true });
      pass = true;
      reason = "writable";
    } catch (err) {
      reason = err.message || "write failed";
    }
    checks.push({ check: HEALTH_CHECK.STATE_DIR_WRITABLE, pass, reason });
  }

  // 4. INCIDENT_LOG_PRESENT
  {
    let pass = false;
    let reason;
    try {
      await fs.access(paths.incidentLog);
      pass = true;
      reason = "accessible";
    } catch (err) {
      reason = err.code === "ENOENT" ? "file not found (ENOENT)" : err.message || "inaccessible";
    }
    checks.push({ check: HEALTH_CHECK.INCIDENT_LOG_PRESENT, pass, reason });
  }

  // 5. FREEZE_LOCK_CONSISTENT
  {
    let pass = false;
    let reason;
    try {
      const lockData = await readJsonSafe(paths.lockFile);
      if (!lockData.ok && lockData.reason === "missing") {
        // No lock file → consistent (not frozen)
        pass = true;
        reason = "absent (not frozen)";
      } else if (lockData.ok && typeof lockData.data?.frozen === "boolean") {
        pass = true;
        reason = lockData.data.frozen ? "frozen" : "unfrozen";
      } else {
        reason = lockData.ok ? "frozen field missing or not boolean" : `read error: ${lockData.reason}`;
      }
    } catch (err) {
      reason = err.message || "check failed";
    }
    checks.push({ check: HEALTH_CHECK.FREEZE_LOCK_CONSISTENT, pass, reason });
  }

  const allPass = checks.every(c => c.pass);
  const failed  = checks.filter(c => !c.pass).map(c => c.check);
  const summary = allPass
    ? "all health checks passed"
    : `failed checks: ${failed.join(", ")}`;

  return { ok: allPass, checks, summary };
}

// ── Rollback level executors ──────────────────────────────────────────────────

/**
 * Execute config-only rollback.
 * Reads box.config.json backup from evidence.controlValue and writes it back.
 * Must complete within one-cycle SLA (oneCycleSlaMs).
 *
 * @param {object} ctx — { configFilePath, evidence: { controlValue, configPath } }
 * @returns {Promise<{ ok: boolean, steps: string[], reason?: string }>}
 */
async function executeConfigRollback(ctx) {
  const steps = [];

  const { configFilePath, evidence } = ctx;

  if (!evidence?.controlValue) {
    return { ok: false, steps, reason: ROLLBACK_REASON.NO_ROLLBACK_TARGET };
  }

  steps.push("read control value from evidence");
  try {
    // controlValue is the pre-canary config snapshot (object or partial patch)
    // Write it back to box.config.json
    const existing = await readJsonSafe(configFilePath);
    const current = existing.ok ? existing.data : {};

    // Apply controlValue as a deep patch (top-level keys only — safe shallow restore)
    const restored = { ...current, ...evidence.controlValue };
    await writeJson(configFilePath, restored);
    steps.push(`wrote control value back to ${configFilePath}`);
    return { ok: true, steps };
  } catch (err) {
    steps.push(`write failed: ${err.message}`);
    return { ok: false, steps, reason: err.message };
  }
}

/**
 * Execute state-schema rollback.
 * Moves the offending state file to a .corrupt backup and writes an empty valid skeleton.
 *
 * @param {object} ctx — { stateDir, evidence: { filePath, requiredFields } }
 * @returns {Promise<{ ok: boolean, steps: string[], reason?: string }>}
 */
async function executeStateSchemaRollback(ctx) {
  const steps = [];
  const { evidence } = ctx;

  if (!evidence?.filePath) {
    return { ok: false, steps, reason: ROLLBACK_REASON.NO_ROLLBACK_TARGET };
  }

  const corruptPath = `${evidence.filePath}.corrupt.${Date.now()}`;
  try {
    // Rename offending file to .corrupt backup — preserve for forensics
    await fs.rename(evidence.filePath, corruptPath);
    steps.push(`quarantined corrupt state file → ${corruptPath}`);

    // Write a typed empty skeleton so downstream code doesn't fail on missing file
    const skeleton = {
      schemaVersion: 1,
      quarantinedAt: new Date().toISOString(),
      reason:        "state-schema rollback — original file quarantined",
      originalPath:  evidence.filePath
    };
    await writeJson(evidence.filePath, skeleton);
    steps.push(`wrote empty skeleton to ${evidence.filePath}`);
    return { ok: true, steps };
  } catch (err) {
    steps.push(`quarantine failed: ${err.message}`);
    return { ok: false, steps, reason: err.message };
  }
}

/**
 * Execute policy-set rollback.
 * Restores policy.json from evidence.controlValue.
 *
 * @param {object} ctx — { policyFilePath, evidence: { controlValue } }
 * @returns {Promise<{ ok: boolean, steps: string[], reason?: string }>}
 */
async function executePolicyRollback(ctx) {
  const steps = [];
  const { policyFilePath, evidence } = ctx;

  if (!evidence?.controlValue) {
    return { ok: false, steps, reason: ROLLBACK_REASON.NO_ROLLBACK_TARGET };
  }

  steps.push("read policy control value from evidence");
  try {
    await writeJson(policyFilePath, evidence.controlValue);
    steps.push(`restored policy.json from control value`);
    return { ok: true, steps };
  } catch (err) {
    steps.push(`policy restore failed: ${err.message}`);
    return { ok: false, steps, reason: err.message };
  }
}

/**
 * Execute orchestration-code-freeze.
 * Writes the freeze lock and does NOT modify any source files.
 * Scope is derived from selfDev.criticalFiles in box.config.json.
 *
 * @param {object} ctx — { lockFilePath, criticalFiles, trigger }
 * @returns {Promise<{ ok: boolean, steps: string[], reason?: string }>}
 */
async function executeCodeFreeze(ctx) {
  const steps = [];
  const { lockFilePath, criticalFiles, trigger } = ctx;

  try {
    const lock = await writeFreezelock(lockFilePath, trigger, criticalFiles);
    steps.push(`wrote freeze lock to ${lockFilePath}`);
    steps.push(`frozen scope: ${lock.scope.length} critical files`);
    steps.push("code freeze active — no further writes to critical files until unfreeze()");
    return { ok: true, steps };
  } catch (err) {
    steps.push(`freeze lock write failed: ${err.message}`);
    return { ok: false, steps, reason: err.message };
  }
}

/**
 * Execute full-baseline-restore guidance.
 * Records the baseline tag reference and verification check list in the incident.
 * Automated step: validates baseline ref is resolvable in state/project_baseline.json.
 * Human step: instructions are recorded in the incident record (evidence.restoreGuidance).
 *
 * @param {object} ctx — { baselineRefPath, evidence }
 * @returns {Promise<{ ok: boolean, steps: string[], baselineRef: string|null, reason?: string }>}
 */
async function executeFullBaselineRestore(ctx) {
  const steps = [];
  const { baselineRefPath, evidence } = ctx;

  const baseline = await readJson(baselineRefPath, null);
  const baselineTag = baseline?.tagName || null;

  if (!baselineTag) {
    steps.push("WARNING: no baseline tag found in state/project_baseline.json");
    steps.push("manual baseline restore required — see evidence.restoreGuidance");
  } else {
    steps.push(`baseline tag resolved: ${baselineTag} → ${baseline.sha?.slice(0, 7) || "unknown"}`);
    steps.push("automated verification: CONFIG_PARSE, POLICY_PARSE, STATE_DIR_WRITABLE, INCIDENT_LOG_PRESENT, FREEZE_LOCK_CONSISTENT");
    steps.push(`restore command: git revert --no-commit ${baselineTag}..HEAD && git commit -m "Revert to baseline ${baselineTag}"`);
  }

  // Record machine-readable restore guidance
  const restoreGuidance = {
    baselineTag,
    baselineSha:         baseline?.sha || null,
    baselineRepo:        baseline?.repo || null,
    capturedAt:          baseline?.capturedAt || null,
    verificationChecks:  Object.values(HEALTH_CHECK),
    restoreCommand:      baselineTag
      ? `git revert --no-commit ${baselineTag}..HEAD && git commit -m "Revert to baseline ${baselineTag}"`
      : "git revert --no-commit <baseline-tag>..HEAD && git commit -m 'Revert to baseline'",
    note: "Run runHealthValidation() after completing the restore to confirm system health"
  };

  if (evidence && typeof evidence === "object") {
    evidence.restoreGuidance = restoreGuidance;
  }

  return { ok: true, steps, baselineRef: baselineTag };
}

// ── Main public API ───────────────────────────────────────────────────────────

/**
 * Resolve rollback engine configuration from box.config.json#rollbackEngine.
 * Falls back to ROLLBACK_ENGINE_DEFAULTS for any absent key.
 */
export function resolveRollbackConfig(boxConfig) {
  const rc = boxConfig?.rollbackEngine || {};
  return {
    enabled:         rc.enabled         ?? ROLLBACK_ENGINE_DEFAULTS.enabled,
    oneCycleSlaMs:   rc.oneCycleSlaMs   ?? ROLLBACK_ENGINE_DEFAULTS.oneCycleSlaMs,
    incidentLogPath: rc.incidentLogPath ?? ROLLBACK_ENGINE_DEFAULTS.incidentLogPath,
    lockFilePath:    rc.lockFilePath    ?? ROLLBACK_ENGINE_DEFAULTS.lockFilePath,
    baselineRefPath: rc.baselineRefPath ?? ROLLBACK_ENGINE_DEFAULTS.baselineRefPath,
    configFilePath:  rc.configFilePath  ?? ROLLBACK_ENGINE_DEFAULTS.configFilePath,
    policyFilePath:  rc.policyFilePath  ?? ROLLBACK_ENGINE_DEFAULTS.policyFilePath,
    criticalFiles:   rc.criticalFiles   ?? (boxConfig?.selfDev?.criticalFiles || [])
  };
}

/**
 * Execute a rollback at the specified level with the given trigger.
 *
 * Algorithm:
 *   1. Validate inputs (missing vs. invalid, AC-9)
 *   2. Write "triggered" incident record (AC-2)
 *   3. Execute level-specific steps with SLA timer (AC-3)
 *   4. Run post-rollback health validation (AC-5)
 *   5. Append final incident record with status, steps, health, duration (AC-2)
 *   6. Return structured result — never throws, always sets status (AC-10)
 *
 * @param {object} params
 *   @param {string}  params.level     — one of ROLLBACK_LEVEL
 *   @param {string}  params.trigger   — one of ROLLBACK_TRIGGER
 *   @param {object}  [params.evidence] — level-specific context
 *   @param {object}  params.config    — full box.config.json object
 *   @param {string}  [params.stateDir] — override state directory path
 * @returns {Promise<{
 *   ok: boolean,
 *   status: string,
 *   reason: string|null,
 *   incidentId: string|null,
 *   durationMs: number|null,
 *   slaBreach: boolean,
 *   healthCheckResult: object|null,
 *   baselineRef: string|null
 * }>}
 */
export async function executeRollback(params) {
  // ── Validate inputs ──────────────────────────────────────────────────────
  const validation = validateRollbackRequest(params);
  if (!validation.ok) {
    return {
      ok:               false,
      status:           "degraded",
      reason:           validation.reason,
      incidentId:       null,
      durationMs:       null,
      slaBreach:        false,
      healthCheckResult: null,
      baselineRef:       null
    };
  }

  if (!params.config || typeof params.config !== "object") {
    return {
      ok:               false,
      status:           "degraded",
      reason:           ROLLBACK_REASON.MISSING_CONFIG,
      incidentId:       null,
      durationMs:       null,
      slaBreach:        false,
      healthCheckResult: null,
      baselineRef:       null
    };
  }

  const { level, trigger, evidence = {}, config } = params;
  const rc = resolveRollbackConfig(config);
  const stateDir = params.stateDir || "state";

  const triggeredAt = new Date().toISOString();
  const incidentId  = buildIncidentId(level, trigger, triggeredAt);
  const startMs     = Date.now();

  // ── Write "triggered" incident record ────────────────────────────────────
  const triggeredRecord = {
    schemaVersion:   ROLLBACK_ENGINE_SCHEMA_VERSION,
    incidentId,
    level,
    trigger,
    triggeredAt,
    completedAt:     null,
    status:          ROLLBACK_STATUS.TRIGGERED,
    stepsExecuted:   [],
    evidence:        { ...evidence },
    baselineRef:     null,
    healthCheckResult: null,
    durationMs:      null,
    slaBreach:       false
  };

  try {
    await appendIncident(rc.incidentLogPath, triggeredRecord);
  } catch (err) {
    warn(`[rollback] failed to write triggered incident: ${err.message}`);
  }

  // ── Execute level-specific rollback ──────────────────────────────────────
  let execResult;
  let baselineRef = null;

  try {
    switch (level) {
      case ROLLBACK_LEVEL.CONFIG_ONLY:
        execResult = await executeConfigRollback({
          configFilePath: rc.configFilePath,
          evidence
        });
        break;

      case ROLLBACK_LEVEL.STATE_SCHEMA:
        execResult = await executeStateSchemaRollback({
          stateDir,
          evidence
        });
        break;

      case ROLLBACK_LEVEL.POLICY_SET:
        execResult = await executePolicyRollback({
          policyFilePath: rc.policyFilePath,
          evidence
        });
        break;

      case ROLLBACK_LEVEL.ORCHESTRATION_CODE_FREEZE:
        execResult = await executeCodeFreeze({
          lockFilePath:  rc.lockFilePath,
          criticalFiles: rc.criticalFiles,
          trigger
        });
        break;

      case ROLLBACK_LEVEL.FULL_BASELINE_RESTORE:
        execResult = await executeFullBaselineRestore({
          baselineRefPath: rc.baselineRefPath,
          evidence
        });
        baselineRef = execResult.baselineRef || null;
        break;

      default:
        execResult = { ok: false, steps: [], reason: `unhandled level: ${level}` };
    }
  } catch (err) {
    execResult = { ok: false, steps: [], reason: err.message };
    warn(`[rollback] level execution threw: ${err.message}`);
  }

  const durationMs  = Date.now() - startMs;
  const oneCycleSla = rc.oneCycleSlaMs;
  const slaBreach   = (
    (level === ROLLBACK_LEVEL.CONFIG_ONLY || level === ROLLBACK_LEVEL.POLICY_SET) &&
    durationMs > oneCycleSla
  );

  if (slaBreach) {
    warn(`[rollback] SLA breach: level=${level} durationMs=${durationMs} slaMs=${oneCycleSla}`);
  }

  // ── Post-rollback health validation ──────────────────────────────────────
  const healthCheckResult = await runHealthValidation({
    configFile:  rc.configFilePath,
    policyFile:  rc.policyFilePath,
    stateDir,
    incidentLog: rc.incidentLogPath,
    lockFile:    rc.lockFilePath
  });

  // ── Write final incident record ───────────────────────────────────────────
  const completedAt = new Date().toISOString();
  const finalStatus = !execResult.ok
    ? ROLLBACK_STATUS.FAILED
    : slaBreach
      ? ROLLBACK_STATUS.SLA_BREACH
      : ROLLBACK_STATUS.COMPLETED;

  const finalRecord = {
    ...triggeredRecord,
    completedAt,
    status:           finalStatus,
    stepsExecuted:    execResult.steps || [],
    evidence:         { ...evidence },
    baselineRef,
    healthCheckResult,
    durationMs,
    slaBreach
  };

  try {
    await appendIncident(rc.incidentLogPath, finalRecord);
  } catch (err) {
    warn(`[rollback] failed to write final incident: ${err.message}`);
  }

  return {
    ok:               execResult.ok,
    status:           finalStatus,
    reason:           execResult.ok ? null : (execResult.reason || "execution failed"),
    incidentId,
    durationMs,
    slaBreach,
    healthCheckResult,
    baselineRef
  };
}

/**
 * Read all incident records from the JSONL log.
 * Returns an array of parsed incident objects in append order.
 *
 * @param {string} logPath
 * @returns {Promise<object[]>}
 */
export async function readIncidentLog(logPath) {
  try {
    const raw = await fs.readFile(logPath, "utf8");
    return raw
      .split("\n")
      .filter(line => line.trim())
      .map(line => JSON.parse(line));
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
}

```

### FILE: src/core/governance_canary.ts
```typescript
/**
 * Governance Canary — Staged rollout of policy rule changes to a subset of cycles.
 *
 * T-035: "Introduce governance canary for policy changes"
 * Risk level: medium-high (automatic rollback logic gates policy enforcement)
 *
 * ## Design: cohort-based policy gating
 *
 *   Each cycle is deterministically assigned to a cohort ("canary" or "control")
 *   via hash-mod of the cycle ID. Cycles in the canary cohort have new governance
 *   rules applied; control cycles use the existing policy baseline. This lets the
 *   system compare outcomes between the two groups before promoting globally.
 *
 * ## Cohort selection algorithm (AC1 / Athena missing item 1)
 *
 *   Algorithm  : "hash-mod"  (config key: canary.governance.cohortSelectionAlgorithm)
 *   Seeding    : sha1(cycleId) — cycle ID is the entropy source
 *   Mapping    : parseInt(sha1(cycleId).slice(0, 8), 16) % 100 < ratio * 100
 *                → CANARY; otherwise CONTROL
 *   ratio      : canary.governance.canaryRatio or canary.defaultRatio (default 0.2)
 *   Determinism: same cycleId always maps to the same cohort (no randomness)
 *
 * ## Tracking schema (AC2 / Athena missing item 2)
 *
 *   Storage    : state/governance_canary_ledger.json (GOVERNANCE_LEDGER_PATH)
 *   Format     : JSON, schemaVersion: 1
 *   Structure  :
 *   {
 *     "schemaVersion": 1,
 *     "experiments": [
 *       {
 *         "canaryId":      "govcanary-<sha1-12>",   // stable derived ID
 *         "experimentId":  "exp-...|null",           // links to experiment_registry
 *         "policyRulePatch": { ... },                // the staged policy rule change
 *         "canaryRatio":   0.2,                      // cohort selection ratio
 *         "status":        "running",                // GOVERNANCE_CANARY_STATUS enum
 *         "statusReason":  null,                     // machine-readable reason
 *         "cohortStats": {
 *           "canary":  { "cycleCount": 0, "falseBlockRate": 0, "safetyScore": 1 },
 *           "control": { "cycleCount": 0, "falseBlockRate": 0, "safetyScore": 1 }
 *         },
 *         "cycleLog": [                              // per-cycle cohort assignments + outcomes
 *           {
 *             "cycleId":   "cycle-...",
 *             "cohort":    "canary"|"control",
 *             "timestamp": "2026-...",
 *             "metrics":   { "falseBlockRate": 0.01, "safetyScore": 0.98, ... }
 *           }
 *         ],
 *         "createdAt":     "2026-...",
 *         "promotedAt":    null,
 *         "rolledBackAt":  null
 *       }
 *     ],
 *     "updatedAt": "2026-..."
 *   }
 *
 * ## Promotion thresholds (AC3 / Athena missing item 3)
 *
 *   falseBlockRateMax  : 0.02  — canary false-block rate must be < 2%
 *   safetyScoreMin     : 0.95  — canary safety score must be ≥ 95%
 *   Config keys: canary.governance.falseBlockRateMax, canary.governance.safetyScoreMin
 *
 * ## Breach (rollback) condition (AC4 / Athena missing item 4)
 *
 *   Trigger metric     : falseBlockRate > falseBlockRateTrigger (default 0.05)
 *                        OR safetyScore < safetyScoreTriggerLow (default 0.80)
 *   Measurement window : canary.governance.measurementWindowCycles (default 5) cycles
 *   Rollback behavior  : status=rolled_back, breachAction="halt_new_assignments"
 *                        (no new policy rule assignments until canary is cleared)
 *   Config key         : canary.governance.breachAction
 *
 * ## Audit log (AC5)
 *
 *   Storage    : state/governance_canary_audit.jsonl (GOVERNANCE_AUDIT_LOG_PATH)
 *   Each entry : { event, canaryId, experimentId, cycleId, cohort, timestamp,
 *                  metrics, reason }
 */

import path from "node:path";
import fs   from "node:fs/promises";
import { createHash } from "node:crypto";
import { readJson, writeJson } from "./fs_utils.js";

// ── Constants ─────────────────────────────────────────────────────────────────

export const GOVERNANCE_LEDGER_PATH    = "state/governance_canary_ledger.json";
export const GOVERNANCE_AUDIT_LOG_PATH = "state/governance_canary_audit.jsonl";

// ── Cohort enum (AC1) ─────────────────────────────────────────────────────────

/**
 * Cohort assignment values for governance canary.
 * CANARY cycles have new governance rules applied; CONTROL cycles use the baseline.
 */
export const COHORT = Object.freeze({
  CANARY:  "canary",
  CONTROL: "control"
});

// ── Status enum (AC8) ─────────────────────────────────────────────────────────

/**
 * Lifecycle status values for a governance canary experiment entry.
 */
export const GOVERNANCE_CANARY_STATUS = Object.freeze({
  RUNNING:     "running",
  PROMOTED:    "promoted",
  ROLLED_BACK: "rolled_back",
  FAILED:      "failed"
});

// ── Audit event enum (AC8) ────────────────────────────────────────────────────

export const GOVERNANCE_AUDIT_EVENT = Object.freeze({
  CANARY_STARTED:     "GOVERNANCE_CANARY_STARTED",
  CYCLE_ASSIGNED:     "GOVERNANCE_CYCLE_ASSIGNED",
  METRICS_RECORDED:   "GOVERNANCE_METRICS_RECORDED",
  CANARY_PROMOTED:    "GOVERNANCE_CANARY_PROMOTED",
  CANARY_ROLLED_BACK: "GOVERNANCE_CANARY_ROLLED_BACK",
  CANARY_FAILED:      "GOVERNANCE_CANARY_FAILED"
});

/** Required fields on every audit log entry. */
export const GOVERNANCE_AUDIT_REQUIRED_FIELDS = Object.freeze([
  "event", "canaryId", "timestamp"
]);

// ── Named metric set (AC2) ────────────────────────────────────────────────────

/**
 * Named governance metrics used for canary/control comparison.
 * falseBlockRate : fraction of valid policy evaluations incorrectly blocked
 * safetyScore    : weighted safety quality score (1.0 = perfect safety)
 */
export const GOVERNANCE_METRIC_NAMES = Object.freeze({
  FALSE_BLOCK_RATE: "falseBlockRate",
  SAFETY_SCORE:     "safetyScore"
});

// ── Threshold defaults (AC3 / AC4) ────────────────────────────────────────────

/**
 * Default promotion thresholds for governance canary (AC3 / Athena missing item 3).
 * Both must be satisfied across the canary cohort before global promotion is allowed.
 * Config keys: canary.governance.falseBlockRateMax, canary.governance.safetyScoreMin
 */
export const DEFAULT_GOVERNANCE_PROMOTION_THRESHOLDS = Object.freeze({
  falseBlockRateMax: 0.02,   // canary false-block rate must be < 2%
  safetyScoreMin:    0.95    // canary safety score must be >= 95%
});

/**
 * Default breach (rollback trigger) thresholds (AC4 / Athena missing item 4).
 * If the canary cohort exceeds these in any single measurement window, rollback triggers.
 * Config keys: canary.governance.falseBlockRateTrigger, canary.governance.safetyScoreTriggerLow
 */
export const DEFAULT_GOVERNANCE_BREACH_THRESHOLDS = Object.freeze({
  falseBlockRateTrigger: 0.05,  // error: false-block rate above 5% = immediate rollback
  safetyScoreTriggerLow: 0.80   // error: safety score below 80% = immediate rollback
});

/** Default cohort selection algorithm identifier (AC1). */
export const DEFAULT_COHORT_ALGORITHM = "hash-mod";

/** Default measurement window in cycles (AC4). */
export const DEFAULT_MEASUREMENT_WINDOW_CYCLES = 5;

/** Default breach action (AC4). */
export const DEFAULT_BREACH_ACTION = "halt_new_assignments";

// ── Breach action enum (AC4 / AC8) ────────────────────────────────────────────

/**
 * Machine-readable breach action values.
 * Written to the ledger entry status when a breach occurs.
 */
export const GOVERNANCE_BREACH_ACTION = Object.freeze({
  HALT_NEW_ASSIGNMENTS: "halt_new_assignments"
});

// ── Validation error codes (AC9) ─────────────────────────────────────────────

/**
 * Reason codes for governance canary input validation.
 * Distinguishes missing input from invalid input (AC9 / Athena missing item 7).
 *
 * @typedef {"MISSING_FIELD"|"INVALID_VALUE"} GovernanceValidationCode
 */
export const GOVERNANCE_VALIDATION_CODE = Object.freeze({
  MISSING_FIELD: "MISSING_FIELD",
  INVALID_VALUE: "INVALID_VALUE"
});

// ── Cohort selection algorithm (AC1 / Athena missing item 1) ──────────────────

/**
 * Deterministically assign a cycle to a cohort using hash-mod (AC1).
 *
 * Algorithm : "hash-mod"
 * Seeding   : sha1(cycleId)
 * Mapping   : parseInt(sha1(cycleId).slice(0, 8), 16) % 100 < ratio * 100 → CANARY
 *
 * Properties:
 *   - Deterministic: same cycleId always maps to the same cohort
 *   - No external state: purely functional
 *   - Uniform distribution across cycle IDs
 *
 * @param {string} cycleId - opaque cycle identifier (entropy source)
 * @param {number} ratio   - canary fraction in (0, 1] (e.g. 0.2 = 20% canary)
 * @returns {"canary"|"control"}
 */
export function assignCohort(cycleId, ratio) {
  if (!cycleId || typeof cycleId !== "string" || cycleId.trim() === "") {
    // Invalid input: default to control (safe fallback — no new rules applied)
    return COHORT.CONTROL;
  }
  const r = typeof ratio === "number" && Number.isFinite(ratio) && ratio > 0 && ratio <= 1
    ? ratio
    : 0.2;

  const hex    = createHash("sha1").update(String(cycleId)).digest("hex");
  const bucket = parseInt(hex.slice(0, 8), 16) % 100;
  return bucket < Math.round(r * 100) ? COHORT.CANARY : COHORT.CONTROL;
}

// ── Config helpers ────────────────────────────────────────────────────────────

/**
 * Read governance canary config from box.config.json, applying defaults for missing keys.
 *
 * @param {object} config - full runtime config (loadConfig() result)
 * @returns {object}
 */
export function getGovernanceCanaryConfig(config) {
  const c  = config?.canary || {};
  const gc = c.governance || {};

  return {
    enabled:                  typeof c.enabled === "boolean" ? c.enabled : true,
    canaryRatio:              typeof gc.canaryRatio === "number" ? gc.canaryRatio
                              : (typeof c.defaultRatio === "number" ? c.defaultRatio : 0.2),
    cohortSelectionAlgorithm: gc.cohortSelectionAlgorithm || DEFAULT_COHORT_ALGORITHM,
    measurementWindowCycles:  typeof gc.measurementWindowCycles === "number"
                              ? gc.measurementWindowCycles : DEFAULT_MEASUREMENT_WINDOW_CYCLES,
    falseBlockRateMax:        typeof gc.falseBlockRateMax === "number"
                              ? gc.falseBlockRateMax : DEFAULT_GOVERNANCE_PROMOTION_THRESHOLDS.falseBlockRateMax,
    safetyScoreMin:           typeof gc.safetyScoreMin === "number"
                              ? gc.safetyScoreMin : DEFAULT_GOVERNANCE_PROMOTION_THRESHOLDS.safetyScoreMin,
    falseBlockRateTrigger:    typeof gc.falseBlockRateTrigger === "number"
                              ? gc.falseBlockRateTrigger : DEFAULT_GOVERNANCE_BREACH_THRESHOLDS.falseBlockRateTrigger,
    safetyScoreTriggerLow:    typeof gc.safetyScoreTriggerLow === "number"
                              ? gc.safetyScoreTriggerLow : DEFAULT_GOVERNANCE_BREACH_THRESHOLDS.safetyScoreTriggerLow,
    breachAction:             gc.breachAction || DEFAULT_BREACH_ACTION
  };
}

// ── Input validation (AC9 / Athena missing item 7) ────────────────────────────

/**
 * Validate a governance canary start request.
 * Distinguishes MISSING_FIELD from INVALID_VALUE (AC9).
 *
 * @param {object} input - { configPath|policyRulePatch, canaryRatio?, experimentId? }
 * @returns {{ ok: boolean, errors: Array<{ field: string, code: string, message: string }> }}
 */
export function validateGovernanceCanaryInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {
      ok: false,
      errors: [{
        field:   "root",
        code:    GOVERNANCE_VALIDATION_CODE.MISSING_FIELD,
        message: "governance canary input must be a non-null object"
      }]
    };
  }

  const errors = [];
  const e = /** @type {Record<string, unknown>} */ (input);

  // policyRulePatch: required non-null object
  if (!("policyRulePatch" in e) || e.policyRulePatch == null) {
    errors.push({
      field:   "policyRulePatch",
      code:    GOVERNANCE_VALIDATION_CODE.MISSING_FIELD,
      message: "policyRulePatch is required"
    });
  } else if (typeof e.policyRulePatch !== "object" || Array.isArray(e.policyRulePatch)) {
    errors.push({
      field:   "policyRulePatch",
      code:    GOVERNANCE_VALIDATION_CODE.INVALID_VALUE,
      message: "policyRulePatch must be a non-array object"
    });
  }

  // canaryRatio: optional but if provided must be in (0, 1]
  if ("canaryRatio" in e && e.canaryRatio != null) {
    if (
      typeof e.canaryRatio !== "number" ||
      !Number.isFinite(e.canaryRatio) ||
      e.canaryRatio <= 0 ||
      e.canaryRatio > 1
    ) {
      errors.push({
        field:   "canaryRatio",
        code:    GOVERNANCE_VALIDATION_CODE.INVALID_VALUE,
        message: "canaryRatio must be a number in (0, 1]"
      });
    }
  }

  return { ok: errors.length === 0, errors };
}

// ── Metric collection (AC2) ───────────────────────────────────────────────────

/**
 * Collect governance metrics from a policy evaluation outcome object.
 *
 * Expected outcome shape (callers may pass partial objects):
 *   {
 *     totalEvaluations : number   — total policy checks in this cycle
 *     falseBlocks      : number   — evaluations that were wrongly blocked
 *     safetyPassed     : number   — evaluations that passed safety checks
 *   }
 *
 * Returns zero-safe metrics — no NaN propagation. (AC10)
 *
 * @param {object} policyEvalOutcomes
 * @returns {{ falseBlockRate: number, safetyScore: number, sampleSize: number }}
 */
export function collectGovernanceMetrics(policyEvalOutcomes) {
  const total       = (policyEvalOutcomes?.totalEvaluations >= 0) ? policyEvalOutcomes.totalEvaluations : 0;
  const falseBlocks = (policyEvalOutcomes?.falseBlocks      >= 0) ? policyEvalOutcomes.falseBlocks      : 0;
  const safetyPassed = (policyEvalOutcomes?.safetyPassed    >= 0) ? policyEvalOutcomes.safetyPassed     : 0;

  const falseBlockRate = total > 0 ? falseBlocks  / total : 0;
  const safetyScore    = total > 0 ? safetyPassed / total : 1;   // default 1.0 = safe when no data

  return { falseBlockRate, safetyScore, sampleSize: total };
}

// ── Aggregation ───────────────────────────────────────────────────────────────

/**
 * Aggregate governance metric snapshots into averaged cohort stats.
 * Prevents NaN propagation for empty arrays.
 *
 * @param {Array<{ falseBlockRate: number, safetyScore: number }>} snapshots
 * @returns {{ falseBlockRate: number, safetyScore: number, totalObservations: number }}
 */
export function aggregateGovernanceMetrics(snapshots) {
  if (!Array.isArray(snapshots) || snapshots.length === 0) {
    return { falseBlockRate: 0, safetyScore: 1, totalObservations: 0 };
  }
  let sumFbr = 0;
  let sumSs  = 0;
  for (const s of snapshots) {
    sumFbr += typeof s.falseBlockRate === "number" ? s.falseBlockRate : 0;
    sumSs  += typeof s.safetyScore    === "number" ? s.safetyScore    : 1;
  }
  const n = snapshots.length;
  return {
    falseBlockRate:    sumFbr / n,
    safetyScore:       sumSs  / n,
    totalObservations: n
  };
}

// ── Promotion evaluation (AC3) ────────────────────────────────────────────────

/**
 * Evaluate whether aggregated canary governance metrics satisfy promotion thresholds (AC3).
 *
 * @param {{ falseBlockRate: number, safetyScore: number }} canaryMetrics
 * @param {object} [thresholds]
 * @returns {{ promote: boolean, reason: string }}
 */
export function evaluateGovernancePromotion(canaryMetrics, thresholds: any = {}) {
  const maxFbr  = typeof thresholds.falseBlockRateMax === "number"
    ? thresholds.falseBlockRateMax : DEFAULT_GOVERNANCE_PROMOTION_THRESHOLDS.falseBlockRateMax;
  const minSs   = typeof thresholds.safetyScoreMin === "number"
    ? thresholds.safetyScoreMin : DEFAULT_GOVERNANCE_PROMOTION_THRESHOLDS.safetyScoreMin;

  if (canaryMetrics.falseBlockRate >= maxFbr) {
    return {
      promote: false,
      reason:  `FALSE_BLOCK_RATE_ABOVE_THRESHOLD:${canaryMetrics.falseBlockRate.toFixed(4)}>=${maxFbr}`
    };
  }
  if (canaryMetrics.safetyScore < minSs) {
    return {
      promote: false,
      reason:  `SAFETY_SCORE_BELOW_THRESHOLD:${canaryMetrics.safetyScore.toFixed(4)}<${minSs}`
    };
  }
  return { promote: true, reason: "ALL_GOVERNANCE_THRESHOLDS_MET" };
}

// ── Breach evaluation (AC4 / Athena missing item 4) ───────────────────────────

/**
 * Evaluate whether the latest canary governance metrics trigger a breach (AC4).
 *
 * Breach is evaluated per-cycle for fast failure detection within the measurement window.
 * On breach, breachAction="halt_new_assignments": no new policy rules are applied until cleared.
 *
 * @param {{ falseBlockRate: number, safetyScore: number }} canaryMetrics
 * @param {object} [thresholds]
 * @returns {{ breach: boolean, reason: string|null }}
 */
export function evaluateGovernanceBreach(canaryMetrics, thresholds: any = {}) {
  const triggerFbr = typeof thresholds.falseBlockRateTrigger === "number"
    ? thresholds.falseBlockRateTrigger : DEFAULT_GOVERNANCE_BREACH_THRESHOLDS.falseBlockRateTrigger;
  const triggerSs  = typeof thresholds.safetyScoreTriggerLow === "number"
    ? thresholds.safetyScoreTriggerLow : DEFAULT_GOVERNANCE_BREACH_THRESHOLDS.safetyScoreTriggerLow;

  if (canaryMetrics.falseBlockRate > triggerFbr) {
    return {
      breach: true,
      reason: `GOVERNANCE_BREACH_FALSE_BLOCK_RATE:${canaryMetrics.falseBlockRate.toFixed(4)}>${triggerFbr}`
    };
  }
  if (canaryMetrics.safetyScore < triggerSs) {
    return {
      breach: true,
      reason: `GOVERNANCE_BREACH_SAFETY_SCORE_TOO_LOW:${canaryMetrics.safetyScore.toFixed(4)}<${triggerSs}`
    };
  }
  return { breach: false, reason: null };
}

// ── ID generation ─────────────────────────────────────────────────────────────

/**
 * Build a stable governance canary ID from its defining axes.
 * Format: "govcanary-<sha1-12>" — deterministic for (policyKey, createdAt).
 *
 * @param {string} policyKey  - opaque key identifying the policy rule patch
 * @param {string} createdAt  - ISO timestamp
 * @returns {string}
 */
export function buildGovernanceCanaryId(policyKey, createdAt) {
  const key  = `${policyKey}|${createdAt}`;
  const hash = createHash("sha1").update(key).digest("hex").slice(0, 12);
  return `govcanary-${hash}`;
}

// ── Persistence ───────────────────────────────────────────────────────────────

/**
 * Load the governance canary ledger from disk.
 * Returns a fresh default (schemaVersion=1, experiments=[]) on ENOENT.
 *
 * @param {string} stateDir
 * @returns {Promise<{ schemaVersion: number, experiments: Array<object>, updatedAt?: string }>}
 */
export async function loadGovernanceLedger(stateDir) {
  return readJson(path.join(stateDir, "governance_canary_ledger.json"), {
    schemaVersion: 1,
    experiments:   []
  });
}

/**
 * Save the governance canary ledger to disk (atomic write via writeJson).
 *
 * @param {string} stateDir
 * @param {object} ledger
 */
export async function saveGovernanceLedger(stateDir, ledger) {
  ledger.updatedAt = new Date().toISOString();
  await writeJson(path.join(stateDir, "governance_canary_ledger.json"), ledger);
}

// ── Audit log (AC5) ───────────────────────────────────────────────────────────

/**
 * Append a structured governance canary audit event (AC5).
 *
 * Required fields: event, canaryId, timestamp
 * Optional: experimentId, cycleId, cohort, metrics, reason
 *
 * Missing required fields produce an explicit `auditError` field (AC10 — no silent failure).
 *
 * @param {string} stateDir
 * @param {object} entry
 * @returns {Promise<void>}
 */
export async function appendGovernanceAuditLog(stateDir, entry) {
  const missingFields = GOVERNANCE_AUDIT_REQUIRED_FIELDS.filter(
    f => !(f in entry) || entry[f] == null
  );

  const record = {
    event:        entry.event        ?? null,
    canaryId:     entry.canaryId     ?? null,
    experimentId: entry.experimentId ?? null,
    cycleId:      entry.cycleId      ?? null,
    cohort:       entry.cohort       ?? null,
    timestamp:    entry.timestamp    ?? new Date().toISOString(),
    metrics:      entry.metrics      ?? null,
    reason:       entry.reason       ?? null,
    ...(missingFields.length > 0
      ? { auditError: `MISSING_REQUIRED_FIELDS:${missingFields.join(",")}` }
      : {})
  };

  const logPath = path.join(stateDir, "governance_canary_audit.jsonl");
  try {
    await fs.mkdir(stateDir, { recursive: true });
    await fs.appendFile(logPath, JSON.stringify(record) + "\n", "utf8");
    return { ok: true, status: "written" };
  } catch {
    // Audit log write failure must not crash the main path.
    // The missing entry is observable via the absent log line.
    // Return explicit non-fatal failure signal so callers can observe the gap.
    return { ok: false, status: "audit-write-failed" };
  }
}

// ── State machine ─────────────────────────────────────────────────────────────

/**
 * Start a new governance canary experiment for a policy rule change.
 *
 * The policyRulePatch describes the new governance rules to test on canary cycles.
 * Control cycles continue to use the existing policy. After enough canary cycles
 * are observed, the experiment is promoted or rolled back.
 *
 * Returns { ok: false, status: "CANARY_DISABLED" } when canary is disabled.
 * Returns { ok: false, status: "ALREADY_RUNNING", canaryId } when an experiment
 *   with the same policyKey is already running.
 *
 * @param {object}      config         - full runtime config
 * @param {object}      policyRulePatch - the staged governance rule changes to test
 * @param {string|null} [experimentId]  - links to experiment_registry (may be null)
 * @returns {Promise<{ ok: boolean, canaryId?: string, status?: string, errors?: Array<object> }>}
 */
export async function startGovernanceCanary(config, policyRulePatch, experimentId = null) {
  const gc = getGovernanceCanaryConfig(config);

  if (!gc.enabled) {
    return { ok: false, status: "CANARY_DISABLED" };
  }

  const validation = validateGovernanceCanaryInput({ policyRulePatch });
  if (!validation.ok) {
    return { ok: false, status: "INVALID_INPUT", errors: validation.errors };
  }

  const stateDir = config.paths?.stateDir || "state";
  const ledger   = await loadGovernanceLedger(stateDir);
  const policyKey = JSON.stringify(policyRulePatch);

  // Prevent duplicate running experiments for the same policy patch
  const existing = (ledger.experiments || []).find(
    e => e.policyKey === policyKey && e.status === GOVERNANCE_CANARY_STATUS.RUNNING
  );
  if (existing) {
    return { ok: false, status: "ALREADY_RUNNING", canaryId: existing.canaryId };
  }

  const now      = new Date().toISOString();
  const canaryId = buildGovernanceCanaryId(policyKey, now);
  const ratio    = gc.canaryRatio;

  const entry = {
    canaryId,
    experimentId:    experimentId || null,
    policyKey,
    policyRulePatch,
    canaryRatio:     ratio,
    status:          GOVERNANCE_CANARY_STATUS.RUNNING,
    statusReason:    null,
    cohortStats: {
      canary:  { cycleCount: 0, falseBlockRate: 0, safetyScore: 1 },
      control: { cycleCount: 0, falseBlockRate: 0, safetyScore: 1 }
    },
    cycleLog:      [],
    createdAt:     now,
    promotedAt:    null,
    rolledBackAt:  null
  };

  ledger.experiments = ledger.experiments || [];
  ledger.experiments.push(entry);
  await saveGovernanceLedger(stateDir, ledger);

  await appendGovernanceAuditLog(stateDir, {
    event:        GOVERNANCE_AUDIT_EVENT.CANARY_STARTED,
    canaryId,
    experimentId: experimentId || null,
    cycleId:      null,
    cohort:       null,
    timestamp:    now,
    metrics:      null,
    reason:       `STARTED:ratio=${ratio} algorithm=${gc.cohortSelectionAlgorithm}`
  });

  return { ok: true, canaryId };
}

/**
 * Process a single governance cycle: assign cohort, record metrics, evaluate advancement.
 *
 * For each running governance canary experiment:
 *   1. Assign cycleId to canary or control cohort (hash-mod).
 *   2. Record governance metrics for that cohort.
 *   3. If canary cohort, check for breach (fast-fail) and aggregate for promotion.
 *
 * Returns an array of { canaryId, cohort, action, reason } for each running experiment.
 * Non-fatal per-experiment errors are captured and returned with action="error". (AC10)
 *
 * @param {object} config
 * @param {string} cycleId
 * @param {object} policyEvalOutcomes - output of policy evaluation for this cycle
 * @returns {Promise<Array<{ canaryId: string, cohort: string, action: string, reason: string }>>}
 */
export async function processGovernanceCycle(config, cycleId, policyEvalOutcomes: any = {}) {
  const gc = getGovernanceCanaryConfig(config);
  if (!gc.enabled) return [];

  const stateDir = config.paths?.stateDir || "state";
  const ledger   = await loadGovernanceLedger(stateDir);
  const running  = (ledger.experiments || []).filter(
    e => e.status === GOVERNANCE_CANARY_STATUS.RUNNING
  );

  if (running.length === 0) return [];

  const metrics  = collectGovernanceMetrics(policyEvalOutcomes);
  const results  = [];

  for (const entry of running) {
    try {
      const cohort = assignCohort(
        `${cycleId}:${entry.canaryId}`,
        entry.canaryRatio ?? gc.canaryRatio
      );

      const result = await _recordAndEvaluate(config, stateDir, entry.canaryId, cycleId, cohort, metrics, gc);
      results.push({ canaryId: entry.canaryId, cohort, action: result.action, reason: result.reason });
    } catch (err) {
      // Non-fatal: per-experiment error must not crash the cycle (AC10)
      results.push({
        canaryId: entry.canaryId,
        cohort:   "unknown",
        action:   "error",
        reason:   `PROCESSING_ERROR:${String(err?.message || err).slice(0, 200)}`
      });
    }
  }

  return results;
}

/**
 * Check if a governance canary breach is active (breach has been recorded and not cleared).
 * Used by policy_engine to determine whether new governance rules should be applied.
 *
 * @param {object} config
 * @returns {Promise<{ breachActive: boolean, reason: string|null }>}
 */
export async function isGovernanceCanaryBreachActive(config) {
  const gc = getGovernanceCanaryConfig(config);
  if (!gc.enabled) return { breachActive: false, reason: null };

  const stateDir = config.paths?.stateDir || "state";
  const ledger   = await loadGovernanceLedger(stateDir);
  const rolledBack = (ledger.experiments || []).find(
    e => e.status === GOVERNANCE_CANARY_STATUS.ROLLED_BACK &&
         e.breachAction === GOVERNANCE_BREACH_ACTION.HALT_NEW_ASSIGNMENTS
  );

  if (rolledBack) {
    return {
      breachActive: true,
      reason: rolledBack.statusReason || "GOVERNANCE_CANARY_BREACH"
    };
  }
  return { breachActive: false, reason: null };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Record metrics for a cycle/cohort pair and evaluate the canary's advancement.
 *
 * @param {object} config
 * @param {string} stateDir
 * @param {string} canaryId
 * @param {string} cycleId
 * @param {string} cohort   - COHORT.CANARY or COHORT.CONTROL
 * @param {object} metrics  - { falseBlockRate, safetyScore, sampleSize }
 * @param {object} gc       - governance canary config
 * @returns {Promise<{ action: string, reason: string }>}
 */
async function _recordAndEvaluate(config, stateDir, canaryId, cycleId, cohort, metrics, gc) {
  const ledger  = await loadGovernanceLedger(stateDir);
  const idx     = (ledger.experiments || []).findIndex(e => e.canaryId === canaryId);

  if (idx === -1) {
    return { action: "error", reason: "CANARY_NOT_FOUND" };
  }

  const entry = ledger.experiments[idx];
  if (entry.status !== GOVERNANCE_CANARY_STATUS.RUNNING) {
    return { action: "skip", reason: `NOT_RUNNING:status=${entry.status}` };
  }

  const now = new Date().toISOString();

  // Record cycle log entry (AC2 — both canary and control cohort tracked)
  entry.cycleLog = entry.cycleLog || [];
  entry.cycleLog.push({ cycleId, cohort, timestamp: now, metrics });

  // Update running cohort stats (rolling average)
  const stats = entry.cohortStats[cohort] || { cycleCount: 0, falseBlockRate: 0, safetyScore: 1 };
  const n     = stats.cycleCount + 1;
  entry.cohortStats[cohort] = {
    cycleCount:    n,
    falseBlockRate: ((stats.falseBlockRate * (n - 1)) + metrics.falseBlockRate) / n,
    safetyScore:    ((stats.safetyScore    * (n - 1)) + metrics.safetyScore)    / n
  };

  await saveGovernanceLedger(stateDir, ledger);

  await appendGovernanceAuditLog(stateDir, {
    event:        GOVERNANCE_AUDIT_EVENT.METRICS_RECORDED,
    canaryId,
    experimentId: entry.experimentId,
    cycleId,
    cohort,
    timestamp:    now,
    metrics,
    reason:       null
  });

  // Only evaluate advancement for canary cohort cycles (AC4)
  if (cohort !== COHORT.CANARY) {
    return { action: "continue", reason: `CONTROL_COHORT:tracking_only` };
  }

  // Fast-fail: check breach on current cycle metrics immediately (AC4)
  const breachCheck = evaluateGovernanceBreach(metrics, {
    falseBlockRateTrigger: gc.falseBlockRateTrigger,
    safetyScoreTriggerLow: gc.safetyScoreTriggerLow
  });

  if (breachCheck.breach) {
    return _rollbackGovernanceCanary(config, stateDir, canaryId, breachCheck.reason, gc);
  }

  // Check measurement window
  const canarySnaps = (entry.cycleLog || []).filter(l => l.cohort === COHORT.CANARY);
  if (canarySnaps.length < gc.measurementWindowCycles) {
    const remaining = gc.measurementWindowCycles - canarySnaps.length;
    return { action: "continue", reason: `AWAITING_CANARY_CYCLES:need=${remaining}more` };
  }

  // Aggregate canary snapshots for promotion evaluation (AC3)
  const aggregated     = aggregateGovernanceMetrics(canarySnaps.map(s => s.metrics));
  const promotionCheck = evaluateGovernancePromotion(aggregated, {
    falseBlockRateMax: gc.falseBlockRateMax,
    safetyScoreMin:    gc.safetyScoreMin
  });

  if (promotionCheck.promote) {
    return _promoteGovernanceCanary(config, stateDir, canaryId, promotionCheck.reason);
  }

  // Did not meet promotion thresholds after observation window → rollback
  return _rollbackGovernanceCanary(config, stateDir, canaryId, promotionCheck.reason, gc);
}

/**
 * Promote a running governance canary.
 * Marks the ledger entry as "promoted" and emits audit event.
 */
async function _promoteGovernanceCanary(config, stateDir, canaryId, reason) {
  const ledger = await loadGovernanceLedger(stateDir);
  const idx    = (ledger.experiments || []).findIndex(e => e.canaryId === canaryId);
  if (idx === -1) return { action: "error", reason: "NOT_FOUND_ON_PROMOTE" };

  const entry = ledger.experiments[idx];
  const now   = new Date().toISOString();

  ledger.experiments[idx] = {
    ...entry,
    status:       GOVERNANCE_CANARY_STATUS.PROMOTED,
    statusReason: reason,
    promotedAt:   now
  };
  await saveGovernanceLedger(stateDir, ledger);

  await appendGovernanceAuditLog(stateDir, {
    event:        GOVERNANCE_AUDIT_EVENT.CANARY_PROMOTED,
    canaryId,
    experimentId: entry.experimentId,
    cycleId:      null,
    cohort:       null,
    timestamp:    now,
    metrics:      null,
    reason
  });

  return { action: "promote", reason };
}

/**
 * Roll back a running governance canary due to breach or failed promotion.
 *
 * Rollback behavior (AC4 / Athena missing item 4):
 *   - status set to ROLLED_BACK
 *   - breachAction written to entry (default: "halt_new_assignments")
 *   - Audit event emitted with breach reason
 *
 * @param {object} config
 * @param {string} stateDir
 * @param {string} canaryId
 * @param {string} reason
 * @param {object} gc - governance canary config
 * @returns {Promise<{ action: string, reason: string }>}
 */
async function _rollbackGovernanceCanary(config, stateDir, canaryId, reason, gc) {
  const ledger = await loadGovernanceLedger(stateDir);
  const idx    = (ledger.experiments || []).findIndex(e => e.canaryId === canaryId);
  if (idx === -1) return { action: "error", reason: "NOT_FOUND_ON_ROLLBACK" };

  const entry  = ledger.experiments[idx];
  const now    = new Date().toISOString();
  const action = gc.breachAction || DEFAULT_BREACH_ACTION;

  ledger.experiments[idx] = {
    ...entry,
    status:       GOVERNANCE_CANARY_STATUS.ROLLED_BACK,
    statusReason: reason,
    breachAction: action,   // machine-readable breach action (AC4 / AC8)
    rolledBackAt: now
  };
  await saveGovernanceLedger(stateDir, ledger);

  await appendGovernanceAuditLog(stateDir, {
    event:        GOVERNANCE_AUDIT_EVENT.CANARY_ROLLED_BACK,
    canaryId,
    experimentId: entry.experimentId,
    cycleId:      null,
    cohort:       null,
    timestamp:    now,
    metrics:      null,
    reason:       `${reason}|breachAction=${action}`
  });

  return { action: "rollback", reason };
}

```

### FILE: src/core/trust_boundary.ts
```typescript
/**
 * trust_boundary.js — Runtime input validation gate for all leadership provider outputs.
 *
 * Validates provider outputs (planner/reviewer/supervisor JSON contracts) against
 * the canonical schemas in src/schemas/leadership.schema.json before any downstream
 * execution consumes them. This is the trust boundary between untrusted AI output
 * and the BOX orchestration pipeline.
 *
 * ── Schema artifact ──────────────────────────────────────────────────────────
 *   src/schemas/leadership.schema.json (AC1 / Athena missing item #1)
 *   Format: JSON with "contracts" keyed by type ("planner", "reviewer", "supervisor").
 *
 * ── Failure class ────────────────────────────────────────────────────────────
 *   TRUST_BOUNDARY_ERROR = "trust_boundary_violation" (AC2 / Athena missing item #2)
 *   Module location: src/core/trust_boundary.js (this file)
 *
 * ── Retry strategy (AC2) ─────────────────────────────────────────────────────
 *   maxRetries:  3
 *   delayMs:     5000  (5 seconds initial delay)
 *   backoff:     "exponential"
 *   multiplier:  2     (delay × 2 on each retry: 5s, 10s, 20s)
 *   escalation:  after maxRetries exhausted → escalate to "athena_review"
 *
 * ── Critical contract fields per provider type (AC3 / Athena missing item #3) ─
 *   planner   (Prometheus): plans, analysis, projectHealth, executionStrategy, requestBudget
 *   reviewer  (Athena):     approved, corrections, planReviews
 *   supervisor(Jesus):      decision, wakeAthena, callPrometheus, briefForPrometheus, systemHealth
 *
 * ── Error format (AC4) ───────────────────────────────────────────────────────
 *   Each error entry includes: { field, reasonCode, message, payloadPath, sourceFile }
 *
 * ── Missing vs invalid input (AC9) ───────────────────────────────────────────
 *   MISSING_INPUT  — payload is null/undefined (never reached the validator)
 *   INVALID_TYPE   — payload is not a plain object
 *   MISSING_FIELD  — required field is absent from payload
 *   INVALID_FIELD  — field is present but fails type/enum/length constraints
 *   UNKNOWN_CONTRACT_TYPE — contractType not in schema
 *
 * ── No silent fallback (AC10) ────────────────────────────────────────────────
 *   ok=false → status="blocked", explicit reasonCode, non-empty errors array.
 *   Callers MUST check ok before using payload. No auto-approve on failure.
 *
 * ── Risk level: medium-high ──────────────────────────────────────────────────
 *   Rollback path: set config.runtime.trustBoundaryMode = "warn" to downgrade
 *   hard failures to warnings for one release cycle. Default is "enforce".
 *   This rollback path must be explicitly enabled — it is never the default.
 */

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Schema artifact ───────────────────────────────────────────────────────────

/** Canonical path to the leadership contract schema file. */
export const LEADERSHIP_SCHEMA_PATH = path.join(__dirname, "..", "schemas", "leadership.schema.json");

/** Lazy-loaded schema. Loaded once on first call to validateLeadershipContract. */
let _schemaCache = null;

function loadSchema() {
  if (_schemaCache) return _schemaCache;
  const requireFn = createRequire(import.meta.url);
  try {
    _schemaCache = requireFn(LEADERSHIP_SCHEMA_PATH);
  } catch (err) {
    throw new Error(`[trust_boundary] Failed to load schema from ${LEADERSHIP_SCHEMA_PATH}: ${err.message}`, { cause: err });
  }
  return _schemaCache;
}

// ── Failure class ─────────────────────────────────────────────────────────────

/**
 * Trust boundary failure class identifier.
 *
 * Distinct from FAILURE_CLASS in failure_classifier.js — this is specific to
 * schema violations in provider (AI) outputs, not worker task failures.
 *
 * @constant {string}
 */
export const TRUST_BOUNDARY_ERROR = "trust_boundary_violation";

// ── Retry strategy ────────────────────────────────────────────────────────────

/**
 * Default retry strategy for trust boundary violations.
 *
 * maxRetries:  3 attempts total (original + 3 retries)
 * delayMs:     5000ms initial delay
 * backoff:     "exponential" — delay × multiplier on each retry
 * multiplier:  2 (5s → 10s → 20s)
 * escalationTarget: "athena_review" — after exhaustion, escalate for human review
 *
 * @constant {object}
 */
export const TRUST_BOUNDARY_RETRY = Object.freeze({
  maxRetries:        3,
  delayMs:           5000,
  backoff:           "exponential",
  multiplier:        2,
  escalationTarget:  "athena_review"
});

// ── Reason codes ──────────────────────────────────────────────────────────────

/**
 * Reason codes for trust boundary validation results.
 *
 * Distinguishes missing input from invalid input — no silent fallback allowed.
 *
 * @enum {string}
 */
export const TRUST_BOUNDARY_REASON = Object.freeze({
  /** Validation passed — payload is safe for downstream consumption. */
  OK:                    "OK",
  /** Payload is null or undefined — no output received from provider. */
  MISSING_INPUT:         "MISSING_INPUT",
  /** Payload is not a plain object (e.g. string, array, number). */
  INVALID_TYPE:          "INVALID_TYPE",
  /** A required field is absent from the payload. */
  MISSING_FIELD:         "MISSING_FIELD",
  /** A field is present but fails type, enum, or length constraints. */
  INVALID_FIELD:         "INVALID_FIELD",
  /** The contractType argument is not a known schema type. */
  UNKNOWN_CONTRACT_TYPE: "UNKNOWN_CONTRACT_TYPE",
  /** Schema file could not be loaded. */
  SCHEMA_LOAD_ERROR:     "SCHEMA_LOAD_ERROR"
});

// ── Contract type constants ───────────────────────────────────────────────────

/**
 * Canonical contract type identifiers for leadership provider outputs.
 *
 * planner   — Prometheus analysis output (plans, projectHealth, executionStrategy, ...)
 * reviewer  — Athena plan-review output (approved, corrections, planReviews)
 * supervisor — Jesus directive output (decision, wakeAthena, callPrometheus, briefForPrometheus, ...)
 *
 * @enum {string}
 */
export const LEADERSHIP_CONTRACT_TYPE = Object.freeze({
  PLANNER:    "planner",
  REVIEWER:   "reviewer",
  SUPERVISOR: "supervisor"
});

// ── Field validator ───────────────────────────────────────────────────────────

/**
 * Validate a single field value against its field descriptor from the schema.
 *
 * @param {string} field       — field name
 * @param {any}    value       — field value from payload
 * @param {object} descriptor  — field descriptor from schema
 * @param {string} basePath    — JSON payload path prefix (for error anchoring)
 * @returns {{ ok: boolean, errors: object[] }}
 */
function validateField(field, value, descriptor, basePath) {
  const payloadPath = `${basePath}.${field}`;
  const errors = [];

  // ── oneOf support: try each variant, pass if any matches ────────────────
  if (Array.isArray(descriptor.oneOf)) {
    const variantErrors = [];
    for (const variant of descriptor.oneOf) {
      const result = validateField(field, value, variant, basePath);
      if (result.ok) return { ok: true, errors: [] };
      variantErrors.push(...result.errors);
    }
    // None matched — report a combined error
    const types = descriptor.oneOf.map(v => v.type).join(" | ");
    errors.push({
      field,
      reasonCode: TRUST_BOUNDARY_REASON.INVALID_FIELD,
      message: `value does not match any oneOf variant (expected: ${types}), got ${typeof value}`,
      payloadPath
    });
    return { ok: false, errors };
  }

  const { type, enum: enumValues, minLength, minItems, minimum } = descriptor;

  if (type === "boolean") {
    if (typeof value !== "boolean") {
      errors.push({
        field,
        reasonCode: TRUST_BOUNDARY_REASON.INVALID_FIELD,
        message: `expected boolean, got ${typeof value}`,
        payloadPath
      });
    }
  } else if (type === "string") {
    if (typeof value !== "string") {
      errors.push({
        field,
        reasonCode: TRUST_BOUNDARY_REASON.INVALID_FIELD,
        message: `expected string, got ${typeof value}`,
        payloadPath
      });
    } else {
      if (enumValues && !enumValues.includes(value)) {
        errors.push({
          field,
          reasonCode: TRUST_BOUNDARY_REASON.INVALID_FIELD,
          message: `value "${value}" is not one of: ${enumValues.join(", ")}`,
          payloadPath
        });
      }
      if (typeof minLength === "number" && value.length < minLength) {
        errors.push({
          field,
          reasonCode: TRUST_BOUNDARY_REASON.INVALID_FIELD,
          message: `string length ${value.length} is less than minimum ${minLength}`,
          payloadPath
        });
      }
    }
  } else if (type === "number") {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      errors.push({
        field,
        reasonCode: TRUST_BOUNDARY_REASON.INVALID_FIELD,
        message: `expected finite number, got ${typeof value}`,
        payloadPath
      });
    } else if (typeof minimum === "number" && value < minimum) {
      errors.push({
        field,
        reasonCode: TRUST_BOUNDARY_REASON.INVALID_FIELD,
        message: `number ${value} is less than minimum ${minimum}`,
        payloadPath
      });
    }
  } else if (type === "integer") {
    if (typeof value !== "number" || !Number.isInteger(value)) {
      errors.push({
        field,
        reasonCode: TRUST_BOUNDARY_REASON.INVALID_FIELD,
        message: `expected integer, got ${typeof value === "number" ? "float" : typeof value}`,
        payloadPath
      });
    } else if (typeof minimum === "number" && value < minimum) {
      errors.push({
        field,
        reasonCode: TRUST_BOUNDARY_REASON.INVALID_FIELD,
        message: `integer ${value} is less than minimum ${minimum}`,
        payloadPath
      });
    }
  } else if (type === "array") {
    if (!Array.isArray(value)) {
      errors.push({
        field,
        reasonCode: TRUST_BOUNDARY_REASON.INVALID_FIELD,
        message: `expected array, got ${typeof value}`,
        payloadPath
      });
    } else if (typeof minItems === "number" && value.length < minItems) {
      errors.push({
        field,
        reasonCode: TRUST_BOUNDARY_REASON.INVALID_FIELD,
        message: `array length ${value.length} is less than minimum ${minItems}`,
        payloadPath
      });
    }
  } else if (type === "object") {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      errors.push({
        field,
        reasonCode: TRUST_BOUNDARY_REASON.INVALID_FIELD,
        message: `expected plain object, got ${Array.isArray(value) ? "array" : typeof value}`,
        payloadPath
      });
    }
  }

  return { ok: errors.length === 0, errors };
}

// ── Plan item validator ───────────────────────────────────────────────────────

/**
 * Validate individual plan items within a planner payload.
 * Each plan must have: role, task, priority, wave, verification.
 *
 * @param {any[]} plans          — plans array from planner payload
 * @param {object} planSchema    — planner contract from schema
 * @returns {object[]}           — array of error objects
 */
function validatePlanItems(plans, planSchema) {
  const errors = [];
  if (!Array.isArray(plans)) return errors;

  const itemRequiredFields = planSchema.planItemRequiredFields || [];
  const itemFieldDescriptors = planSchema.planItemFields || {};

  for (let i = 0; i < plans.length; i++) {
    const plan = plans[i];
    const basePath = `plans[${i}]`;

    if (!plan || typeof plan !== "object" || Array.isArray(plan)) {
      errors.push({
        field: basePath,
        reasonCode: TRUST_BOUNDARY_REASON.INVALID_FIELD,
        message: `plan item at index ${i} is not a plain object`,
        payloadPath: basePath
      });
      continue;
    }

    for (const field of itemRequiredFields) {
      if (!(field in plan)) {
        errors.push({
          field: `${basePath}.${field}`,
          reasonCode: TRUST_BOUNDARY_REASON.MISSING_FIELD,
          message: `required field "${field}" is absent from plan item ${i}`,
          payloadPath: `${basePath}.${field}`
        });
        continue;
      }
      const descriptor = itemFieldDescriptors[field];
      if (descriptor) {
        const result = validateField(field, plan[field], descriptor, basePath);
        errors.push(...result.errors);
      }
    }
  }

  return errors;
}

// ── Main validation function ──────────────────────────────────────────────────

/**
 * Validate a leadership provider output against the canonical contract schema.
 *
 * Fail-closed contract:
 *   - null/undefined payload        → ok=false, status=blocked, reasonCode=MISSING_INPUT
 *   - non-object payload            → ok=false, status=blocked, reasonCode=INVALID_TYPE
 *   - unknown contractType          → ok=false, status=blocked, reasonCode=UNKNOWN_CONTRACT_TYPE
 *   - schema load failure           → ok=false, status=blocked, reasonCode=SCHEMA_LOAD_ERROR
 *   - missing required field        → ok=false, status=blocked, reasonCode=MISSING_FIELD
 *   - field fails type/enum/length  → ok=false, status=blocked, reasonCode=INVALID_FIELD
 *   - all checks pass               → ok=true,  status=ok
 *
 * Error entries include: { field, reasonCode, message, payloadPath, sourceFile }
 * sourceFile is always set to LEADERSHIP_SCHEMA_PATH for machine-readable anchoring.
 *
 * Rollback path:
 *   Pass options.mode = "warn" to downgrade hard failures to warnings (status="warn").
 *   Default is "enforce". Never set mode=warn in production without explicit config opt-in.
 *
/** Options accepted by {@link validateLeadershipContract}. */
export interface ValidateLeadershipContractOptions {
  /** "enforce" (default) — validation failures return status="blocked".
   *  "warn"    — validation failures return status="warn" instead of blocking. */
  mode?: "enforce" | "warn";
}

/**
 * @param {string} contractType  — one of LEADERSHIP_CONTRACT_TYPE values
 * @param {unknown}    payload       — parsed provider output (untrusted)
 * @param {ValidateLeadershipContractOptions} [options]
 * @returns {{ ok: boolean, status: "ok"|"blocked"|"warn", reasonCode: string, errors: object[] }}
 */
export function validateLeadershipContract(contractType: string, payload: unknown, options: ValidateLeadershipContractOptions = {}) {
  const mode = options.mode === "warn" ? "warn" : "enforce";
  const sourceFile = LEADERSHIP_SCHEMA_PATH;

  // ── Missing input ──────────────────────────────────────────────────────────
  if (payload === null || payload === undefined) {
    const result = {
      ok: false,
      status: mode === "warn" ? "warn" : "blocked",
      reasonCode: TRUST_BOUNDARY_REASON.MISSING_INPUT,
      errors: [{
        field: "(root)",
        reasonCode: TRUST_BOUNDARY_REASON.MISSING_INPUT,
        message: "payload is null or undefined — no output received from provider",
        payloadPath: "(root)",
        sourceFile
      }]
    };
    return result;
  }

  // ── Invalid type ───────────────────────────────────────────────────────────
  if (typeof payload !== "object" || Array.isArray(payload)) {
    return {
      ok: false,
      status: mode === "warn" ? "warn" : "blocked",
      reasonCode: TRUST_BOUNDARY_REASON.INVALID_TYPE,
      errors: [{
        field: "(root)",
        reasonCode: TRUST_BOUNDARY_REASON.INVALID_TYPE,
        message: `payload must be a plain object, got ${Array.isArray(payload) ? "array" : typeof payload}`,
        payloadPath: "(root)",
        sourceFile
      }]
    };
  }

  // ── Load schema ────────────────────────────────────────────────────────────
  // After null/type checks above, payload is a non-null plain object — safe to index.
  const payloadObj = payload as Record<string, unknown>;
  let schema;
  try {
    schema = loadSchema();
  } catch (err) {
    return {
      ok: false,
      status: mode === "warn" ? "warn" : "blocked",
      reasonCode: TRUST_BOUNDARY_REASON.SCHEMA_LOAD_ERROR,
      errors: [{
        field: "(schema)",
        reasonCode: TRUST_BOUNDARY_REASON.SCHEMA_LOAD_ERROR,
        message: String(err.message || err),
        payloadPath: "(schema)",
        sourceFile
      }]
    };
  }

  // ── Unknown contract type ──────────────────────────────────────────────────
  const contracts = schema?.contracts || {};
  if (!(contractType in contracts)) {
    const knownTypes = Object.keys(contracts).join(", ");
    return {
      ok: false,
      status: mode === "warn" ? "warn" : "blocked",
      reasonCode: TRUST_BOUNDARY_REASON.UNKNOWN_CONTRACT_TYPE,
      errors: [{
        field: "(contractType)",
        reasonCode: TRUST_BOUNDARY_REASON.UNKNOWN_CONTRACT_TYPE,
        message: `unknown contract type "${contractType}"; known types: ${knownTypes}`,
        payloadPath: "(contractType)",
        sourceFile
      }]
    };
  }

  const contract = contracts[contractType];
  const requiredFields = contract.requiredFields || [];
  const fieldDescriptors = contract.fields || {};
  const errors = [];
  const basePath = `(${contractType})`;

  // ── Check required fields ──────────────────────────────────────────────────
  for (const field of requiredFields) {
    if (!(field in payloadObj)) {
      errors.push({
        field,
        reasonCode: TRUST_BOUNDARY_REASON.MISSING_FIELD,
        message: `required field "${field}" is absent from ${contractType} payload`,
        payloadPath: `${basePath}.${field}`,
        sourceFile
      });
      continue;
    }

    const descriptor = fieldDescriptors[field];
    if (descriptor) {
      const result = validateField(field, payloadObj[field], descriptor, basePath);
      errors.push(...result.errors.map(e => ({ ...e, sourceFile })));
    }
  }

  // ── Validate plan items for planner contracts ──────────────────────────────
  if (contractType === LEADERSHIP_CONTRACT_TYPE.PLANNER && Array.isArray(payloadObj.plans)) {
    const planErrors = validatePlanItems(payloadObj.plans, contract);
    errors.push(...planErrors.map(e => ({ ...e, sourceFile })));
  }

  if (errors.length === 0) {
    return { ok: true, status: "ok", reasonCode: TRUST_BOUNDARY_REASON.OK, errors: [] };
  }

  // Determine the primary reason code from the first error
  const primaryReasonCode = errors[0].reasonCode || TRUST_BOUNDARY_REASON.INVALID_FIELD;

  return {
    ok: false,
    status: mode === "warn" ? "warn" : "blocked",
    reasonCode: primaryReasonCode,
    errors
  };
}

// ── Retry delay calculator ────────────────────────────────────────────────────

/**
 * Calculate the retry delay (ms) for a given attempt number using exponential backoff.
 *
 * attempt 1 → TRUST_BOUNDARY_RETRY.delayMs
 * attempt 2 → delayMs × multiplier
 * attempt 3 → delayMs × multiplier²
 *
 * @param {number} attempt — 1-indexed attempt number
 * @returns {number} delay in milliseconds
 */
export function trustBoundaryRetryDelayMs(attempt) {
  const { delayMs, multiplier } = TRUST_BOUNDARY_RETRY;
  return delayMs * Math.pow(multiplier, Math.max(0, attempt - 1));
}

// -- Provider decision tagging --------------------------------------------------

/**
 * Tag a reviewer provider decision with its source at the trust boundary.
 *
 * This is the canonical tagging point between untrusted AI output and the BOX
 * orchestration pipeline. It makes fallback decisions explicit and machine-readable
 * so callers can distinguish AI-produced decisions from deterministic fallbacks.
 *
 *   source="provider"  -- AI model returned a parseable, validated response.
 *   source="fallback"  -- AI call failed (process error / parse failure);
 *                         a deterministic fallback value is being used instead.
 *
 * Usage in provider requestJson methods:
 *   return tagProviderDecision(validatedPayload, "provider");
 *   return tagProviderDecision(fallback, "fallback", "API call failed: 429 rate limit");
 *
 * @param decision       - validated decision payload
 * @param source         - "provider" (AI response) | "fallback" (deterministic fallback)
 * @param fallbackReason - why the fallback was used (only meaningful when source="fallback")
 * @returns decision with _source field (and _fallbackReason when source="fallback")
 */
export function tagProviderDecision<T extends Record<string, unknown>>(
  decision: T,
  source: "provider" | "fallback",
  fallbackReason?: string
): T & { _source: "provider" | "fallback"; _fallbackReason?: string } {
  if (source === "fallback" && fallbackReason !== undefined) {
    return { ...decision, _source: source, _fallbackReason: fallbackReason };
  }
  return { ...decision, _source: source };
}

```

### FILE: src/core/plan_contract_validator.ts
```typescript
/**
 * plan_contract_validator.js — Contract-first plan validation (Packet 2)
 *
 * Every plan emitted by Prometheus must pass this validator before persistence.
 * Invalid plans are tagged with violation details but still included (Athena
 * makes the final accept/reject decision).
 *
 * Required fields: task, role, wave, verification
 * Recommended fields: dependencies, filesInScope, acceptance_criteria
 */

import { checkForbiddenCommands } from "./verification_command_registry.js";

/**
 * Canonical deterministic violation code taxonomy.
 *
 * Used by both the pre-normalization generation-boundary gate
 * (checkPacketCompleteness in prometheus.ts) and the post-normalization
 * contract validator (validatePlanContract below).  Having a single source of
 * truth means log messages, rejection metadata, and filtering logic all
 * reference the same well-known codes rather than free-form field-name strings.
 *
 * Pre-normalization codes (shared with UNRECOVERABLE_PACKET_REASONS):
 *   NO_TASK_IDENTITY, MISSING_CAPACITY_DELTA, INVALID_CAPACITY_DELTA,
 *   MISSING_REQUEST_ROI, INVALID_REQUEST_ROI, MISSING_VERIFICATION_COUPLING
 *
 * Post-normalization contract codes:
 *   TASK_TOO_SHORT, MISSING_ROLE, INVALID_WAVE,
 *   MISSING_VERIFICATION, NON_SPECIFIC_VERIFICATION, FORBIDDEN_COMMAND,
 *   MISSING_ACCEPTANCE_CRITERIA, MISSING_DEPENDENCIES
 */
export const PACKET_VIOLATION_CODE = Object.freeze({
  // ── Identity ──────────────────────────────────────────────────────────────
  /** All identity fields (task/title/task_id/id) are absent. */
  NO_TASK_IDENTITY:              "no_task_identity",
  /** task field is present but too short (< 5 chars after normalization). */
  TASK_TOO_SHORT:                "task_too_short",
  /** role field is absent or empty. */
  MISSING_ROLE:                  "missing_role",

  // ── Wave ──────────────────────────────────────────────────────────────────
  /** wave is not a positive finite integer. */
  INVALID_WAVE:                  "invalid_wave",

  // ── Verification ─────────────────────────────────────────────────────────
  /** verification field is absent or blank. */
  MISSING_VERIFICATION:          "missing_verification",
  /** verification value is a bare CLI command with no test file reference. */
  NON_SPECIFIC_VERIFICATION:     "non_specific_verification",
  /** verification value or verification_commands entry contains a forbidden glob or shell pattern. */
  FORBIDDEN_COMMAND:             "forbidden_command",
  /** verification_commands is absent, empty, or contains only blank entries. */
  MISSING_VERIFICATION_COUPLING: "missing_verification_coupling",

  // ── Acceptance criteria ──────────────────────────────────────────────────
  /** acceptance_criteria is absent or empty — no measurable completion signal. */
  MISSING_ACCEPTANCE_CRITERIA:   "missing_acceptance_criteria",
  /** dependencies field is absent or not an array. */
  MISSING_DEPENDENCIES:          "missing_dependencies",

  // ── Decomposition / size ──────────────────────────────────────────────────
  /**
   * Task has too many acceptance criteria or files in scope — it is an oversized
   * compound task that must be decomposed into smaller work items.
   */
  TASK_TOO_LARGE:                "task_too_large",
  /**
   * Task description is too generic/vague — it does not specify a concrete
   * artifact, system component, or measurable outcome.
   */
  TASK_AMBIGUOUS:                "task_ambiguous",

  // ── Scoring fields (shared with generation-boundary gate) ────────────────
  /** capacityDelta is absent. */
  MISSING_CAPACITY_DELTA:        "missing_capacity_delta",
  /** capacityDelta is present but not a finite number ∈ [-1.0, 1.0]. */
  INVALID_CAPACITY_DELTA:        "invalid_capacity_delta",
  /** requestROI is absent. */
  MISSING_REQUEST_ROI:           "missing_request_roi",
  /** requestROI is present but not a positive finite number. */
  INVALID_REQUEST_ROI:           "invalid_request_roi",
});

/**
 * Verification values that are non-specific: bare CLI commands with no test file
 * reference or observable assertion description.
 * Per the Prometheus output format, `verification` MUST be a specific test file
 * path + expected test description, not a generic command invocation.
 */
export const NON_SPECIFIC_VERIFICATION_PATTERNS = [
  /^npm\s+test\s*$/i,
  /^npm\s+run\s+test\s*$/i,
  /^npm\s+run\s+tests\s*$/i,
  /^node\s+--test\s*$/i,
  /^npx\s+[a-z][\w-]*\s*$/i,
  /^run\s+tests?\s*$/i,
  /^tests?\s+pass\s*$/i,
];

/**
 * Maximum number of acceptance criteria a single plan task may declare.
 * Plans exceeding this threshold are oversized compound tasks that should be
 * decomposed into smaller, independently-verifiable work items.
 */
export const MAX_ACCEPTANCE_CRITERIA_PER_TASK = 10;

/**
 * Maximum number of files a single plan task may declare in its scope
 * (filesInScope or target_files). Plans with broader file coverage are
 * oversized compound tasks.
 */
export const MAX_FILES_IN_SCOPE_PER_TASK = 30;

/**
 * Regex patterns matching ambiguous, underspecified task descriptions.
 * A description is ambiguous when it contains only generic action/noun
 * vocabulary without specifying a concrete artifact, system component, or
 * measurable outcome.
 */
export const AMBIGUOUS_TASK_PATTERNS: ReadonlyArray<RegExp> = Object.freeze([
  /^fix\s*(bugs?|issues?|things?|stuff|it|that|this|them)?\s*$/i,
  /^update\s*(code|system|things?|stuff|it|that|this|them)?\s*$/i,
  /^improve\s*(system|code|things?|stuff|it|performance|quality)?\s*$/i,
  /^refactor\s*(code|things?|stuff|it|that|this|them)?\s*$/i,
  /^clean\s*up\s*(code|things?|stuff|it|that|this|them)?\s*$/i,
  /^misc(ellaneous)?\s*(changes?|updates?|fixes?)?\s*$/i,
  /^general\s*(cleanup|refactor|update|fix|improvement|changes?)?\s*$/i,
  /^various\s*(updates?|changes?|fixes?|improvements?)?\s*$/i,
  /^add\s+tests?\s*$/i,
  /^write\s+tests?\s*$/i,
]);

/**
 * Determine whether a task description is ambiguous/underspecified.
 * Returns true when the description matches a known generic-vocabulary pattern.
 *
 * @param {string} value - the plan's `task` field
 * @returns {boolean} true when the task is ambiguous
 */
export function isAmbiguousTask(value: string): boolean {
  if (!value || !String(value).trim()) return true;
  const v = String(value).trim();
  return AMBIGUOUS_TASK_PATTERNS.some(pattern => pattern.test(v));
}

/**
 * Determine whether a `verification` field value is non-specific.
 * A value is non-specific when it contains no test file reference (`.test.ts`,
 * `.test.js`, `.spec.ts`, etc.) and no test description separator (`— test:`)
 * and matches a known bare CLI command pattern.
 *
 * @param {string} value - the plan's `verification` field
 * @returns {boolean} true when non-specific (should be rejected)
 */
export function isNonSpecificVerification(value: string): boolean {
  if (!value || !String(value).trim()) return true;
  const v = String(value).trim();
  // Specific: references a test file by extension
  if (/\.(test|spec)\.(ts|js|tsx|jsx)/i.test(v)) return false;
  // Specific: references a tests/ directory path
  if (/\/tests?\/[^\s]/.test(v)) return false;
  // Specific: contains a description separator used by the output format
  if (/[—\-–]\s*test[:\s]/i.test(v)) return false;
  // Non-specific: matches a known bare CLI command (no file argument)
  return /^(npm|node|npx)\s/i.test(v) || /^run\s+(test|check)/i.test(v);
}

/**
 * Plan contract violation severity levels.
 * @enum {string}
 */
export const PLAN_VIOLATION_SEVERITY = Object.freeze({
  CRITICAL: "critical",
  WARNING: "warning",
});

/**
 * A single contract violation emitted by validatePlanContract.
 * `code` is a deterministic value from PACKET_VIOLATION_CODE and is the
 * canonical identifier for machine consumption; `message` is human-readable.
 */
export interface PlanViolation {
  field: string;
  message: string;
  severity: string;
  code: string;
}

/**
 * Validate a single plan against the contract schema.
 *
 * @param {object} plan
 * @returns {{ valid: boolean, violations: PlanViolation[] }}
 */
export function validatePlanContract(plan): { valid: boolean; violations: PlanViolation[] } {
  if (!plan || typeof plan !== "object") {
    return {
      valid: false,
      violations: [{
        field: "plan",
        message: "Plan is null or not an object",
        severity: PLAN_VIOLATION_SEVERITY.CRITICAL,
        code: PACKET_VIOLATION_CODE.NO_TASK_IDENTITY,
      }],
    };
  }

  const violations: PlanViolation[] = [];

  // Required fields
  if (!plan.task || String(plan.task).trim().length < 5) {
    violations.push({
      field: "task",
      message: "Task must be a non-empty string (≥5 chars)",
      severity: PLAN_VIOLATION_SEVERITY.CRITICAL,
      code: PACKET_VIOLATION_CODE.TASK_TOO_SHORT,
    });
  } else if (isAmbiguousTask(String(plan.task))) {
    // Only flag ambiguity when the task passes the length check (avoids duplicate errors).
    violations.push({
      field: "task",
      message: `Task description is too generic/ambiguous: "${String(plan.task).trim().slice(0, 80)}". ` +
        "Specify a concrete artifact, system component, or measurable outcome.",
      severity: PLAN_VIOLATION_SEVERITY.WARNING,
      code: PACKET_VIOLATION_CODE.TASK_AMBIGUOUS,
    });
  }

  if (!plan.role || String(plan.role).trim().length === 0) {
    violations.push({
      field: "role",
      message: "Role must be specified",
      severity: PLAN_VIOLATION_SEVERITY.CRITICAL,
      code: PACKET_VIOLATION_CODE.MISSING_ROLE,
    });
  }

  const wave = Number(plan.wave);
  if (!Number.isFinite(wave) || wave < 1) {
    violations.push({
      field: "wave",
      message: `Wave must be a positive integer, got: ${plan.wave}`,
      severity: PLAN_VIOLATION_SEVERITY.WARNING,
      code: PACKET_VIOLATION_CODE.INVALID_WAVE,
    });
  }

  if (!plan.verification || String(plan.verification).trim().length === 0) {
    violations.push({
      field: "verification",
      message: "Verification command must be specified",
      severity: PLAN_VIOLATION_SEVERITY.WARNING,
      code: PACKET_VIOLATION_CODE.MISSING_VERIFICATION,
    });
  } else if (isNonSpecificVerification(String(plan.verification))) {
    violations.push({
      field: "verification",
      message: `Verification target is non-specific: "${String(plan.verification).trim()}". ` +
        "Must reference a specific test file (e.g. tests/core/foo.test.ts — test: expected description). " +
        "Generic commands like 'npm test' alone are rejected.",
      severity: PLAN_VIOLATION_SEVERITY.CRITICAL,
      code: PACKET_VIOLATION_CODE.NON_SPECIFIC_VERIFICATION,
    });
  }

  // Recommended fields
  if (!Array.isArray(plan.dependencies)) {
    violations.push({
      field: "dependencies",
      message: "Dependencies should be an array",
      severity: PLAN_VIOLATION_SEVERITY.WARNING,
      code: PACKET_VIOLATION_CODE.MISSING_DEPENDENCIES,
    });
  }

  if (!Array.isArray(plan.acceptance_criteria) || plan.acceptance_criteria.length === 0) {
    violations.push({
      field: "acceptance_criteria",
      message: "Acceptance criteria must be a non-empty array — plans without measurable AC are rejected",
      severity: PLAN_VIOLATION_SEVERITY.CRITICAL,
      code: PACKET_VIOLATION_CODE.MISSING_ACCEPTANCE_CRITERIA,
    });
  } else if (plan.acceptance_criteria.length > MAX_ACCEPTANCE_CRITERIA_PER_TASK) {
    // Oversized AC list — the task is compound and must be decomposed.
    violations.push({
      field: "acceptance_criteria",
      message: `Task has ${plan.acceptance_criteria.length} acceptance criteria (max ${MAX_ACCEPTANCE_CRITERIA_PER_TASK}). ` +
        "Oversized tasks must be decomposed into smaller, independently-verifiable work items.",
      severity: PLAN_VIOLATION_SEVERITY.WARNING,
      code: PACKET_VIOLATION_CODE.TASK_TOO_LARGE,
    });
  }

  // Decomposition cap: files-in-scope ceiling.
  const inScopeFiles: unknown[] | null = Array.isArray(plan.filesInScope)
    ? plan.filesInScope
    : Array.isArray(plan.target_files)
      ? plan.target_files
      : null;
  if (inScopeFiles !== null && inScopeFiles.length > MAX_FILES_IN_SCOPE_PER_TASK) {
    violations.push({
      field: "filesInScope",
      message: `Task declares ${inScopeFiles.length} files in scope (max ${MAX_FILES_IN_SCOPE_PER_TASK}). ` +
        "Tasks with broad file coverage are oversized — decompose into focused work items.",
      severity: PLAN_VIOLATION_SEVERITY.WARNING,
      code: PACKET_VIOLATION_CODE.TASK_TOO_LARGE,
    });
  }

  // Measurable capacity delta — expected change in system capacity if plan succeeds.
  // Mandatory field: finite number ∈ [-1.0, 1.0]. Plans without a valid capacityDelta
  // are rejected — they cannot be ranked or compared against budget constraints.
  if (!("capacityDelta" in plan)) {
    violations.push({
      field: "capacityDelta",
      message: "capacityDelta is missing — plans must declare the expected measurable change in system capacity (number ∈ [-1.0, 1.0])",
      severity: PLAN_VIOLATION_SEVERITY.CRITICAL,
      code: PACKET_VIOLATION_CODE.MISSING_CAPACITY_DELTA,
    });
  } else {
    const cd = Number(plan.capacityDelta);
    if (!Number.isFinite(cd) || cd < -1 || cd > 1) {
      violations.push({
        field: "capacityDelta",
        message: `capacityDelta must be a finite number ∈ [-1.0, 1.0]; got: ${plan.capacityDelta}`,
        severity: PLAN_VIOLATION_SEVERITY.CRITICAL,
        code: PACKET_VIOLATION_CODE.INVALID_CAPACITY_DELTA,
      });
    }
  }

  // Request ROI — expected return-on-investment for the premium request consumed.
  // Mandatory field: positive finite number (dimensionless gain ratio). Plans without
  // a valid requestROI are rejected — they cannot be ranked by cost-effectiveness.
  if (!("requestROI" in plan)) {
    violations.push({
      field: "requestROI",
      message: "requestROI is missing — plans must declare the expected return-on-investment for the premium request consumed (positive finite number)",
      severity: PLAN_VIOLATION_SEVERITY.CRITICAL,
      code: PACKET_VIOLATION_CODE.MISSING_REQUEST_ROI,
    });
  } else {
    const roi = Number(plan.requestROI);
    if (!Number.isFinite(roi) || roi <= 0) {
      violations.push({
        field: "requestROI",
        message: `requestROI must be a positive finite number; got: ${plan.requestROI}`,
        severity: PLAN_VIOLATION_SEVERITY.CRITICAL,
        code: PACKET_VIOLATION_CODE.INVALID_REQUEST_ROI,
      });
    }
  }

  // Forbidden verification command gate (Packet 5) — uses centralized registry.
  // Check all command-bearing fields: verification (string) and
  // verification_commands (array) so Windows false-fails can't slip through
  // a non-primary command field.
  const commandsToCheck: Array<{ field: string; value: string }> = [
    { field: "verification", value: String(plan.verification || "") },
  ];

  if (Array.isArray(plan.verification_commands)) {
    plan.verification_commands.forEach((cmd: unknown, idx: number) => {
      commandsToCheck.push({ field: `verification_commands[${idx}]`, value: String(cmd || "") });
    });
  }

  for (const { field, value } of commandsToCheck) {
    const forbidden = checkForbiddenCommands(value);
    if (forbidden.forbidden) {
      for (const v of forbidden.violations) {
        violations.push({
          field,
          message: `Forbidden command: ${v.reason}`,
          severity: PLAN_VIOLATION_SEVERITY.CRITICAL,
          code: PACKET_VIOLATION_CODE.FORBIDDEN_COMMAND,
        });
      }
    }
  }

  const criticalCount = violations.filter(v => v.severity === PLAN_VIOLATION_SEVERITY.CRITICAL).length;
  return { valid: criticalCount === 0, violations };
}
/**
 * Validate all plans in a batch and compute aggregate pass rate.
 *
 * @param {object[]} plans
 * @returns {{ passRate: number, totalPlans: number, validCount: number, invalidCount: number, results: Array<{ planIndex: number, task: string, valid: boolean, violations: object[] }> }}
 */
export function validateAllPlans(plans) {
  if (!Array.isArray(plans) || plans.length === 0) {
    return { passRate: 1.0, totalPlans: 0, validCount: 0, invalidCount: 0, results: [] };
  }

  const results = plans.map((plan, i) => {
    const r = validatePlanContract(plan);
    return {
      planIndex: i,
      task: String(plan?.task || "").slice(0, 80),
      valid: r.valid,
      violations: r.violations,
    };
  });

  const validCount = results.filter(r => r.valid).length;
  const invalidCount = results.length - validCount;
  const passRate = Math.round((validCount / results.length) * 100) / 100;

  return { passRate, totalPlans: results.length, validCount, invalidCount, results };
}

// ── Quarantine gate ───────────────────────────────────────────────────────────

/**
 * Confidence threshold below which a packet is considered quarantined.
 * Mirrors the value exported by prometheus.ts so both modules share the same gate.
 */
export const QUARANTINE_CONFIDENCE_THRESHOLD = 0.5 as const;

/**
 * Determine whether a plan packet should be quarantined from dispatch.
 *
 * A packet is quarantined when:
 *   1. It carries `_quarantined: true` (explicitly set by quarantineLowConfidencePackets), or
 *   2. It has a `_provenance.confidence` value that is strictly below QUARANTINE_CONFIDENCE_THRESHOLD.
 *
 * Packets without provenance metadata pass through (backward compatible).
 *
 * @param packet — any plan object
 * @returns true when the packet must not be dispatched
 */
export function isPacketQuarantined(packet: any): boolean {
  if (!packet || typeof packet !== "object") return false;
  if (packet._quarantined === true) return true;
  if (typeof packet._provenance?.confidence === "number") {
    return packet._provenance.confidence < QUARANTINE_CONFIDENCE_THRESHOLD;
  }
  return false;
}

```

### FILE: src/core/learning_policy_compiler.ts
```typescript
/**
 * learning_policy_compiler.js — Converts postmortem lessons into enforced policy checks.
 *
 * Problem: Postmortem lessons sit as text in JSON files. The same defects recur
 * because lessons are advisory, not enforced.
 *
 * Solution: This compiler extracts actionable patterns from lessons and generates
 * deterministic policy assertions that can be checked before worker dispatch.
 *
 * Integration: called by orchestrator after postmortem, before next cycle start.
 */

/**
 * Known lesson patterns that can be compiled into policy checks.
 * Each pattern has a regex to match lessons and a policy assertion to enforce.
 *
 * @type {Array<{ id: string, pattern: RegExp, assertion: string, severity: string }>}
 */
const COMPILABLE_PATTERNS = [
  {
    id: "glob-false-fail",
    pattern: /glob|node --test tests[\\/]\*|wildcard|path.*expansion/i,
    assertion: "Verification must use 'npm test' not 'node --test tests/**'",
    severity: "critical"
  },
  {
    id: "missing-test",
    pattern: /no\s+test|missing\s+test|untested|test.*coverage/i,
    assertion: "New code must include at least one test file",
    severity: "warning"
  },
  {
    id: "lint-failure",
    pattern: /lint|eslint|unused\s+(var|import|export)/i,
    assertion: "Run npm run lint before marking task complete",
    severity: "warning"
  },
  {
    id: "import-error",
    pattern: /import.*error|module.*not\s+found|cannot\s+find\s+module/i,
    assertion: "All imports must resolve; verify with node -e 'import(\"./path\")'",
    severity: "critical"
  },
  {
    id: "state-corruption",
    pattern: /state.*corrupt|json.*parse|invalid\s+json|malformed/i,
    assertion: "State files must be written atomically with writeJson",
    severity: "critical"
  },
  {
    id: "syntax-error",
    pattern: /syntax\s*error|unexpected\s+token|parse\s+error/i,
    assertion: "Code must parse without SyntaxError before commit",
    severity: "critical"
  },
  {
    id: "hardcoded-path",
    pattern: /hardcoded|absolute\s+path|windows.*path|backslash/i,
    assertion: "Use path.join() for all file paths; no hardcoded separators",
    severity: "warning"
  },
  {
    id: "missing-error-handling",
    pattern: /unhandled|uncaught|swallow.*error|silent.*fail/i,
    assertion: "Async operations at system boundaries must have try/catch",
    severity: "warning"
  },
];

/**
 * @typedef {object} CompiledPolicy
 * @property {string} id — policy rule ID
 * @property {string} assertion — human-readable policy assertion
 * @property {string} severity — "critical" | "warning"
 * @property {string} sourceLesson — the lesson text that triggered this policy
 * @property {string} detectedAt — ISO timestamp
 */

/**
 * Compile lessons from postmortem history into enforced policy checks.
 *
 * @param {object[]} postmortems — postmortem entries with lessonLearned field
 * @param {{ existingPolicies?: string[] }} opts
 * @returns {CompiledPolicy[]}
 */
export function compileLessonsToPolicies(postmortems, opts: any = {}) {
  if (!Array.isArray(postmortems)) return [];

  const existing = new Set(opts.existingPolicies || []);
  /** @type {CompiledPolicy[]} */
  const policies = [];
  const seen = new Set();

  for (const pm of postmortems) {
    const lesson = String(pm?.lessonLearned || "").trim();
    if (lesson.length < 10) continue;

    for (const template of COMPILABLE_PATTERNS) {
      if (template.pattern.test(lesson) && !seen.has(template.id) && !existing.has(template.id)) {
        seen.add(template.id);
        policies.push({
          id: template.id,
          assertion: template.assertion,
          severity: template.severity,
          sourceLesson: lesson.slice(0, 200),
          detectedAt: pm.reviewedAt || new Date().toISOString()
        });
      }
    }
  }

  return policies;
}

/**
 * Validate a plan against compiled policies.
 * Returns violations if the plan conflicts with any active policy.
 *
 * @param {object} plan — plan object
 * @param {CompiledPolicy[]} policies — active compiled policies
 * @returns {{ ok: boolean, violations: Array<{ policyId: string, assertion: string, severity: string }> }}
 */
export function validatePlanAgainstPolicies(plan, policies) {
  if (!plan || !Array.isArray(policies)) return { ok: true, violations: [] };

  const violations = [];
  const verification = String(plan.verification || "").toLowerCase();
  const task = String(plan.task || "").toLowerCase();

  for (const policy of policies) {
    // Check specific known violations
    if (policy.id === "glob-false-fail" && /node\s+--test\s+tests/.test(verification)) {
      violations.push({ policyId: policy.id, assertion: policy.assertion, severity: policy.severity, reasonCode: REASON_CODES.PLAN_VIOLATION });
    }
    if (policy.id === "missing-test" && /implement|create|add/.test(task) && !/test/.test(task) && !/test/.test(verification)) {
      violations.push({ policyId: policy.id, assertion: policy.assertion, severity: policy.severity, reasonCode: REASON_CODES.PLAN_VIOLATION });
    }
  }

  return { ok: violations.length === 0, violations };
}

/**
 * Check if unresolved carry-forward lessons should block plan acceptance (Packet 10/16).
 * Plans are blocked when the same lesson has gone unresolved for more than maxCycles.
 *
 * Enhanced (Packet 16): Also validates that mandatory carry-forward items appear
 * explicitly in the current plan set. Plans missing mandatory items are blocked.
 *
 * @param {object[]} postmortems — postmortem entries with followUpNeeded/followUpTask
 * @param {object[]} currentPlans — current plan set to check against
 * @param {{ maxUnresolvedCycles?: number, mandatoryCarryForward?: string[] }} opts
 * @returns {{ shouldBlock: boolean, reason: string, unresolvedLessons: string[], missingMandatory: string[] }}
 */
export function checkCarryForwardGate(postmortems, currentPlans, opts: any = {}) {
  const maxCycles = opts.maxUnresolvedCycles || 3;
  if (!Array.isArray(postmortems)) return { shouldBlock: false, reason: "", unresolvedLessons: [], missingMandatory: [] };

  // Count how many times each lesson appears unresolved
  const lessonCounts = new Map();
  for (const pm of postmortems) {
    if (!pm.followUpNeeded || !pm.followUpTask) continue;
    const normalized = normalizeKey(pm.followUpTask);
    if (!normalized) continue;
    lessonCounts.set(normalized, (lessonCounts.get(normalized) || 0) + 1);
  }

  // Check if current plans address any of the unresolved lessons
  const planTexts = (currentPlans || []).map(p => normalizeKey(String(p.task || "")));

  const unresolvedLessons = [];
  for (const [lesson, count] of lessonCounts) {
    if (count < maxCycles) continue;
    // Check if current plan addresses this lesson
    const addressed = planTexts.some(pt => pt.includes(lesson.slice(0, 40)) || lesson.includes(pt.slice(0, 40)));
    if (!addressed) {
      unresolvedLessons.push(lesson.slice(0, 100));
    }
  }

  // Packet 16: Validate mandatory carry-forward items
  const mandatory = Array.isArray(opts.mandatoryCarryForward) ? opts.mandatoryCarryForward : [];
  const missingMandatory = [];
  for (const item of mandatory) {
    const normalizedItem = normalizeKey(item);
    const found = planTexts.some(pt => pt.includes(normalizedItem.slice(0, 40)) || normalizedItem.includes(pt.slice(0, 40)));
    if (!found) {
      missingMandatory.push(item.slice(0, 100));
    }
  }

  const shouldBlock = unresolvedLessons.length > 0 || missingMandatory.length > 0;
  const reasons = [];
  if (unresolvedLessons.length > 0) {
    reasons.push(`${unresolvedLessons.length} lesson(s) unresolved for >${maxCycles} cycles and not addressed in current plan`);
  }
  if (missingMandatory.length > 0) {
    reasons.push(`${missingMandatory.length} mandatory carry-forward item(s) missing from plan`);
  }

  return {
    shouldBlock,
    reason: reasons.join("; "),
    reasonCode: unresolvedLessons.length > 0
      ? REASON_CODES.CARRY_FORWARD_UNRESOLVED
      : missingMandatory.length > 0
      ? REASON_CODES.MANDATORY_ITEM_MISSING
      : null,
    unresolvedLessons,
    missingMandatory,
  };
}

function normalizeKey(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

/** Exported for testing. */
export { COMPILABLE_PATTERNS };

/**
 * Structured reason codes emitted by gate functions so callers can react
 * programmatically without parsing free-form reason strings.
 */
export const REASON_CODES = {
  /** Lesson has recurred enough times to trigger a hard-gate policy block. */
  RECURRENCE_HARD_GATE: "RECURRENCE_HARD_GATE",
  /** Lesson is approaching the hard-gate threshold — early warning issued. */
  EARLY_RECURRENCE_WARNING: "EARLY_RECURRENCE_WARNING",
  /** One or more carry-forward lessons remain unresolved past the cycle limit. */
  CARRY_FORWARD_UNRESOLVED: "CARRY_FORWARD_UNRESOLVED",
  /** A mandatory carry-forward item is absent from the current plan set. */
  MANDATORY_ITEM_MISSING: "MANDATORY_ITEM_MISSING",
  /** A plan field directly violates an active compiled policy. */
  PLAN_VIOLATION: "PLAN_VIOLATION",
} as const;

export type ReasonCode = typeof REASON_CODES[keyof typeof REASON_CODES];

/**
 * Hard-gate: auto-compile unresolved recurrences into enforceable policies (Packet 15).
 *
 * When the same lesson recurs more than `maxRecurrences` times without resolution,
 * this function forcibly compiles it into a policy assertion that blocks future plans
 * matching the same pattern.
 *
 * Early promotion: lessons that recur more than `earlyGateThreshold` times (default:
 * maxRecurrences - 1) are promoted to warning-level policies with a distinct
 * `-early-warning` ID suffix so they enter the gate pipeline before the hard threshold.
 * This gives operators one cycle of advance notice before the hard block fires.
 *
 * All emitted policies carry a `reasonCode` field for programmatic routing by callers.
 *
 * @param {object[]} postmortems — full postmortem history
 * @param {string[]} existingPolicyIds — already-active policy IDs
 * @param {{ maxRecurrences?: number, earlyGateThreshold?: number }} opts
 * @returns {{ newPolicies: CompiledPolicy[], escalations: string[] }}
 */
export function hardGateRecurrenceToPolicies(postmortems, existingPolicyIds = [], opts: any = {}) {
  const maxRecurrences = opts.maxRecurrences || 3;
  // earlyGateThreshold defaults to one below maxRecurrences so promotion is one cycle early.
  const earlyGateThreshold = opts.earlyGateThreshold ?? Math.max(1, maxRecurrences - 1);
  if (!Array.isArray(postmortems)) return { newPolicies: [], escalations: [] };

  const existing = new Set(existingPolicyIds);
  const lessonCounts = new Map();

  // Count lesson occurrences
  for (const pm of postmortems) {
    if (!pm.followUpNeeded) continue;
    const lesson = String(pm.lessonLearned || "").trim();
    if (lesson.length < 10) continue;
    lessonCounts.set(lesson, (lessonCounts.get(lesson) || 0) + 1);
  }

  const newPolicies = [];
  const escalations = [];

  for (const [lesson, count] of lessonCounts) {
    const isHardGate = count >= maxRecurrences;
    const isEarlyWarning = !isHardGate && count >= earlyGateThreshold;
    if (!isHardGate && !isEarlyWarning) continue;

    const reasonCode = isHardGate ? REASON_CODES.RECURRENCE_HARD_GATE : REASON_CODES.EARLY_RECURRENCE_WARNING;

    // Try to compile into a known pattern
    let compiled = false;
    for (const template of COMPILABLE_PATTERNS) {
      if (!template.pattern.test(lesson)) continue;
      // Hard gate uses the canonical ID; early warning uses a distinct suffixed ID so
      // both can coexist in existingPolicyIds without suppressing each other.
      const policyId = isHardGate ? template.id : `${template.id}-early-warning`;
      if (existing.has(policyId)) { compiled = true; break; }
      existing.add(policyId);
      newPolicies.push({
        id: policyId,
        assertion: template.assertion,
        severity: isHardGate ? "critical" : template.severity,
        reasonCode,
        sourceLesson: lesson.slice(0, 200),
        detectedAt: new Date().toISOString(),
        _hardGated: isHardGate,
        _recurrenceCount: count,
      });
      compiled = true;
      break;
    }

    // If no known pattern matches, escalate as a custom rule
    if (!compiled) {
      const baseId = `custom-recurrence-${normalizeKey(lesson).slice(0, 30).replace(/\s/g, "-")}`;
      const customId = isHardGate ? baseId : `${baseId}-early-warning`;
      if (!existing.has(customId)) {
        existing.add(customId);
        newPolicies.push({
          id: customId,
          assertion: `Recurring unresolved: ${lesson.slice(0, 100)}`,
          severity: isHardGate ? "critical" : "warning",
          reasonCode,
          sourceLesson: lesson.slice(0, 200),
          detectedAt: new Date().toISOString(),
          _hardGated: isHardGate,
          _recurrenceCount: count,
        });
        if (isEarlyWarning) {
          escalations.push(`Lesson approaching recurrence threshold (${count}/${maxRecurrences}): ${lesson.slice(0, 80)}`);
        } else {
          escalations.push(`Lesson recurring ${count}x without resolution: ${lesson.slice(0, 80)}`);
        }
      }
    }
  }

  return { newPolicies, escalations };
}

// ── Routing adjustments (Task 9) ──────────────────────────────────────────────

/**
 * @typedef {object} RoutingAdjustment
 * @property {string} policyId — the compiled policy that triggered this adjustment
 * @property {string} modelOverride — model routing override (e.g. "force-sonnet", "block-opus")
 * @property {string} reason — why this routing adjustment was applied
 * @property {"critical"|"warning"} severity — mirrors the triggering policy severity
 */

/**
 * Map from policy ID to the routing adjustment it should trigger.
 * Critical policies (recurring failures) route to safer, more predictable models.
 * Import-related issues block Opus escalation since model complexity is not the problem.
 */
const POLICY_ROUTING_MAP: Record<string, { modelOverride: string; reason: string }> = {
  "glob-false-fail":          { modelOverride: "force-sonnet", reason: "glob failures are tooling issues, not reasoning gaps — Sonnet sufficient" },
  "lint-failure":             { modelOverride: "force-sonnet", reason: "lint failures require precision, not reasoning depth" },
  "hardcoded-path":           { modelOverride: "force-sonnet", reason: "path issues are mechanical — Sonnet sufficient" },
  "import-error":             { modelOverride: "block-opus",   reason: "import errors indicate env/dependency issues, not model capability gaps" },
  "missing-error-handling":   { modelOverride: "force-sonnet", reason: "error handling is a discipline issue, not a reasoning issue" },
  "missing-test":             { modelOverride: "force-sonnet", reason: "test coverage is discipline-driven, not model-driven" },
  "state-corruption":         { modelOverride: "force-sonnet", reason: "state atomicity is a tooling discipline; model change unhelpful" },
  "syntax-error":             { modelOverride: "block-opus",   reason: "syntax errors are never fixed by a more expensive model" },
};

/**
 * Derive routing adjustments from compiled policies.
 *
 * Recurring failure classes adjust model routing to prevent the same model from
 * being used on tasks where it has demonstrated repeated failure.
 *
 * @param {CompiledPolicy[]} policies — active compiled policies (from compileLessonsToPolicies or hardGateRecurrenceToPolicies)
 * @returns {RoutingAdjustment[]}
 */
export function deriveRoutingAdjustments(policies) {
  if (!Array.isArray(policies)) return [];

  const adjustments = [];
  const seen = new Set<string>();

  for (const policy of policies) {
    const id = String(policy?.id || "");
    if (!id || seen.has(id)) continue;
    seen.add(id);

    const mapping = POLICY_ROUTING_MAP[id];
    if (mapping) {
      adjustments.push({
        policyId: id,
        modelOverride: mapping.modelOverride,
        reason: mapping.reason,
        severity: policy.severity || "warning",
      });
    }
    // For hard-gated custom recurrence policies, default to force-sonnet
    else if (id.startsWith("custom-recurrence-") && (policy as any)._hardGated) {
      adjustments.push({
        policyId: id,
        modelOverride: "force-sonnet",
        reason: `Recurring custom failure class: ${policy.assertion?.slice(0, 80) || id}`,
        severity: policy.severity || "warning",
      });
    }
  }

  return adjustments;
}

/**
 * @typedef {object} PromptHardConstraint
 * @property {string} policyId — the compiled policy that triggered this constraint
 * @property {string} constraint — the hard constraint to inject into the worker prompt
 * @property {boolean} blocking — if true, violation of this constraint causes immediate rework
 * @property {"critical"|"warning"} severity — mirrors the triggering policy severity
 */

/**
 * Map from policy ID to the prompt hard constraint it injects.
 * Hard constraints are injected into the worker prompt preamble so the model
 * cannot silently violate them — violation triggers an immediate rework gate.
 */
const POLICY_PROMPT_CONSTRAINT_MAP: Record<string, { constraint: string; blocking: boolean }> = {
  "glob-false-fail":          { constraint: "HARD CONSTRAINT: Use 'npm test' only. Never use 'node --test tests/**' glob patterns.", blocking: true },
  "missing-test":             { constraint: "HARD CONSTRAINT: Every code change must include or update at least one test file.", blocking: true },
  "lint-failure":             { constraint: "HARD CONSTRAINT: Run 'npm run lint' before marking done. Zero new lint errors are required.", blocking: true },
  "import-error":             { constraint: "HARD CONSTRAINT: Verify all imports resolve before committing. Run 'node -e \"import('./path')\"' on new imports.", blocking: true },
  "state-corruption":         { constraint: "HARD CONSTRAINT: All state file writes must use writeJson (atomic write). Never use fs.writeFile directly on JSON state.", blocking: true },
  "syntax-error":             { constraint: "HARD CONSTRAINT: Syntax-check all changed files before commit. No SyntaxError is acceptable.", blocking: true },
  "hardcoded-path":           { constraint: "HARD CONSTRAINT: Use path.join() for all file paths. No hardcoded separators (/ or \\\\).", blocking: false },
  "missing-error-handling":   { constraint: "HARD CONSTRAINT: All async operations at system boundaries must have explicit try/catch with logged errors.", blocking: false },
};

/**
 * Build prompt hard constraints from compiled policies.
 *
 * These constraints are injected into the worker prompt so the model has
 * explicit in-context rules derived from recurring postmortem failure classes.
 *
 * @param {CompiledPolicy[]} policies — active compiled policies
 * @returns {PromptHardConstraint[]}
 */
export function buildPromptHardConstraints(policies) {
  if (!Array.isArray(policies)) return [];

  const constraints = [];
  const seen = new Set<string>();

  for (const policy of policies) {
    const id = String(policy?.id || "");
    if (!id || seen.has(id)) continue;
    seen.add(id);

    const mapping = POLICY_PROMPT_CONSTRAINT_MAP[id];
    if (mapping) {
      constraints.push({
        policyId: id,
        constraint: mapping.constraint,
        blocking: mapping.blocking,
        severity: policy.severity || "warning",
      });
    }
    // For hard-gated custom recurrence policies, generate a generic constraint
    else if (id.startsWith("custom-recurrence-") && (policy as any)._hardGated) {
      constraints.push({
        policyId: id,
        constraint: `HARD CONSTRAINT (recurring): ${policy.assertion?.slice(0, 120) || id}`,
        blocking: policy.severity === "critical",
        severity: policy.severity || "warning",
      });
    }
  }

  return constraints;
}

// ── Closure evidence and retirement criteria ──────────────────────────────────

/**
 * Closure evidence for a compiled policy binding.
 * Records that a recurring lesson was verifiably resolved so the policy
 * can be evaluated for retirement after sufficient clean cycles.
 */
export interface PolicyClosureEvidence {
  /** ID of the compiled policy that was resolved. */
  policyId:   string;
  /** ISO timestamp when closure was recorded. */
  resolvedAt: string;
  /** Who or what provided the closure evidence. */
  resolvedBy: string;
  /** Human-readable description of the evidence. */
  evidence:   string;
  /** Optional cycle identifier (e.g. from pipeline_progress). */
  cycleId?:   string;
}

/** Retirement evaluation result for a single policy binding. */
export interface RetirementEvaluation {
  policyId:            string;
  eligible:            boolean;
  reason:              string;
  closureCount:        number;
  cyclesSinceClosure:  number;
  lastClosedAt:        string | null;
}

/** Minimum number of closure evidence records before retirement is considered. */
export const RETIREMENT_MIN_CLOSURES = 1;

/**
 * Minimum number of postmortem cycles that must pass after the last closure
 * without any recurrence of the lesson before the policy can be retired.
 */
export const RETIREMENT_MIN_CLEAN_CYCLES = 3;

/**
 * Build a PolicyClosureEvidence record for a given policy.
 *
 * @param policyId  — ID of the compiled policy being closed
 * @param evidence  — human-readable description of the resolution evidence
 * @param opts      — optional resolvedBy and cycleId overrides
 */
export function buildPolicyClosureEvidence(
  policyId: string,
  evidence: string,
  opts: { resolvedBy?: string; cycleId?: string } = {},
): PolicyClosureEvidence {
  if (!policyId || !String(policyId).trim()) {
    throw new Error("policyId is required for buildPolicyClosureEvidence");
  }
  return {
    policyId:   String(policyId).trim(),
    resolvedAt: new Date().toISOString(),
    resolvedBy: String(opts.resolvedBy || "manual"),
    evidence:   String(evidence || "").slice(0, 500),
    ...(opts.cycleId ? { cycleId: String(opts.cycleId) } : {}),
  };
}

/**
 * Evaluate whether a compiled policy binding is eligible for retirement.
 *
 * Retirement requires:
 *   1. At least `minClosures` closure evidence records for the policy.
 *   2. No recurrences of the triggering lesson in postmortems after the last closure.
 *   3. At least `minCleanCycles` postmortem cycles after the last closure with no recurrence.
 *
 * @param policyId         — ID of the policy to evaluate
 * @param closureHistory   — all recorded PolicyClosureEvidence entries
 * @param recentPostmortems — postmortem entries (must have `reviewedAt` and `lessonLearned`)
 * @param opts             — { minClosures?, minCleanCycles? }
 */
export function evaluateRetirementEligibility(
  policyId: string,
  closureHistory: PolicyClosureEvidence[],
  recentPostmortems: any[],
  opts: { minClosures?: number; minCleanCycles?: number } = {},
): RetirementEvaluation {
  const minClosures    = opts.minClosures    ?? RETIREMENT_MIN_CLOSURES;
  const minCleanCycles = opts.minCleanCycles ?? RETIREMENT_MIN_CLEAN_CYCLES;

  const policyClosures = Array.isArray(closureHistory)
    ? closureHistory.filter(e => e?.policyId === policyId)
    : [];

  if (policyClosures.length < minClosures) {
    return {
      policyId,
      eligible:           false,
      reason:             `Insufficient closure evidence (${policyClosures.length} < ${minClosures})`,
      closureCount:       policyClosures.length,
      cyclesSinceClosure: 0,
      lastClosedAt:       null,
    };
  }

  // Most-recent closure
  const sorted       = [...policyClosures].sort((a, b) => new Date(b.resolvedAt).getTime() - new Date(a.resolvedAt).getTime());
  const lastClosedAt = sorted[0].resolvedAt;
  const lastClosedMs = new Date(lastClosedAt).getTime();

  // Find the known pattern for this policyId so we can detect recurrences
  const template = COMPILABLE_PATTERNS.find(p => p.id === policyId);

  const pms = Array.isArray(recentPostmortems) ? recentPostmortems : [];

  // Postmortems AFTER the last closure (by reviewedAt; default to include if timestamp missing)
  const pmsAfterClosure = pms.filter(pm => {
    const ts = pm?.reviewedAt ? new Date(pm.reviewedAt).getTime() : Infinity;
    return ts >= lastClosedMs;
  });

  // Postmortems that re-trigger the policy pattern
  const recurrencesAfterClosure = template
    ? pmsAfterClosure.filter(pm => template.pattern.test(String(pm?.lessonLearned || ""))).length
    : 0;

  const cleanCycles = pmsAfterClosure.length - recurrencesAfterClosure;

  if (recurrencesAfterClosure > 0) {
    return {
      policyId,
      eligible:           false,
      reason:             `Policy still triggering — ${recurrencesAfterClosure} recurrence(s) since last closure`,
      closureCount:       policyClosures.length,
      cyclesSinceClosure: cleanCycles,
      lastClosedAt,
    };
  }

  if (cleanCycles < minCleanCycles) {
    return {
      policyId,
      eligible:           false,
      reason:             `Insufficient clean cycles since closure (${cleanCycles} < ${minCleanCycles})`,
      closureCount:       policyClosures.length,
      cyclesSinceClosure: cleanCycles,
      lastClosedAt,
    };
  }

  return {
    policyId,
    eligible:           true,
    reason:             `Policy has ${policyClosures.length} closure(s) and ${cleanCycles} clean cycles — eligible for retirement`,
    closureCount:       policyClosures.length,
    cyclesSinceClosure: cleanCycles,
    lastClosedAt,
  };
}

/**
 * Partition an active policy list into active and retired policies.
 *
 * Each policy is evaluated via evaluateRetirementEligibility. Policies
 * meeting the retirement criteria are moved to the `retired` list with
 * `_retiredAt` and `_retirementReason` metadata attached.
 *
 * @param policies         — active compiled policies
 * @param closureHistory   — all recorded closure evidence
 * @param recentPostmortems — recent postmortems used to detect recurrences
 * @param opts             — { minClosures?, minCleanCycles? }
 */
export function filterRetiredPolicies(
  policies: any[],
  closureHistory: PolicyClosureEvidence[],
  recentPostmortems: any[],
  opts: { minClosures?: number; minCleanCycles?: number } = {},
): { active: any[]; retired: any[] } {
  if (!Array.isArray(policies)) return { active: [], retired: [] };

  const active  = [];
  const retired = [];

  for (const policy of policies) {
    const evaluation = evaluateRetirementEligibility(
      policy?.id,
      closureHistory,
      recentPostmortems,
      opts,
    );
    if (evaluation.eligible) {
      retired.push({
        ...policy,
        _retiredAt:        new Date().toISOString(),
        _retirementReason: evaluation.reason,
      });
    } else {
      active.push(policy);
    }
  }

  return { active, retired };
}

```

### FILE: src/core/schema_registry.ts
```typescript
/**
 * schema_registry.js — Contract-versioned state schema registry for BOX.
 *
 * Defines version numbering, schema diffs, and migration handlers for the
 * three critical state files:
 *   - worker_sessions      (state/worker_sessions.json)
 *   - prometheus_analysis  (state/prometheus_analysis.json)
 *   - athena_postmortems   (state/athena_postmortems.json)
 *
 * Version scheme: non-negative integers.
 *   0 = LEGACY  — no schemaVersion field (files written before this registry)
 *   1 = V1      — current schema; schemaVersion: 1 present
 *
 * Schema diffs v0 → v1:
 *
 *   worker_sessions v0:
 *     { [roleName]: { status, startedAt?, ... } }
 *   worker_sessions v1:
 *     { schemaVersion: 1, [roleName]: { status, startedAt?, ... } }
 *     Added: schemaVersion integer field at root level.
 *
 *   prometheus_analysis v0:
 *     { plans, projectHealth, analysis, analyzedAt, model, repo, requestedBy, ... }
 *   prometheus_analysis v1:
 *     { schemaVersion: 1, plans, projectHealth, analysis, analyzedAt, model, repo, requestedBy, ... }
 *     Added: schemaVersion integer field at root level.
 *
 *   athena_postmortems v0:
 *     [ { workerName, taskCompleted, recommendation, ... }, ... ]  (root array)
 *   athena_postmortems v1:
 *     { schemaVersion: 1, entries: [ { workerName, taskCompleted, recommendation, ... }, ... ] }
 *     Added: schemaVersion wrapper object, entries array field.
 *
 * Migration telemetry: appended to state/schema_migration_log.json.
 *   Each record: { timestamp, fileType, filePath, fromVersion, toVersion, success, reason }
 */

import fs from "node:fs/promises";
import path from "node:path";

// ── Version constants ─────────────────────────────────────────────────────────

/**
 * Integer schema version enumeration.
 *   LEGACY (0): No schemaVersion field — written before this registry existed.
 *   V1     (1): Current schema — schemaVersion: 1 present at root.
 *
 * N-1 baseline: V1 is the current version; LEGACY (0) is N-1.
 * Future versions > V1 are unknown and must fail closed.
 */
export const SCHEMA_VERSION = Object.freeze({
  LEGACY: 0,
  V1: 1
});

/** The schema version written by all new writes. */
export const CURRENT_SCHEMA_VERSION = SCHEMA_VERSION.V1;

// ── File type identifiers ─────────────────────────────────────────────────────

/**
 * Canonical identifiers for schema-versioned state files.
 * Used as the `fileType` parameter in all registry functions.
 */
export const STATE_FILE_TYPE = Object.freeze({
  WORKER_SESSIONS:     "worker_sessions",
  PROMETHEUS_ANALYSIS: "prometheus_analysis",
  ATHENA_POSTMORTEMS:  "athena_postmortems"
});

// ── Migration result reason codes ─────────────────────────────────────────────

/**
 * Reason codes returned by migrateData.
 * Callers must inspect this field; silent fallback is not allowed.
 *
 * @enum {string}
 */
export const MIGRATION_REASON = Object.freeze({
  /** Migration succeeded — data was at v0 and has been migrated to v1. */
  OK: "OK",
  /** No migration needed — data is already at CURRENT_SCHEMA_VERSION. */
  ALREADY_CURRENT: "ALREADY_CURRENT",
  /** schemaVersion is present but exceeds CURRENT_SCHEMA_VERSION — fail closed. */
  UNKNOWN_FUTURE_VERSION: "UNKNOWN_FUTURE_VERSION",
  /** fileType is not a known STATE_FILE_TYPE value. */
  UNSUPPORTED_TYPE: "UNSUPPORTED_TYPE",
  /** Data structure is incompatible with the declared (or detected) version. */
  INVALID_DATA: "INVALID_DATA"
});

/** File name for migration telemetry log within the state directory. */
export const MIGRATION_LOG_FILE = "schema_migration_log.json";

/** Maximum telemetry log entries retained (oldest entries pruned first). */
const MIGRATION_LOG_MAX_ENTRIES = 500;

// ── Version detection ─────────────────────────────────────────────────────────

/**
 * Detect the schemaVersion of a parsed state value.
 *
 * Rules:
 *   - Array input               → SCHEMA_VERSION.LEGACY (athena_postmortems v0)
 *   - Object without field      → SCHEMA_VERSION.LEGACY
 *   - Object with integer field → that integer value
 *   - Object with non-integer   → null (undetectable / corrupt)
 *   - null / non-object         → null
 *
 * @param {any} data
 * @returns {number|null}
 */
export function detectVersion(data) {
  if (Array.isArray(data)) return SCHEMA_VERSION.LEGACY;
  if (!data || typeof data !== "object") return null;
  if (!("schemaVersion" in data)) return SCHEMA_VERSION.LEGACY;
  const v = data.schemaVersion;
  if (typeof v === "number" && Number.isInteger(v) && v >= 0) return v;
  return null; // non-integer schemaVersion is corrupt / undetectable
}

// ── v0 → v1 schema migrations ─────────────────────────────────────────────────

/**
 * Internal: apply v0 → v1 migration for a specific file type.
 *
 * @param {any} data
 * @param {string} fileType - STATE_FILE_TYPE value
 * @returns {{ ok: boolean, data: any, reason: string }}
 */
function migrateV0ToV1(data, fileType) {
  switch (fileType) {
    case STATE_FILE_TYPE.WORKER_SESSIONS:
      if (!data || typeof data !== "object" || Array.isArray(data)) {
        return { ok: false, data: null, reason: MIGRATION_REASON.INVALID_DATA };
      }
      // Add schemaVersion at root; all existing role-keyed entries remain.
      return { ok: true, data: { schemaVersion: SCHEMA_VERSION.V1, ...data }, reason: MIGRATION_REASON.OK };

    case STATE_FILE_TYPE.PROMETHEUS_ANALYSIS:
      if (!data || typeof data !== "object" || Array.isArray(data)) {
        return { ok: false, data: null, reason: MIGRATION_REASON.INVALID_DATA };
      }
      // Add schemaVersion at root; all existing analysis fields remain.
      return { ok: true, data: { schemaVersion: SCHEMA_VERSION.V1, ...data }, reason: MIGRATION_REASON.OK };

    case STATE_FILE_TYPE.ATHENA_POSTMORTEMS:
      if (!Array.isArray(data)) {
        return { ok: false, data: null, reason: MIGRATION_REASON.INVALID_DATA };
      }
      // Wrap array in object envelope with schemaVersion.
      return { ok: true, data: { schemaVersion: SCHEMA_VERSION.V1, entries: data }, reason: MIGRATION_REASON.OK };

    default:
      return { ok: false, data: null, reason: MIGRATION_REASON.UNSUPPORTED_TYPE };
  }
}

// ── Public migration API ──────────────────────────────────────────────────────

/**
 * Migrate parsed state data from its detected version to CURRENT_SCHEMA_VERSION.
 *
 * Fail-closed contract:
 *   - Unknown future versions (schemaVersion > CURRENT) → ok=false, reason=UNKNOWN_FUTURE_VERSION
 *   - Undetectable / corrupt schemaVersion value         → ok=false, reason=INVALID_DATA
 *   - Unsupported fileType                               → ok=false, reason=UNSUPPORTED_TYPE
 *   - Data incompatible with declared version            → ok=false, reason=INVALID_DATA
 *   - Already at current version                         → ok=true,  reason=ALREADY_CURRENT
 *   - Successfully migrated                              → ok=true,  reason=OK
 *
 * @param {any} data - parsed JSON value
 * @param {string} fileType - STATE_FILE_TYPE value
 * @returns {{ ok: boolean, data: any, fromVersion: number|null, toVersion: number, reason: string }}
 */
export function migrateData(data, fileType) {
  const fromVersion = detectVersion(data);

  // Undetectable / corrupt schemaVersion
  if (fromVersion === null) {
    return {
      ok: false, data: null,
      fromVersion: null, toVersion: CURRENT_SCHEMA_VERSION,
      reason: MIGRATION_REASON.INVALID_DATA
    };
  }

  // Future unknown version — fail closed with explicit warning
  if (fromVersion > CURRENT_SCHEMA_VERSION) {
    return {
      ok: false, data: null,
      fromVersion, toVersion: CURRENT_SCHEMA_VERSION,
      reason: MIGRATION_REASON.UNKNOWN_FUTURE_VERSION
    };
  }

  // Already at current version — no migration needed
  if (fromVersion === CURRENT_SCHEMA_VERSION) {
    return {
      ok: true, data,
      fromVersion, toVersion: CURRENT_SCHEMA_VERSION,
      reason: MIGRATION_REASON.ALREADY_CURRENT
    };
  }

  // v0 → v1
  if (fromVersion === SCHEMA_VERSION.LEGACY) {
    const result = migrateV0ToV1(data, fileType);
    return {
      ok: result.ok, data: result.data,
      fromVersion, toVersion: CURRENT_SCHEMA_VERSION,
      reason: result.reason
    };
  }

  // Intermediate versions not yet defined (would be vN → vN+1 chains)
  return {
    ok: false, data: null,
    fromVersion, toVersion: CURRENT_SCHEMA_VERSION,
    reason: MIGRATION_REASON.UNSUPPORTED_TYPE
  };
}

/**
 * Stamp a data object with the current schema version for writing.
 *
 * For athena_postmortems: wraps an array in { schemaVersion, entries }.
 * For all other file types: adds schemaVersion at root (spread).
 *
 * @param {any} data - the value to write (object or array depending on fileType)
 * @param {string} fileType - STATE_FILE_TYPE value
 * @returns {object} - versioned object ready to pass to writeJson
 */
export function addSchemaVersion(data, fileType) {
  if (fileType === STATE_FILE_TYPE.ATHENA_POSTMORTEMS) {
    const entries = Array.isArray(data)
      ? data
      : (Array.isArray(data?.entries) ? data.entries : []);
    return { schemaVersion: CURRENT_SCHEMA_VERSION, entries };
  }
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return { schemaVersion: CURRENT_SCHEMA_VERSION, ...data };
  }
  return data;
}

/**
 * Extract the postmortem entries array from a raw read value.
 *
 * Handles both v0 (array) and v1 ({ schemaVersion, entries }) transparently.
 * Returns an empty array on unrecognized input.
 *
 * @param {any} raw - value returned by readJson for athena_postmortems.json
 * @returns {Array}
 */
export function extractPostmortemEntries(raw) {
  if (Array.isArray(raw)) return raw;                         // v0 legacy
  if (raw?.entries && Array.isArray(raw.entries)) return raw.entries; // v1
  return [];
}

// ── Migration telemetry ───────────────────────────────────────────────────────

/**
 * Record a schema migration event to state/schema_migration_log.json.
 *
 * Telemetry record schema:
 *   {
 *     timestamp:   string (ISO 8601),
 *     fileType:    string (STATE_FILE_TYPE value),
 *     filePath:    string,
 *     fromVersion: number | null,
 *     toVersion:   number,
 *     success:     boolean,
 *     reason:      string (MIGRATION_REASON value)
 *   }
 *
 * Never throws — telemetry failure is logged to stderr but never propagates.
 *
 * @param {string} stateDir
 * @param {{ fileType, filePath, fromVersion, toVersion, success, reason }} event
 */
export async function recordMigrationTelemetry(stateDir, event) {
  const logPath = path.join(stateDir, MIGRATION_LOG_FILE);
  const record = {
    timestamp:   new Date().toISOString(),
    fileType:    event.fileType,
    filePath:    event.filePath,
    fromVersion: event.fromVersion ?? null,
    toVersion:   event.toVersion,
    success:     Boolean(event.success),
    reason:      event.reason
  };

  try {
    let entries = [];
    try {
      const raw = await fs.readFile(logPath, "utf8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) entries = parsed;
    } catch {
      // Missing or corrupt log — start fresh
    }
    entries.push(record);
    if (entries.length > MIGRATION_LOG_MAX_ENTRIES) {
      entries = entries.slice(entries.length - MIGRATION_LOG_MAX_ENTRIES);
    }
    await fs.mkdir(path.dirname(logPath), { recursive: true });
    await fs.writeFile(logPath, `${JSON.stringify(entries, null, 2)}\n`, "utf8");
  } catch (err) {
    console.error(`[schema_registry] telemetry write failed: ${String(err?.message || err)}`);
  }
}

```

### FILE: src/dashboard/auth.ts
```typescript
import crypto from "node:crypto";
import type http from "node:http";

interface AuthSuccess { ok: true }
interface AuthFailure { ok: false; status: number; error: string }

/**
 * Verify a Bearer token from the Authorization header using a timing-safe comparison.
 * Returns an object describing the auth result.
 */
export function checkDashboardAuth(authHeader: string | undefined): AuthSuccess | AuthFailure {
  // Read token lazily — allows env injection in tests and avoids caching a secret in memory longer than needed.
  const token = process.env.BOX_DASHBOARD_TOKEN?.trim() || "";

  // Fail-safe: if operator did not configure a token, mutations must be blocked.
  if (!token) {
    return { ok: false, status: 403, error: "Dashboard auth token not configured — set BOX_DASHBOARD_TOKEN" };
  }

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const provided = authHeader.slice(7); // strip "Bearer "
  if (!provided) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  // Constant-time comparison to prevent timing attacks.
  // Pad both buffers to equal length before comparison.
  const tokenBuf = Buffer.from(token, "utf8");
  const providedBuf = Buffer.from(provided, "utf8");

  if (tokenBuf.length !== providedBuf.length) {
    // Lengths differ — do a dummy comparison to keep timing consistent, then reject.
    crypto.timingSafeEqual(tokenBuf, tokenBuf);
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  if (!crypto.timingSafeEqual(tokenBuf, providedBuf)) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  return { ok: true };
}

/**
 * Enforce Bearer token auth on a mutation request.
 * Writes a JSON error response and returns false if the request is not authorized.
 * Returns true if the caller should proceed.
 */
export function requireDashboardAuth(req: http.IncomingMessage, res: http.ServerResponse): boolean {
  const result = checkDashboardAuth(req.headers["authorization"]);
  if (!result.ok) {
    const fail = result as AuthFailure;
    res.writeHead(fail.status, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ ok: false, error: fail.error }));
    return false;
  }
  return true;
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