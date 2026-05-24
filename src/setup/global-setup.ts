import { FullConfig } from '@playwright/test';
import { ensureFresh } from '../core/auth/AuthCache';

/**
 * Playwright globalSetup hook.
 *
 * Delegates to the shared {@link AuthCache} so the cached storageState used
 * by worker contexts is in sync with the freshness check that runs in the
 * `Before` hook for long-running suites.
 */
export default async function globalSetup(_config: FullConfig): Promise<void> {
    await ensureFresh();
}
