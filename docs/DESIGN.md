# ATLAS Onboarding Shell Design Contract

This contract defines the non-dashboard baseline for the ATLAS onboarding shell. It applies to the dedicated onboarding experience outside `src/dashboard/**` and establishes a deterministic desktop-first visual system.

## Product stance

- **Surface:** modern black-and-white desktop shell with restrained Fluent 2-inspired polish.
- **Priority:** clarity over ornament, low visual noise, and explicit progression from first question to confirmation.
- **Viewport baseline:** desktop-first at 1440px wide; narrower layouts may stack content, but the shell should still read like a desktop application.

## Palette

Use a monochrome foundation with a single cool-neutral accent range inspired by Fluent 2 contrast behavior.

| Token | Value | Usage |
| --- | --- | --- |
| `--atlas-bg` | `#0a0a0a` | Window background |
| `--atlas-surface` | `#111111` | Primary panels |
| `--atlas-surface-raised` | `#171717` | Raised cards and tables |
| `--atlas-line` | `#262626` | Default borders and dividers |
| `--atlas-line-strong` | `#3a3a3a` | Active separators and focus-adjacent borders |
| `--atlas-text` | `#f5f5f5` | Primary content |
| `--atlas-text-muted` | `#b3b3b3` | Secondary content |
| `--atlas-accent` | `#f0f0f0` | Primary action fill on dark backgrounds |
| `--atlas-accent-text` | `#0a0a0a` | Text on accent-filled controls |
| `--atlas-focus` | `#ffffff` | Keyboard focus ring |

## Typography

- **Primary font stack:** `"Segoe UI Variable", "Segoe UI", Inter, sans-serif`
- **Code / metadata stack:** `"Cascadia Code", "SFMono-Regular", Consolas, monospace`
- **Type scale**
  - Shell title: 32-40px, semibold
  - Section title: 20-24px, semibold
  - Body: 14-16px, regular
  - Labels / eyebrow / table headers: 12px, medium, uppercase only when needed for scanability
- **Line height:** 1.4-1.5 for body copy, tighter for headings
- **Rule:** avoid decorative gradients, oversized hero copy, or saturated status colors in onboarding

## Layout and spacing

- Render the onboarding shell as a centered window with clear chrome, a single primary content column, and optional secondary context rail only when needed.
- Prefer 8px spacing increments.
- Target 720-880px readable width for the active question area.
- Only one primary decision should be visually dominant at a time.

## Focus and interaction

- Every interactive element must expose a visible 2px focus ring using `--atlas-focus`.
- Focus ring must sit outside the element edge and remain visible against dark surfaces.
- Primary actions use filled controls; secondary actions use outlined controls.
- Destructive styling is not part of onboarding baseline.
- Back navigation must remain available but visually subordinate to the current forward action.

## Question flow guidance

- Present exactly one active clarification question at a time.
- Show progress as plain language or lightweight step context rather than gamified progress bars.
- Avoid pre-filling implied confirmations. The shell must wait for explicit user approval before handoff.
- When all slots are answered, swap the question pane for a confirmation summary instead of auto-advancing.

## Skeleton and loading states

- Use rectangular skeleton blocks with 8-12px radius.
- Skeleton shimmer should be subtle grayscale only; no blue or multicolor effects.
- Reserve skeletons for the initial premium initialization call and any deterministic refresh points.
- Preserve final layout dimensions during loading to avoid content jump.

## Tables and structured review

- Tables are allowed for summary/review surfaces, not for the active question step.
- Use high-contrast headers, 44px minimum row height, and left-aligned text.
- Keep columns limited to label, current answer, and status/review metadata.
- Use muted borders and alternating elevation rather than zebra striping.
- Confirmation summaries should remain scannable without relying on color alone.

## Accessibility and tone

- Maintain WCAG-friendly contrast for all text and borders on dark surfaces.
- Do not encode required vs. incomplete state with color alone; pair it with explicit copy.
- Keep copy direct, calm, and system-like: the shell should feel trustworthy, not chatty.
