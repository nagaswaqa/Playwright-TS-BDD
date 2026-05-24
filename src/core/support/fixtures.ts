import { test as base } from 'playwright-bdd';
import { BrowserContext, Page, Browser, BrowserContextOptions } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { testConfig } from '../../../config/testConfig';

/** Optional storage state captured by global-setup; reused when present. */
const STORAGE_STATE_FILE = path.resolve(process.cwd(), '.auth', 'user.json');

// Define types for scenario and worker fixtures
type MyTestFixtures = {
    readonlyContext: BrowserContext; // dummy if needed
};

type MyWorkerFixtures = {
    workerContext: BrowserContext;
    workerPage: Page;
};

/**
 * Custom fixtures to support Singleton Page per Worker.
 */
export const test = base.extend<MyTestFixtures, MyWorkerFixtures>({
    // 1. Define worker-scoped BrowserContext
    workerContext: [async ({ browser }: { browser: Browser }, use: (r: BrowserContext) => Promise<void>) => {
        const opts: BrowserContextOptions = {
            viewport: testConfig.viewport,
            ignoreHTTPSErrors: true,
            locale: 'en-US',
        };
        if (fs.existsSync(STORAGE_STATE_FILE)) {
            opts.storageState = STORAGE_STATE_FILE;
        }
        if (testConfig.zapProxyEnabled) {
            // Route every browser request through the local ZAP daemon so its
            // passive-scan rules can analyse traffic without changing the test.
            opts.proxy = {
                server: `http://${testConfig.zapProxyHost}:${testConfig.zapProxyPort}`,
            };
            // ZAP issues its own dynamic CA cert; ignore TLS so HTTPS targets
            // still load. The `Start-Zap.ps1` orchestrator owns telling the
            // operator how to install the cert if they want green padlocks.
            opts.ignoreHTTPSErrors = true;
        }
        const context = await browser.newContext(opts);
        await use(context);
        await context.close();
    }, { scope: 'worker' }],

    // 2. Define worker-scoped Page
    workerPage: [async ({ workerContext }: MyWorkerFixtures, use: (r: Page) => Promise<void>) => {
        const page = await workerContext.newPage();
        await use(page);
        await page.close();
    }, { scope: 'worker' }],

    // 3. Override standard scenario-scoped context to use the worker-scoped one
    context: async ({ workerContext }: MyWorkerFixtures, use: (r: BrowserContext) => Promise<void>) => {
        await use(workerContext);
    },

    // 4. Override standard scenario-scoped page to use the worker-scoped one
    page: async ({ workerPage }: MyWorkerFixtures, use: (r: Page) => Promise<void>) => {
        await use(workerPage);
    },
});
