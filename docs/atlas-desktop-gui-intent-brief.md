# ATLAS Desktop GUI Intent Brief

This brief is the canonical wording for the current ATLAS target intent.
Use it when clarifying, planning, or reviewing work so the request does not collapse into a web route or terminal wrapper.

## Canonical Intent

The user wants ATLAS to become a dedicated desktop GUI.
The goal is to make the system easier and more comfortable for users to operate through a modern, polished, app-like surface.

## Required Product Class

- Windows-first desktop GUI
- separate ATLAS product identity
- session-centered operator experience
- modern visual quality with meaningful animation and polish

## Design Contract

- monochrome or restrained black-and-white is correct only when it still feels premium and product-owned
- do not use gimmicky gradients, decorative filler, or placeholder polish as a shortcut to looking premium
- do not let the result resemble the older ATLAS dashboard family, a generic internal admin panel, or a safe dark card-grid reskin
- do not copy ChatGPT or Claude literally or structurally; the target is high-end originality, not AI-product mimicry
- the UI should feel like a deliberate Windows desktop product shell with stronger hierarchy and composition than a browser dashboard

## Explicitly Not Requested

- not a browser-first surface
- not a localhost page opened in the browser as the main product
- not a cmd or terminal-first experience
- not a dashboard route added under the existing internal dashboard
- not gimmicky gradients, glow-heavy backdrops, or flashy demo styling
- not dashboard-like hero cards or overview blocks as the main ATLAS surface

## Reuse Boundary

The existing internal design language and useful runtime/state plumbing may inform the implementation.
That does not permit reusing the current dashboard shell as the primary product surface.

## Success Test

The result is correct only if a reasonable user would describe it as:
"ATLAS now has a real desktop GUI that feels modern and pleasant to use."

The result is wrong if a reasonable user would describe it as:
"It still opens in the browser" or "It is basically the old dashboard/terminal flow with nicer styling."
