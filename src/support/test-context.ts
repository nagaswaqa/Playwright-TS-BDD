import { setWorldConstructor, World, IWorldOptions } from '@cucumber/cucumber';
import { BrowserContext, Page, APIRequestContext } from '@playwright/test';
import { AsyncLocalStorage } from 'async_hooks';

export interface ITestContextData {
    [key: string]: any;
}

export class TestContext extends World {
    public context?: BrowserContext;
    public page?: Page;
    public apiContext?: APIRequestContext;
    public testData: ITestContextData = {};

    constructor(options: IWorldOptions) {
        super(options);
    }

    public setValue(key: string, value: any): void {
        this.testData[key] = value;
    }

    public getValue(key: string): any {
        return this.testData[key];
    }
}

try {
    setWorldConstructor(TestContext);
} catch (e) {
    // bddgen CLI might load this file before Cucumber is ready
}

/**
 * AsyncLocalStorage to provide global access to the current scenario's TestContext.
 */
export const testContextStorage = new AsyncLocalStorage<TestContext>();

/**
 * A global proxy object to access the current TestContext from anywhere.
 * Usage: testContext.getValue('KEY')
 */
export const testContext = {
    getValue: (key: string) => testContextStorage.getStore()?.getValue(key),
    setValue: (key: string, value: any) => testContextStorage.getStore()?.setValue(key, value),
    get page(): Page | undefined { return testContextStorage.getStore()?.page; },
    get apiContext(): APIRequestContext | undefined { return testContextStorage.getStore()?.apiContext; },
    get context(): BrowserContext | undefined { return testContextStorage.getStore()?.context; }
};
