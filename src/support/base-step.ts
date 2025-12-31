import { createBdd, test } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { TestContext, testContext, testContextStorage } from './test-context';
import { RestApiClient } from '../api/RestApiClient';
import { logger } from './logger';

export const { Given, When, Then, Before, After, BeforeAll, AfterAll } = createBdd<TestContext>();
export { TestContext, expect, testContext, RestApiClient, logger, testContextStorage, test };
