import os
import requests
import time
from dotenv import load_dotenv
from supabase import create_client, Client
from fastembed import TextEmbedding

# 1. Load environment variables (.env for local runs, GitHub Secrets for CI/CD runs)
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Missing Supabase credentials. Make sure SUPABASE_URL and SUPABASE_KEY are set.")

# 2. Initialize Supabase client and local ML Embedding model
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
embedding_model = TextEmbedding(model_name="sentence-transformers/all-MiniLM-L6-v2")

MEALDB_API_URL = "https://www.themealdb.com/api/json/v1/1/search.php?f="

def fetch_and_ingest_recipes():
    """
    ETL Ingestion Pipeline:
    - Extracts recipes from TheMealDB
    - Deduplicates existing database entries
    - Transforms instructions, ingredients, and ML embeddings
    - Loads structured data into Supabase (recipes, ingredients, recipe_ingredients)
    """
    print("🚀 Starting Automated Recipe Ingestion Pipeline...")
    
    # Query letters to pull a representative sample of recipes
    letters = ['a', 'b', 'c', 'd', 'e', 'f', 'g'] 
    total_added = 0
    total_skipped = 0

    for letter in letters:
        print(f"\n--- Fetching recipes starting with '{letter}' ---")
        try:
            response = requests.get(MEALDB_API_URL + letter, timeout=10)
        except Exception as err:
            print(f"Network error on letter '{letter}': {err}")
            continue
        
        if response.status_code != 200:
            print(f"Failed to fetch data for '{letter}' (Status code: {response.status_code})")
            continue
            
        data = response.json()
        meals = data.get('meals')
        
        if not meals:
            print(f"No recipes found for letter '{letter}'.")
            continue

        for meal in meals:
            title = meal.get('strMeal')
            if not title:
                continue
            
            title = title.strip()
            image_url = meal.get('strMealThumb')
            raw_instructions = meal.get('strInstructions', '')

            # --- DEDUPLICATION CHECK ---
            try:
                existing_recipe = supabase.table("recipes").select("id").eq("title", title).execute()
                if existing_recipe.data:
                    print(f"⏩ Skipping existing recipe: {title}")
                    total_skipped += 1
                    continue
            except Exception as e:
                print(f"Error checking existing recipe '{title}': {e}")
                continue
            
            # --- TRANSFORM: Clean Instructions ---
            steps = []
            if raw_instructions:
                raw_steps = [s.strip() for s in raw_instructions.split('\n') if s.strip()]
                for i, step_text in enumerate(raw_steps):
                    steps.append({"step": i + 1, "instruction": step_text})
            
            # --- TRANSFORM: Clean Ingredients ---
            ingredients = []
            for i in range(1, 21):
                ing_name = meal.get(f'strIngredient{i}')
                if ing_name and ing_name.strip():
                    cleaned_ing = ing_name.strip().lower()
                    if cleaned_ing not in ingredients:
                        ingredients.append(cleaned_ing)
            
            if not ingredients:
                continue

            # --- TRANSFORM: Generate ML Embedding Vector ---
            ingredient_text = ", ".join(ingredients)
            recipe_vector = list(embedding_model.embed([ingredient_text]))[0].tolist()

            # --- LOAD: Write to Supabase ---
            try:
                # 1. Insert into recipes table
                recipe_data = {
                    "title": title,
                    "instructions": steps,
                    "image_url": image_url,
                    "embedding": recipe_vector
                }
                rec_res = supabase.table("recipes").insert(recipe_data).execute()
                recipe_id = rec_res.data[0]['id']

                # 2. Process and link ingredients
                for ing_name in ingredients:
                    # Check if ingredient exists, insert if missing
                    ing_check = supabase.table("ingredients").select("id").eq("name", ing_name).execute()
                    
                    if not ing_check.data:
                        ing_res = supabase.table("ingredients").insert({"name": ing_name}).execute()
                        ingredient_id = ing_res.data[0]['id']
                    else:
                        ingredient_id = ing_check.data[0]['id']

                    # Link in junction table
                    supabase.table("recipe_ingredients").insert({
                        "recipe_id": recipe_id,
                        "ingredient_id": ingredient_id,
                        "quantity": "As needed"
                    }).execute()

                print(f"✅ Successfully ingested: {title}")
                total_added += 1

            except Exception as e:
                print(f"❌ Failed to ingest '{title}': {e}")
            
            # Brief pause to respect API rate limits
            time.sleep(0.3)

    print(f"\n🎉 Pipeline complete! Added: {total_added} | Skipped existing: {total_skipped}")

if __name__ == "__main__":
    fetch_and_ingest_recipes()