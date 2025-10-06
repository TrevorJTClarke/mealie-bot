// config/database.js - Database setup and initialization
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Database setup (using lowdb for simplicity - can swap to PostgreSQL)
const adapter = new JSONFile(join(__dirname, '..', 'db.json'));
const db = new Low(adapter, {});

// Initialize database with proper structure
export const initializeDatabase = async () => {
  await db.read();
  db.data ||= {};
  db.data.preferences ||= null;
  db.data.mealPlans ||= [];
  db.data.feedback ||= [];
  db.data.orders ||= [];
  
  // Write initial structure if needed
  await db.write();
  return db;
};

export { db };