Ground the task in this ATLAS product intent before proposing or implementing anything.

Intent:
- Build ATLAS as a dedicated Windows-first desktop GUI.
- The purpose is to make the system easier and more comfortable for users to operate.
- The interface should feel modern, polished, and intentionally designed.
- Meaningful animation and refined visual quality are part of the requirement, not an optional afterthought.

Non-negotiable boundaries:
- Do not satisfy this by adding a browser route.
- Do not satisfy this by opening localhost in the browser as the primary experience.
- Do not satisfy this with a cmd or terminal-first flow.
- Do not turn the existing dashboard into the main ATLAS shell.

Allowed reuse:
- backend/runtime/state logic
- useful existing internal interaction patterns when they support the new product
- implementation details that help the desktop GUI ship safely

When planning or reviewing, preserve the requested product class exactly.
If a proposal would reasonably be described as a web dashboard or terminal wrapper, reject it and restate the desktop GUI requirement.