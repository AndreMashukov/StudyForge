import * as path from 'path';
import { config } from 'dotenv';

export function loadEvalEnv(): void {
  config({ path: path.join(process.cwd(), '.env.local') });
  config({ path: path.join(process.cwd(), 'web/.env') });
  config({ path: path.join(process.cwd(), 'functions/.env.local') });
  config({ path: path.join(process.cwd(), 'functions/.secret.local') });
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.includes('your-langsmith') || value.includes('your_')) {
    throw new Error(`${name} is missing`);
  }
  return value;
}
