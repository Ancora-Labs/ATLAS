Use this prompt when a developer wants the AI to answer a live BOX onboarding session on the developer's behalf without changing runtime behavior, agent definitions, or system structure.

Goal:
- Continue the already-open onboarding conversation through the real live surface.
- Let the onboarding agent ask its own questions and approve completion itself.
- Keep the existing session, runtime path, and agent behavior intact.

Operating mode:
- Treat this as a developer-operated live-answering task, not a product-code task.
- The primary problem is to reach the live onboarding conversation correctly and answer it turn by turn.
- Prefer the visible terminal session that is already hosting the onboarding conversation.

Required approach:
1. Identify the active target session and confirm which onboarding conversation is actually live.
2. Find the visible terminal that is rendering that live onboarding agent conversation.
3. Read the current prompt from that terminal before sending anything.
4. Answer exactly one turn at a time.
5. After each answer, read the next rendered prompt before deciding the next answer.
6. If the prompt is a menu, send only the needed menu choice.
7. If the prompt is free text, send only the answer for that one question.
8. Once the agent starts emitting the final `===DECISION=== ... ===END===` block, stop sending answers and only observe until it completes.
9. Exit the live chat cleanly only after the decision block is fully finished, so the real wrapper can write transcript and done-flag artifacts itself.

Hard rules:
- Do not create a synthetic clarification packet.
- Do not prefill or patch transcript files, done-flag files, or intent packet files.
- Do not switch to `-p` or any non-interactive shortcut just because terminal control is inconvenient.
- Do not open a replacement session if the real live onboarding session already exists.
- Do not restart onboarding unless the developer explicitly asks for a restart.
- Do not modify onboarding runtime code, agent profiles, hooks, or instructions as part of answering the session.
- Do not bulk-send multiple answers at once.
- Do not guess the next question from memory when the actual terminal output has not been read yet.
- Do not pivot to detached-window key injection, process-title tricks, or packet synthesis if a visible terminal can be targeted directly.

If control becomes ambiguous:
- Prefer reading the foreground visible terminal again.
- If the drafted text is sitting in the input box, submit only that one answer and then re-read.
- If the wrong answer is drafted for the current question, clear or replace that draft in the same live terminal instead of opening a new path.
- If you cannot reach the live visible terminal at all, stop and report that exact blocker. Do not improvise with synthetic completion.

Success condition:
- The real onboarding agent completes its own clarification flow.
- The final decision block is emitted by that live agent session.
- The existing session advances naturally through the normal BOX onboarding completion path.

Output style while working:
- Keep status updates short.
- State which live terminal you are targeting.
- State what the current rendered question is.
- State the single answer you are about to send.
- After each submission, state what the next rendered question became.