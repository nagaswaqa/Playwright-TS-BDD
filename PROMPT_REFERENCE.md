# Future Reference: API Simulator Prompt

Use this document as a "cheat sheet" when you want to expand the framework with a new API-based scenario.

## 🎯 The Prompt

Copy and paste the block below into your AI assistant:

---

**Prompt:**
> "Using the patterns in `AI_PROMPT_GUIDE.md`, add a new BDD scenario for the **API Simulator** in `demo.html`.
> 
> 1. **Feature**: Create `features/api_simulator.feature` with a scenario 'Verify custom field updates from API response'.
> 2. **POM**: Update `DemoPage.ts` with selectors for the 'API Tab' (`#tab-api`) and the 'Custom Field' (`#custom-api-data`). Use `clickHealed` for the tab.
> 3. **Steps**: Implement the steps in a new file `src/steps/api-demo.steps.ts`.
>
> **The Flow**: Navigate to demo -> Click API Tab -> Wait for API load -> Verify the 'Custom Field' contains 'User: Antigravity'.
> 
> Finally, update the **Critical System Nodes** in `AI_PROMPT_GUIDE.md` with the new step file."

