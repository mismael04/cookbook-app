import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Fetch all recipes from the 'recipes' table
response = supabase.table("recipes").select("id, title").execute()

print("--- RECIPES IN DATABASE ---")
for recipe in response.data:
    print(f"ID: {recipe['id']} | Title: {recipe['title']}")