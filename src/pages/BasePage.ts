import { Page, Response, Locator, FrameLocator } from '@playwright/test';

export abstract class BasePage {
    constructor(protected page: Page) { }

    // ================== Navigation Methods ==================

    async navigateTo(url: string, waitUntil: 'load' | 'domcontentloaded' | 'networkidle' | 'commit' = 'networkidle'): Promise<Response | null> {
        return await this.page.goto(url, { waitUntil });
    }

    async reload(waitUntil: 'load' | 'domcontentloaded' | 'networkidle' | 'commit' = 'networkidle'): Promise<Response | null> {
        return await this.page.reload({ waitUntil });
    }

    async goBack(waitUntil: 'load' | 'domcontentloaded' | 'networkidle' | 'commit' = 'networkidle'): Promise<Response | null> {
        return await this.page.goBack({ waitUntil });
    }

    async goForward(waitUntil: 'load' | 'domcontentloaded' | 'networkidle' | 'commit' = 'networkidle'): Promise<Response | null> {
        return await this.page.goForward({ waitUntil });
    }

    // ================== Locator Methods ==================

    locator(selector: string): Locator {
        return this.page.locator(selector);
    }

    getByRole(role: 'alert' | 'alertdialog' | 'application' | 'article' | 'banner' | 'blockquote' | 'button' | 'caption' | 'cell' | 'checkbox' | 'code' | 'columnheader' | 'combobox' | 'complementary' | 'contentinfo' | 'definition' | 'deletion' | 'dialog' | 'directory' | 'document' | 'emphasis' | 'feed' | 'figure' | 'form' | 'generic' | 'grid' | 'gridcell' | 'group' | 'heading' | 'img' | 'insertion' | 'link' | 'list' | 'listbox' | 'listitem' | 'log' | 'main' | 'marquee' | 'math' | 'meter' | 'menu' | 'menubar' | 'menuitem' | 'menuitemcheckbox' | 'menuitemradio' | 'navigation' | 'none' | 'note' | 'option' | 'paragraph' | 'presentation' | 'progressbar' | 'radio' | 'radiogroup' | 'region' | 'row' | 'rowgroup' | 'rowheader' | 'scrollbar' | 'search' | 'searchbox' | 'separator' | 'slider' | 'spinbutton' | 'status' | 'strong' | 'subscript' | 'superscript' | 'switch' | 'tab' | 'table' | 'tablist' | 'tabpanel' | 'term' | 'textbox' | 'time' | 'timer' | 'toolbar' | 'tooltip' | 'tree' | 'treegrid' | 'treeitem', options?: { name?: string | RegExp; exact?: boolean }): Locator {
        return this.page.getByRole(role, options);
    }

    getByText(text: string | RegExp, options?: { exact?: boolean }): Locator {
        return this.page.getByText(text, options);
    }

    getByLabel(text: string | RegExp, options?: { exact?: boolean }): Locator {
        return this.page.getByLabel(text, options);
    }

    getByPlaceholder(text: string | RegExp, options?: { exact?: boolean }): Locator {
        return this.page.getByPlaceholder(text, options);
    }

    getByAltText(text: string | RegExp, options?: { exact?: boolean }): Locator {
        return this.page.getByAltText(text, options);
    }

    getByTitle(text: string | RegExp, options?: { exact?: boolean }): Locator {
        return this.page.getByTitle(text, options);
    }

    getByTestId(testId: string): Locator {
        return this.page.getByTestId(testId);
    }

    frameLocator(selector: string): FrameLocator {
        return this.page.frameLocator(selector);
    }

    // ================== Interaction Methods ==================

    async click(selector: string | Locator, options?: { button?: 'left' | 'right' | 'middle'; clickCount?: number; delay?: number; force?: boolean; timeout?: number }): Promise<void> {
        const element = typeof selector === 'string' ? this.page.locator(selector) : selector;
        await element.click(options);
    }

    async doubleClick(selector: string | Locator, options?: { button?: 'left' | 'right' | 'middle'; delay?: number; force?: boolean; timeout?: number }): Promise<void> {
        const element = typeof selector === 'string' ? this.page.locator(selector) : selector;
        await element.dblclick(options);
    }

    async type(selector: string | Locator, text: string, options?: { delay?: number; timeout?: number }): Promise<void> {
        const element = typeof selector === 'string' ? this.page.locator(selector) : selector;
        await element.fill(text, options);
    }

    async fill(selector: string | Locator, text: string, options?: { force?: boolean; timeout?: number }): Promise<void> {
        const element = typeof selector === 'string' ? this.page.locator(selector) : selector;
        await element.fill(text, options);
    }

    async pressKey(selector: string | Locator, key: string, options?: { delay?: number; timeout?: number }): Promise<void> {
        const element = typeof selector === 'string' ? this.page.locator(selector) : selector;
        await element.press(key, options);
    }

    async hover(selector: string | Locator, options?: { force?: boolean; timeout?: number }): Promise<void> {
        const element = typeof selector === 'string' ? this.page.locator(selector) : selector;
        await element.hover(options);
    }

    async check(selector: string | Locator, options?: { force?: boolean; timeout?: number }): Promise<void> {
        const element = typeof selector === 'string' ? this.page.locator(selector) : selector;
        await element.check(options);
    }

    async uncheck(selector: string | Locator, options?: { force?: boolean; timeout?: number }): Promise<void> {
        const element = typeof selector === 'string' ? this.page.locator(selector) : selector;
        await element.uncheck(options);
    }

    async selectOption(selector: string | Locator, values: string | string[] | { value?: string; label?: string; index?: number }, options?: { force?: boolean; timeout?: number }): Promise<string[]> {
        const element = typeof selector === 'string' ? this.page.locator(selector) : selector;
        return await element.selectOption(values, options);
    }

    async dragAndDrop(source: string | Locator, target: string | Locator, options?: { force?: boolean; timeout?: number }): Promise<void> {
        const sourceElement = typeof source === 'string' ? this.page.locator(source) : source;
        const targetElement = typeof target === 'string' ? this.page.locator(target) : target;
        await sourceElement.dragTo(targetElement, options);
    }

    async uploadFile(selector: string | Locator, filePath: string | string[], options?: { timeout?: number }): Promise<void> {
        const element = typeof selector === 'string' ? this.page.locator(selector) : selector;
        await element.setInputFiles(filePath, options);
    }

    // ================== Element State Methods ==================

    async getText(selector: string | Locator): Promise<string> {
        const element = typeof selector === 'string' ? this.page.locator(selector) : selector;
        return (await element.textContent()) || '';
    }

    async getInnerText(selector: string | Locator): Promise<string> {
        const element = typeof selector === 'string' ? this.page.locator(selector) : selector;
        return await element.innerText();
    }

    async getInputValue(selector: string | Locator): Promise<string> {
        const element = typeof selector === 'string' ? this.page.locator(selector) : selector;
        return await element.inputValue();
    }

    async getAttribute(selector: string | Locator, name: string): Promise<string | null> {
        const element = typeof selector === 'string' ? this.page.locator(selector) : selector;
        return await element.getAttribute(name);
    }

    async isVisible(selector: string | Locator): Promise<boolean> {
        const element = typeof selector === 'string' ? this.page.locator(selector) : selector;
        return await element.isVisible();
    }

    async isHidden(selector: string | Locator): Promise<boolean> {
        const element = typeof selector === 'string' ? this.page.locator(selector) : selector;
        return await element.isHidden();
    }

    async isEnabled(selector: string | Locator): Promise<boolean> {
        const element = typeof selector === 'string' ? this.page.locator(selector) : selector;
        return await element.isEnabled();
    }

    async isDisabled(selector: string | Locator): Promise<boolean> {
        const element = typeof selector === 'string' ? this.page.locator(selector) : selector;
        return await element.isDisabled();
    }

    async isChecked(selector: string | Locator): Promise<boolean> {
        const element = typeof selector === 'string' ? this.page.locator(selector) : selector;
        return await element.isChecked();
    }

    async isEditable(selector: string | Locator): Promise<boolean> {
        const element = typeof selector === 'string' ? this.page.locator(selector) : selector;
        return await element.isEditable();
    }

    async count(selector: string | Locator): Promise<number> {
        const element = typeof selector === 'string' ? this.page.locator(selector) : selector;
        return await element.count();
    }

    // ================== Wait Methods ==================

    async waitForLoadState(state: 'load' | 'domcontentloaded' | 'networkidle' = 'load', options?: { timeout?: number }): Promise<void> {
        await this.page.waitForLoadState(state, options);
    }

    async waitForURL(url: string | RegExp | ((url: URL) => boolean), options?: { timeout?: number; waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit' }): Promise<void> {
        await this.page.waitForURL(url, options);
    }

    async waitForSelector(selector: string, options?: { state?: 'attached' | 'detached' | 'visible' | 'hidden'; timeout?: number }): Promise<Locator> {
        return this.page.locator(selector);
    }

    async waitForTimeout(timeout: number): Promise<void> {
        await this.page.waitForTimeout(timeout);
    }

    async waitForResponse(urlOrPredicate: string | RegExp | ((response: Response) => boolean | Promise<boolean>), options?: { timeout?: number }): Promise<Response> {
        return await this.page.waitForResponse(urlOrPredicate, options);
    }

    async waitForRequest(urlOrPredicate: string | RegExp, options?: { timeout?: number }): Promise<any> {
        return await this.page.waitForRequest(urlOrPredicate, options);
    }

    // ================== Page Information Methods ==================

    async getTitle(): Promise<string> {
        return await this.page.title();
    }

    getURL(): string {
        return this.page.url();
    }

    async getContent(): Promise<string> {
        return await this.page.content();
    }

    // ================== Screenshot & Media Methods ==================

    async screenshot(options?: { path?: string; fullPage?: boolean; type?: 'png' | 'jpeg'; quality?: number }): Promise<Buffer> {
        return await this.page.screenshot(options);
    }

    async screenshotElement(selector: string | Locator, options?: { path?: string; type?: 'png' | 'jpeg'; quality?: number }): Promise<Buffer> {
        const element = typeof selector === 'string' ? this.page.locator(selector) : selector;
        return await element.screenshot(options);
    }

    // ================== Evaluation & Script Methods ==================

    /**
     * Evaluate JavaScript code in the page context
     * @param pageFunction - Function to execute in browser context
     * @param arg - Optional argument to pass to the function
     * @returns Promise with the result of the function
     * @example
     * await page.evaluate(() => window.innerWidth);
     * await page.evaluate((text) => document.title = text, 'New Title');
     */
    async evaluate<R, Arg = undefined>(
        pageFunction: Arg extends undefined ? () => R | Promise<R> : (arg: Arg) => R | Promise<R>,
        arg?: Arg
    ): Promise<R> {
        return await this.page.evaluate(pageFunction as any, arg);
    }

    /**
     * Evaluate JavaScript code in the page context and return a JSHandle
     * Use this when you need to work with non-serializable return values
     * @param pageFunction - Function to execute in browser context
     * @param arg - Optional argument to pass to the function
     * @returns Promise with JSHandle
     */
    async evaluateHandle<Arg = undefined>(
        pageFunction: Arg extends undefined ? () => any | Promise<any> : (arg: Arg) => any | Promise<any>,
        arg?: Arg
    ): Promise<any> {
        return await this.page.evaluateHandle(pageFunction as any, arg);
    }

    /**
     * Evaluate JavaScript on a specific element (Modern approach using locator)
     * Replaces deprecated page.$eval() method
     * @param selector - Selector to find the element
     * @param pageFunction - Function to execute with the element
     * @param arg - Optional argument to pass to the function
     * @returns Promise with the result
     * @example
     * await page.evaluateOnSelector('#search', el => el.value);
     * await page.evaluateOnSelector('.container', (el, suffix) => el.innerHTML + suffix, 'hello');
     */
    async evaluateOnSelector<R, Arg = undefined>(
        selector: string | Locator,
        pageFunction: Arg extends undefined
            ? (element: Element) => R | Promise<R>
            : (element: Element, arg: Arg) => R | Promise<R>,
        arg?: Arg
    ): Promise<R> {
        const element = typeof selector === 'string' ? this.page.locator(selector) : selector;
        return await element.evaluate(pageFunction as any, arg);
    }

    /**
     * Evaluate JavaScript on all matching elements (Modern approach using locator)
     * Replaces deprecated page.$$eval() method
     * @param selector - Selector to find elements
     * @param pageFunction - Function to execute with the elements array
     * @param arg - Optional argument to pass to the function
     * @returns Promise with the result
     * @example
     * await page.evaluateOnSelectorAll('div', divs => divs.length);
     * await page.evaluateOnSelectorAll('a', (links, className) => 
     *   links.filter(l => l.className === className).length, 'active'
     * );
     */
    async evaluateOnSelectorAll<R, Arg = undefined>(
        selector: string,
        pageFunction: Arg extends undefined
            ? (elements: Element[]) => R | Promise<R>
            : (elements: Element[], arg: Arg) => R | Promise<R>,
        arg?: Arg
    ): Promise<R> {
        return await this.page.locator(selector).evaluateAll(pageFunction as any, arg);
    }

    // ================== Context & Viewport Methods ==================

    async setViewportSize(width: number, height: number): Promise<void> {
        await this.page.setViewportSize({ width, height });
    }

    viewportSize(): { width: number; height: number } | null {
        return this.page.viewportSize();
    }

    // ================== Dialog & Alert Handling ==================

    async handleDialog(accept: boolean = true, promptText?: string): Promise<void> {
        this.page.once('dialog', async dialog => {
            if (accept) {
                await dialog.accept(promptText);
            } else {
                await dialog.dismiss();
            }
        });
    }

    // ================== Keyboard & Mouse Methods ==================

    async keyboardPress(key: string, options?: { delay?: number }): Promise<void> {
        await this.page.keyboard.press(key, options);
    }

    async keyboardType(text: string, options?: { delay?: number }): Promise<void> {
        await this.page.keyboard.type(text, options);
    }

    async mouseClick(x: number, y: number, options?: { button?: 'left' | 'right' | 'middle'; clickCount?: number; delay?: number }): Promise<void> {
        await this.page.mouse.click(x, y, options);
    }

    // ================== Cookie Methods ==================

    async getCookies(): Promise<any[]> {
        return await this.page.context().cookies();
    }

    async setCookie(cookies: any[]): Promise<void> {
        await this.page.context().addCookies(cookies);
    }

    async clearCookies(): Promise<void> {
        await this.page.context().clearCookies();
    }

    // ================== Utility Methods ==================

    async bringToFront(): Promise<void> {
        await this.page.bringToFront();
    }

    async close(): Promise<void> {
        await this.page.close();
    }

    isClosed(): boolean {
        return this.page.isClosed();
    }
}
