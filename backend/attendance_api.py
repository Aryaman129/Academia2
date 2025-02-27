from flask import Flask, request, jsonify
from flask_cors import CORS
from supabase import create_client, Client
import os
from dotenv import load_dotenv
from werkzeug.security import generate_password_hash, check_password_hash

load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Missing Supabase credentials")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def get_user_by_email(email):
    try:
        response = supabase.table("users").select("*").eq("email", email).execute()
        return response.data[0] if response.data else None
    except Exception as e:
        print(f"Error getting user: {e}")
        return None

@app.route("/signup", methods=["POST"])
def signup():
    try:
        data = request.json
        email = data.get("email")
        password = data.get("password")
        registration_number = data.get("registration_number")

        if not all([email, password, registration_number]):
            return jsonify({"success": False, "error": "Missing required fields"}), 400

        # Check if email exists
        existing_user = get_user_by_email(email)
        if existing_user:
            return jsonify({"success": False, "error": "Email already registered"}), 400

        # Create new user
        new_user = {
            "email": email,
            "password_hash": generate_password_hash(password),
            "registration_number": registration_number
        }

        result = supabase.table("users").insert(new_user).execute()
        
        if not result.data:
            return jsonify({"success": False, "error": "Failed to create user"}), 500

        return jsonify({
            "success": True,
            "user": {
                "id": result.data[0]["id"],
                "email": email,
                "registration_number": registration_number
            }
        })

    except Exception as e:
        print(f"Signup error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/login", methods=["POST"])
def login():
    try:
        data = request.json
        email = data.get("email")
        password = data.get("password")

        if not all([email, password]):
            return jsonify({"success": False, "error": "Missing email or password"}), 400

        user = get_user_by_email(email)
        if not user:
            return jsonify({"success": False, "error": "User not found"}), 404

        if not check_password_hash(user["password_hash"], password):
            return jsonify({"success": False, "error": "Invalid password"}), 401

        return jsonify({
            "success": True,
            "user": {
                "id": user["id"],
                "email": user["email"],
                "registration_number": user["registration_number"]
            }
        })

    except Exception as e:
        print(f"Login error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/attendance", methods=["GET"])
def get_attendance():
    try:
        user_id = request.args.get("user_id")
        if not user_id:
            return jsonify({"success": False, "error": "User ID required"}), 400

        response = supabase.table("attendance").select("*").eq("user_id", user_id).execute()
        
        return jsonify({
            "success": True,
            "attendance": response.data or []
        })

    except Exception as e:
        print(f"Attendance error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True, port=5000)







