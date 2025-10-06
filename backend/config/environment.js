// config/environment.js - Environment configuration
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const __root = join(__dirname, '../..');

// Load .env from project root
config({ path: join(__root, '.env') });

export const configuration = {
  mealie: {
    url: process.env.MEALIE_URL || 'http://localhost:9000',
    token: process.env.MEALIE_TOKEN
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY
  },
  instacart: {
    accessToken: process.env.INSTACART_ACCESS_TOKEN,
    retailerId: process.env.INSTACART_RETAILER_ID, // New Seasons Market ID
    storeId: process.env.INSTACART_STORE_ID
  },
  server: {
    port: process.env.PORT || 3001
  }
};