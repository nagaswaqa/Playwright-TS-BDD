import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';
import { testConfig } from './src/config/testConfig';

// Environment variables are now loaded by testConfig import
const bddDir = defineBddConfig({
    paths: ['features/*.feature'],
    require: [
        'src/core/support/fixtures.ts',
        'src/steps/demo-healing.steps.ts',
        'src/steps/mixed.steps.ts',
        'src/core/support/hooks.ts'
    ],
});

export const BROWSER_NAME = testConfig.browser;

export default defineConfig({
    timeout: process.env.PLAYWRIGHT_TIMEOUT ? parseInt(process.env.PLAYWRIGHT_TIMEOUT) : 90000,
    testDir: '.features-gen',
    testMatch: [
        /.*\.feature\.spec\.(ts|js)/,
        'tests/**/*.spec.ts',
        'examples/**/*.spec.ts'
    ],
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    // Workers configuration from master config
    workers: process.env.CI ? 1 : testConfig.workers,
    reporter: [
        ['html', { outputFolder: 'reports/html-report', open: 'never' }],
        ['list']
    ],
    outputDir: './reports/test-results',
    use: {
        baseURL: 'http://localhost:3000',
        headless: testConfig.headless, // Use headless setting from master config
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'on-first-retry',
        // Viewport from master config
        viewport: testConfig.viewport,
        // Add a real user agent to avoid bot detection
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    projects: [
        {
            name: testConfig.browser, // Use browser from master config
            use: { ...devices[testConfig.browser === 'firefox' ? 'Desktop Firefox' : testConfig.browser === 'webkit' ? 'Desktop Safari' : 'Desktop Chrome'] },
        }
    ]
});
