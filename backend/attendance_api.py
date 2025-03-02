from flask import Flask, request, jsonify, session
from flask_cors import CORS
from supabase import create_client, Client
import os
import requests
import threading  # Runs scraper in background
from dotenv import load_dotenv
from werkzeug.security import generate_password_hash, check_password_hash
from scrape_attendance import run_scraper  # ✅ Import the scraper function

# ✅ Load environment variables
load_dotenv()

# ✅ Initialize Flask App
app = Flask(__name__)
app.secret_key = "your_secret_key"
CORS(app, supports_credentials=True)

# ✅ Supabase Setup
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ✅ Function to Fetch User from Supabase
def get_user_by_email(email):
    try:
        response = supabase.table("users").select("*").eq("email", email).single().execute()
        return response.data if response.data else None
    except Exception as e:
        print(f"Error getting user: {e}")
    return None

# ✅ Login Route (Runs Scraper)
@app.route("/login", methods=["POST"])
def login():
    try:
        data = request.json
        email, password = data.get("email"), data.get("password")
        user = get_user_by_email(email)
        if not user or not check_password_hash(user["password_hash"], password):
            return jsonify({"success": False, "error": "Invalid credentials"}), 401
        
        auth_user_id = user["auth_user_id"]
        threading.Thread(target=run_scraper, args=(email, password, auth_user_id)).start()
        
        return jsonify({"success": True, "user": {"id": auth_user_id, "email": email, "registration_number": user["registration_number"]}})

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# ✅ Fetch Attendance
@app.route("/api/attendance", methods=["GET"])
def get_attendance():
    try:
        print("📌 Step 1: Fetching attendance data...")  # Debugging
        
        token = request.headers.get("Authorization")
        if not token:
            print("❌ Error: No Authorization token provided!")
            return jsonify({"success": False, "error": "Authentication required"}), 401

        token = token.split(" ")[1]
        print(f"📌 Step 2: Token received - {token[:20]}...")  # Only print part of token for security

        auth_user = verify_token(token)
        if not auth_user or "email" not in auth_user:
            print("❌ Error: Invalid or expired token!")
            return jsonify({"success": False, "error": "Invalid token"}), 401

        user_email = auth_user["email"]
        print(f"📌 Step 3: Retrieved Email from Token - {user_email}")

        # ✅ Fetch correct user_id from Supabase
        user_query = supabase.table("users").select("id").eq("email", user_email).single().execute()
        if "data" not in user_query or not user_query.data:
            print("❌ Error: No matching user found in database!")
            return jsonify({"success": False, "error": "User not found in database"}), 404

        user_id = user_query.data["id"]
        print(f"📌 Step 4: Matching User ID - {user_id}")

        # ✅ Fetch attendance using the correct user_id
        response = supabase.table("attendance").select("*").eq("user_id", user_id).execute()
        
        if "data" not in response or not response.data:
            print("❌ Error: No attendance records found!")
            return jsonify({"success": False, "attendance": []})  # Return empty attendance

        print(f"📌 Step 5: Supabase Query Response - {response.data}")

        return jsonify({"success": True, "attendance": response.data})

    except Exception as e:
        print(f"❌ Step 6: Attendance API Error - {e}")
        return jsonify({"success": False, "error": str(e)}), 500


# ✅ Start Server
if __name__ == "__main__":
    app.run(debug=True, port=5000)













