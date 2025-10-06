// routes/meal-plans.js - Meal plans API routes
import { Router } from 'express';
import { db } from '../config/database.js';
import { MealPlannerService } from '../services/meal-planner.js';

const router = Router();
const service = new MealPlannerService();

// Get all meal plans
router.get('/', (req, res) => {
  const mealPlans = db.data.mealPlans || [];
  res.json(mealPlans.sort((a, b) => 
    new Date(b.createdAt) - new Date(a.createdAt)
  ));
});

// Get current meal plan
router.get('/current', (req, res) => {
  const mealPlans = db.data.mealPlans || [];
  const current = mealPlans
    .filter(p => ['pending', 'approved'].includes(p.status))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
  res.json(current || null);
});

// Generate new meal plan
router.post('/generate', async (req, res) => {
  try {
    const plan = await service.generateWeeklyPlan();
    res.json(plan);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Approve meal plan
router.post('/:id/approve', async (req, res) => {
  try {
    const plan = await service.approveMealPlan(req.params.id, req.body);
    res.json(plan);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;