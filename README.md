# Automated Meal Planner with Mealie & Instacart

A fully automated meal planning system that:
- Generates weekly meal plans using Claude AI
- Tracks family allergies and preferences
- Creates shopping lists automatically
- Integrates with Instacart for grocery ordering
- Syncs with Mealie for recipe management

## Prerequisites

- Docker & Docker Compose
- Anthropic API key
- Instacart Connect API access
- New Seasons Market account (or other Instacart-partnered store)

## Quick Start

1. **Clone and Setup**
   ```bash
   git clone <your-repo>
   cd meal-planner
   cp .env.example .env
   ```

2. **Configure Environment Variables**
   Edit `.env` with your API keys and tokens:
   - Get Anthropic API key from https://console.anthropic.com/
   - Get Instacart API access from https://docs.instacart.com/connect/api/
   - After starting Mealie, get token from Settings > API Tokens

3. **Start Services**
   ```bash
   docker-compose up -d
   ```

4. **Access Applications**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001
   - Mealie: http://localhost:9000

5. **Initial Setup**
   - Create Mealie account at http://localhost:9000
   - Add your recipes to Mealie
   - Generate API token in Mealie settings
   - Update `.env` with MEALIE_TOKEN
   - Restart backend: `docker-compose restart meal-planner-backend`

6. **Configure Preferences**
   - Open http://localhost:3000
   - Go to Preferences tab
   - Add family members with allergies/dislikes
   - Set cooking time limits and budget

## Getting Instacart API Access

1. **Register for Instacart Connect**
   - Go to https://docs.instacart.com/connect/api/
   - Sign up for API access
   - Complete the onboarding process

2. **Get Retailer & Store IDs**
   - Find New Seasons Market in the retailer list
   - Note the retailer_id
   - Find your local store_id

3. **Generate Access Token**
   - Follow Instacart's OAuth flow
   - Save the access token to your `.env`

## How It Works

### Monday 8 PM (Automatic)
- System generates meal plan using Claude AI
- Considers all allergies, preferences, and past feedback
- Creates pending plan for your review

### You Review & Approve
- Check meal plan on dashboard
- Edit if needed
- Approve to generate shopping list
- Shopping list syncs to Mealie automatically

### Place Order
- Review shopping list
- Click "Place Order at New Seasons"
- Select pickup time
- Order placed through Instacart

### End of Week
- Submit feedback on meals
- System learns for next week's plan

## Project Structure

```
meal-planner/
├── backend/
│   ├── server.js           # Main backend service
│   ├── package.json
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.jsx        # React dashboard
│   │   └── main.jsx
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
├── .env.example
└── README.md
```

## API Endpoints

### Preferences
- `GET /api/preferences` - Get current preferences
- `POST /api/preferences` - Update preferences

### Meal Plans
- `GET /api/meal-plans` - Get all meal plans
- `GET /api/meal-plans/current` - Get current active plan
- `POST /api/meal-plans/generate` - Manually generate plan
- `POST /api/meal-plans/:id/approve` - Approve plan

### Orders
- `POST /api/orders` - Place Instacart order
- `GET /api/orders` - Get order history

### Feedback
- `POST /api/feedback` - Submit weekly feedback
- `GET /api/feedback` - Get feedback history

## Customization

### Change Schedule
Edit `server.js` cron expression:
```javascript
// Current: Every Monday at 8 PM
cron.schedule('0 20 * * 1', async () => { ... });

// Example: Every Sunday at 6 PM
cron.schedule('0 18 * * 0', async () => { ... });
```

### Change Meal Count
Edit the Claude prompt in `generateWithClaude()` to request different number of meals per week.

### Add Different Store
Replace Instacart configuration with any supported retailer. Check Instacart's retailer list.

## Troubleshooting

**Mealie connection error:**
- Ensure Mealie is running: `docker-compose ps`
- Check MEALIE_TOKEN is set correctly
- Verify token in Mealie UI

**Instacart API errors:**
- Check access token hasn't expired
- Verify retailer_id and store_id are correct
- Review Instacart API docs for rate limits

**Meal plan generation fails:**
- Check Anthropic API key
- Ensure preferences are configured
- Check backend logs: `docker-compose logs meal-planner-backend`

## Development

Run locally without Docker:

```bash
# Backend
cd backend
npm install
npm run dev

# Frontend
cd frontend
npm install
npm run dev
```
