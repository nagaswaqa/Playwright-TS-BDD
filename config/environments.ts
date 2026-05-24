// config/environments.ts
// Registry of supported environments for the Playwright BDD framework.
// Each environment maps to a corresponding .env file located in the config directory.
// The .env filename follows the pattern `.env.UB.<env>` where <env> is the key below.

export interface EnvironmentInfo {
  /** Human readable description */
  description: string;
  /** Corresponding .env filename */
  envFile: string;
}

export const environments: Record<string, EnvironmentInfo> = {
  dev: {
    description: "Development environment",
    envFile: ".env.UB.dev",
  },
  qa: {
    description: "Quality Assurance environment",
    envFile: ".env.UB.qa",
  },
  uat: {
    description: "User Acceptance Testing environment",
    envFile: ".env.UB.uat",
  },
  staging: {
    description: "Staging environment",
    envFile: ".env.UB.staging",
  },
  prod: {
    description: "Production environment",
    envFile: ".env.UB.prod",
  },
};
