import { Given, When, testContextStorage, logger } from '../core/support/base-step';
import { LoginPage } from '../pages/LoginPage';
import { StudentEnquiryPage } from '../pages/StudentEnquiryPage';

/**
 * Step definitions for `features/StudentEnquiryRecorded.feature`.
 *
 * Each step constructs a fresh page object so the POM can resolve the active
 * page from the AsyncLocalStorage-backed test context.
 *
 * Note: playwright-bdd parses fixture names from the first argument's
 * destructuring pattern, so the first arg must be `{}` or `{ page, ... }`.
 */

Given('the application is open', async function (this: any, {}: any) {
    testContextStorage.enterWith(this);
    logger.info('>> [STEP] Open application + ensure logged in');
    const login = new LoginPage();
    await login.loginAndOpenDashboard();
});

When('I navigate to the {string} section', async function (
    this: any,
    {}: any,
    sectionName: string,
) {
    testContextStorage.enterWith(this);
    logger.info(`>> [STEP] Navigate to section: ${sectionName}`);
    const page = new StudentEnquiryPage();
    await page.navigateToSection(sectionName);
});

When('I open the {string} modal', async function (
    this: any,
    {}: any,
    modalName: string,
) {
    testContextStorage.enterWith(this);
    logger.info(`>> [STEP] Open modal: ${modalName}`);
    const page = new StudentEnquiryPage();
    await page.openModal(modalName);
});

When('I select {string} from the {string} dropdown', async function (
    this: any,
    {}: any,
    value: string,
    label: string,
) {
    testContextStorage.enterWith(this);
    logger.info(`>> [STEP] Select "${value}" from dropdown "${label}"`);
    const page = new StudentEnquiryPage();
    await page.selectDropdown(label, value);
});

When('I select {string} from the {string} datepicker', async function (
    this: any,
    {}: any,
    value: string,
    label: string,
) {
    testContextStorage.enterWith(this);
    logger.info(`>> [STEP] Select "${value}" from datepicker "${label}"`);
    const page = new StudentEnquiryPage();
    await page.pickDate(label, value);
});

When('I open the filters panel', async function (this: any, {}: any) {
    testContextStorage.enterWith(this);
    logger.info('>> [STEP] Open filters panel');
    const page = new StudentEnquiryPage();
    await page.openFilters();
});

When('I edit the enquiry row matching {string}', async function (
    this: any,
    {}: any,
    rowText: string,
) {
    testContextStorage.enterWith(this);
    logger.info(`>> [STEP] Edit enquiry row: ${rowText}`);
    const page = new StudentEnquiryPage();
    await page.editEnquiryRow(rowText);
});

When('I save the changes', async function (this: any, {}: any) {
    testContextStorage.enterWith(this);
    logger.info('>> [STEP] Save changes');
    const page = new StudentEnquiryPage();
    await page.saveChanges();
});
