# AI Agent Framework Manifest (AI_AGENT_CONTEXT)

This file provide comprehensive context to AI Agents regarding the Playwright-TS-BDD framework architecture, patterns, and component registry.

> [!IMPORTANT]
> **To the AI Agent**: Read this file entirely to understand how to contribute to this project without breaking framework patterns.

## 🏗️ Framework Architecture & Roles

- **Core Layer (`src/core/`)**: Immutable framework logic. Do NOT modify unless specifically asked to update framework features.
- **Page Layer (`src/pages/`)**: Contains Page Object Model (POM) classes. MUST extend `SelfHealingBasePage`.
- **Step Layer (`src/steps/`)**: Maps Gherkin to POM methods. MUST use `testContextStorage.enterWith(this)`.
- **Feature Layer (`features/`)**: Gherkin business logic.

## 🩺 Self-Healing Standards

- **Preferred Actions**: Use `this.clickHealed()`, `this.fillHealed()`, `this.getTextHealed()`.
- **Locator Keys**: Logical names MUST be defined in `resources/locators.json`.
- **Schema**: Refer to `resources/locators.schema.json` for valid locator metadata.

## � Component Registry (Map)

### Page Objects
- `DemoPage` ([src/pages/DemoPage.ts](file:///c:/Users/Dell/Playwright-TS-BDD-main/src/pages/DemoPage.ts)): Main interactive demo page with React/Angular support.

### Step Definitions
- `demo-healing.steps.ts` ([src/steps/demo-healing.steps.ts](file:///c:/Users/Dell/Playwright-TS-BDD-main/src/steps/demo-healing.steps.ts)): Core demo steps.
- `mixed.steps.ts` ([src/steps/mixed.steps.ts](file:///c:/Users/Dell/Playwright-TS-BDD-main/src/steps/mixed.steps.ts)): API and UI integration steps.

### Test Data & Locators
- `locators.json` ([resources/locators.json](file:///c:/Users/Dell/Playwright-TS-BDD-main/resources/locators.json)): The source of truth for self-healing metadata.

## 📝 Agent Instructions for Generating Code

1.  **POM Updates**: Always check if a logical name already exists in `locators.json` before adding a new one.
2.  **JSDoc**: Annotate POM methods with `@step` to document Gherkin mappings.
3.  **Error Handling**: Wrap healing-dependent actions in descriptive logging.
4.  **Imports**: Use relative paths. Base modules are in `../core/...`.
5.  **Manifest Maintenance**: Whenever you create a file that does NOT follow the patterns above, you MUST add it to the **Critical System Nodes** section in this file.

## 🔄 Self-Maintenance (Agent Only)

As an AI Agent, you are responsible for keeping this manifest accurate. 
- **On New Exception**: If you create a file that does NOT follow the patterns above, add it to **Critical System Nodes**.
- **On Pattern Shift**: Update the table if you reorganize the folder structure.

## 🎯 Implementation Prompt Template (For User)

"Using the manifest in `AI_PROMPT_GUIDE.md`, create a new [Feature/Scenario] for [Component]. Ensure you update the POM in `src/pages/` and the Steps in `src/steps/` following the Self-Healing patterns."
