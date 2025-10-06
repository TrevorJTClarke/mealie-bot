import React, { useState, useEffect } from 'react';
import { Calendar, ShoppingCart, Settings, Check, X, Edit2, Clock, DollarSign } from 'lucide-react';

const API_URL = 'http://localhost:3001/api';

export default function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [mealPlan, setMealPlan] = useState(null);
  const [preferences, setPreferences] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadCurrentPlan();
    loadPreferences();
  }, []);

  const loadCurrentPlan = async () => {
    try {
      const res = await fetch(`${API_URL}/meal-plans/current`);
      const data = await res.json();
      setMealPlan(data);
    } catch (error) {
      console.error('Failed to load meal plan:', error);
    }
  };

  const loadPreferences = async () => {
    try {
      const res = await fetch(`${API_URL}/preferences`);
      const data = await res.json();
      setPreferences(data);
    } catch (error) {
      console.error('Failed to load preferences:', error);
    }
  };

  const generatePlan = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/meal-plans/generate`, { method: 'POST' });
      const data = await res.json();
      setMealPlan(data);
    } catch (error) {
      alert('Failed to generate meal plan: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const approvePlan = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/meal-plans/${mealPlan.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await res.json();
      setMealPlan(data);
      alert('Meal plan approved! Shopping list generated.');
    } catch (error) {
      alert('Failed to approve: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">
              🍽️ Automated Meal Planner
            </h1>
            <nav className="flex gap-2">
              <button
                onClick={() => setCurrentView('dashboard')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  currentView === 'dashboard'
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Calendar className="inline w-4 h-4 mr-2" />
                Dashboard
              </button>
              <button
                onClick={() => setCurrentView('preferences')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  currentView === 'preferences'
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Settings className="inline w-4 h-4 mr-2" />
                Preferences
              </button>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {currentView === 'dashboard' && (
          <DashboardView
            mealPlan={mealPlan}
            loading={loading}
            onGenerate={generatePlan}
            onApprove={approvePlan}
          />
        )}
        {currentView === 'preferences' && (
          <PreferencesView
            preferences={preferences}
            onSave={(prefs) => {
              setPreferences(prefs);
              loadPreferences();
            }}
          />
        )}
      </main>
    </div>
  );
}

function DashboardView({ mealPlan, loading, onGenerate, onApprove }) {
  const [editMode, setEditMode] = useState(false);
  const [editedMeals, setEditedMeals] = useState([]);

  useEffect(() => {
    if (mealPlan?.meals) {
      setEditedMeals([...mealPlan.meals]);
    }
  }, [mealPlan]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Generating your perfect meal plan...</p>
        </div>
      </div>
    );
  }

  if (!mealPlan) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
        <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">No Meal Plan Yet</h2>
        <p className="text-gray-600 mb-6">
          Generate your first automated meal plan or wait until Monday at 8 PM for automatic generation.
        </p>
        <button
          onClick={onGenerate}
          className="bg-green-500 hover:bg-green-600 text-white px-8 py-3 rounded-lg font-semibold transition"
        >
          Generate Meal Plan Now
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      <div className={`rounded-xl p-6 ${
        mealPlan.status === 'pending' ? 'bg-yellow-50 border-2 border-yellow-200' :
        mealPlan.status === 'approved' ? 'bg-green-50 border-2 border-green-200' :
        'bg-blue-50 border-2 border-blue-200'
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">
              Week of {new Date(mealPlan.weekStart).toLocaleDateString('en-US', { 
                month: 'long', 
                day: 'numeric', 
                year: 'numeric' 
              })}
            </h2>
            <p className="text-gray-600">
              Status: <span className="font-semibold capitalize">{mealPlan.status}</span>
            </p>
          </div>
          <div className="flex gap-3">
            {mealPlan.status === 'pending' && (
              <>
                <button
                  onClick={() => setEditMode(!editMode)}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition"
                >
                  <Edit2 className="w-4 h-4" />
                  {editMode ? 'Cancel Edit' : 'Edit Plan'}
                </button>
                <button
                  onClick={onApprove}
                  className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-lg flex items-center gap-2 font-semibold transition"
                >
                  <Check className="w-5 h-5" />
                  Approve Plan
                </button>
              </>
            )}
          </div>
        </div>
        {mealPlan.notes && (
          <div className="mt-4 p-4 bg-white rounded-lg">
            <p className="text-sm text-gray-700"><strong>Note:</strong> {mealPlan.notes}</p>
          </div>
        )}
      </div>

      {/* Meal Plan Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {editedMeals.map((meal, index) => (
          <div key={index} className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition">
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-lg font-bold text-gray-900">{meal.day}</h3>
              <Clock className="w-5 h-5 text-gray-400" />
            </div>
            <h4 className="text-xl font-semibold text-green-600 mb-2">
              {meal.recipe_name}
            </h4>
            <p className="text-sm text-gray-600 leading-relaxed">{meal.reason}</p>
          </div>
        ))}
      </div>

      {/* Shopping List */}
      {mealPlan.shoppingList && mealPlan.shoppingList.length > 0 && (
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <ShoppingCart className="w-6 h-6 text-green-500" />
              Shopping List
            </h2>
            {mealPlan.status === 'approved' && (
              <OrderButton planId={mealPlan.id} />
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {mealPlan.shoppingList.map((item, index) => (
              <div key={index} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">{item.name}</span>
                  <span className="text-sm text-gray-500">
                    {item.quantity} {item.unit}
                  </span>
                </div>
                {item.recipe && (
                  <span className="text-xs text-gray-400">for {item.recipe}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feedback Section */}
      {mealPlan.status === 'ordered' && <FeedbackForm planId={mealPlan.id} />}
    </div>
  );
}

function OrderButton({ planId }) {
  const [showModal, setShowModal] = useState(false);
  const [pickupTime, setPickupTime] = useState('');
  const [loading, setLoading] = useState(false);

  const placeOrder = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, pickupTime })
      });
      const data = await res.json();
      alert('Order placed successfully! Check your Instacart account for details.');
      setShowModal(false);
    } catch (error) {
      alert('Failed to place order: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold flex items-center gap-2 transition"
      >
        <ShoppingCart className="w-5 h-5" />
        Place Order at New Seasons
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4">
            <h3 className="text-2xl font-bold mb-4">Schedule Pickup</h3>
            <label className="block mb-4">
              <span className="text-gray-700 font-medium mb-2 block">Pickup Time</span>
              <input
                type="datetime-local"
                value={pickupTime}
                onChange={(e) => setPickupTime(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </label>
            <div className="flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={placeOrder}
                disabled={loading || !pickupTime}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold transition disabled:opacity-50"
              >
                {loading ? 'Placing...' : 'Confirm Order'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function FeedbackForm({ planId }) {
  const [feedback, setFeedback] = useState({
    likedMeals: [],
    dislikedMeals: [],
    suggestions: ''
  });

  const submitFeedback = async () => {
    try {
      await fetch(`${API_URL}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...feedback, planId })
      });
      alert('Feedback submitted! This will improve next week\'s plan.');
    } catch (error) {
      alert('Failed to submit feedback');
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <h2 className="text-2xl font-bold mb-4">Weekly Feedback</h2>
      <textarea
        placeholder="How did this week's meals go? Any suggestions?"
        value={feedback.suggestions}
        onChange={(e) => setFeedback({ ...feedback, suggestions: e.target.value })}
        className="w-full px-4 py-3 border border-gray-300 rounded-lg mb-4 min-h-32 focus:ring-2 focus:ring-green-500 focus:border-transparent"
      />
      <button
        onClick={submitFeedback}
        className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-lg font-semibold transition"
      >
        Submit Feedback
      </button>
    </div>
  );
}

function PreferencesView({ preferences, onSave }) {
  const [prefs, setPrefs] = useState(preferences || {
    familyMembers: [],
    dietaryRestrictions: [],
    cookingTimeMax: 60,
    budgetPerWeek: null,
    notes: ''
  });

  const [newMember, setNewMember] = useState({ name: '', allergies: [], dislikes: [], preferences: [] });

  const addFamilyMember = () => {
    if (newMember.name) {
      setPrefs({
        ...prefs,
        familyMembers: [...prefs.familyMembers, newMember]
      });
      setNewMember({ name: '', allergies: [], dislikes: [], preferences: [] });
    }
  };

  const removeMember = (index) => {
    setPrefs({
      ...prefs,
      familyMembers: prefs.familyMembers.filter((_, i) => i !== index)
    });
  };

  const savePreferences = async () => {
    try {
      await fetch(`${API_URL}/preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs)
      });
      onSave(prefs);
      alert('Preferences saved successfully!');
    } catch (error) {
      alert('Failed to save preferences');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <h2 className="text-2xl font-bold mb-6">Family Members & Preferences</h2>
        
        {/* Existing family members */}
        <div className="space-y-4 mb-6">
          {prefs.familyMembers.map((member, index) => (
            <div key={index} className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-bold text-lg text-gray-900">{member.name}</h3>
                  {member.allergies.length > 0 && (
                    <p className="text-sm text-red-600 mt-1">
                      🚫 Allergies: {member.allergies.join(', ')}
                    </p>
                  )}
                  {member.dislikes.length > 0 && (
                    <p className="text-sm text-orange-600 mt-1">
                      👎 Dislikes: {member.dislikes.join(', ')}
                    </p>
                  )}
                  {member.preferences.length > 0 && (
                    <p className="text-sm text-green-600 mt-1">
                      ❤️ Loves: {member.preferences.join(', ')}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => removeMember(index)}
                  className="text-red-500 hover:text-red-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Add new member form */}
        <div className="border-t pt-6">
          <h3 className="font-semibold mb-4">Add Family Member</h3>
          <input
            type="text"
            placeholder="Name"
            value={newMember.name}
            onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-3"
          />
          <input
            type="text"
            placeholder="Allergies (comma-separated)"
            value={newMember.allergies.join(', ')}
            onChange={(e) => setNewMember({ ...newMember, allergies: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-3"
          />
          <input
            type="text"
            placeholder="Dislikes (comma-separated)"
            value={newMember.dislikes.join(', ')}
            onChange={(e) => setNewMember({ ...newMember, dislikes: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-3"
          />
          <input
            type="text"
            placeholder="Favorite foods (comma-separated)"
            value={newMember.preferences.join(', ')}
            onChange={(e) => setNewMember({ ...newMember, preferences: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-3"
          />
          <button
            onClick={addFamilyMember}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-lg transition"
          >
            Add Member
          </button>
        </div>
      </div>

      {/* Other preferences */}
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <h2 className="text-2xl font-bold mb-6">Cooking Preferences</h2>
        <div className="space-y-4">
          <label className="block">
            <span className="font-medium text-gray-700 mb-2 block">Max Cooking Time (minutes)</span>
            <input
              type="number"
              value={prefs.cookingTimeMax}
              onChange={(e) => setPrefs({ ...prefs, cookingTimeMax: parseInt(e.target.value) })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            />
          </label>
          <label className="block">
            <span className="font-medium text-gray-700 mb-2 block">Weekly Budget (optional)</span>
            <input
              type="number"
              placeholder="Leave blank for no limit"
              value={prefs.budgetPerWeek || ''}
              onChange={(e) => setPrefs({ ...prefs, budgetPerWeek: e.target.value ? parseFloat(e.target.value) : null })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            />
          </label>
          <label className="block">
            <span className="font-medium text-gray-700 mb-2 block">Additional Notes</span>
            <textarea
              placeholder="Any other preferences or constraints..."
              value={prefs.notes}
              onChange={(e) => setPrefs({ ...prefs, notes: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg min-h-24"
            />
          </label>
        </div>
      </div>

      <button
        onClick={savePreferences}
        className="w-full bg-green-500 hover:bg-green-600 text-white py-4 rounded-xl font-bold text-lg transition"
      >
        Save All Preferences
      </button>
    </div>
  );
}