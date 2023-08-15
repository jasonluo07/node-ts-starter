import dotenv from 'dotenv';
import path from 'path';

const nodeEnv = process.env.NODE_ENV;
console.log(`App is running in ${nodeEnv} mode`);

if (!nodeEnv) {
  console.log('The NODE_ENV environment variable is required but was not specified.');
  process.exit(1);
}

// First, load the default .env file
dotenv.config();

// Based on the NODE_ENV, load the corresponding .env.{NODE_ENV} file
dotenv.config({
  path: path.resolve(process.cwd(), `.env.${nodeEnv}`),
});

// Finally, load the .env.local file, typically used to override some local settings
dotenv.config({
  path: path.resolve(process.cwd(), '.env.local'),
});
