from flask import Flask, request, jsonify
from flask_cors import CORS
from supabase import create_client, Client
import os
from dotenv import load_dotenv
from werkzeug.security import generate_password_hash, check_password_hash
import jwt
from datetime import datetime, timedelta
import threading
from scrape_attendance import run_scraper  # ensure run_scraper accepts (username, password)

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)
CORS(app, supports_credentials=True, resources={
    r"/*": {
        "origins": ["http://localhost:3000", "http://127.0.0.1:3000"],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

# Supabase setup
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# JWT Configuration
JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key")
JWT_EXPIRATION = 24  # hours

def generate_token(user_data):
    """Generate JWT token for user"""
    payload = {
        'email': user_data['email'],
        'id': user_data['id'],  # NEW: include user id in token
        'exp': datetime.utcnow() + timedelta(hours=JWT_EXPIRATION)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm='HS256')

def verify_token(token):
    """Verify JWT token"""
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
    except Exception as e:
        print(f"Token verification error: {e}")
        return None

def get_user_by_email(email):
    """Fetch user from Supabase by email"""
    try:
        response = supabase.table("users").select("*").eq("email", email).single().execute()
        return response.data
    except Exception as e:
        print(f"Error getting user: {e}")
        return None

@app.route("/api/health", methods=["GET"])
def health_check():
    """Health check endpoint"""
    return jsonify({"status": "healthy"}), 200

@app.route("/api/login", methods=["POST"])
def login_route():
    """Handle user login and start scraper"""
    try:
        data = request.json
        email = data.get("email")
        password = data.get("password")
        
        if not email or not password:
            return jsonify({"success": False, "error": "Email and password required"}), 400
            
        # Get user from database
        user = get_user_by_email(email)
        if not user or not check_password_hash(user["password_hash"], password):
            return jsonify({"success": False, "error": "Invalid credentials"}), 401
            
        # Generate token with email and id
        token = generate_token(user)
        
        # Start scraper in background with two arguments (email, password)
        print(f"Starting scraper for user: {email}")
        threading.Thread(
            target=run_scraper,
            args=(email, password),
            daemon=True
        ).start()
        
        return jsonify({
            "success": True,
            "token": token,
            "user": {
                "email": email,
                "id": user["id"]
            }
        })
        
    except Exception as e:
        print(f"Login error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/attendance", methods=["GET"])
def get_attendance():
    """Fetch attendance data for user"""
    try:
        # Verify token
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return jsonify({"success": False, "error": "No token provided"}), 401
            
        token = auth_header.split(" ")[1]
        payload = verify_token(token)
        if not payload:
            return jsonify({"success": False, "error": "Invalid token"}), 401
            
        # Get user's attendance using user id from token
        user_id = payload["id"]
        response = supabase.table("attendance").select("*").eq("user_id", user_id).execute()
        
        return jsonify({
            "success": True,
            "attendance": response.data or []
        })
        
    except Exception as e:
        print(f"Error fetching attendance: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/register", methods=["POST"])
def register():
    """Register new user"""
    try:
        data = request.json
        email = data.get("email")
        password = data.get("password")
        
        if not email or not password:
            return jsonify({"success": False, "error": "Email and password required"}), 400
            
        # Check if user exists
        existing_user = get_user_by_email(email)
        if existing_user:
            return jsonify({"success": False, "error": "User already exists"}), 400
            
        # Create user
        password_hash = generate_password_hash(password)
        user_data = {
            "email": email,
            "password_hash": password_hash
        }
        
        response = supabase.table("users").insert(user_data).execute()
        
        if "error" in response:
            return jsonify({"success": False, "error": response["error"]}), 400
            
        # Generate token with email and id
        token = generate_token({"email": email, "id": response.data[0]["id"]})
        
        return jsonify({
            "success": True,
            "token": token,
            "user": {
                "email": email,
                "id": response.data[0]["id"]
            }
        })
        
    except Exception as e:
        print(f"Registration error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
















