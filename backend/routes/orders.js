// routes/orders.js - Orders API routes
import { Router } from 'express';
import { db } from '../config/database.js';
import { MealPlannerService } from '../services/meal-planner.js';

const router = Router();
const service = new MealPlannerService();

// Place grocery order
router.post('/', async (req, res) => {
  try {
    const { planId, pickupTime } = req.body;
    const order = await service.placeGroceryOrder(planId, pickupTime);
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get order history
router.get('/', (req, res) => {
  res.json(db.data.orders || []);
});

// Get Instacart store availability
router.get('/instacart/availability', async (req, res) => {
  try {
    const { configuration } = await import('../config/environment.js');
    const availability = await service.instacart.getStoreAvailability(
      configuration.instacart.storeId
    );
    res.json(availability);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;