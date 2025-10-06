// clients/mealie.js - Mealie API client
import axios from 'axios';

export class MealieClient {
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