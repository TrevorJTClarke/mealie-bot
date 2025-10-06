// services/meal-planner.js - Core meal planning service
import Anthropic from '@anthropic-ai/sdk';
import { MealieClient } from '../clients/mealie.js';
import { InstacartClient } from '../clients/instacart.js';
import { configuration } from '../config/environment.js';
import { db } from '../config/database.js';

export class MealPlannerService {
  constructor() {
    this.mealie = new MealieClient(configuration.mealie.url, configuration.mealie.token);
    this.instacart = new InstacartClient(
      configuration.instacart.accessToken,
      configuration.instacart.retailerId
    );
    this.anthropic = new Anthropic({ apiKey: configuration.anthropic.apiKey });
  }

  async generateWeeklyPlan() {
    console.log(`[${new Date().toISOString()}] Generating weekly meal plan...`);

    const preferences = db.data.preferences;
    if (!preferences) {
      throw new Error('No preferences configured');
    }

    const feedback = (db.data.feedback || []).slice(-5); // Last 5 feedbacks
    const recipes = await this.mealie.getRecipes();

    // Generate plan using Claude
    const planData = await this.generateWithClaude(preferences, recipes, feedback);

    // Create meal plan object
    const weekStart = this.getNextMonday();
    const mealPlan = {
      id: Date.now().toString(),
      weekStart: weekStart.toISOString().split('T')[0],
      meals: planData.meal_plan,
      notes: planData.notes,
      shoppingList: [],
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    // Save to database
    db.data.mealPlans ||= [];
    db.data.mealPlans.push(mealPlan);
    await db.write();

    return mealPlan;
  }

  async generateWithClaude(preferences, recipes, feedback) {
    const recipesText = recipes
      .slice(0, 50)
      .map(r => `- ${r.name}: ${r.description || 'No description'}`)
      .join('\n');

    const feedbackText = feedback
      .map(
        f =>
          `Previous feedback: Liked: ${f.likedMeals.join(', ')}, Disliked: ${f.dislikedMeals.join(', ')}. Notes: ${f.suggestions}`
      )
      .join('\n');

    const familyInfo = preferences.familyMembers
      .map(
        m =>
          `- ${m.name}: Allergies: ${m.allergies.join(', ') || 'none'}, Dislikes: ${m.dislikes.join(', ') || 'none'}, Preferences: ${m.preferences.join(', ') || 'none'}`
      )
      .join('\n');

    const prompt = `You are a meal planning assistant. Create a 7-day meal plan (dinner only) for this family.

FAMILY INFORMATION:
${familyInfo}

DIETARY RESTRICTIONS: ${preferences.dietaryRestrictions.join(', ') || 'none'}
MAX COOKING TIME: ${preferences.cookingTimeMax} minutes
BUDGET: ${preferences.budgetPerWeek ? '$' + preferences.budgetPerWeek : 'No limit'}
ADDITIONAL NOTES: ${preferences.notes || 'none'}

AVAILABLE RECIPES:
${recipesText}

PAST FEEDBACK:
${feedbackText || 'No previous feedback'}

Please create a meal plan that:
1. Avoids ALL allergens completely
2. Minimizes disliked foods
3. Incorporates preferences when possible
4. Provides variety (no repeating meals)
5. Balances nutrition across the week
6. Stays within cooking time limits
7. Learns from past feedback

Respond with a JSON object in this exact format:
{
  "meal_plan": [
    {
      "day": "Monday",
      "recipe_name": "Recipe Name",
      "reason": "Why this meal works for the family (one sentence)"
    }
  ],
  "notes": "Any important notes about this week's plan"
}

CRITICAL: Your entire response must be ONLY a valid JSON object. DO NOT include any text before or after the JSON.`;

    const message = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    });

    let responseText = message.content[0].text.trim();
    
    // Clean up response
    if (responseText.includes('```')) {
      const match = responseText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
      if (match) responseText = match[1];
    }

    return JSON.parse(responseText);
  }

  async approveMealPlan(planId, modifications = null) {
    const mealPlans = db.data.mealPlans || [];
    const plan = mealPlans.find(p => p.id === planId);
    if (!plan) throw new Error('Plan not found');

    if (modifications?.meals) {
      plan.meals = modifications.meals;
    }

    // Generate shopping list from recipes
    plan.shoppingList = await this.generateShoppingList(plan.meals);
    plan.status = 'approved';
    plan.approvedAt = new Date().toISOString();

    await db.write();

    // Sync to Mealie
    await this.syncToMealie(plan);

    return plan;
  }

  async generateShoppingList(meals) {
    const ingredients = [];
    
    for (const meal of meals) {
      // Find recipe in Mealie
      const recipes = await this.mealie.getRecipes();
      const recipe = recipes.find(
        r => r.name.toLowerCase() === meal.recipe_name.toLowerCase()
      );

      if (recipe) {
        const details = await this.mealie.getRecipeDetails(recipe.id);
        if (details.recipeIngredient) {
          details.recipeIngredient.forEach(ing => {
            ingredients.push({
              name: ing.food?.name || ing.note || ing.original_text,
              quantity: ing.quantity || 1,
              unit: ing.unit?.name || '',
              recipe: meal.recipe_name
            });
          });
        }
      }
    }

    // Consolidate duplicate ingredients
    const consolidated = {};
    ingredients.forEach(ing => {
      const key = ing.name.toLowerCase();
      if (consolidated[key]) {
        consolidated[key].quantity += ing.quantity;
      } else {
        consolidated[key] = ing;
      }
    });

    return Object.values(consolidated);
  }

  async placeGroceryOrder(planId, pickupTime) {
    const mealPlans = db.data.mealPlans || [];
    const plan = mealPlans.find(p => p.id === planId);
    if (!plan) throw new Error('Plan not found');
    if (plan.status !== 'approved') throw new Error('Plan must be approved first');

    // Create cart
    const cart = await this.instacart.createCart(configuration.instacart.storeId);

    // Search and add items
    const cartItems = [];
    for (const item of plan.shoppingList) {
      const products = await this.instacart.searchProducts(
        item.name,
        configuration.instacart.storeId
      );

      if (products.length > 0) {
        cartItems.push({
          product_id: products[0].id,
          quantity: Math.max(1, Math.floor(item.quantity))
        });
      }
    }

    // Add items to cart
    if (cartItems.length > 0) {
      await this.instacart.addItemsToCart(cart.id, cartItems);
    }

    // Checkout
    const order = await this.instacart.checkout(cart.id, pickupTime);

    // Save order info
    db.data.orders ||= [];
    db.data.orders.push({
      id: Date.now().toString(),
      planId,
      orderId: order.id,
      cartId: cart.id,
      pickupTime,
      createdAt: new Date().toISOString()
    });

    plan.status = 'ordered';
    await db.write();

    return order;
  }

  async syncToMealie(plan) {
    const weekStart = new Date(plan.weekStart);
    const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);

    // Create meal plan
    await this.mealie.createMealPlan(
      plan.weekStart,
      weekEnd.toISOString().split('T')[0],
      plan.meals
    );

    // Create shopping list
    if (plan.shoppingList.length > 0) {
      await this.mealie.createShoppingList(plan.shoppingList);
    }
  }

  getNextMonday() {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
    return new Date(today.getTime() + daysUntilMonday * 24 * 60 * 60 * 1000);
  }
}