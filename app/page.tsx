"use client";

import React, { useState, useEffect } from 'react';
import { ChefHat, Search, ChevronLeft, Loader2, Database, BookOpen, Home, Heart, Calendar, Trash2 } from 'lucide-react';

interface RecipeStep {
  step: number;
  instruction: string;
}

interface Recipe {
  id: number;
  title: string;
  prep_time?: string;
  difficulty?: string;
  ingredients: any;
  instructions?: RecipeStep[];
  image_url?: string;
}

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function MedesCookApp() {
  const [currentView, setCurrentView] = useState<string>('landing'); 
  const [pantry, setPantry] = useState<string[]>(['chicken', 'garlic', 'rice', 'heavy cream', 'butter']);
  const [inputValue, setInputValue] = useState<string>('');
  const [matches, setMatches] = useState<Recipe[]>([]);
  const [allRecipes, setAllRecipes] = useState<Recipe[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [catalogLoading, setCatalogLoading] = useState<boolean>(false);

  // Persistent States using localStorage
  const [favorites, setFavorites] = useState<number[]>([]);
  const [mealPlan, setMealPlan] = useState<Record<string, Recipe | null>>({});

  const API_URL = 'http://localhost:8000';

  // Load saved favorites and meal plan from localStorage on mount
  useEffect(() => {
    const savedFavs = localStorage.getItem('medes_favorites');
    if (savedFavs) setFavorites(JSON.parse(savedFavs));

    const savedPlan = localStorage.getItem('medes_meal_plan');
    if (savedPlan) setMealPlan(JSON.parse(savedPlan));
  }, []);

  // Save favorites
  const toggleFavorite = (recipeId: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    let updated;
    if (favorites.includes(recipeId)) {
      updated = favorites.filter(id => id !== recipeId);
    } else {
      updated = [...favorites, recipeId];
    }
    setFavorites(updated);
    localStorage.setItem('medes_favorites', JSON.stringify(updated));
  };

  // Assign recipe to a day of the week
  const assignMealToDay = (day: string, recipe: Recipe) => {
    const updated = { ...mealPlan, [day]: recipe };
    setMealPlan(updated);
    localStorage.setItem('medes_meal_plan', JSON.stringify(updated));
  };

  // Clear a specific day or entire week
  const clearMealDay = (day: string) => {
    const updated = { ...mealPlan, [day]: null };
    setMealPlan(updated);
    localStorage.setItem('medes_meal_plan', JSON.stringify(updated));
  };

  const clearEntireWeeklyPlan = () => {
    setMealPlan({});
    localStorage.removeItem('medes_meal_plan');
  };

  // Smart estimation function for time and difficulty if not provided by backend
  const getEstimatedDetails = (recipe: Recipe) => {
    const title = recipe.title ? recipe.title.toLowerCase() : '';
    
    let ingredientCount = 0;
    if (Array.isArray(recipe.ingredients)) {
      ingredientCount = recipe.ingredients.length;
    } else if (typeof recipe.ingredients === 'string') {
      ingredientCount = recipe.ingredients.split(',').length;
    }

    let time = recipe.prep_time;
    let difficulty = recipe.difficulty;

    if (!time || !difficulty) {
      if (title.includes('roast') || title.includes('bake') || title.includes('stew') || title.includes('casserole') || ingredientCount > 7) {
        time = time || '50 mins';
        difficulty = difficulty || 'Hard';
      } else if (title.includes('pasta') || title.includes('chicken') || title.includes('curry') || title.includes('rice') || ingredientCount > 4) {
        time = time || '30 mins';
        difficulty = difficulty || 'Medium';
      } else {
        time = time || '15 mins';
        difficulty = difficulty || 'Easy';
      }
    }

    return { time, difficulty };
  };

  // Helper to cleanly render ingredients whether they are a list or string
  const renderIngredientsList = (recipe: any) => {
    const ingredients = recipe.ingredients || recipe.ingredient_list || recipe.recipe_ingredients || recipe.items;
    
    if (!ingredients) return <p className="text-slate-500 italic">No ingredients listed.</p>;

    let items: string[] = [];
    if (Array.isArray(ingredients)) {
      items = ingredients;
    } else if (typeof ingredients === 'string') {
      items = ingredients.split(',').map(i => i.trim());
    }

    if (items.length === 0) return <p className="text-slate-500 italic">No ingredients listed.</p>;

    return (
      <ul className="list-disc list-inside text-sm text-slate-400 space-y-1">
        {items.map((ing, i) => (
          <li key={i} className="capitalize">{ing}</li>
        ))}
      </ul>
    );
  };

  const fetchAllRecipes = async () => {
    if (allRecipes.length > 0) return;
    setCatalogLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/all-recipes`);
      const data = await response.json();
      setAllRecipes(data.recipes || []);
    } catch (error) {
      console.error("Failed to fetch all recipes:", error);
    } finally {
      setCatalogLoading(false);
    }
  };

  const addIngredient = () => {
    if (inputValue.trim() && !pantry.includes(inputValue.trim().toLowerCase())) {
      setPantry([...pantry, inputValue.trim().toLowerCase()]);
      setInputValue('');
    }
  };

  const removeIngredient = (item: string) => {
    setPantry(pantry.filter(i => i !== item));
  };

  const handleMatchRecipes = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/match-recipes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredients: pantry }),
      });

      if (!response.ok) throw new Error('Failed to fetch from backend');

      const data = await response.json();
      setMatches(data.matches || []);
      setCurrentView('matches');
    } catch (error) {
      console.error("Backend connection error:", error);
    } finally {
      setLoading(false);
    }
  };

  const findRecipeById = (id: number) => {
    return allRecipes.find(r => r.id === id) || matches.find(r => r.id === id) || (selectedRecipe?.id === id ? selectedRecipe : null);
  };

  return (
    <main className="min-h-screen bg-[#0B132B] text-slate-100 p-6 md:p-12 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Global Navigation Header */}
        <div className="flex flex-col md:flex-row items-center justify-between border-b border-slate-800 pb-6 gap-4">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setCurrentView('landing')}>
            <div className="bg-[#06D6A0] p-3 rounded-2xl text-[#0B132B] shadow-md shadow-[#06D6A0]/20">
              <ChefHat size={32} />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight">Pantry-to-Plate</h1>
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <Database size={12} className="text-[#06D6A0]" /> AI Kitchen & Planner
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm font-medium">
            <button onClick={() => setCurrentView('landing')} className={`flex items-center gap-1 hover:text-[#06D6A0] transition-colors ${currentView === 'landing' ? 'text-[#06D6A0]' : 'text-slate-400'}`}>
              <Home size={16} /> Home
            </button>
            <button onClick={() => setCurrentView('matcher')} className={`flex items-center gap-1 hover:text-[#06D6A0] transition-colors ${currentView === 'matcher' ? 'text-[#06D6A0]' : 'text-slate-400'}`}>
              <Search size={16} /> Matcher
            </button>
            <button onClick={() => { setCurrentView('catalog'); fetchAllRecipes(); }} className={`flex items-center gap-1 hover:text-[#06D6A0] transition-colors ${currentView === 'catalog' ? 'text-[#06D6A0]' : 'text-slate-400'}`}>
              <BookOpen size={16} /> Catalog
            </button>
            <button onClick={() => { setCurrentView('planner'); fetchAllRecipes(); }} className={`flex items-center gap-1 hover:text-[#06D6A0] transition-colors ${currentView === 'planner' ? 'text-[#06D6A0]' : 'text-slate-400'}`}>
              <Calendar size={16} /> Planner
            </button>
            <button onClick={() => { setCurrentView('favorites'); fetchAllRecipes(); }} className={`flex items-center gap-1 hover:text-[#06D6A0] transition-colors ${currentView === 'favorites' ? 'text-[#06D6A0]' : 'text-slate-400'}`}>
              <Heart size={16} /> Favorites ({favorites.length})
            </button>
          </div>
        </div>

        {/* 1. LANDING PAGE VIEW */}
        {currentView === 'landing' && (
          <div className="py-12 text-center space-y-6 bg-slate-900/40 border border-slate-800 rounded-3xl p-8 shadow-2xl">
            <span className="bg-[#06D6A0]/10 text-[#06D6A0] text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider border border-[#06D6A0]/20">
              Smart Kitchen & Meal Planner
            </span>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight text-white max-w-xl mx-auto">
              Turn What’s In Your Kitchen Into a Masterpiece.
            </h2>
            <p className="text-slate-400 max-w-md mx-auto text-sm leading-relaxed">
              Find recipes using what's in your kitchen, explore our entire cookbook, save your favorites, and organize your weekly meals effortlessly.
            </p>
            <div className="flex flex-wrap justify-center gap-4 pt-4">
              <button onClick={() => setCurrentView('matcher')} className="bg-[#06D6A0] text-[#0B132B] font-bold px-6 py-3.5 rounded-xl shadow-lg hover:opacity-90 transition-all flex items-center gap-2">
                <Search size={18} /> Launch Pantry Matcher
              </button>
              <button onClick={() => { setCurrentView('planner'); fetchAllRecipes(); }} className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-6 py-3.5 rounded-xl transition-all border border-slate-700 flex items-center gap-2">
                <Calendar size={18} /> Weekly Planner
              </button>
            </div>
          </div>
        )}

        {/* 2. PANTRY MATCHER VIEW */}
        {currentView === 'matcher' && (
          <div className="space-y-6 bg-slate-900/60 p-6 rounded-2xl border border-slate-800 shadow-xl">
            <h2 className="text-xl font-semibold text-slate-200">What ingredients do you have?</h2>
            
            <div className="flex gap-3">
              <input 
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addIngredient()}
                placeholder="Add an ingredient (e.g., tomatoes, pasta)..."
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:border-[#06D6A0]"
              />
              <button onClick={addIngredient} className="bg-slate-800 hover:bg-slate-700 font-semibold px-6 py-3 rounded-xl transition-all">Add</button>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              {pantry.length === 0 ? (
                <p className="text-slate-500 italic">Your pantry is currently empty.</p>
              ) : (
                pantry.map((item) => (
                  <span key={item} className="bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg text-sm flex items-center gap-2">
                    {item}
                    <button onClick={() => removeIngredient(item)} className="text-slate-400 hover:text-red-400 font-bold">×</button>
                  </span>
                ))
              )}
            </div>

            <div className="pt-4">
              <button 
                onClick={handleMatchRecipes} 
                disabled={pantry.length === 0 || loading}
                className="w-full bg-gradient-to-r from-[#06D6A0] to-[#00F5D4] text-[#0B132B] font-semibold py-3 px-6 rounded-xl shadow-lg hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />}
                {loading ? "Querying ML Search..." : "Find Matching Recipes"}
              </button>
            </div>
          </div>
        )}

        {/* 3. MATCH RESULTS VIEW */}
        {currentView === 'matches' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Top Matching Recipes</h2>
              <button onClick={() => setCurrentView('matcher')} className="text-xs text-[#06D6A0] hover:underline">Edit Pantry</button>
            </div>
            <div className="grid gap-4">
              {matches.length === 0 ? (
                <p className="text-slate-400">No matching recipes found.</p>
              ) : (
                matches.map((recipe, idx) => {
                  const isFav = favorites.includes(recipe.id);
                  const { time, difficulty } = getEstimatedDetails(recipe);
                  return (
                    <div 
                      key={`${recipe.id}-${idx}`}
                      onClick={() => { setSelectedRecipe(recipe); setCurrentView('detail'); }}
                      className="bg-slate-900/60 border border-slate-800 hover:border-[#06D6A0] p-5 rounded-2xl cursor-pointer transition-all flex items-center justify-between group"
                    >
                      <div className="space-y-2">
                        <h3 className="text-lg font-bold text-slate-100 group-hover:text-[#06D6A0] transition-colors">{recipe.title}</h3>
                        <div className="flex items-center gap-3 text-xs font-medium">
                          <span className="text-slate-400">⏱ {time}</span>
                          <span className={`px-2 py-0.5 rounded-md font-semibold ${
                            difficulty === 'Hard' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                            difficulty === 'Medium' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
                            'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}>
                            {difficulty}
                          </span>
                        </div>
                      </div>
                      <button onClick={(e) => toggleFavorite(recipe.id, e)} className={`p-2 rounded-xl border ${isFav ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'}`}>
                        <Heart size={18} fill={isFav ? "currentColor" : "none"} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* 4. A-Z CATALOG VIEW */}
        {currentView === 'catalog' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">Complete Cookbook Catalog (A-Z)</h2>
            {catalogLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="animate-spin text-[#06D6A0]" size={32} /></div>
            ) : (
              <div className="grid gap-4">
                {allRecipes.map((recipe, idx) => {
                  const isFav = favorites.includes(recipe.id);
                  const { time, difficulty } = getEstimatedDetails(recipe);
                  return (
                    <div 
                      key={`${recipe.id}-${idx}`}
                      onClick={() => { setSelectedRecipe(recipe); setCurrentView('detail'); }}
                      className="bg-slate-900/60 border border-slate-800 hover:border-[#06D6A0] p-5 rounded-2xl cursor-pointer transition-all flex items-center justify-between group"
                    >
                      <div className="space-y-2">
                        <h3 className="text-lg font-bold text-slate-100 group-hover:text-[#06D6A0] transition-colors">{recipe.title}</h3>
                        <div className="flex items-center gap-3 text-xs font-medium">
                          <span className="text-slate-400">⏱ {time}</span>
                          <span className={`px-2 py-0.5 rounded-md font-semibold ${
                            difficulty === 'Hard' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                            difficulty === 'Medium' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
                            'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}>
                            {difficulty}
                          </span>
                        </div>
                      </div>
                      <button onClick={(e) => toggleFavorite(recipe.id, e)} className={`p-2 rounded-xl border ${isFav ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'}`}>
                        <Heart size={18} fill={isFav ? "currentColor" : "none"} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 5. FAVORITES VIEW */}
        {currentView === 'favorites' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">Your Favorite Recipes</h2>
            {favorites.length === 0 ? (
              <p className="text-slate-400 italic">No favorite recipes yet. Click the heart icon on any recipe to save it here!</p>
            ) : (
              <div className="grid gap-4">
                {favorites.map((favId) => {
                  const recipe = findRecipeById(favId);
                  if (!recipe) return null;
                  const { time, difficulty } = getEstimatedDetails(recipe);
                  return (
                    <div 
                      key={recipe.id}
                      onClick={() => { setSelectedRecipe(recipe); setCurrentView('detail'); }}
                      className="bg-slate-900/60 border border-slate-800 hover:border-[#06D6A0] p-5 rounded-2xl cursor-pointer transition-all flex items-center justify-between group"
                    >
                      <div className="space-y-2">
                        <h3 className="text-lg font-bold text-slate-100 group-hover:text-[#06D6A0] transition-colors">{recipe.title}</h3>
                        <div className="flex items-center gap-3 text-xs font-medium">
                          <span className="text-slate-400">⏱ {time}</span>
                          <span className={`px-2 py-0.5 rounded-md font-semibold ${
                            difficulty === 'Hard' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                            difficulty === 'Medium' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
                            'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}>
                            {difficulty}
                          </span>
                        </div>
                      </div>
                      <button onClick={(e) => toggleFavorite(recipe.id, e)} className="p-2 rounded-xl border bg-red-500/10 border-red-500/30 text-red-400">
                        <Heart size={18} fill="currentColor" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 6. WEEKLY PLANNER VIEW */}
        {currentView === 'planner' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Weekly Meal Planner</h2>
                <p className="text-xs text-slate-400">Assign recipes to your week. Clear anytime to start fresh!</p>
              </div>
              <button 
                onClick={clearEntireWeeklyPlan}
                className="bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 text-xs font-bold px-3 py-2 rounded-xl transition-all flex items-center gap-1.5"
              >
                <Trash2 size={14} /> Clear Weekly Plan
              </button>
            </div>

            <div className="grid gap-4">
              {DAYS_OF_WEEK.map((day) => {
                const plannedRecipe = mealPlan[day];
                return (
                  <div key={day} className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="w-32 font-bold text-[#06D6A0] flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#06D6A0]"></span>
                      {day}
                    </div>

                    <div className="flex-1 w-full">
                      {plannedRecipe ? (
                        <div 
                          onClick={() => { setSelectedRecipe(plannedRecipe); setCurrentView('detail'); }}
                          className="bg-slate-950 border border-slate-800 hover:border-[#06D6A0] p-3 rounded-xl cursor-pointer flex items-center justify-between"
                        >
                          <span className="font-semibold text-slate-200 text-sm">{plannedRecipe.title}</span>
                          <span className="text-xs text-slate-400">View Recipe &rarr;</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500 italic">No meal assigned for {day}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 w-full md:w-auto">
                      <select 
                        onChange={(e) => {
                          const recipeId = Number(e.target.value);
                          const recipe = allRecipes.find(r => r.id === recipeId) || matches.find(r => r.id === recipeId);
                          if (recipe) assignMealToDay(day, recipe);
                        }}
                        defaultValue=""
                        className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-[#06D6A0] w-full md:w-48"
                      >
                        <option value="" disabled>Assign Recipe...</option>
                        {allRecipes.map(r => (
                          <option key={r.id} value={r.id}>{r.title}</option>
                        ))}
                      </select>

                      {plannedRecipe && (
                        <button onClick={() => clearMealDay(day)} className="p-2 bg-slate-800 hover:bg-red-500/20 hover:text-red-400 text-slate-400 rounded-xl border border-slate-700 transition-all">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 7. RECIPE DETAIL VIEW */}
        {currentView === 'detail' && selectedRecipe && (
          <div className="space-y-6 bg-slate-900/60 p-6 rounded-2xl border border-slate-800">
            <div className="flex items-center justify-between">
              <button onClick={() => setCurrentView('catalog')} className="flex items-center text-sm text-[#06D6A0] hover:underline">
                <ChevronLeft size={16} className="mr-1" /> Back
              </button>
              <button 
                onClick={(e) => toggleFavorite(selectedRecipe.id, e)} 
                className={`p-2.5 rounded-xl border ${favorites.includes(selectedRecipe.id) ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
              >
                <Heart size={20} fill={favorites.includes(selectedRecipe.id) ? "currentColor" : "none"} />
              </button>
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold">{selectedRecipe.title}</h2>
              {(() => {
                const { time, difficulty } = getEstimatedDetails(selectedRecipe);
                return (
                  <div className="flex items-center gap-3 text-xs font-medium">
                    <span className="text-slate-400">⏱ {time}</span>
                    <span className={`px-2 py-0.5 rounded-md font-semibold ${
                      difficulty === 'Hard' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                      difficulty === 'Medium' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
                      'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    }`}>
                      {difficulty}
                    </span>
                  </div>
                );
              })()}
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-slate-300">Required Ingredients:</h4>
              {renderIngredientsList(selectedRecipe)}
            </div>

            <div className="space-y-4 pt-2">
              <h4 className="font-semibold text-slate-300">Step-by-Step Instructions:</h4>
              <div className="space-y-3">
                {(() => {
                  const rawSteps = selectedRecipe.instructions || [];
                  let expandedSteps: string[] = [];

                  rawSteps.forEach((s) => {
                    let text = s.instruction ? s.instruction.trim() : "";
                    if (text.endsWith(':')) text = text.slice(0, -1);
                    text = text.replace(/^(step\s*\d+[:\s]*)+/i, '').trim();

                    if (!text) return;

                    const splitSentences = text.split(/(?<=[.!?])\s+/);
                    
                    if (splitSentences.length > 1) {
                      let currentChunk = "";
                      splitSentences.forEach((sentence) => {
                        const lowerSentence = sentence.toLowerCase();
                        // If a sentence starts with conditional/optional phrases, attach it to the current chunk instead of splitting
                        const isOptionalModifier = lowerSentence.startsWith('if ') || 
                                                   lowerSentence.startsWith('alternatively') || 
                                                   lowerSentence.startsWith('optionally') || 
                                                   lowerSentence.startsWith('or ');

                        if (isOptionalModifier && currentChunk) {
                          currentChunk = currentChunk + " " + sentence;
                        } else if ((currentChunk + " " + sentence).length > 120 && !isOptionalModifier) {
                          if (currentChunk) expandedSteps.push(currentChunk.trim());
                          currentChunk = sentence;
                        } else {
                          currentChunk = currentChunk ? currentChunk + " " + sentence : sentence;
                        }
                      });
                      if (currentChunk) expandedSteps.push(currentChunk.trim());
                    } else {
                      expandedSteps.push(text);
                    }
                  });

                  return expandedSteps.map((stepText, idx) => (
                    <div key={idx} className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-sm flex gap-4">
                      <span className="font-bold text-[#06D6A0]">0{idx + 1}</span>
                      <p className="text-slate-300">{stepText}</p>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}