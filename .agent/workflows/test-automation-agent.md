---
description: Workflow for End-to-End Test Case Generation and Automation Agent
---

# Test Creation and Automation Agent Workflow

This workflow defines the agentic behavior for seamlessly converting a set of inputs (developer code, ADO work item, and requirements) into fully automated Playwright BDD tests. 

When instructed to run this workflow, follow these exact steps sequentially:

### 1. Source Code Context Construction
- **Action**: Fetch the latest code from the provided Development Team Git repository URL (e.g., clone to a temporary directory or pull latest). 
- **Analysis**: Review the application's source code architecture, key components, and existing functionality. 
- **Output**: Create a reference markdown document (e.g., `dev_code_reference.md`) summarizing the developer codebase for context.

### 2. ADO Work Item Extraction
- **Action**: Query the provided ADO ID (Story/Feature/Bug/Defect) using the ADO MCP.
- **Analysis**: Extract descriptions, acceptance criteria, comments, and defect reproduction steps.
- **Output**: Create a reference markdown document (e.g., `ado_reference.md`) to serve as the ground truth for what needs to be tested according to the agile board.

### 3. Business Requirements Ingestion
- **Action**: Access the provided Business Requirements link (using web scraping tools or browser sub-agents).
- **Analysis**: Read and synthesize the business rules and constraints.
- **Output**: Create a reference markdown document (e.g., `business_requirements_reference.md`).

### 4. BDD Feature Generation
- **Action**: Combine the 3 contexts (`dev_code_reference.md`, `ado_reference.md`, `business_requirements_reference.md`).
- **Generation**: Author a new standard `*.feature` Cucumber file in the `features/` directory. Target our existing step definitions wherever possible and use Gherkin best practices.
- **User Action**: Present the completed `*.feature` file to the User and explicitly ask for their review and approval. Wait for confirmation before proceeding.

### 5. Automation Implementation
- **Condition**: Only proceed to this step ONCE the User has approved the feature file.
- **Action**:
  - Run `npx bddgen` to generate test stubs if needed.
  - Implement any missing Page Object Model (POM) classes in `src/pages/`.
  - Add missing locators to `resources/locators.json` (applying our self-healing locator strategies).
  - Write robust TypeScript step definitions in `src/steps/`.
- **Validation**: Ensure there are no TypeScript compilation errors.

### 6. Test Execution and Reporting
- **Action**: Execute the newly created tests.
```bash
npx bddgen
npx playwright test
```
- **Review**: Once the execution completes, parse the results.
- **Reporting**: Automatically open the generated Playwright HTML report so the User can view the execution trace and results. 
```bash
npx playwright show-report
```
