import { BasePage } from './BasePage';
import { Page, Locator } from '@playwright/test';

export class TradetronStrategiesPage extends BasePage {
    readonly searchstring: string = '[name="searchString"]';
    readonly latest: string = '#latest';
    readonly minfees: string = '#minFees';
    readonly maxdeployment: string = '#maxDeployment';
    readonly mincapital: string = '#minCapital';
    readonly algostrategy: string = '#AlgoStrategy';
    readonly stockbag: string = '#StockBag';
    readonly tags__: string = '#tags[]';
    readonly exchanges__: string = '#exchanges[]';
    readonly fixed_fee: string = '#strategyFilterFeeFree';
    readonly fixed_fee_1: string = '#strategyFilterFeePaid';
    readonly searchstring_1: string = '[name="searchString"]';
    readonly email: string = '#modalEmailSignIn';
    readonly password: string = '#modalPasswordSignIn';
    readonly altcha_checkbox_74525284: string = '#altcha_checkbox_74525284';
    readonly name: string = '#modalFullNameSignUp';
    readonly email_1: string = '#modalEmailSignUp';
    readonly phone_code: string = '#modalCountryCodeSignUp';
    readonly mobile: string = '#modalPhoneSignUp';
    readonly country_id: string = '#country_id';
    readonly state_id: string = '#state_id';
    readonly password_1: string = '#modalPasswordSignUp';
    readonly terms_of_service: string = '#modalAgreeSignUp';
    readonly altcha_checkbox_82370232: string = '#altcha_checkbox_82370232';
    readonly in: string = 'role=button[name="IN"]';
    readonly features: string = 'role=button[name="Features"]';
    readonly use_cases: string = 'role=button[name="Use cases"]';
    readonly services: string = 'role=button[name="Services"]';
    readonly sign_up: string = '#headerSignUpLink';
    readonly sign_in: string = 'xpath=//*[@id="header"]/div[1]/div[1]/div[1]/div[1]/div[4]/div[2]/div[2]/div[1]/a[2]';
    readonly features_1: string = 'role=button[name="Features"]';
    readonly use_cases_1: string = 'role=button[name="Use cases"]';
    readonly services_1: string = 'role=button[name="Services"]';
    readonly in_1: string = 'role=button[name="IN"]';
    readonly sign_up_1: string = 'xpath=//*[@id="header"]/div[1]/div[1]/div[1]/div[3]/div[1]/a[1]';
    readonly sign_in_1: string = 'xpath=//*[@id="header"]/div[1]/div[1]/div[1]/div[3]/div[1]/a[2]';
    readonly button: string = 'xpath=//*[@id="left-filter-menu"]/div[1]/div[1]/div[1]/div[1]/button[1]';
    readonly reset: string = 'role=button[name="Reset"]';
    readonly submit: string = 'role=button[name="Submit"]';
    readonly button_1: string = 'xpath=//*[@id="strategy"]/div[3]/div[1]/div[1]/div[1]/div[1]/div[2]/div[1]/div[1]/form[1]/div[1]/div[1]/div[1]/button[1]';
    readonly purchase_plan: string = 'role=button[name="Purchase plan"]';
    readonly proceed: string = 'role=button[name="Proceed"]';
    readonly go_to_my_strategies: string = 'role=button[name="Go to My Strategies"]';
    readonly close_1: string = 'role=button[name="Close"]';
    readonly cancel: string = 'role=button[name="Close"]';
    readonly confirm: string = 'role=button[name="Close"]';
    readonly sign_in_2: string = 'role=button[name="Sign in"]';
    readonly sign_in_with_faceboo: string = 'xpath=//*[@id="signinModal"]/div[1]/div[1]/div[2]/div[1]/div[2]/a[1]';
    readonly sign_in_with_google: string = 'xpath=//*[@id="signinModal"]/div[1]/div[1]/div[2]/div[1]/div[2]/a[2]';
    readonly sign_up_2: string = 'role=button[name="Sign up"]';
    readonly sign_in_with_faceboo_1: string = 'xpath=//*[@id="signupModal"]/div[1]/div[1]/div[2]/div[1]/div[2]/a[1]';
    readonly sign_in_with_google_1: string = 'xpath=//*[@id="signupModal"]/div[1]/div[1]/div[2]/div[1]/div[2]/a[2]';
    readonly tour: string = 'role=button[name="TOUR"]';

    constructor(page: Page) {
        super(page);
    }

    /**
     * Navigates to the Tradetron Strategies page.
     */
    async goto() {
        await this.navigateTo('/strategies');
    }

    /**
     * Searches for a specific strategy by query string.
     * @param query - The search term to use.
     */
    async searchStrategy(query: string) {
        await this.fill(this.searchstring, query);
        await this.pressKey(this.searchstring, 'Enter');
    }

    /**
     * Applies filters to the strategies list.
     * @param options - Filter options including latest, fees, deployment, and capital.
     */
    async applyFilters(options: {
        latest?: boolean,
        minFees?: string,
        maxDeployment?: string,
        minCapital?: string
    }) {
        if (options.latest) await this.click(this.latest);
        if (options.minFees) await this.fill(this.minfees, options.minFees);
        if (options.maxDeployment) await this.fill(this.maxdeployment, options.maxDeployment);
        if (options.minCapital) await this.fill(this.mincapital, options.minCapital);
        await this.click(this.submit);
    }

    /**
     * Resets all search and filter inputs.
     */
    async resetFilters() {
        await this.click(this.reset);
    }

    /**
     * Performs a login operation using the sign-in modal.
     * @param email - User's email.
     * @param password - User's password.
     */
    async signIn(email: string, password: string) {
        await this.click(this.sign_in);
        await this.fill(this.email, email);
        await this.fill(this.password, password);
        await this.click(this.sign_in_2);
    }

    /**
     * Navigates to the sign-up modal and fills in user details.
     * @param details - Object containing full name, email, mobile, and password.
     */
    async signUp(details: {
        name: string,
        email: string,
        phoneCode: string,
        mobile: string,
        countryId: string,
        stateId: string,
        password: string
    }) {
        await this.click(this.sign_up);
        await this.fill(this.name, details.name);
        await this.fill(this.email_1, details.email);
        await this.selectOption(this.phone_code, details.phoneCode);
        await this.fill(this.mobile, details.mobile);
        await this.selectOption(this.country_id, details.countryId);
        await this.selectOption(this.state_id, details.stateId);
        await this.fill(this.password_1, details.password);
        await this.check(this.terms_of_service);
    }
}