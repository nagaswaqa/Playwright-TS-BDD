import { Page } from '@playwright/test';
import { IHealingStrategy } from './IHealingStrategy';
import { LocatorData } from '../LocatorRepository';

/**
 * CustomAttributeStrategy — looks for elements whose `data-test-id` (or any
 * configured attribute) matches the locator name. This is a no-network,
 * high-confidence strategy that should run early in the chain so the more
 * expensive ones don't have to.
 *
 * The attribute name can be customised via constructor or
 * `CUSTOM_HEALING_ATTRIBUTE` env var. Common candidates: `data-test-id`,
 * `data-testid`, `data-cy`, `data-qa`.
 */
export class CustomAttributeStrategy implements IHealingStrategy {
    readonly name = 'CUSTOM_ATTR';
    private attributeNames: string[];

    constructor(attributeName?: string | string[]) {
        const fromEnv = process.env.CUSTOM_HEALING_ATTRIBUTE;
        if (Array.isArray(attributeName) && attributeName.length) {
            this.attributeNames = attributeName;
        } else if (typeof attributeName === 'string' && attributeName.length) {
            this.attributeNames = [attributeName];
        } else if (fromEnv) {
            this.attributeNames = fromEnv.split(',').map((s) => s.trim()).filter(Boolean);
        } else {
            this.attributeNames = ['data-test-id', 'data-testid', 'data-test', 'data-cy', 'data-qa'];
        }
    }

    async attempt(
        page: Page,
        locatorName: string,
        originalSelector: string,
        _metadata?: LocatorData,
    ): Promise<{ selector: string; confidence: number } | null> {
        const slug = (locatorName.split('.').pop() || locatorName).trim();
        const variants = uniq([
            locatorName,
            slug,
            slug.replace(/[._-]+/g, '-'),
            slug.replace(/[._-]+/g, '_'),
        ]);

        for (const attr of this.attributeNames) {
            for (const value of variants) {
                const selector = `[${attr}="${escapeAttr(value)}"]`;
                if (await selectorResolves(page, selector, 800)) {
                    return { selector, confidence: 0.9 };
                }
            }
        }
        return null;
    }
}

function uniq<T>(items: T[]): T[] {
    return Array.from(new Set(items));
}

function escapeAttr(value: string): string {
    return value.replace(/(["\\])/g, '\\$1');
}

async function selectorResolves(page: Page, selector: string, timeoutMs: number): Promise<boolean> {
    try {
        await page.waitForSelector(selector, { state: 'attached', timeout: timeoutMs });
        return true;
    } catch {
        return false;
    }
}
