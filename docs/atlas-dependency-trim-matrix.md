# ATLAS dependency trim matrix

| Area | Kept dependency | Trimmed dependency | Reason |
| --- | --- | --- | --- |
| Home route data loading | `src/core/pipeline_progress.ts` | `src/dashboard/live_dashboard.ts` | The route needs authoritative pipeline state, not dashboard orchestration. |
| HTML rendering | `src/atlas/state_bridge.ts` DTOs | Dashboard summary wrappers | The renderer consumes normalized session DTOs directly. |
| Future sessions routing | `src/atlas/renderer.ts` | Dashboard page identity | The same shell can render `/` and `/sessions` without linking back to mission-control framing. |

## Drift guard summary

| Guard | Outcome |
| --- | --- |
| Renderer contract | `renderAtlasHomeHtml()` and `renderAtlasSessionsHtml()` both accept `AtlasPageData`. |
| No dashboard coupling | New ATLAS modules do not import dashboard files. |
| Lane diversity | UI work is isolated under `src/atlas/` and `tests/atlas/`. |
| `fs_utils.js` drift | No direct dependency added in the new renderer path. |
