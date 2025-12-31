# Playwright BDD Enterprise Framework

Enterprise-grade testing framework with Playwright, TypeScript, and Cucumber.

## Installation

```bash
npm install
```

## Running Tests

### 1. Run All Tests
```bash
npm test
```

### 2. Run Tests by Tags
Run scenarios annotated with specific tags (e.g., `@smoke`, `@regression`, `@ui`).
```bash
npx playwright test --grep "@smoke"
npx playwright test --grep "@regression"
```

### 3. Run with Specific Environment
Default is `dev`. You can switch environments using the `ENV` variable.

**Bash (Git Bash, Mac, Linux):**
```bash
# Run against QA
ENV=qa npm test

# Run against Specific File
ENV=aptl-z1-002.dev npm test
```

**PowerShell (Windows):**
```powershell
# Run against QA
$env:ENV="qa"; npm test

# Run against Specific File
$env:ENV="aptl-z1-002.dev"; npm test
```

### 4. Configuration Overrides
You can override the defaults set in `src/config/testConfig.ts` via command line variables.

**Common Variables:**
- `ENV`: Environment to load (default: `dev`)
- `BROWSER_NAME`: Browser to run on (default: `chromium`)
- `HEADLESS`: `true` for invisible, `false` to see browser (default: `true`)
- `WORKERS`: Number of parallel workers (default: `undefined`/Auto)

**Examples (Bash):**
```bash
# Run on Firefox, Headed (Visible), with 2 workers
BROWSER_NAME=firefox HEADLESS=false WORKERS=2 npm test

# Run Smoke tests on QA environment
ENV=qa npx playwright test --grep "@smoke"
```

**Examples (PowerShell):**
```powershell
# Run on Firefox, Headed (Visible), with 2 workers
$env:BROWSER_NAME="firefox"; $env:HEADLESS="false"; $env:WORKERS="2"; npm test

# Run Smoke tests on QA environment
$env:ENV="qa"; npx playwright test --grep "@smoke"
```

## Key Files

- `src/config/testConfig.ts`: **Master Configuration File**. Set defaults here.
- `src/support/test-context.ts`: Test Context implementation.
- `src/api/RestApiClient.ts`: REST API utility.
- `src/pages/BasePage.ts`: UI Base class.
- `src/steps/steps.ts`: Step definitions.
- `src/support/hooks.ts`: Test hooks.
- `playwright.config.ts`: Playwright configuration.
- `features/*.feature`: Feature files.

