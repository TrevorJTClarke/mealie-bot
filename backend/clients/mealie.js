// clients/mealie.js - Mealie API client
import axios from 'axios';

export class MealieClient {
  constructor(baseUrl, token) {
    this.baseUrl = baseUrl;
    this.headers = { Authorization: `Bearer ${token}` };
    this.householdId = null;
    this.userId = null;
  }

  async getHouseholdId() {
    if (this.householdId) return this.householdId;
    
    try {
      const response = await axios.get(`${this.baseUrl}/api/groups/households`, {
        headers: this.headers
      });
      console.log('Households response:', JSON.stringify(response.data, null, 2));
      
      // Get the first household - typically the main/primary household
      if (response.data.items && response.data.items.length > 0) {
        this.householdId = response.data.items[0].id;
      } else if (Array.isArray(response.data) && response.data.length > 0) {
        this.householdId = response.data[0].id;
      } else if (response.data.id) {
        // Single household response
        this.householdId = response.data.id;
      }
      
      console.log('Found household ID:', this.householdId);
      
      if (!this.householdId) {
        console.error('No household ID found in response. Response structure:', response.data);
      }
      
      return this.householdId;
    } catch (error) {
      console.error('Failed to get household ID:', error.response?.status, error.response?.data || error.message);
      return null;
    }
  }

  async getUserId() {
    if (this.userId) return this.userId;
    
    try {
      const response = await axios.get(`${this.baseUrl}/api/users/self`, {
        headers: this.headers
      });
      console.log('User info response:', response.data);
      this.userId = response.data.id;
      console.log('Found user ID:', this.userId);
      return this.userId;
    } catch (error) {
      console.error('Failed to get user ID:', error.response?.status, error.response?.data || error.message);
      return null;
    }
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

  async createOrUpdateMealPlan(startDate, endDate, meals) {
    // Get required IDs
    const householdId = await this.getHouseholdId();
    const userId = await this.getUserId();
    
    if (!householdId) {
      throw new Error('Could not determine household ID for meal plan creation. Please ensure your Mealie instance has at least one household configured.');
    }
    if (!userId) {
      throw new Error('Could not determine user ID for meal plan creation.');
    }
    
    console.log(`Creating meal plan entries for ${meals.length} meals from ${startDate} to ${endDate}`);
    console.log('Household ID:', householdId, 'User ID:', userId);
    
    // Get all existing meal plan entries for the date range
    const existingEntries = await this.getMealPlanForWeek(startDate, endDate);
    console.log(`Found ${existingEntries.length} existing meal plan entries in date range`);
    
    // Create a map of existing entries by date for quick lookup
    const existingEntriesMap = new Map();
    existingEntries.forEach(entry => {
      if (entry.entryType === 'dinner') {
        existingEntriesMap.set(entry.date, entry);
      }
    });
    
    const startDateObj = startDate instanceof Date ? startDate : new Date(startDate);
    const results = [];
    const skipped = [];
    
    // Process each meal and map to its intended date
    for (let i = 0; i < meals.length; i++) {
      const meal = meals[i];
      const mealDate = new Date(startDateObj.getTime() + (i * 24 * 60 * 60 * 1000));
      const dateStr = mealDate.toISOString().split('T')[0];
      
      // Check if meal entry already exists for this date
      const existingEntry = existingEntriesMap.get(dateStr);
      
      if (existingEntry) {
        console.log(`Meal entry already exists for ${dateStr}:`, {
          date: existingEntry.date,
          recipeId: existingEntry.recipeId,
          entryType: existingEntry.entryType
        });
        skipped.push({
          date: dateStr,
          meal: meal,
          existing: existingEntry
        });
        continue;
      }
      
      const mealData = {
        date: dateStr,
        title: "",
        text: "",
        recipeId: meal.recipe_id || "",
        entryType: "dinner",
        existing: false,
        id: 0,
        groupId: householdId,
        userId: userId
      };
      
      console.log('Creating meal entry:', JSON.stringify(mealData, null, 2));
      
      try {
        const response = await axios.post(
          `${this.baseUrl}/api/households/mealplans`,
          mealData,
          { headers: this.headers }
        );
        
        console.log('Created meal entry response:', response.data);
        results.push(response.data);
      } catch (error) {
        console.error('Failed to create meal entry for', dateStr, ':', error.response?.data || error.message);
        throw error;
      }
    }
    
    const message = `Successfully created ${results.length} meal plan entries${skipped.length > 0 ? `, skipped ${skipped.length} existing entries` : ''}`;
    console.log(message);
    
    return {
      success: true,
      entries: results,
      skipped: skipped,
      message: message
    };
  }

  async getMealPlanEntryForDate(dateStr) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/api/households/mealplans`,
        { 
          headers: this.headers,
          params: { 
            startDate: dateStr, 
            endDate: dateStr
          }
        }
      );
      
      // Look for an entry on this specific date with entryType "dinner"
      const entries = response.data.items || response.data || [];
      const entry = entries.find(item => 
        item.date === dateStr && item.entryType === 'dinner'
      );
      
      return entry || null;
    } catch (error) {
      if (error.response?.status === 404) {
        return null;
      }
      console.error('Error getting meal plan entry for date:', error.response?.data || error.message);
      return null;
    }
  }

  async getMealPlanForWeek(startDate, endDate) {
    try {
      const householdId = await this.getHouseholdId();
      
      if (!householdId) {
        console.warn('No household ID available for meal plan lookup');
        return [];
      }

      console.log(`Getting meal plan for week: ${startDate} to ${endDate}`);
      
      const response = await axios.get(
        `${this.baseUrl}/api/households/mealplans`,
        { 
          headers: this.headers,
          params: { 
            startDate: startDate, 
            endDate: endDate
          }
        }
      );
      
      console.log('Week meal plan response:', response.data);
      return response.data.items || response.data || [];
    } catch (error) {
      console.error('Error getting weekly meal plan:', error.response?.data || error.message);
      return [];
    }
  }

  async getShoppingLists() {
    const householdId = await this.getHouseholdId();
    
    if (!householdId) {
      throw new Error('Could not determine household ID for shopping lists lookup.');
    }
    
    try {
      const response = await axios.get(
        `${this.baseUrl}/api/households/shopping/lists`,
        { headers: this.headers }
      );
      
      console.log('Retrieved shopping lists:', response.data);
      return response.data.items || response.data || [];
    } catch (error) {
      console.error('Failed to get shopping lists:', error.response?.data || error.message);
      throw error;
    }
  }

  async getShoppingListForWeek(startDate, endDate) {
    try {
      const shoppingLists = await this.getShoppingLists();
      
      // Look for a shopping list with a name that indicates it's for this week
      const weekIdentifier = startDate; // Use start date as week identifier
      const existingList = shoppingLists.find(list => 
        list.name && (
          list.name.includes(weekIdentifier) || 
          list.name.includes(`Weekly Shopping - ${weekIdentifier}`)
        )
      );
      
      console.log(`Looking for shopping list for week ${startDate} to ${endDate}`);
      if (existingList) {
        console.log('Found existing shopping list:', existingList.name);
      } else {
        console.log('No existing shopping list found for this week');
      }
      
      return existingList || null;
    } catch (error) {
      console.error('Error getting shopping list for week:', error.message);
      return null;
    }
  }

  async createEmptyShoppingList(name = null) {
    const householdId = await this.getHouseholdId();
    
    if (!householdId) {
      throw new Error('Could not determine household ID for shopping list creation.');
    }
    
    const listName = name || `Weekly Shopping - ${new Date().toISOString().split('T')[0]}`;
    
    try {
      const response = await axios.post(
        `${this.baseUrl}/api/households/shopping/lists`,
        { name: listName },
        { headers: this.headers }
      );
      
      console.log('Created shopping list:', response.data);
      return response.data;
    } catch (error) {
      console.error('Failed to create shopping list:', error.response?.data || error.message);
      throw error;
    }
  }

  async addRecipeToShoppingList(shoppingListId, recipeId, recipeIngredients = null) {
    try {
      const payload = [{
        recipeId: recipeId,
        recipeIncrementQuantity: 1
      }];
      
      // Include recipe ingredients if provided (for more detailed ingredient extraction)
      if (recipeIngredients) {
        payload[0].recipeIngredients = recipeIngredients;
      }
      
      const response = await axios.post(
        `${this.baseUrl}/api/households/shopping/lists/${shoppingListId}/recipe`,
        payload,
        { 
          headers: {
            ...this.headers,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log(`Added recipe ${recipeId} to shopping list ${shoppingListId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to add recipe to shopping list:', error.response?.data || error.message);
      throw error;
    }
  }

  async getOrCreateShoppingListForWeek(startDate, endDate) {
    try {
      // Step 1: Check if a shopping list already exists for this week
      console.log(`Checking for existing shopping list for week ${startDate} to ${endDate}`);
      const existingList = await this.getShoppingListForWeek(startDate, endDate);
      
      if (existingList) {
        console.log(`Found existing shopping list: ${existingList.name} (ID: ${existingList.id})`);
        return {
          shoppingList: existingList,
          isExisting: true
        };
      }
      
      // Step 2: Create a new shopping list for this week
      console.log('No existing shopping list found, creating new one');
      const listName = `Weekly Shopping - ${startDate}`;
      const newList = await this.createEmptyShoppingList(listName);
      console.log(`Created new shopping list: ${newList.name} (ID: ${newList.id})`);
      
      return {
        shoppingList: newList,
        isExisting: false
      };
      
    } catch (error) {
      console.error('Failed to get or create shopping list for week:', error.message);
      throw error;
    }
  }

  async getShoppingListItems(shoppingListId) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/api/households/shopping/lists/${shoppingListId}`,
        { headers: this.headers }
      );
      
      return response.data.listItems || [];
    } catch (error) {
      console.error('Failed to get shopping list items:', error.response?.data || error.message);
      return [];
    }
  }

  async createShoppingListFromMealPlan(startDate, endDate) {
    try {
      // Step 1: Get the meal plan for the week
      const mealPlanEntries = await this.getMealPlanForWeek(startDate, endDate);
      
      if (!mealPlanEntries || mealPlanEntries.length === 0) {
        console.log('No meal plan entries found for the specified week');
        return { success: false, message: 'No meal plan entries found for the specified week' };
      }
      
      console.log(`Raw meal plan entries retrieved: ${mealPlanEntries.length}`);
      
      // Step 2: Ensure we only process entries within the specified date range
      const startDateObj = new Date(startDate);
      const endDateObj = new Date(endDate);
      
      const entriesInDateRange = mealPlanEntries.filter(entry => {
        const entryDate = new Date(entry.date);
        const isInRange = entryDate >= startDateObj && entryDate <= endDateObj;
        if (!isInRange) {
          console.log(`Filtering out entry outside date range: ${entry.date} (recipe: ${entry.recipeId})`);
        }
        return isInRange;
      });
      
      console.log(`Entries within date range ${startDate} to ${endDate}: ${entriesInDateRange.length}`);
      
      // Step 3: Filter entries that have recipes
      const entriesWithRecipes = entriesInDateRange.filter(entry => entry.recipeId);
      
      if (entriesWithRecipes.length === 0) {
        console.log('No meal plan entries with recipes found in the specified date range');
        return { success: false, message: 'No meal plan entries with recipes found in the specified date range' };
      }
      
      // Remove duplicate recipe IDs
      const uniqueRecipeIds = [...new Set(entriesWithRecipes.map(entry => entry.recipeId))];
      console.log(`Found ${entriesWithRecipes.length} meal plan entries with recipes (${uniqueRecipeIds.length} unique recipes) in date range`);
      
      // Step 4: Get or create shopping list for this week (this gives us the shopping list ID)
      const { shoppingList, isExisting } = await this.getOrCreateShoppingListForWeek(startDate, endDate);
      const shoppingListId = shoppingList.id;
      
      console.log(`Using shopping list ID: ${shoppingListId} (${isExisting ? 'existing' : 'new'})`);
      
      // Step 5: If using existing list, check for recipes that are already added
      let existingRecipeIds = [];
      if (isExisting) {
        const existingItems = await this.getShoppingListItems(shoppingListId);
        existingRecipeIds = existingItems
          .filter(item => item.recipeId)
          .map(item => item.recipeId);
        console.log(`Found ${existingRecipeIds.length} existing recipes in shopping list`);
      }
      
      // Step 6: Add only new recipes to the shopping list
      let recipesAdded = 0;
      let recipesSkipped = 0;
      
      for (const recipeId of uniqueRecipeIds) {
        if (existingRecipeIds.includes(recipeId)) {
          console.log(`Recipe ${recipeId} already exists in shopping list, skipping`);
          recipesSkipped++;
          continue;
        }
        
        try {
          // Get recipe details to include ingredients if needed
          const recipeDetails = await this.getRecipeDetails(recipeId);
          const recipeIngredients = recipeDetails.recipeIngredient || null;
          
          await this.addRecipeToShoppingList(shoppingListId, recipeId, recipeIngredients);
          console.log(`Added recipe ${recipeId} to shopping list ${shoppingListId}`);
          recipesAdded++;
        } catch (error) {
          console.error(`Failed to add recipe ${recipeId} to shopping list ${shoppingListId}:`, error.message);
          // Continue with other recipes even if one fails
        }
      }
      
      let message;
      if (isExisting) {
        message = `Added ${recipesAdded} new recipes to existing shopping list: ${shoppingList.name}`;
        if (recipesSkipped > 0) {
          message += ` (skipped ${recipesSkipped} existing recipes)`;
        }
      } else {
        message = `Successfully created shopping list with ${recipesAdded} recipes`;
      }
      
      return {
        success: true,
        shoppingList: shoppingList,
        shoppingListId: shoppingListId,
        isExisting: isExisting,
        recipesAdded: recipesAdded,
        recipesSkipped: recipesSkipped,
        totalRecipes: uniqueRecipeIds.length,
        message: message
      };
      
    } catch (error) {
      console.error('Failed to create shopping list from meal plan:', error.message);
      throw error;
    }
  }

  // Legacy method for backward compatibility - now creates from meal plan
  async createShoppingList(startDate = null, endDate = null) {
    // If no dates provided, use current week
    if (!startDate || !endDate) {
      const today = new Date();
      const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
      const endOfWeek = new Date(today.setDate(today.getDate() - today.getDay() + 6));
      
      startDate = startOfWeek.toISOString().split('T')[0];
      endDate = endOfWeek.toISOString().split('T')[0];
    }
    
    return this.createShoppingListFromMealPlan(startDate, endDate);
  }
}