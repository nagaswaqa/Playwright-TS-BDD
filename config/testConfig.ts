import path from 'path';
import * as dotenv from 'dotenv';
import fs from 'fs';
import { environments } from './environments';
// ===========================
// DEFAULT CONFIGURATION VALUES
// ===========================
const DEFAULT_ENV = 'dev';                  // Default environment (dev, qa, etc.)
const DEFAULT_BROWSER = 'chromium';         // Default browser (chromium, firefox, webkit)
const DEFAULT_HEADLESS = false;              // Default to invisible mode (true)
const DEFAULT_WORKERS = 3;          // Parallel execution with Singleton Page support
const DEFAULT_VIEWPORT = { width: 1920, height: 1080 }; // Full HD

// ===========================
// CONFIGURATION LOGIC
// ===========================

// 1. Resolve Environment Name using registry
const envKey = process.env.ENV || DEFAULT_ENV;
const selectedEnv = environments[envKey] ?? environments[DEFAULT_ENV];
// 2. Resolve .env file path from registry
let envFile = path.resolve(process.cwd(), 'config', selectedEnv.envFile);
if (!fs.existsSync(envFile)) {
    // If the specific .env file does not exist, create an empty placeholder
    fs.writeFileSync(envFile, `# Auto-generated env file for ${envKey}\n`);
}


// 3. Load Environment Variables (Synchronously)
dotenv.config({ path: envFile });

/**
 * MASTER CONFIGURATION FILE
 * -------------------------
 * Use this file to configure your test execution settings.
 * You can set defaults by changing the constants at the top of this file.
 */
export const testConfig = {
    // Environment Configuration
    env: envKey,
    envFile: envFile,

    // Browser Configuration
    browser: process.env.BROWSER_NAME || DEFAULT_BROWSER,

    // Headless Mode
    // true = Invisible (faster), false = Visible (for debugging)
    headless: process.env.HEADLESS ? process.env.HEADLESS === 'true' : DEFAULT_HEADLESS,

    // Worker Count
    // undefined = Use all available cores (Playwright default)
    workers: process.env.WORKERS ? parseInt(process.env.WORKERS, 10) : DEFAULT_WORKERS,

    // Viewport Settings
    viewport: DEFAULT_VIEWPORT,

    // Paths
    rootDir: process.cwd(),

    // Self‑Healing / auditing toggle
    // Set HEALING_AUDIT=false to disable the audit logger at runtime
    enableHealingAudit: process.env.HEALING_AUDIT !== 'false',

    // ZAP security proxy
    // When `ZAP_PROXY=1` (set by `npm run test:security`), all worker
    // contexts route HTTP traffic through the running ZAP daemon. Default
    // port matches `scripts/Start-Zap.ps1`.
    zapProxyEnabled: process.env.ZAP_PROXY === '1' || process.env.ZAP_PROXY === 'true',
    zapProxyHost: process.env.ZAP_PROXY_HOST || '127.0.0.1',
    zapProxyPort: process.env.ZAP_PROXY_PORT ? parseInt(process.env.ZAP_PROXY_PORT, 10) : 8090,

    // Helpers
    getEnvPath: function () {
        return this.envFile;
    },

    // Base URL from env
    baseUrl: process.env.BASE_URL || ''
};
