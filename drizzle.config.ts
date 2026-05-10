import { config } from 'dotenv';
import type { Config } from 'drizzle-kit';

// Next.js loads .env.local automatically; standalone scripts (drizzle-kit) don't.
config({ path: '.env.local' });

export default {
  schema: './src/db/schema.ts',
  out: './drizzle/migrations',
  dialect: 'turso',
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
} satisfies Config;
