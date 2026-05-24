/**
 * Stage 3 of the recording pipeline (`automation-agent`).
 *
 * Runs only after the operator has reviewed the generated `.feature` file and
 * said `automate it`. Generates / updates the supporting Page Object under
 * `src/pages/` and appends any missing logical-locator entries to
 * `resources/locators.json`.
 *
 * Splitting this from `convert-recording-to-feature.js` keeps `src/pages/` and
 * `resources/locators.json` clean during feature review — they are only
 * touched once the operator approves the recorded flow.
 *
 * Usage:
 *   node scripts/generate-pom-and-locators.js <normalized-recording.json>
 */

const fs = require('fs');
const path = require('path');

const inputPath = process.argv[2];
if (!inputPath) {
    console.error('Usage: node scripts/generate-pom-and-locators.js <normalized-recording.json>');
    process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), inputPath), 'utf8'));
const actions = raw.actions || [];

if (!actions.length) {
    console.warn('[generate-pom-and-locators] No actions in recording; nothing to generate.');
    process.exit(0);
}

// ── Locator repository updates ──────────────────────────────────────────────
// The TypeScript LocatorRepository can't be required from a Node script, so
// we touch resources/locators.json directly. The shape is documented in
// resources/locators.schema.json and matches LocatorRepository's behaviour.
const locatorsPath = path.resolve(__dirname, '../resources/locators.json');
const locatorsDir = path.dirname(locatorsPath);
if (!fs.existsSync(locatorsDir)) {
    fs.mkdirSync(locatorsDir, { recursive: true });
}
const locators = fs.existsSync(locatorsPath)
    ? JSON.parse(fs.readFileSync(locatorsPath, 'utf8'))
    : {};

function nameFromSelector(selector) {
    return selector.replace(/[^a-zA-Z0-9]/g, '_').replace(/^_+|_+$/g, '');
}

let locatorsAdded = 0;
actions.forEach((action) => {
    const sel = (action.selector || '').trim();
    if (!sel) return;
    const logicalName = nameFromSelector(sel);
    if (!locators[logicalName]) {
        locators[logicalName] = {
            name: logicalName,
            selector: sel,
            description: 'Auto‑generated locator from recording',
        };
        locatorsAdded += 1;
    }
});

if (locatorsAdded > 0) {
    fs.writeFileSync(locatorsPath, JSON.stringify(locators, null, 4), 'utf8');
}

// ── POM generation ──────────────────────────────────────────────────────────
function inferPageName(url) {
    if (!url) return 'DemoPage';
    const match = url.match(/([^\\/]+)\.html$/i);
    if (match) {
        const base = match[1];
        return base.charAt(0).toUpperCase() + base.slice(1) + 'Page';
    }
    return 'DemoPage';
}

function generateMethodForAction(className, action) {
    const selector = (action.selector || '').trim();
    if (!selector) return null;
    const logicalName = nameFromSelector(selector);
    const lc = selector.toLowerCase();
    let methodName = null;

    if (action.type === 'click') {
        if (lc.includes('login')) methodName = 'clickLoginButtonWithHealing';
        else if (lc.includes('username')) methodName = 'clickUsernameInput';
        else methodName = 'clickElementWithHealing';
    } else if (action.type === 'input' || action.type === 'change') {
        if (lc.includes('username')) methodName = 'enterUsername';
        else methodName = 'fillElement';
    }

    if (!methodName) return null;

    if (action.type === 'click') {
        return `  async ${methodName}(): Promise<void> {
    await this.clickHealed('${logicalName}', ${className}.selectors.${logicalName});
  }`;
    }
    if (action.type === 'input' || action.type === 'change') {
        const param = action.value ? 'value: string' : '';
        const val = action.value ? 'value' : '""';
        return `  async ${methodName}(${param}): Promise<void> {
    await this.page.fill(${className}.selectors.${logicalName}, ${val});
  }`;
    }
    return null;
}

function generateOrUpdatePageClass(targetPath, className, actionList) {
    const selectorsMap = {};
    actionList.forEach((a) => {
        const sel = (a.selector || '').trim();
        if (sel) {
            const key = nameFromSelector(sel);
            selectorsMap[key] = sel;
        }
    });

    const selectorLines = Object.entries(selectorsMap)
        .map(([name, sel]) => `  ${name}: '${sel}',`)
        .join('\n');

    const methodLines = actionList
        .map((a) => generateMethodForAction(className, a))
        .filter(Boolean)
        .join('\n\n');

    const classContent = `import { SelfHealingBasePage } from '../core/base/SelfHealingBasePage';
import { globalHealingEngine } from '../core/healing/HealingUtils';
import { testContext } from '../core/support/test-context';
import * as path from 'path';

export class ${className} extends SelfHealingBasePage {
  constructor() {
    super(testContext.page!, globalHealingEngine!);
  }

  private static selectors = {
${selectorLines}
  };

  async navigate() {
    const demoPath = path.resolve(__dirname, '../../demoa_appication/demo.html');
    await this.navigateTo('file://' + demoPath);
  }

${methodLines}
}
`;

    fs.writeFileSync(targetPath, classContent, 'utf8');
    console.log('[generate-pom-and-locators] Page class written:', targetPath);
}

const pageName = inferPageName(raw.metadata?.url);
const pagesDir = path.resolve(__dirname, '../src/pages');
if (!fs.existsSync(pagesDir)) {
    fs.mkdirSync(pagesDir, { recursive: true });
}
const pageFile = path.resolve(pagesDir, `${pageName}.ts`);
generateOrUpdatePageClass(pageFile, pageName, actions);

console.log(
    `[generate-pom-and-locators] Locators appended: ${locatorsAdded} (existing entries left untouched).`,
);
console.log(
    '[generate-pom-and-locators] Done. Review the generated POM, register it in docs/COMPONENTS.md if you keep it, then run `npx bddgen && npx playwright test`.',
);
