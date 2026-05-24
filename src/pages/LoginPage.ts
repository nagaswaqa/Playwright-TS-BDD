import { SelfHealingBasePage } from '../core/base/SelfHealingBasePage';
import { testContext } from '../core/support/test-context';
import { globalHealingEngine } from '../core/healing/HealingUtils';
import { testConfig } from '../../config/testConfig';
/**
 * Tuple describing one click in the recorded login sequence.
 * Exported so other entry points (e.g. global-setup) can reuse the same
 * selectors without depending on the test context.
 */
export interface LoginStep {
    name: string;
    selector: string;
}

/**
 * The recorded login bypass sequence captured against the demo Student
 * Information System at `/app`. The flow does not require credentials — the
 * user picks a role/tenant via on-screen buttons and confirms twice before
 * landing on the dashboard.
 */
export const LOGIN_BYPASS_SEQUENCE: LoginStep[] = [
    {
        name: 'login.preform.button1',
        selector:
            'div#root > div > div:nth-of-type(2) > form > div:nth-of-type(1) > div > button:nth-of-type(1)',
    },
    {
        name: 'login.preform.button3',
        selector:
            'div#root > div > div:nth-of-type(2) > form > div:nth-of-type(1) > div > button:nth-of-type(3)',
    },
    {
        name: 'login.preform.submit',
        selector:
            'div#root > div > div:nth-of-type(2) > form > button:nth-of-type(1)',
    },
    {
        name: 'login.sidenav.role3',
        selector: 'div#root > div > aside > nav > button:nth-of-type(3)',
    },
    {
        name: 'login.sidenav.role10',
        selector: 'div#root > div > aside > nav > button:nth-of-type(10)',
    },
    {
        name: 'login.header.confirm',
        selector: 'div#root > div > div > header > button',
    },
    {
        name: 'login.postform.button1',
        selector:
            'div#root > div > div:nth-of-type(2) > form > div:nth-of-type(1) > div > button:nth-of-type(1)',
    },
    {
        name: 'login.postform.submit',
        selector:
            'div#root > div > div:nth-of-type(2) > form > button:nth-of-type(1)',
    },
];

/**
 * CSS selector matching the dashboard sidebar. Used to detect whether the
 * current page is already authenticated so we can short-circuit login.
 */
export const DASHBOARD_READY_SELECTOR =
    'div.app-layout > aside.sidebar > nav.sidebar-nav';

export class LoginPage extends SelfHealingBasePage {
    private static readonly DEFAULT_BASE_URL = 'http://145.241.185.96/app';

    constructor() {
        super(testContext.page!, globalHealingEngine!);
    }

    /** Navigate to the application's landing page. */
    async open(): Promise<void> {
        const url = testConfig.baseUrl || LoginPage.DEFAULT_BASE_URL;
        await this.navigateTo(url);
    }

    /**
     * Resolve the application URL — env-driven, with a sensible default.
     */
    static resolveBaseUrl(): string {
        return testConfig.baseUrl || LoginPage.DEFAULT_BASE_URL;
    }

    /**
     * Navigate to the app, then run the recorded login sequence only if the
     * dashboard isn't already visible. With cached storageState the dashboard
     * is reached immediately and the click sequence is skipped.
     */
    async loginAndOpenDashboard(): Promise<void> {
        await this.open();
        if (await this.isDashboardVisible()) {
            return;
        }
        for (const step of LOGIN_BYPASS_SEQUENCE) {
            await this.clickHealed(step.name, step.selector);
        }
    }

    /** Quick check for the dashboard sidebar. */
    private async isDashboardVisible(): Promise<boolean> {
        try {
            return await this.page
                .locator(DASHBOARD_READY_SELECTOR)
                .first()
                .isVisible({ timeout: 1500 });
        } catch {
            return false;
        }
    }
}
