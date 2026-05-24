import { SelfHealingBasePage } from '../core/base/SelfHealingBasePage';
import { testContext } from '../core/support/test-context';
import { globalHealingEngine } from '../core/healing/HealingUtils';
import { testConfig } from '../../config/testConfig';

/**
 * Page Object for the Student Enquiry / Student Information System flow.
 *
 * Methods build multi-strategy CSS selectors so they remain robust as the
 * underlying app evolves. Each interaction goes through a `*Healed` helper,
 * giving every step access to the self-healing pipeline.
 *
 * Logical locator names follow a stable scheme so entries in
 * `resources/locators.json` can be tightened later without touching steps.
 */
export class StudentEnquiryPage extends SelfHealingBasePage {
    /** Used when no `BASE_URL` env var is configured. */
    private static readonly DEFAULT_BASE_URL = 'http://145.241.185.96/app';

    constructor() {
        super(testContext.page!, globalHealingEngine!);
    }

    // ── High-level actions ──────────────────────────────────────────────────

    /**
     * Open the application landing page.
     * @step Given the application is open
     */
    async open(): Promise<void> {
        const url = testConfig.baseUrl || StudentEnquiryPage.DEFAULT_BASE_URL;
        await this.navigateTo(url);
    }

    /**
     * Click a top-level section in the sidebar navigation by visible text.
     * @step When I navigate to the "<section>" section
     */
    async navigateToSection(sectionName: string): Promise<void> {
        const locatorName = `sidebar.section.${StudentEnquiryPage.slug(sectionName)}`;
        const selector = [
            `nav.sidebar-nav a:has-text("${sectionName}")`,
            `aside.sidebar a:has-text("${sectionName}")`,
            `nav a:has-text("${sectionName}")`,
            `[role="link"]:has-text("${sectionName}")`,
        ].join(', ');
        await this.clickHealed(locatorName, selector);
    }

    /**
     * Click the trigger that opens a named modal.
     * @step When I open the "<modal>" modal
     */
    async openModal(modalName: string): Promise<void> {
        const locatorName = `modal.trigger.${StudentEnquiryPage.slug(modalName)}`;
        const selector = [
            `button:has-text("${modalName}")`,
            `[role="button"]:has-text("${modalName}")`,
            `a:has-text("${modalName}")`,
        ].join(', ');
        await this.clickHealed(locatorName, selector);
    }

    /**
     * Select a value from a dropdown identified by its visible label.
     * Tries native `<select>` first, then falls back to a custom dropdown
     * (click trigger → click option with matching text).
     * @step When I select "<value>" from the "<label>" dropdown
     */
    async selectDropdown(label: string, value: string): Promise<void> {
        const locatorName = `field.dropdown.${StudentEnquiryPage.slug(label)}`;
        const nativeSelector = this.fieldSelector(label, 'select');

        try {
            await this.selectOptionHealed(locatorName, nativeSelector, { label: value });
            return;
        } catch {
            // Not a native <select> — fall through to custom dropdown handling.
        }

        const triggerSelector = this.fieldSelector(
            label,
            '.dropdown, [role="combobox"], [role="button"], button',
        );
        await this.clickHealed(`${locatorName}.trigger`, triggerSelector);

        const optionSelector = [
            `[role="option"]:has-text("${value}")`,
            `li:has-text("${value}")`,
            `.dropdown-item:has-text("${value}")`,
        ].join(', ');
        await this.clickHealed(
            `${locatorName}.option.${StudentEnquiryPage.slug(value)}`,
            optionSelector,
        );
    }

    /**
     * Fill a date / datetime input identified by its visible label.
     * @step When I select "<isoDate>" from the "<label>" datepicker
     */
    async pickDate(label: string, isoDate: string): Promise<void> {
        const locatorName = `field.datepicker.${StudentEnquiryPage.slug(label)}`;
        const selector = this.fieldSelector(
            label,
            'input[type="date"], input[type="datetime-local"], input.form-control',
        );
        await this.fillHealed(locatorName, selector, isoDate);
    }

    /**
     * Open the filters panel inside the current page (used by the Enquiries
     * list view to expose the Source / Programme dropdowns).
     * @step When I open the filters panel
     */
    async openFilters(): Promise<void> {
        const locatorName = 'enquiries.button.filters';
        const selector = [
            'button:has-text("Filters")',
            '[role="button"]:has-text("Filters")',
            'button.btn-secondary:has-text("Filters")',
        ].join(', ');
        await this.clickHealed(locatorName, selector);
    }

    /**
     * Open the edit modal for a row identified by visible text (e.g. an
     * enquiry reference like `ENQ-2026-0015` or a student name).
     * @step When I edit the enquiry row matching "<rowText>"
     */
    async editEnquiryRow(rowText: string): Promise<void> {
        const locatorName = `enquiries.row.edit.${StudentEnquiryPage.slug(rowText)}`;
        const selector = [
            `table.data-table tbody tr:has-text("${rowText}") td:last-child button.btn-ghost:nth-of-type(2)`,
            `table.data-table tbody tr:has-text("${rowText}") button[title*="Edit" i]`,
            `table.data-table tbody tr:has-text("${rowText}") button.btn-ghost:has-text("Edit")`,
            `table.data-table tbody tr:has-text("${rowText}") td:last-child button:nth-of-type(2)`,
        ].join(', ');
        await this.clickHealed(locatorName, selector);
    }

    /**
     * Click the primary "Save Changes" button inside the currently open modal
     * footer.
     * @step When I save the changes
     */
    async saveChanges(): Promise<void> {
        const locatorName = 'modal.button.save_changes';
        const selector = [
            'div.modal-footer button.btn-primary:has-text("Save Changes")',
            'div.modal-footer button:has-text("Save Changes")',
            'button.btn-primary:has-text("Save Changes")',
            'button:has-text("Save Changes")',
        ].join(', ');
        await this.clickHealed(locatorName, selector);
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    /**
     * Build a multi-strategy CSS selector that finds a control by its label.
     */
    private fieldSelector(label: string, leaf: string): string {
        return [
            `label:has-text("${label}") ~ ${leaf}`,
            `label:has-text("${label}") + ${leaf}`,
            `label:has-text("${label}") + * ${leaf}`,
            `[aria-label="${label}"]`,
        ].join(', ');
    }

    private static slug(input: string): string {
        return input
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_|_$/g, '');
    }
}
