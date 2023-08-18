import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Constants and Configurations
const DEFAULT_NODE_ENV = 'development';
const nonEmptyString = z.string().nonempty({ message: 'Required' });

// Load environment files based on NODE_ENV
function loadEnvFiles() {
  const nodeEnv = process.env.NODE_ENV ?? DEFAULT_NODE_ENV;
  console.log(`App is running in ${nodeEnv} mode`);

  // Load environment-specific .env file (e.g. .env.local, .env.development, .env.test, .env.production etc.)
  dotenv.config({ path: path.resolve(process.cwd(), `.env.${nodeEnv}`) });
  // Load .env
  dotenv.config();
}

// Define and validate the required environment variables
function ensureRequiredEnvVariables() {
  const envSchema = z.object({
    HOST: nonEmptyString,
    PORT: nonEmptyString,
    DB_HOST: nonEmptyString,
    DB_USER: nonEmptyString,
    DB_PASSWORD: nonEmptyString,
    DB_NAME: nonEmptyString,
    JWT_SECRET: nonEmptyString,
    JWT_EXPIRES_IN: nonEmptyString,
  });

  const validationResult = envSchema.safeParse(process.env);

  if (!validationResult.success) {
    console.error('Environment variable validation failed:');
    validationResult.error.issues.forEach((issue) => {
      console.error(`- ${issue.path[0]}: ${issue.message}`);
    });
    process.exit(1);
  }
}

function main() {
  loadEnvFiles();
  ensureRequiredEnvVariables();
}

main();
