// routes/preferences.js - Preferences API routes
import { Router } from 'express';
import { db } from '../config/database.js';

const router = Router();

// Get preferences
router.get('/', (req, res) => {
  res.json(db.data.preferences);
});

// Save preferences
router.post('/', async (req, res) => {
  db.data.preferences = req.body;
  await db.write();
  res.json({ status: 'saved', preferences: db.data.preferences });
});

export default router;