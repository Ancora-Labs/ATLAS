# ATLAS single-target extraction map

| Concern | Source of truth | Dedicated ATLAS module | Result |
| --- | --- | --- | --- |
| Worker session normalization | `src/atlas/state_bridge.ts` | `src/atlas/routes/home.ts` | The Home route consumes normalized session DTOs rather than dashboard-only shapes. |
| Home surface rendering | Dedicated ATLAS renderer contract | `src/atlas/renderer.ts` | Product shell copy uses Windows-first session-control language. |
| Sessions surface rendering | Dedicated ATLAS renderer contract | `src/atlas/renderer.ts` | Session inspection remains additive and detached from dashboard identity. |

## Boundaries

1. The dedicated ATLAS surface targets a single workspace and a Windows launcher flow.
2. The renderer contract is pure and reusable by a future dedicated server with `/` and `/sessions`.
3. The extraction keeps dashboard HTML out of the new surface so branding and navigation do not drift back together.
