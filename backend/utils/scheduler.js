// utils/scheduler.js - Cron job scheduler
import cron from 'node-cron';
import { MealPlannerService } from '../services/meal-planner.js';

const service = new MealPlannerService();

export const startScheduledTasks = () => {
  // Generate meal plan every Monday at 8 PM
  cron.schedule('0 20 * * 1', async () => {
    try {
      console.log('Running scheduled meal plan generation...');
      await service.generateWeeklyPlan();
    } catch (error) {
      console.error('Scheduled generation failed:', error);
    }
  });

  console.log('📅 Automatic meal plans will generate every Monday at 8 PM');
};