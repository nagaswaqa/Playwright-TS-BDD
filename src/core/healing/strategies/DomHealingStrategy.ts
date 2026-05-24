import { Page } from '@playwright/test';
import { IHealingStrategy } from './IHealingStrategy';
import { LocatorData } from '../LocatorRepository';

/**
 * DOM healing strategy — local, deterministic, no external calls.
 *
 * Tries a series of heuristics inside the page, in order of decreasing
 * confidence. Each candidate is verified before being returned.
 *
 * Heuristics (ordered):
 *   1. Stable test attributes derived from the locator name
 *      (`data-testid`, `data-test-id`, `data-cy`, `data-qa`, `id`, `name`).
 *   2. Visible text exact match (using the locator's `description` when
 *      available, falling back to the slug-name).
 *   3. ARIA accessible name (`aria-label`, `[role][name]`).
 *   4. Role-based lookup using the locator name's tail token (e.g.
 *      `field.dropdown.major` → role `combobox`).
 *   5. Heuristic CSS-attribute scan: any element whose visible text contains
 *      every word of the description, scoring tighter matches higher.
 */
export class DomHealingStrategy implements IHealingStrategy {
    readonly name = 'DOM';

    async attempt(
        page: Page,
        locatorName: string,
        originalSelector: string,
        metadata?: LocatorData,
    ): Promise<{ selector: string; confidence: number } | null> {
        const description = (metadata?.description || '').trim();
        const slug = lastSegment(locatorName);
        const tail = lastDotSegment(locatorName).toLowerCase();
        const candidates: Array<{ selector: string; confidence: number }> = [];

        // 1. Test attributes built from the slug and the description.
        const attrSlugs = uniq([
            slug,
            slug.replace(/[._-]+/g, '-'),
            slug.replace(/[._-]+/g, '_'),
            description ? slugify(description) : null,
        ].filter((x): x is string => Boolean(x)));

        for (const attr of ['data-testid', 'data-test-id', 'data-test', 'data-cy', 'data-qa']) {
            for (const value of attrSlugs) {
                candidates.push({
                    selector: `[${attr}="${value}"]`,
                    confidence: 0.95,
                });
            }
        }
        for (const value of attrSlugs) {
            candidates.push({ selector: `#${cssEscape(value)}`, confidence: 0.9 });
            candidates.push({ selector: `[name="${value}"]`, confidence: 0.85 });
        }

        // 2. Exact visible text via Playwright's `text=` engine.
        if (description) {
            candidates.push({ selector: `text="${description}"`, confidence: 0.85 });
            candidates.push({
                selector: `*:has-text("${description}")`,
                confidence: 0.7,
            });
        }

        // 3. ARIA labelled selectors.
        if (description) {
            candidates.push({
                selector: `[aria-label="${description}"]`,
                confidence: 0.85,
            });
            candidates.push({
                selector: `[aria-labelledby] >> text="${description}"`,
                confidence: 0.7,
            });
        }

        // 4. Role-based lookup driven by the locator name's tail token.
        const role = inferRole(tail);
        if (role && description) {
            candidates.push({
                selector: `role=${role}[name="${description}"]`,
                confidence: 0.8,
            });
            candidates.push({
                selector: `role=${role}[name=/${escapeRegex(description)}/i]`,
                confidence: 0.7,
            });
        }

        // Test each candidate in order; first one that resolves wins.
        for (const cand of candidates) {
            const ok = await selectorResolves(page, cand.selector, 1000);
            if (ok) {
                return cand;
            }
        }

        // 5. Last-resort heuristic scan — search the rendered DOM for an
        //    element whose visible text contains all the description words.
        if (description) {
            const fuzzy = await fuzzyTextLookup(page, description);
            if (fuzzy) {
                return fuzzy;
            }
        }

        return null;
    }
}

// ── helpers ────────────────────────────────────────────────────────────────-
function lastSegment(name: string): string {
    return name.replace(/^.*[./]/, '');
}

function lastDotSegment(name: string): string {
    const parts = name.split('.');
    return parts[parts.length - 1] || name;
}

function slugify(input: string): string {
    return input
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function uniq<T>(items: T[]): T[] {
    return Array.from(new Set(items));
}

function cssEscape(value: string): string {
    return value.replace(/([!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, '\\$1');
}

function escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function inferRole(tail: string): string | null {
    if (tail.includes('button')) return 'button';
    if (tail.includes('link')) return 'link';
    if (tail.includes('checkbox')) return 'checkbox';
    if (tail.includes('radio')) return 'radio';
    if (tail.includes('dropdown') || tail.includes('select') || tail.includes('combobox')) {
        return 'combobox';
    }
    if (tail.includes('tab')) return 'tab';
    if (tail.includes('menu')) return 'menu';
    if (tail.includes('switch')) return 'switch';
    if (tail.includes('search')) return 'searchbox';
    return null;
}

async function selectorResolves(page: Page, selector: string, timeoutMs: number): Promise<boolean> {
    try {
        await page.waitForSelector(selector, { state: 'attached', timeout: timeoutMs });
        return true;
    } catch {
        return false;
    }
}

/**
 * Last-resort scan: walk visible interactive elements and pick the one whose
 * trimmed text contains every word of `description`. Returns a Playwright
 * `text=...` selector that resolves uniquely on retry.
 */
async function fuzzyTextLookup(
    page: Page,
    description: string,
): Promise<{ selector: string; confidence: number } | null> {
    try {
        const phrase = description.trim();
        if (!phrase) return null;

        const handle = await page.evaluateHandle((needle: string) => {
            const lower = needle.toLowerCase();
            const words = lower.split(/\s+/).filter(Boolean);
            const candidates: Array<{ text: string; score: number; element: Element }> = [];
            const interactive = document.querySelectorAll(
                'a, button, input, textarea, select, [role], label, [data-testid], [data-test-id], [data-test], [data-cy], [data-qa], li, td, th',
            );
            interactive.forEach((el) => {
                const text = (el.textContent || '').trim();
                if (!text) return;
                const tl = text.toLowerCase();
                const allWords = words.every((w) => tl.includes(w));
                if (!allWords) return;
                // Tighter fits score higher.
                const score = words.length / Math.max(1, tl.split(/\s+/).length);
                candidates.push({ text, score, element: el });
            });
            candidates.sort((a, b) => b.score - a.score);
            return candidates[0]?.text ?? null;
        }, phrase);

        const matchedText = (await handle.jsonValue()) as string | null;
        await handle.dispose();
        if (!matchedText) return null;

        const selector = `text=${quoteForSelector(matchedText)}`;
        if (await selectorResolves(page, selector, 1000)) {
            return { selector, confidence: 0.65 };
        }
        return null;
    } catch {
        return null;
    }
}

function quoteForSelector(text: string): string {
    if (text.includes('"')) {
        return `'${text}'`;
    }
    return `"${text}"`;
}
