# LibreChat Shared Runtime Boundary

This directory is the stable integration boundary for the LibreChat-derived runtime. The full upstream product source is intentionally not vendored into the Rhiza product repository.

Locked upstream:

- Version: `v0.8.7`
- Commit: `9e74cc0e57b395926122bd4062c1fcedc48ed465`
- Git baseline branch: `librechat-v0.8.7`
- Integration branch: `codex/rhiza-librechat-runtime`

`server/librechat-shared.ts` adapts the exact `librechat-data-provider@0.8.509` package into Rhiza model specs, endpoint file capabilities and role-based agent messages. `server/provider-runtime.ts` remains the only execution path and uses the user's current Provider Catalog/API keys.

No separate LibreChat deployment, URL or token is required. Full `@librechat/agents` integration is deferred because the matching package currently requires Node.js 24 while this project runs on Node.js 22.

The following upstream areas were used for the initial mapping:

- `packages/data-provider/src/models.ts`: model-spec schema
- `packages/data-provider/src/file-config.ts`: endpoint file capabilities
- `api/app/clients/prompts/formatMessages.js`: non-LangChain message ordering

Do not copy the upstream UI, Admin Panel, Sandpack/Nodebox chain or product legal templates into this boundary.
