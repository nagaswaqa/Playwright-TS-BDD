---
name: ado-mcp
description: Azure DevOps MCP guidance for pipeline integration.
---

# ADO MCP Skill

Use this skill when wiring Azure DevOps Pipelines around the framework.

## Recommended pipeline outline

1. Node.js agent.
2. `npm ci` to restore packages.
3. `npx playwright install` for browser binaries.
4. `npx bddgen` to regenerate specs.
5. `npx playwright test` to run.
6. Publish `reports/html-report` and `healing-logs/` as artifacts.

No pipeline YAML is committed yet. When one is added, place it under `.azure-pipelines/` and link from [`docs/RUNNING.md`](../../../docs/RUNNING.md).
