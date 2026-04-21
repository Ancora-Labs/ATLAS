# ATLAS direct import matrix

| Module | Direct imports | Purpose |
| --- | --- | --- |
| `src/atlas/renderer.ts` | `src/atlas/state_bridge.ts` (type only) | Pure HTML renderers for the dedicated Home and Sessions surfaces. |
| `src/atlas/routes/home.ts` | `src/atlas/renderer.ts`, `src/atlas/state_bridge.ts`, `src/core/pipeline_progress.ts` | Builds `AtlasPageData` from worker session state and returns ATLAS Home HTML. |

## Normalization notes

| Rule | Status |
| --- | --- |
| Dashboard modules are not imported by the dedicated ATLAS renderer path. | Yes |
| `fs_utils.js` is not imported directly by the ATLAS route or renderer. | Yes |
| The route reads state through `readPipelineProgress()` and `worker_sessions.json` only. | Yes |
