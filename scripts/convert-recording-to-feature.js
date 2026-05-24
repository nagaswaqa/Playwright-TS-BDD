/**
 * Stage 2 of the recording pipeline (`exporter-agent`).
 *
 * Reads a normalized recording JSON and writes a Gherkin `.feature` file under
 * `features/<OperatorName>.feature`. POM and locator generation are owned by
 * `scripts/generate-pom-and-locators.js` (the third sub-agent), which the
 * operator runs only after reviewing the generated feature.
 *
 * Step generation is rules-file driven (strict by default):
 *   1. Load `resources/recorder-step-rules.json`. Each rule is `{ name, when, step }`.
 *   2. For each recorded action, iterate the rules in declaration order and
 *      use the first match. Rule templates expand tokens like {value},
 *      {formLabel}, {selector}, etc.
 *   3. If ANY action fails to match a rule, the generator refuses to write
 *      the feature and exits non-zero. The list of unmatched actions is
 *      printed so the operator can extend `resources/recorder-step-rules.json`
 *      and re-run. Pass `--allow-fallback` to opt out of strict mode and
 *      emit generic `I click the element "<css>"` / `I fill the element ... with ...`
 *      steps for unmatched actions (spike work only — fallbacks bypass
 *      self-healing because the selector is not registered in
 *      `resources/locators.json`).
 *
 * Format authority: `docs/AUTHORING/writing-features.md` describes the layout
 * this generator is expected to produce. Update that doc first, then mirror
 * the change here — never the other way around.
 *
 * Usage:
 *   node scripts/convert-recording-to-feature.js <normalized-recording.json>
 *                                                [<FeatureFileName>]
 *                                                [--force] [--allow-fallback]
 *
 * Positional `<FeatureFileName>` accepts `StudentEnquiryRecorded` or
 * `StudentEnquiryRecorded.feature`. When omitted, the generator slug-cases
 * the recording's metadata.title and suffixes `Recorded`. Pass `--force` to
 * overwrite an existing target file (default behaviour: write a timestamped
 * sibling and warn). Pass `--allow-fallback` to permit generic steps for
 * actions that no rule matched (default: refuse).
 */

const fs = require('fs');
const path = require('path');

// ── CLI parsing ─────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
if (!args.length) {
    console.error(
        'Usage: node scripts/convert-recording-to-feature.js <normalized-recording.json> [<FeatureFileName>] [--force] [--allow-fallback]',
    );
    process.exit(1);
}

let force = false;
let allowFallback = false;
const positionals = [];
for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--force') {
        force = true;
    } else if (arg === '--allow-fallback') {
        allowFallback = true;
    } else if (!arg.startsWith('--')) {
        positionals.push(arg);
    }
}

const inputPath = positionals[0];
if (!inputPath) {
    console.error('[convert-recording-to-feature] No normalized recording path supplied.');
    process.exit(1);
}

const normalized = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), inputPath), 'utf8'));
const actions = Array.isArray(normalized.actions) ? normalized.actions : [];

// ── Filename + tag inference ────────────────────────────────────────────────
function camelCaseFromTitle(title) {
    if (!title) return '';
    return title
        .replace(/[^a-zA-Z0-9 ]+/g, ' ')
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join('');
}

const explicitName = positionals[1] ? positionals[1].replace(/\.feature$/i, '') : null;
const featureBaseName = (() => {
    if (explicitName && explicitName.trim()) {
        // Operator may pass the bare name (`StudentEnquiry`) or include the
        // suffix (`StudentEnquiryRecorded`). Normalise to "<Bare>Recorded".
        const bare = explicitName.trim().replace(/Recorded$/i, '');
        return `${bare}Recorded`;
    }
    const fromTitle = camelCaseFromTitle(normalized.metadata?.title);
    return fromTitle ? `${fromTitle}Recorded` : 'RecordedFlow';
})();
const featureFileName = `${featureBaseName}.feature`;
const featureTitle = (normalized.metadata?.title || featureBaseName)
    .replace(/[^a-zA-Z0-9 \-_/]/g, '')
    .trim() || featureBaseName;

// Functional tag is the bare name (without the `Recorded` suffix) so we get
// `@StudentEnquiry` rather than `@StudentEnquiryRecorded`. Strip non-tag
// characters defensively — Gherkin tags are alphanumerics + underscore.
const tagBase = featureBaseName.replace(/Recorded$/i, '').replace(/[^a-zA-Z0-9_]/g, '');
const functionalTag = `@${tagBase || 'Recorded'}`;
const tags = [functionalTag, '@recording'];

// ── Load rules file ─────────────────────────────────────────────────────────
const rulesPath = path.resolve(__dirname, '../resources/recorder-step-rules.json');
let rulesDoc = { preconditions: [], rules: [] };
if (fs.existsSync(rulesPath)) {
    try {
        rulesDoc = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
    } catch (err) {
        console.error(`[convert-recording-to-feature] Failed to parse ${rulesPath}: ${err.message}`);
        process.exit(1);
    }
} else {
    console.warn(`[convert-recording-to-feature] No rules file at ${rulesPath} — every action will fall back to generic steps.`);
}

const preconditionRules = Array.isArray(rulesDoc.preconditions) ? rulesDoc.preconditions : [];
const actionRules = Array.isArray(rulesDoc.rules) ? rulesDoc.rules : [];

// ── Predicate evaluation ────────────────────────────────────────────────────
function asArray(x) {
    if (x === undefined || x === null) return [];
    return Array.isArray(x) ? x : [x];
}

function matchRegex(pattern, value) {
    if (typeof pattern !== 'string' || pattern.length === 0) return false;
    if (typeof value !== 'string') return false;
    try {
        return new RegExp(pattern).test(value);
    } catch (err) {
        console.warn(`[convert-recording-to-feature] Invalid regex in rule: ${pattern} (${err.message})`);
        return false;
    }
}

function matchesPreconditionWhen(when, ctx) {
    if (!when || typeof when !== 'object') return true;
    if (when.urlEquals !== undefined && when.urlEquals !== ctx.url) return false;
    if (when.urlMatches !== undefined && !matchRegex(when.urlMatches, ctx.url || '')) return false;
    if (when.titleMatches !== undefined && !matchRegex(when.titleMatches, ctx.title || '')) return false;
    return true;
}

function matchesActionWhen(when, action) {
    if (!when || typeof when !== 'object') return true;
    const el = action.element || {};

    const types = asArray(when.type);
    if (types.length && !types.includes(action.type)) return false;

    const tags = asArray(when.tag);
    if (tags.length && !tags.includes((el.tag || '').toLowerCase())) return false;

    if (when.role !== undefined && (el.role || '') !== when.role) return false;

    if (when.inSidebar !== undefined && Boolean(el.inSidebar) !== Boolean(when.inSidebar)) return false;

    if (when.inputType !== undefined && (el.inputType || '').toLowerCase() !== when.inputType.toLowerCase()) return false;
    if (Array.isArray(when.inputTypeIn) && when.inputTypeIn.length) {
        const want = when.inputTypeIn.map((s) => s.toLowerCase());
        if (!want.includes((el.inputType || '').toLowerCase())) return false;
    }

    const sel = action.selector || '';
    if (when.selectorContains !== undefined && !sel.includes(when.selectorContains)) return false;
    if (when.selectorMatches !== undefined && !matchRegex(when.selectorMatches, sel)) return false;

    const value = action.value || '';
    if (when.valueEquals !== undefined && value !== when.valueEquals) return false;
    if (when.valueContains !== undefined && !value.includes(when.valueContains)) return false;
    if (when.valueMatches !== undefined && !matchRegex(when.valueMatches, value)) return false;

    if (when.formLabelDefined !== undefined && Boolean(el.formLabel) !== Boolean(when.formLabelDefined)) return false;
    if (when.formLabelEquals !== undefined && (el.formLabel || '') !== when.formLabelEquals) return false;
    if (when.formLabelMatches !== undefined && !matchRegex(when.formLabelMatches, el.formLabel || '')) return false;

    if (when.ariaLabelDefined !== undefined && Boolean(el.ariaLabel) !== Boolean(when.ariaLabelDefined)) return false;
    if (when.ariaLabelEquals !== undefined && (el.ariaLabel || '') !== when.ariaLabelEquals) return false;

    return true;
}

// ── Template expansion ──────────────────────────────────────────────────────
function escapeQuotes(text) {
    return String(text == null ? '' : text).replace(/"/g, '\\"').trim();
}

function expandTemplate(template, action) {
    const el = action.element || {};
    const subs = {
        '{value}': escapeQuotes(action.value),
        '{selector}': escapeQuotes(action.selector),
        '{formLabel}': escapeQuotes(el.formLabel),
        '{ariaLabel}': escapeQuotes(el.ariaLabel),
        '{placeholder}': escapeQuotes(el.placeholder),
        '{role}': escapeQuotes(el.role),
        '{tag}': escapeQuotes(el.tag),
        '{inputType}': escapeQuotes(el.inputType),
        '{label}': escapeQuotes(action.label),
    };
    return Object.keys(subs).reduce(
        (out, token) => out.split(token).join(subs[token]),
        template,
    );
}

// ── Step rendering ──────────────────────────────────────────────────────────
function renderStepFromRules(action) {
    for (const rule of actionRules) {
        if (matchesActionWhen(rule.when, action)) {
            if (rule.skip === true) {
                return { skip: true, ruleName: rule.name || '(unnamed skip)' };
            }
            return { step: expandTemplate(rule.step, action), ruleName: rule.name || '(unnamed)' };
        }
    }
    return null;
}

function renderGenericStep(action) {
    switch (action.type) {
        case 'click':
            return `When I click the element "${escapeQuotes(action.selector)}"`;
        case 'input':
        case 'change':
            return `When I fill the element "${escapeQuotes(action.selector)}" with "${escapeQuotes(action.value)}"`;
        default:
            return `# Unsupported action: ${action.type} (${escapeQuotes(action.selector)})`;
    }
}

function renderAction(action) {
    const fromRule = renderStepFromRules(action);
    if (fromRule && fromRule.skip) return { source: 'skip', ruleName: fromRule.ruleName, action };
    if (fromRule) return { ...fromRule, source: 'rule', action };
    return { step: renderGenericStep(action), ruleName: null, source: 'generic', action };
}

// ── Background ──────────────────────────────────────────────────────────────
function inferBackgroundLines() {
    const ctx = { url: normalized.metadata?.url || '', title: normalized.metadata?.title || '' };
    for (const rule of preconditionRules) {
        if (matchesPreconditionWhen(rule.when, ctx)) {
            return [rule.step];
        }
    }
    if (ctx.url) {
        return [`Given I open the application at "${ctx.url}"`];
    }
    return [];
}

// ── De-dupe consecutive fills/changes on the same selector ─────────────────-
function dedupeSettledFills(actionList, rendered) {
    const out = [];
    for (let i = 0; i < actionList.length; i += 1) {
        const action = actionList[i];
        const next = actionList[i + 1];
        const isFill = action.type === 'input' || action.type === 'change';
        const nextIsFill = next && (next.type === 'input' || next.type === 'change');
        if (isFill && nextIsFill && action.selector === next.selector) {
            continue;
        }
        out.push(rendered[i]);
    }
    return out;
}

function dedupeSequentialDuplicates(rendered) {
    const out = [];
    for (const r of rendered) {
        if (out.length && out[out.length - 1].step === r.step) continue;
        out.push(r);
    }
    return out;
}

// ── Render the feature ──────────────────────────────────────────────────────
const allRendered = actions.map(renderAction);
const collapsed = dedupeSettledFills(actions, allRendered);
// Drop entries whose rule said `skip: true` — those are recognised noise
// (e.g. <select> open/close clicks) and must not appear in the feature.
const visible = collapsed.filter((r) => r.source !== 'skip');
const finalSteps = dedupeSequentialDuplicates(visible);

const backgroundLines = inferBackgroundLines();
const backgroundBlock = backgroundLines.length
    ? `  Background:\n    ${backgroundLines.join('\n    ')}\n\n`
    : '';

const stepBlock = finalSteps.length
    ? `    ${finalSteps.map((r) => r.step).join('\n    ')}\n`
    : '    # No actions captured — re-record or normalize the source manually.\n';

const feature = `${tags.join('\n')}
Feature: ${featureTitle}

${backgroundBlock}  Scenario: Recorded user flow
${stepBlock}`;

// ── Strict-mode check: refuse to write the feature when fallback steps exist ─
const fallbackCount = finalSteps.filter((r) => r.source === 'generic').length;
if (fallbackCount > 0 && !allowFallback) {
    console.error(
        `[convert-recording-to-feature] Refusing to write ${featureFileName}: ${fallbackCount} action(s) had no matching rule.`,
    );
    console.error('[convert-recording-to-feature] Recorded features must use high-level rule-matched steps so the framework can apply self-healing.');
    console.error('[convert-recording-to-feature] Unmatched actions (extend resources/recorder-step-rules.json or amend src/steps/):');
    for (const r of finalSteps) {
        if (r.source !== 'generic') continue;
        const action = r.action;
        if (!action) continue;
        const el = action.element || {};
        const detail = [
            `type=${action.type}`,
            el.tag ? `tag=${el.tag}` : null,
            action.value ? `value="${String(action.value).slice(0, 40)}${String(action.value).length > 40 ? '…' : ''}"` : null,
            el.formLabel ? `formLabel="${el.formLabel}"` : null,
            el.ariaLabel ? `ariaLabel="${el.ariaLabel}"` : null,
        ]
            .filter(Boolean)
            .join(' ');
        console.error(`    - ${detail}`);
    }
    console.error('[convert-recording-to-feature] If this is a spike and you accept selectors-in-Gherkin, re-run with --allow-fallback.');
    process.exit(2);
}

// ── Write the feature ──────────────────────────────────────────────────────
const featurePath = path.resolve(__dirname, '../features', featureFileName);
const featuresDir = path.dirname(featurePath);
if (!fs.existsSync(featuresDir)) {
    fs.mkdirSync(featuresDir, { recursive: true });
}

let resolvedFeaturePath = featurePath;
let didFallbackToTimestamp = false;
if (fs.existsSync(featurePath) && !force) {
    const suffix = new Date()
        .toISOString()
        .replace(/[-:T.Z]/g, '')
        .substring(0, 14);
    resolvedFeaturePath = path.resolve(featuresDir, `${featureBaseName}.${suffix}.feature`);
    didFallbackToTimestamp = true;
}
fs.writeFileSync(resolvedFeaturePath, feature, 'utf8');

// ── Reporting ──────────────────────────────────────────────────────────────
const total = finalSteps.length;
const reused = finalSteps.filter((r) => r.source === 'rule').length;
const fallback = total - reused;
const skipped = collapsed.filter((r) => r.source === 'skip').length;

console.log('[convert-recording-to-feature] Feature written:', resolvedFeaturePath);
if (didFallbackToTimestamp) {
    // Use stdout (not stderr/console.warn) so non-zero exit codes are reserved
    // for actual failures. The operator still sees the message clearly.
    console.log(
        `[convert-recording-to-feature] ${featureFileName} already exists. Wrote timestamped sibling instead. Use --force to overwrite.`,
    );
}
console.log(`[convert-recording-to-feature] Steps total: ${total}`);
console.log(`[convert-recording-to-feature]   reused via rules-file       : ${reused}`);
if (skipped > 0) {
    console.log(`[convert-recording-to-feature]   actions skipped by rules    : ${skipped} (recognised noise)`);
}
if (allowFallback) {
    console.log(`[convert-recording-to-feature]   fell back to generic steps  : ${fallback} (--allow-fallback)`);
}

if (allowFallback && fallback > 0) {
    console.log('[convert-recording-to-feature] Unmatched actions (consider extending resources/recorder-step-rules.json or amending src/steps/):');
    for (const r of finalSteps) {
        if (r.source !== 'generic') continue;
        const action = r.action;
        if (!action) continue;
        const el = action.element || {};
        const detail = [
            `type=${action.type}`,
            el.tag ? `tag=${el.tag}` : null,
            action.value ? `value="${String(action.value).slice(0, 40)}${String(action.value).length > 40 ? '…' : ''}"` : null,
            el.formLabel ? `formLabel="${el.formLabel}"` : null,
            el.ariaLabel ? `ariaLabel="${el.ariaLabel}"` : null,
        ]
            .filter(Boolean)
            .join(' ');
        console.log(`    - ${detail}`);
    }
}

console.log('[convert-recording-to-feature] Format reference: docs/AUTHORING/writing-features.md');
console.log('[convert-recording-to-feature] Review the feature, then say "automate it" or run:');
console.log(`  npm run recorder:generate-pom -- ${path.relative(process.cwd(), inputPath)}`);
