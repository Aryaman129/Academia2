from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
import jwt
import threading
import time
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
load_dotenv()
print("SUPABASE_URL:", os.getenv("SUPABASE_URL"))
print("SUPABASE_KEY:", os.getenv("SUPABASE_KEY"))

app = Flask(__name__)
app.config['TIMEOUT'] = 30

CORS(app, resources={
    r"/*": {
        "origins": ["http://localhost:3000"],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "expose_headers": ["Content-Type", "Authorization"],
        "supports_credentials": True,
        "max_age": 3600
    }
})

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
except Exception as e:
    print(f"Failed to initialize Supabase client: {e}")
    raise

active_scrapers = {}

def async_scraper(email, password):
    """Run scraper in background."""
    from scrape_attendance import run_scraper
    try:
        print(f"Starting scraper for {email}")
        success = run_scraper(email, password)
        print(f"Scraper finished for {email} with success: {success}")
        active_scrapers[email] = {"status": "completed" if success else "failed"}
    except Exception as e:
        print(f"Scraper error for {email}: {e}")
        active_scrapers[email] = {"status": "failed", "error": str(e)}

@app.route("/health", methods=["GET"])
def health_check():
    print("Health check endpoint hit")
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat()
    }), 200

@app.route("/api/login", methods=["POST", "OPTIONS"])
def login_route():
    if request.method == "OPTIONS":
        return jsonify({"success": True}), 200
    try:
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "error": "No data provided"}), 400

        email = data.get("email")
        password = data.get("password")
        if not email or not password:
            return jsonify({"success": False, "error": "Email and password required"}), 400

        print(f"Login attempt for email: {email}")

        # 1) Check if user exists by email
        resp = supabase.table("users").select("*").eq("email", email).execute()
        if not resp.data or len(resp.data) == 0:
            # 2) Create new user with empty registration_number
            new_user = {
                "email": email,
                "password_hash": generate_password_hash(password),
                "registration_number": ""
            }
            insert_resp = supabase.table("users").insert(new_user).execute()
            user = insert_resp.data[0]
        else:
            user = resp.data[0]
            # 3) If password mismatch, update hash
            if not check_password_hash(user["password_hash"], password):
                new_hash = generate_password_hash(password)
                supabase.table("users").update({"password_hash": new_hash}).eq("id", user["id"]).execute()
                updated_resp = supabase.table("users").select("*").eq("id", user["id"]).execute()
                user = updated_resp.data[0]

        # 4) Generate token with user["id"]
        token = jwt.encode({
            "email": email,
            "id": user["id"],
            "exp": datetime.utcnow() + timedelta(hours=24)
        }, os.getenv("JWT_SECRET", "default-secret-key"))

        # 5) Start the scraper
        threading.Thread(
            target=async_scraper,
            args=(email, password),
            daemon=True
        ).start()

        return jsonify({
            "success": True,
            "token": token,
            "user": {"email": email, "id": user["id"]}
        })

    except Exception as e:
        print(f"Login error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/attendance", methods=["GET", "OPTIONS"])
def get_attendance():
    if request.method == "OPTIONS":
        return jsonify({"success": True}), 200
    try:
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return jsonify({"success": False, "error": "No token provided"}), 401

        token = auth_header.split(" ")[1]
        try:
            payload = jwt.decode(token, os.getenv('JWT_SECRET', 'default-secret-key'), algorithms=["HS256"])
            user_id = payload["id"]
        except jwt.ExpiredSignatureError:
            return jsonify({"success": False, "error": "Token expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"success": False, "error": "Invalid token"}), 401

        # Query attendance by user_id
        resp = supabase.table("attendance").select("*").eq("user_id", user_id).execute()
        data = resp.data if resp.data else []
        return jsonify({"success": True, "attendance": data}), 200

    except Exception as e:
        print(f"Error fetching attendance: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/scraper-status", methods=["GET"])
def get_scraper_status():
    try:
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return jsonify({"success": False, "error": "No token provided"}), 401

        token = auth_header.split(" ")[1]
        try:
            payload = jwt.decode(token, os.getenv('JWT_SECRET', 'default-secret-key'), algorithms=["HS256"])
            email = payload["email"]
        except jwt.ExpiredSignatureError:
            return jsonify({"success": False, "error": "Token expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"success": False, "error": "Invalid token"}), 401

        status = active_scrapers.get(email, {"status": "not_started"})
        return jsonify({"success": True, "status": status})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/register", methods=["POST", "OPTIONS"])
def register():
    if request.method == "OPTIONS":
        return jsonify({"success": True}), 200
    try:
        data = request.get_json()
        email = data.get("email")
        password = data.get("password")
        print(f"Registration attempt for email: {email}")
        if not email or not password:
            return jsonify({"success": False, "error": "Email and password required"}), 400

        # Check if user already exists
        resp = supabase.table("users").select("*").eq("email", email).execute()
        if resp.data and len(resp.data) > 0:
            return jsonify({"success": False, "error": "User already exists"}), 400

        new_user = {
            "email": email,
            "password_hash": generate_password_hash(password),
            "registration_number": ""
        }
        insert_resp = supabase.table("users").insert(new_user).execute()
        if not insert_resp.data:
            return jsonify({"success": False, "error": "Failed to create user"}), 500

        user = insert_resp.data[0]
        token = jwt.encode({
            "email": email,
            "id": user["id"],
            "exp": datetime.utcnow() + timedelta(hours=24)
        }, os.getenv("JWT_SECRET", "default-secret-key"))

        return jsonify({
            "success": True,
            "token": token,
            "user": {"email": email, "id": user["id"]}
        })
    except Exception as e:
        print(f"Registration error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5050))
    print(f"Starting server on port {port}...")
    app.run(host="0.0.0.0", port=port, debug=True, threaded=True)









