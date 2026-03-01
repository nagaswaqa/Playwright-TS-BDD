# 📚 Playwright‑TS‑BDD Framework Overview

This document combines the interactive **Mermaid map** and a plain‑text **ASCII tree** so it works in any markdown viewer (GitHub, VS Code, slide decks, etc.).

---

## �️ Interactive Mermaid Diagram

```mermaid
graph LR
    Root[Playwright‑TS‑BDD]
    Root --> Features[features/]
    Root --> Src[src/]
    Root --> Resources[resources/]
    Root --> Config[Configuration]

    subgraph FeatureLayer["📝 Test Requirements (Gherkin)"]
        Features --> F1[demo_healing.feature]
        Features --> F2[angular_users.feature]
    end

    subgraph LogicLayer["⚙️ Implementation (TypeScript)"]
        Src --> Steps[steps/]
        Src --> Pages[pages/]
        Src --> Core[core/]
        Steps --> S1[demo‑healing.steps.ts]
        Pages --> P1[DemoPage.ts]
        Core --> C1[Healing Engine]
        Core --> C2[Base Classes]
        Core --> C3[BDD Support]
    end

    subgraph AssetLayer["💎 Intelligence & Metadata"]
        Resources --> R1[locators.json]
        Resources --> R2[locators.schema.json]
        Resources --> R3[Visual Templates]
    end

    style Core fill:#ffcc99,stroke:#333,stroke-width:2px
    style HealingEngine fill:#bbf,stroke:#333,stroke-width:2px
    style FeatureLayer fill:#f9f,stroke:#333,stroke-width:1px
    style LogicLayer fill:#dfd,stroke:#333,stroke-width:1px
```

---

## � ASCII Tree (fallback when Mermaid isn’t rendered)

```
Playwright‑TS‑BDD
├─ features/
│  ├─ demo_healing.feature
│  └─ angular_users.feature
├─ src/
│  ├─ steps/
│  │  └─ demo‑healing.steps.ts
│  ├─ pages/
│  │  └─ DemoPage.ts
│  └─ core/
│     ├─ Healing Engine
│     ├─ Base Classes
│     └─ BDD Support
├─ resources/
│  ├─ locators.json
│  ├─ locators.schema.json
│  └─ Visual Templates
└─ Configuration (git, jest, playwright configs)
```

---

## �🚀 Execution Flow (Self‑Exploratory Path)
1. **Define** – Write a `.feature` file in `features/`.
2. **Generate** – Run `npx bddgen` to produce Playwright specs.
3. **Implement** – Add selectors in `src/pages/` (POM) and map steps in `src/steps/`.
4. **Execute** – Run `npx playwright test`. The **Healing Engine** automatically attempts recovery (DOM → Text → OCR) if a locator fails.
5. **Audit** – Review `reports/` for test results and the Healing Audit Log.

---

## 🧠 AI Integration
- **AI_PROMPT_GUIDE.md** – GPS for agents: where to add new code, naming conventions, and self‑maintenance rules.
- **.github/copilot‑instructions.md** – Law that enforces clean‑code standards (use `clickHealed`, `fillHealed`, etc.).

---

*Use this file directly in documentation, slide decks, or as a quick reference for new contributors.*
