// routes/feedback.js - Feedback API routes
import { Router } from 'express';
import { db } from '../config/database.js';

const router = Router();

// Submit feedback
router.post('/', async (req, res) => {
  const feedback = {
    id: Date.now().toString(),
    ...req.body,
    timestamp: new Date().toISOString()
  };
  db.data.feedback ||= [];
  db.data.feedback.push(feedback);
  await db.write();
  res.json(feedback);
});

// Get feedback history
router.get('/', (req, res) => {
  res.json(db.data.feedback || []);
});

export default router;