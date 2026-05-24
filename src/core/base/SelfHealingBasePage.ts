import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';
import { HealingEngine } from '../healing/HealingEngine';
import { AuditLogger } from '../healing/AuditLogger';
import { testConfig } from '../../../config/testConfig';

export abstract class SelfHealingBasePage extends BasePage {
    protected auditLogger: AuditLogger;

    /**
     * @param page - Playwright page instance supplied by test context
     * @param healingEngine - Engine used to attempt repairs when selectors fail
     * @param auditDir - optional directory path where audit logs are stored
     *                    if omitted the default './healing-logs' is used
     */
    constructor(
        page: Page,
        protected healingEngine: HealingEngine,
        auditDir: string = './healing-logs'
    ) {
        super(page);
        // create logger with runtime toggle coming from testConfig
        this.auditLogger = new AuditLogger(auditDir, testConfig.enableHealingAudit);
    }

    /**
     * Core healing orchestrator: Try selector first, heal on failure
     * @param locatorName - Logical name from locators.json (required for healing)
     * @param selector - Primary selector to try first
     * @param action - Async function that performs the action
     * @returns Result of the action
     */
    protected async performWithHealing<T>(
        locatorName: string,
        selector: string,
        action: (sel: string) => Promise<T>
    ): Promise<T> {
        try {
            // STEP 1: Try with user-provided selector
            const result = await action(selector);
            await this.auditLogger.log(`✓ Selector succeeded on first attempt: ${locatorName}`);
            return result;
        } catch (primaryError: any) {
            // STEP 2: Primary selector failed, attempt healing
            await this.auditLogger.log(
                `✗ Selector failed for '${locatorName}': ${primaryError.message}`
            );
            console.warn(
                `[Self-Healing] Primary selector failed for '${locatorName}'. Initiating healing...`
            );

            try {
                const healedSelector = await this.healingEngine.heal(
                    this.page,
                    locatorName,
                    selector
                );

                if (!healedSelector) {
                    throw new Error(
                        `[Self-Healing] Healing returned no alternative selector`
                    );
                }

                // STEP 3: Retry with healed selector
                console.log(
                    `[Self-Healing] Retrying with healed selector: ${healedSelector}`
                );
                const result = await action(healedSelector);
                await this.auditLogger.log(
                    `✓ Healed selector succeeded: ${locatorName} → ${healedSelector}`
                );
                return result;
            } catch (healingError: any) {
                // STEP 4: Healing also failed
                await this.auditLogger.log(
                    `✗ Healing failed for '${locatorName}': ${healingError.message}`
                );
                throw new Error(
                    `[Self-Healing] Both selectors failed for '${locatorName}'. ` +
                    `Primary: ${primaryError.message}. Healing: ${healingError.message}`
                );
            }
        }
    }

    /**
     * Normalize caller arguments into locatorName/selector pair.
     * If only one argument is provided we use the selector value for both.
     */
    private normalizeLocator(
        locatorNameOrSelector: string,
        maybeSelector?: string
    ): { locatorName: string; selector: string } {
        const selector = maybeSelector || locatorNameOrSelector;
        const locatorName = maybeSelector ? locatorNameOrSelector : selector;
        return { locatorName, selector };
    }

    /**
     * Generic wrapper that handles optional locatorName and delegates to
     * performWithHealing. Saves duplication across many "Healed" helpers.
     */
    private async executeHealed<T>(
        locatorNameOrSelector: string,
        maybeSelector: string | undefined,
        action: (sel: string) => Promise<T>
    ): Promise<T> {
        const { locatorName, selector } = this.normalizeLocator(
            locatorNameOrSelector,
            maybeSelector
        );
        return await this.performWithHealing(locatorName, selector, async (sel) => {
            // If the selector was healed, we use .first() to avoid strict mode issues
            // If it's the original selector, we leave it as is or also use .first() for safety
            return await action(sel);
        });
    }

    /**
     * Return a selector that has been healed (or the original if no healing happened).
     * Useful when you need to resolve a locator ahead of performing an action or for
     * assertions, without actually invoking page operations.
     */
    public async healedLocator(
        locatorNameOrSelector: string,
        maybeSelector?: string
    ): Promise<string> {
        const { locatorName, selector } = this.normalizeLocator(
            locatorNameOrSelector,
            maybeSelector
        );
        const healed = await this.healingEngine.heal(this.page, locatorName, selector);
        return healed || selector;
    }

    /**
     * Performs a click with self-healing fallback.
     * STRATEGY: Try user selector first → if fails → trigger healing → retry
     * @param locatorName - Logical name from locators.json (required for healing)
     * @param selector - Primary selector to attempt first
     * @param options - Click options (timeout, button, etc.)
     */
    /**
     * Performs a click with self-healing fallback.
     * If `locatorName` is omitted, the selector string is used as the logical name.
     */
    async clickHealed(
        locatorNameOrSelector: string,
        maybeSelector?: string,
        options?: { button?: "left" | "right" | "middle"; clickCount?: number; delay?: number; force?: boolean; timeout?: number }
    ): Promise<void> {
        const timeout = options?.timeout || 5000;
        await this.executeHealed(locatorNameOrSelector, maybeSelector, async (sel) => {
            await this.page.locator(sel).first().click({ ...options, timeout });
        });
    }

    /**
     * Performs a force click with self-healing fallback (bypasses actionability checks).
     * STRATEGY: Try user selector first → if fails → trigger healing → retry
     * @param locatorName - Logical name from locators.json
     * @param selector - Primary selector to try first
     */
    async forceClickHealed(
        locatorNameOrSelector: string,
        maybeSelector?: string,
        options?: { button?: "left" | "right" | "middle"; clickCount?: number; delay?: number; timeout?: number }
    ): Promise<void> {
        const timeout = options?.timeout || 5000;
        await this.executeHealed(locatorNameOrSelector, maybeSelector, async (sel) => {
            await this.page.locator(sel).first().click({ force: true, ...options, timeout });
        });
    }

    /**
     * Performs a double click with self-healing fallback.
     * STRATEGY: Try user selector first → if fails → trigger healing → retry
     * @param locatorName - Logical name from locators.json
     * @param selector - Primary selector to try first
     */
    async doubleClickHealed(
        locatorNameOrSelector: string,
        maybeSelector?: string,
        options?: { button?: "left" | "right" | "middle"; delay?: number; force?: boolean; timeout?: number }
    ): Promise<void> {
        const timeout = options?.timeout || 5000;
        await this.executeHealed(locatorNameOrSelector, maybeSelector, async (sel) => {
            await this.page.locator(sel).first().dblclick({ ...options, timeout });
        });
    }

    /**
     * Performs a fill with self-healing fallback.
     * STRATEGY: Try user selector first → if fails → trigger healing → retry
     * @param locatorName - Logical name from locators.json
     * @param selector - Primary selector to try first
     * @param value - Text to fill
     */
    async fillHealed(
        locatorNameOrSelector: string,
        maybeSelector: string | undefined,
        value: string,
        options?: { force?: boolean; timeout?: number }
    ): Promise<void> {
        const timeout = options?.timeout || 5000;
        await this.executeHealed(locatorNameOrSelector, maybeSelector, async (sel) => {
            await this.page.locator(sel).first().fill(value, { ...options, timeout });
        });
    }

    /**
     * Performs a hover with self-healing fallback.
     * STRATEGY: Try user selector first → if fails → trigger healing → retry
     * @param locatorName - Logical name from locators.json
     * @param selector - Primary selector to try first
     */
    async hoverHealed(
        locatorNameOrSelector: string,
        maybeSelector?: string,
        options?: { force?: boolean; timeout?: number }
    ): Promise<void> {
        const timeout = options?.timeout || 5000;
        await this.executeHealed(locatorNameOrSelector, maybeSelector, async (sel) => {
            await this.page.locator(sel).first().hover({ ...options, timeout });
        });
    }

    /**
     * Performs a check with self-healing fallback.
     * STRATEGY: Try user selector first → if fails → trigger healing → retry
     * @param locatorName - Logical name from locators.json
     * @param selector - Primary selector to try first
     */
    async checkHealed(
        locatorNameOrSelector: string,
        maybeSelector?: string,
        options?: { force?: boolean; timeout?: number }
    ): Promise<void> {
        const timeout = options?.timeout || 5000;
        await this.executeHealed(locatorNameOrSelector, maybeSelector, async (sel) => {
            await this.page.locator(sel).first().check({ ...options, timeout });
        });
    }

    /**
     * Performs an uncheck with self-healing fallback.
     * STRATEGY: Try user selector first → if fails → trigger healing → retry
     * @param locatorName - Logical name from locators.json
     * @param selector - Primary selector to try first
     */
    async uncheckHealed(
        locatorNameOrSelector: string,
        maybeSelector?: string,
        options?: { force?: boolean; timeout?: number }
    ): Promise<void> {
        const timeout = options?.timeout || 5000;
        await this.executeHealed(locatorNameOrSelector, maybeSelector, async (sel) => {
            await this.page.locator(sel).first().uncheck({ ...options, timeout });
        });
    }

    /**
     * Performs a select option with self-healing fallback.
     * STRATEGY: Try user selector first → if fails → trigger healing → retry
     * @param locatorName - Logical name from locators.json
     * @param selector - Primary selector to try first
     * @param values - Value(s) to select
     */
    async selectOptionHealed(
        locatorName: string,
        selector: string,
        values: string | string[] | { value?: string; label?: string; index?: number },
        options?: { force?: boolean; timeout?: number }
    ): Promise<string[]> {
        const timeout = options?.timeout || 5000;
        return await this.performWithHealing(locatorName, selector, async (sel) => {
            return await this.page.locator(sel).first().selectOption(values, { ...options, timeout });
        });
    }

    /**
     * Gets text content with self-healing fallback.
     * STRATEGY: Try user selector first → if fails → trigger healing → retry
     * @param locatorName - Logical name from locators.json
     * @param selector - Primary selector to try first
     */
    async getTextHealed(
        locatorName: string,
        selector: string,
        options?: { timeout?: number }
    ): Promise<string> {
        const timeout = options?.timeout || 5000;
        return await this.performWithHealing(locatorName, selector, async (sel) => {
            const text = await this.page.locator(sel).first().textContent({ timeout });
            return text || '';
        });
    }

    /**
     * Gets input value with self-healing fallback.
     * STRATEGY: Try user selector first → if fails → trigger healing → retry
     * @param locatorName - Logical name from locators.json
     * @param selector - Primary selector to try first
     */
    async getInputValueHealed(
        locatorName: string,
        selector: string,
        options?: { timeout?: number }
    ): Promise<string> {
        const timeout = options?.timeout || 5000;
        return await this.performWithHealing(locatorName, selector, async (sel) => {
            return await this.page.locator(sel).first().inputValue({ timeout });
        });
    }

    /**
     * Gets attribute value with self-healing fallback.
     * STRATEGY: Try user selector first → if fails → trigger healing → retry
     * @param locatorName - Logical name from locators.json
     * @param selector - Primary selector to try first
     * @param name - Attribute name
     */
    async getAttributeHealed(
        locatorName: string,
        selector: string,
        name: string,
        options?: { timeout?: number }
    ): Promise<string | null> {
        const timeout = options?.timeout || 5000;
        return await this.performWithHealing(locatorName, selector, async (sel) => {
            return await this.page.locator(sel).first().getAttribute(name, { timeout });
        });
    }

    /**
     * Checks if element is visible with self-healing fallback.
     * STRATEGY: Try user selector first → if fails → trigger healing → retry
     * @param locatorName - Logical name from locators.json
     * @param selector - Primary selector to try first
     */
    async isVisibleHealed(
        locatorName: string,
        selector: string,
        options?: { timeout?: number }
    ): Promise<boolean> {
        const timeout = options?.timeout || 5000;
        try {
            return await this.performWithHealing(locatorName, selector, async (sel) => {
                // Force a throw if not visible within a reasonable sub-timeout to trigger healing
                await this.page.locator(sel).first().waitFor({ state: 'visible', timeout: 3000 });
                return true;
            });
        } catch (e) {
            return false;
        }
    }

    /**
     * Checks if element is hidden with self-healing fallback.
     * STRATEGY: Try user selector first → if fails → trigger healing → retry
     * @param locatorName - Logical name from locators.json
     * @param selector - Primary selector to try first
     */
    async isHiddenHealed(
        locatorName: string,
        selector: string,
        options?: { timeout?: number }
    ): Promise<boolean> {
        const timeout = options?.timeout || 5000;
        return await this.performWithHealing(locatorName, selector, async (sel) => {
            return await this.page.locator(sel).isHidden({ timeout });
        });
    }

    /**
     * Checks if element is enabled with self-healing fallback.
     * STRATEGY: Try user selector first → if fails → trigger healing → retry
     * @param locatorName - Logical name from locators.json
     * @param selector - Primary selector to try first
     */
    async isEnabledHealed(
        locatorName: string,
        selector: string,
        options?: { timeout?: number }
    ): Promise<boolean> {
        const timeout = options?.timeout || 5000;
        try {
            return await this.performWithHealing(locatorName, selector, async (sel) => {
                // Ensure element exists/attached before checking enabled
                await this.page.locator(sel).first().waitFor({ state: 'attached', timeout: 3000 });
                return await this.page.locator(sel).first().isEnabled({ timeout });
            });
        } catch (e) {
            return false;
        }
    }

    /**
     * Checks if element is checked with self-healing fallback.
     * STRATEGY: Try user selector first → if fails → trigger healing → retry
     * @param locatorName - Logical name from locators.json
     * @param selector - Primary selector to try first
     */
    async isCheckedHealed(
        locatorName: string,
        selector: string,
        options?: { timeout?: number }
    ): Promise<boolean> {
        const timeout = options?.timeout || 5000;
        return await this.performWithHealing(locatorName, selector, async (sel) => {
            return await this.page.locator(sel).first().isChecked({ timeout });
        });
    }

    /**
     * Performs a tap with self-healing fallback.
     * STRATEGY: Try user selector first → if fails → trigger healing → retry
     * @param locatorName - Logical name from locators.json
     * @param selector - Primary selector to try first
     */
    async tapHealed(
        locatorName: string,
        selector: string,
        options?: { force?: boolean; timeout?: number }
    ): Promise<void> {
        const timeout = options?.timeout || 5000;
        await this.performWithHealing(locatorName, selector, async (sel) => {
            await this.page.locator(sel).tap({ ...options, timeout });
        });
    }

    /**
     * Performs a blur with self-healing fallback.
     * STRATEGY: Try user selector first → if fails → trigger healing → retry
     * @param locatorName - Logical name from locators.json
     * @param selector - Primary selector to try first
     */
    async blurHealed(
        locatorName: string,
        selector: string,
        options?: { timeout?: number }
    ): Promise<void> {
        const timeout = options?.timeout || 5000;
        await this.performWithHealing(locatorName, selector, async (sel) => {
            await this.page.locator(sel).blur({ ...options, timeout });
        });
    }

    /**
     * Performs a focus with self-healing fallback.
     * STRATEGY: Try user selector first → if fails → trigger healing → retry
     * @param locatorName - Logical name from locators.json
     * @param selector - Primary selector to try first
     */
    async focusHealed(
        locatorName: string,
        selector: string,
        options?: { timeout?: number }
    ): Promise<void> {
        const timeout = options?.timeout || 5000;
        await this.performWithHealing(locatorName, selector, async (sel) => {
            await this.page.locator(sel).focus({ ...options, timeout });
        });
    }

    /**
     * Performs a clear with self-healing fallback.
     * STRATEGY: Try user selector first → if fails → trigger healing → retry
     * @param locatorName - Logical name from locators.json
     * @param selector - Primary selector to try first
     */
    async clearHealed(
        locatorName: string,
        selector: string,
        options?: { force?: boolean; timeout?: number }
    ): Promise<void> {
        const timeout = options?.timeout || 5000;
        await this.performWithHealing(locatorName, selector, async (sel) => {
            await this.page.locator(sel).clear({ ...options, timeout });
        });
    }

    /**
     * Performs a press sequentially with self-healing fallback.
     * STRATEGY: Try user selector first → if fails → trigger healing → retry
     * @param locatorName - Logical name from locators.json
     * @param selector - Primary selector to try first
     * @param text - Text to press character by character
     */
    async pressSequentiallyHealed(
        locatorName: string,
        selector: string,
        text: string,
        options?: { timeout?: number }
    ): Promise<void> {
        const timeout = options?.timeout || 5000;
        await this.performWithHealing(locatorName, selector, async (sel) => {
            await this.page.locator(sel).pressSequentially(text, { ...options, timeout });
        });
    }

    /**
     * Performs a select text with self-healing fallback.
     * STRATEGY: Try user selector first → if fails → trigger healing → retry
     * @param locatorName - Logical name from locators.json
     * @param selector - Primary selector to try first
     */
    async selectTextHealed(
        locatorName: string,
        selector: string,
        options?: { force?: boolean; timeout?: number }
    ): Promise<void> {
        const timeout = options?.timeout || 5000;
        await this.performWithHealing(locatorName, selector, async (sel) => {
            await this.page.locator(sel).selectText({ ...options, timeout });
        });
    }

    /**
     * Performs a set checked with self-healing fallback.
     * STRATEGY: Try user selector first → if fails → trigger healing → retry
     * @param locatorName - Logical name from locators.json
     * @param selector - Primary selector to try first
     * @param checked - Whether to check or uncheck
     */
    async setCheckedHealed(
        locatorName: string,
        selector: string,
        checked: boolean,
        options?: { force?: boolean; timeout?: number }
    ): Promise<void> {
        const timeout = options?.timeout || 5000;
        await this.performWithHealing(locatorName, selector, async (sel) => {
            await this.page.locator(sel).setChecked(checked, { ...options, timeout });
        });
    }

    /**
     * Gets inner HTML with self-healing fallback.
     * STRATEGY: Try user selector first → if fails → trigger healing → retry
     * @param locatorName - Logical name from locators.json
     * @param selector - Primary selector to try first
     */
    async getInnerHTMLHealed(
        locatorName: string,
        selector: string,
        options?: { timeout?: number }
    ): Promise<string> {
        const timeout = options?.timeout || 5000;
        return await this.performWithHealing(locatorName, selector, async (sel) => {
            return await this.page.locator(sel).innerHTML({ timeout });
        });
    }

    /**
     * Gets text content with self-healing fallback.
     * STRATEGY: Try user selector first → if fails → trigger healing → retry
     * @param locatorName - Logical name from locators.json
     * @param selector - Primary selector to try first
     */
    async getTextContentHealed(
        locatorName: string,
        selector: string,
        options?: { timeout?: number }
    ): Promise<string | null> {
        const timeout = options?.timeout || 5000;
        return await this.performWithHealing(locatorName, selector, async (sel) => {
            return await this.page.locator(sel).textContent({ timeout });
        });
    }

    /**
     * Gets bounding box with self-healing fallback.
     * STRATEGY: Try user selector first → if fails → trigger healing → retry
     * @param locatorName - Logical name from locators.json
     * @param selector - Primary selector to try first
     */
    async boundingBoxHealed(
        locatorName: string,
        selector: string,
        options?: { timeout?: number }
    ): Promise<{ x: number; y: number; width: number; height: number } | null> {
        const timeout = options?.timeout || 5000;
        return await this.performWithHealing(locatorName, selector, async (sel) => {
            return await this.page.locator(sel).boundingBox({ timeout });
        });
    }

    /**
     * Scrolls element into view if needed with self-healing fallback.
     * STRATEGY: Try user selector first → if fails → trigger healing → retry
     * @param locatorName - Logical name from locators.json
     * @param selector - Primary selector to try first
     */
    async scrollIntoViewIfNeededHealed(
        locatorName: string,
        selector: string,
        options?: { timeout?: number }
    ): Promise<void> {
        const timeout = options?.timeout || 5000;
        await this.performWithHealing(locatorName, selector, async (sel) => {
            await this.page.locator(sel).scrollIntoViewIfNeeded({ ...options, timeout });
        });
    }

    /**
     * Dispatches event with self-healing fallback.
     * STRATEGY: Try user selector first → if fails → trigger healing → retry
     * @param locatorName - Logical name from locators.json
     * @param selector - Primary selector to try first
     * @param type - Event type
     * @param eventInit - Optional event initialization data
     */
    async dispatchEventHealed(
        locatorName: string,
        selector: string,
        type: string,
        eventInit?: any,
        options?: { timeout?: number }
    ): Promise<void> {
        const timeout = options?.timeout || 5000;
        await this.performWithHealing(locatorName, selector, async (sel) => {
            await this.page.locator(sel).dispatchEvent(type, eventInit, { ...options, timeout });
        });
    }

    /**
     * Gets ARIA snapshot with self-healing fallback.
     * STRATEGY: Try user selector first → if fails → trigger healing → retry
     * @param locatorName - Logical name from locators.json
     * @param selector - Primary selector to try first
     */
    async ariaSnapshotHealed(
        locatorName: string,
        selector: string,
        options?: { timeout?: number }
    ): Promise<string> {
        const timeout = options?.timeout || 5000;
        return await this.performWithHealing(locatorName, selector, async (sel) => {
            return await this.page.locator(sel).ariaSnapshot({ ...options, timeout });
        });
    }
}
