// clients/instacart.js - Instacart API client
import axios from 'axios';

export class InstacartClient {
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