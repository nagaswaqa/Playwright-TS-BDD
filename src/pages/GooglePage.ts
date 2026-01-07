import { BasePage } from './BasePage';
import { Page, Locator } from '@playwright/test';

export class GooglePage extends BasePage {
    readonly q: string = '#APjFqb';
    readonly btnk: string = '[name="btnK"]';
    readonly btni: string = '[name="btnI"]';
    readonly btnk_1: string = '[name="btnK"]';
    readonly btni_1: string = '[name="btnI"]';
    readonly csi: string = '[name="csi"]';
    readonly spchx: string = '#spchx';
    readonly button: string = 'input';
    readonly button_1: string = 'input';
    readonly button_2: string = 'input';
    readonly button_3: string = 'input';

    constructor(page: Page) {
        super(page);
    }

    async goto() {
        await this.navigateTo('/');
    }

}