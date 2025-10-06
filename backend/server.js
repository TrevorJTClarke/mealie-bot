// server.js - Main backend service
import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import Anthropic from '@anthropic-ai/sdk';
import axios from 'axios';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Initialize Express
const app = express();
app.use(cors());
app.use(express.json());

// Database setup (using lowdb for simplicity - can swap to PostgreSQL)
const adapter = new JSONFile(join(__dirname, 'db.json'));
const db = new Low(adapter, {});
await db.read();
db.data ||= { preferences: null, mealPlans: [], feedback: [], orders: [] };

// Configuration
const config = {
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
  }
};

// Clients
const anthropic = new Anthropic({ apiKey: config.anthropic.apiKey });

// ===== MEALIE CLIENT =====
class MealieClient {
  constructor(baseUrl, token) {
    this.baseUrl = baseUrl;
    this.headers = { Authorization: `Bearer ${token}` };
  }

  async getRecipes(limit = 100) {
    const response = await axios.get(`${this.baseUrl}/api/recipes`, {
      headers: this.headers,
      params: { perPage: limit }
    });
    return response.data.items;
  }

  async getRecipeDetails(recipeId) {
    const response = await axios.get(
      `${this.baseUrl}/api/recipes/${recipeId}`,
      { headers: this.headers }
    );
    return response.data;
  }

  async createMealPlan(startDate, endDate, meals) {
    const planDays = meals.map((meal, index) => ({
      date: new Date(startDate.getTime() + index * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0],
      meals: [
        {
          slug: meal.slug,
          name: meal.recipe_name,
          description: meal.reason
        }
      ]
    }));

    const response = await axios.post(
      `${this.baseUrl}/api/groups/mealplans`,
      { startDate, endDate, planDays },
      { headers: this.headers }
    );
    return response.data;
  }

  async createShoppingList(items) {
    const response = await axios.post(
      `${this.baseUrl}/api/groups/shopping/lists`,
      {
        name: `Weekly Shopping - ${new Date().toISOString().split('T')[0]}`,
        listItems: items.map(item => ({
          note: item.name,
          quantity: item.quantity || 1,
          unit: item.unit,
          food: { name: item.name }
        }))
      },
      { headers: this.headers }
    );
    return response.data;
  }
}

// ===== INSTACART CLIENT =====
class InstacartClient {
  constructor(accessToken, retailerId) {
    this.accessToken = accessToken;
    this.retailerId = retailerId;
    this.baseUrl = 'https://connect.instacart.com/v2';
  }

  async searchProducts(query, storeId) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/retailers/${this.retailerId}/locations/${storeId}/products/search`,
        {
          headers: { Authorization: `Bearer ${this.accessToken}` },
          params: { q: query, limit: 10 }
        }
      );
      return response.data.products || [];
    } catch (error) {
      console.error('Instacart search error:', error.response?.data || error.message);
      return [];
    }
  }

  async createCart(storeId) {
    const response = await axios.post(
      `${this.baseUrl}/carts`,
      {
        retailer_id: this.retailerId,
        location_id: storeId
      },
      { headers: { Authorization: `Bearer ${this.accessToken}` } }
    );
    return response.data;
  }

  async addItemsToCart(cartId, items) {
    const response = await axios.post(
      `${this.baseUrl}/carts/${cartId}/items`,
      { items },
      { headers: { Authorization: `Bearer ${this.accessToken}` } }
    );
    return response.data;
  }

  async checkout(cartId, pickupTime) {
    const response = await axios.post(
      `${this.baseUrl}/carts/${cartId}/checkout`,
      {
        service_option: {
          type: 'pickup',
          requested_start_at: pickupTime
        }
      },
      { headers: { Authorization: `Bearer ${this.accessToken}` } }
    );
    return response.data;
  }

  async getStoreAvailability(storeId) {
    const response = await axios.get(
      `${this.baseUrl}/retailers/${this.retailerId}/locations/${storeId}/availability`,
      { headers: { Authorization: `Bearer ${this.accessToken}` } }
    );
    return response.data;
  }
}

// ===== MEAL PLANNING SERVICE =====
class MealPlannerService {
  constructor() {
    this.mealie = new MealieClient(config.mealie.url, config.mealie.token);
    this.instacart = new InstacartClient(
      config.instacart.accessToken,
      config.instacart.retailerId
    );
  }

  async generateWeeklyPlan() {
    console.log(`[${new Date().toISOString()}] Generating weekly meal plan...`);

    const preferences = db.data.preferences;
    if (!preferences) {
      throw new Error('No preferences configured');
    }

    const feedback = db.data.feedback.slice(-5); // Last 5 feedbacks
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

    const message = await anthropic.messages.create({
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
    const plan = db.data.mealPlans.find(p => p.id === planId);
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
    const plan = db.data.mealPlans.find(p => p.id === planId);
    if (!plan) throw new Error('Plan not found');
    if (plan.status !== 'approved') throw new Error('Plan must be approved first');

    // Create cart
    const cart = await this.instacart.createCart(config.instacart.storeId);

    // Search and add items
    const cartItems = [];
    for (const item of plan.shoppingList) {
      const products = await this.instacart.searchProducts(
        item.name,
        config.instacart.storeId
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

const service = new MealPlannerService();

// ===== API ROUTES =====

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Preferences
app.get('/api/preferences', (req, res) => {
  res.json(db.data.preferences);
});

app.post('/api/preferences', async (req, res) => {
  db.data.preferences = req.body;
  await db.write();
  res.json({ status: 'saved', preferences: db.data.preferences });
});

// Meal Plans
app.get('/api/meal-plans', (req, res) => {
  res.json(db.data.mealPlans.sort((a, b) => 
    new Date(b.createdAt) - new Date(a.createdAt)
  ));
});

app.get('/api/meal-plans/current', (req, res) => {
  const current = db.data.mealPlans
    .filter(p => ['pending', 'approved'].includes(p.status))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
  res.json(current || null);
});

app.post('/api/meal-plans/generate', async (req, res) => {
  try {
    const plan = await service.generateWeeklyPlan();
    res.json(plan);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/meal-plans/:id/approve', async (req, res) => {
  try {
    const plan = await service.approveMealPlan(req.params.id, req.body);
    res.json(plan);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Feedback
app.post('/api/feedback', async (req, res) => {
  const feedback = {
    id: Date.now().toString(),
    ...req.body,
    timestamp: new Date().toISOString()
  };
  db.data.feedback.push(feedback);
  await db.write();
  res.json(feedback);
});

app.get('/api/feedback', (req, res) => {
  res.json(db.data.feedback);
});

// Grocery Orders
app.post('/api/orders', async (req, res) => {
  try {
    const { planId, pickupTime } = req.body;
    const order = await service.placeGroceryOrder(planId, pickupTime);
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/orders', (req, res) => {
  res.json(db.data.orders);
});

// Instacart store availability
app.get('/api/instacart/availability', async (req, res) => {
  try {
    const availability = await service.instacart.getStoreAvailability(
      config.instacart.storeId
    );
    res.json(availability);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== SCHEDULER =====
// Generate meal plan every Monday at 8 PM
cron.schedule('0 20 * * 1', async () => {
  try {
    console.log('Running scheduled meal plan generation...');
    await service.generateWeeklyPlan();
  } catch (error) {
    console.error('Scheduled generation failed:', error);
  }
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Meal Planner API running on port ${PORT}`);
  console.log(`📅 Automatic meal plans will generate every Monday at 8 PM`);
});