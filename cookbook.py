import os
import json
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from supabase import create_client, Client
from dotenv import load_dotenv
from fastembed import TextEmbedding # Free local ML Embeddings
import google.generativeai as genai # AI Customizer RAG extension


# Load environment variables (SUPABASE_URL, SUPABASE_KEY, GEMINI_API_KEY)
load_dotenv()

app = FastAPI(
    title="Medes Recipe Backend API",
    description="API for managing ingredients, hybrid ML matching, and RAG AI recipe customization.",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Missing Supabase credentials. Please set SUPABASE_URL and SUPABASE_KEY.")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Initialize the local ML Embedding model (Runs completely free, 0 API costs)
embedding_model = TextEmbedding(model_name="sentence-transformers/all-MiniLM-L6-v2")

# Initialize Gemini if API key is provided
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    generation_config = {"response_mime_type": "application/json"}
    llm_model = genai.GenerativeModel("gemini-3.6-flash", generation_config=generation_config)
class PantryRequest(BaseModel):
    ingredients: List[str]

class CustomRecipeRequest(BaseModel):
    ingredients: List[str]
    avoid_ingredients: Optional[List[str]] = []

class RecipeStep(BaseModel):
    step: int
    instruction: str

class RecipeIngest(BaseModel):
    title: str
    ingredients: List[str]
    instructions: List[RecipeStep]
    image_url: Optional[str] = None

@app.post("/api/match-recipes")
async def match_recipes(request: PantryRequest):
    """
    Takes a list of ingredients from the user's pantry and returns the top matched recipes
    using ML Hybrid Search (Exact Overlap + Vector Similarity).
    """
    try:
        # 1. Use ML to embed the user's pantry query into a dense vector array
        query_text = ", ".join(request.ingredients)
        query_vector = list(embedding_model.embed([query_text]))[0].tolist()

        # 2. Call the high-speed Postgres function we created in schema.sql
        response = supabase.rpc(
            "get_best_recipe_matches", 
            {
                "user_pantry_items": request.ingredients,
                "user_query_embedding": query_vector
            }
        ).execute()
        
        if not response.data:
            return {
                "message": "No database matches found.",
                "matches": []
            }

        return {"matches": response.data}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/custom-recipe")
async def generate_custom_recipe(request: CustomRecipeRequest):
    """
    RAG Endpoint: Retrieves the best database match, then uses Gemini 
    to rewrite the instructions specifically for the user's exact ingredients and preferences.
    """
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=400, detail="GEMINI_API_KEY is not configured in environment variables.")

    try:
        # 1. Embed query and find best baseline recipe from Supabase
        query_text = ", ".join(request.ingredients)
        query_vector = list(embedding_model.embed([query_text]))[0].tolist()

        response = supabase.rpc(
            "get_best_recipe_matches", 
            {
                "user_pantry_items": request.ingredients,
                "user_query_embedding": query_vector
            }
        ).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="No base recipes found to customize.")

        # 2. Grab the #1 best matching recipe
        base_recipe = response.data[0]
        base_title = base_recipe["title"]
        base_instructions = json.dumps(base_recipe["instructions"])

        # 3. Construct the RAG Prompt for Gemini
        prompt = f"""
        You are an expert culinary AI. 
        We have a base recipe called: {base_title}
        Original Instructions: {base_instructions}
        
        The user wants to make this, but they ONLY have these ingredients: {request.ingredients}
        They absolutely want to avoid these ingredients/flavors: {request.avoid_ingredients}
        
        Rewrite the cooking instructions to work perfectly with only the ingredients the user has. 
        If an ingredient is missing, adapt the cooking method so the dish still succeeds.
        Ensure you strictly omit anything in their avoid list.
        
        Return a valid JSON object matching this exact schema:
        {{
            "custom_title": "String (A clever name for this modified dish)",
            "base_recipe_used": "{base_title}",
            "ai_instructions": [
                {{"step": 1, "instruction": "String"}}
            ]
        }}
        """

        # 4. Generate the customized recipe via Gemini
        ai_response = llm_model.generate_content(prompt)
        custom_recipe_data = json.loads(ai_response.text)
        
        return {
            "status": "success",
            "data": custom_recipe_data
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ingest-recipe")
async def ingest_recipe(recipe: RecipeIngest):
    """
    Endpoint for GitHub Actions or external pipelines to automatically push new recipes.
    Handles deduplication of ingredients automatically.
    """
    try:
        # 1. Generate recipe embedding vector
        ingredient_text = ", ".join(recipe.ingredients)
        recipe_vector = list(embedding_model.embed([ingredient_text]))[0].tolist()

        # 2. Insert main recipe record
        recipe_data = {
            "title": recipe.title,
            "instructions": [step.dict() for step in recipe.instructions],
            "image_url": recipe.image_url,
            "embedding": recipe_vector
        }
        rec_res = supabase.table("recipes").insert(recipe_data).execute()
        recipe_id = rec_res.data[0]['id']

        # 3. Process and deduplicate ingredients
        for ing_name in recipe.ingredients:
            ing_name = ing_name.lower().strip()
            
            ing_check = supabase.table("ingredients").select("id").eq("name", ing_name).execute()
            
            if not ing_check.data:
                ing_res = supabase.table("ingredients").insert({"name": ing_name}).execute()
                ingredient_id = ing_res.data[0]['id']
            else:
                ingredient_id = ing_check.data[0]['id']

            # Link ingredient to the recipe in the junction table
            supabase.table("recipe_ingredients").insert({
                "recipe_id": recipe_id,
                "ingredient_id": ingredient_id,
                "quantity": "As needed"
            }).execute()

        return {"status": "success", "recipe_id": recipe_id}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    """Simple health check to ensure the API is running."""
    return {"status": "healthy", "service": "Medes Recipe API"}

@app.get("/api/all-recipes")
async def get_all_recipes():
    """
    Fetches all recipes from Supabase sorted alphabetically for the A-to-Z catalog view.
    """
    try:
        response = supabase.table("recipes").select("*").order("title", desc=False).execute()
        return {"recipes": response.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    