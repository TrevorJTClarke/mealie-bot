// server.js - Main backend service entry point
import express from 'express';
import cors from 'cors';
import { configuration } from './config/environment.js';
import { initializeDatabase } from './config/database.js';
import { startScheduledTasks } from './utils/scheduler.js';

// Route imports
import preferencesRoutes from './routes/preferences.js';
import mealPlansRoutes from './routes/meal-plans.js';
import feedbackRoutes from './routes/feedback.js';
import ordersRoutes from './routes/orders.js';

// Initialize Express
const app = express();
app.use(cors());
app.use(express.json());

// Initialize database
await initializeDatabase();

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/preferences', preferencesRoutes);
app.use('/api/meal-plans', mealPlansRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/orders', ordersRoutes);

// Start scheduled tasks
startScheduledTasks();

// Start server
const PORT = configuration.server.port;
app.listen(PORT, () => {
  console.log(`🚀 Meal Planner API running on port ${PORT}`);
});