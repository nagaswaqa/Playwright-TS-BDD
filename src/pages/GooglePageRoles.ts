import { BasePage } from './BasePage';
import { Page, Locator } from '@playwright/test';

export class GooglePageRoles extends BasePage {
    readonly q: string = 'role=combobox[name="Search"]';
    readonly btnk: string = 'role=button[name="Google Search"]';
    readonly btni: string = '[name="btnI"]';
    readonly btnk_1: string = 'role=button[name="Google Search"]';
    readonly btni_1: string = '[name="btnI"]';
    readonly csi: string = '[name="csi"]';
    readonly spchx: string = 'role=button[name="close"]';
    readonly button: string = 'role=button[name="Google Search"]';
    readonly button_1: string = '[name="btnI"]';
    readonly button_2: string = 'role=button[name="Google Search"]';
    readonly button_3: string = '[name="btnI"]';

    constructor(page: Page) {
        super(page);
    }

    async goto() {
        await this.navigateTo('/');
    }

}