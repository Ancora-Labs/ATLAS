# UI Contract System Opus 4.7 Output Format

Use this exact response structure when finishing the UI contract-system
implementation pass.
The goal is to force a concrete implementation report instead of a vague design
essay.

## Required Response Shape

Return one Markdown response with these sections in this order.

### 1. Outcome

State in 3 to 6 lines:

- whether the contract-system pass is complete
- whether the deliverable stayed focused on UI control structure instead of UI
  redesign
- whether a repair pass was needed
- whether focused validation passed

### 2. System Slice

Describe the exact MVP slice you implemented.
State what is now real in code and what is still intentionally out of scope.

### 3. Files Changed

List the exact files you created or modified.
For each file, give one sentence explaining its responsibility.

### 4. Contract Layer

Describe the machine-readable design contract or schema you implemented.
Must explicitly cover the core fields or field groups.

### 5. Scenario Layer

Describe how deterministic scenarios or fixtures are represented.
Name the concrete scenarios you added or supported.

### 6. Adapter Layer

Explain the surface adapter structure.
Must say whether the adapter is:

- real
- mocked
- partially implemented

### 7. Evidence And Verdict Layer

Explain how evidence is collected and how the judge output or verdict is
represented.
Must explicitly mention which evidence classes are supported now:

- visual
- structural
- behavioral
- accessibility

### 8. Loop Control

Explain how the bounded repair or iteration loop is represented.
Must explicitly mention stop conditions, retry limits, or escalation behavior if
implemented.

### 9. Verification

List every focused verification command you ran.
For each one, report:

- command
- pass or fail
- what it proved

### 10. Repair Pass

If the first implementation pass was insufficient, explain:

- what was still wrong
- what you changed in the repair pass
- what check proved the repair worked

If no repair pass was needed, state `No repair pass needed` and explain why.

### 11. Remaining Gaps

List only real intentional gaps or risks.
Do not inflate future work.

## Required Ending Block

End the response with this exact machine-readable block shape:

```text
UI_CONTRACT_SYSTEM_STATUS=done|partial|blocked
UI_CONTRACT_SYSTEM_SCOPE=contract-control|drifted
UI_CONTRACT_SYSTEM_REPAIR_PASS=yes|no
UI_CONTRACT_SYSTEM_TESTS=pass|fail|partial
UI_CONTRACT_SYSTEM_BUILD=pass|fail|not-run
UI_CONTRACT_SYSTEM_ADAPTER=real|mocked|partial|none
UI_CONTRACT_SYSTEM_CONTRACT_LAYER=<path>
UI_CONTRACT_SYSTEM_SCENARIO_LAYER=<path>
UI_CONTRACT_SYSTEM_ADAPTER_LAYER=<path>
UI_CONTRACT_SYSTEM_VERDICT_LAYER=<path>
UI_CONTRACT_SYSTEM_FILES=<comma-separated paths>
UI_CONTRACT_SYSTEM_VERIFICATION_COMMANDS=<semicolon-separated commands>
UI_CONTRACT_SYSTEM_NOTES=<short summary>
```

## Forbidden Response Patterns

Do not return any of the following:

- a plan without implementation
- an ATLAS UI redesign summary pretending that the system layer was built
- a generic architecture essay without file-level changes
- a "looks good" claim without executable validation
- a response that says tests passed without naming them

## Minimal Quality Bar For The Response

The response should make it possible for a reviewer to answer these questions
quickly:

- Did the model build UI contract/control structure instead of chasing the UI
  symptom directly?
- Is there a real machine-readable contract layer?
- Is there a real scenario or fixture layer?
- Is there a real adapter and verdict path, even if narrow?
- Is there bounded-loop thinking in the implementation?
- What exact files now own the slice?
