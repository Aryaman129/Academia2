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

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

app = Flask(__name__)

# Enable CORS for all routes with proper configuration
CORS(app, origins=["https://academia-khaki.vercel.app", "http://localhost:3000"], supports_credentials=True, allow_headers=["Content-Type", "Authorization"])

active_scrapers = {}

def async_scraper(email, password):
    """Run scraper in background."""
    try:
        print(f"Starting attendance scraper for {email}")
        # Import here to avoid circular imports
        # This is the correct import statement for srm_scrapper
        import srm_scrapper
        
        # Use the "attendance" type to only run attendance & marks scraper
        success = srm_scrapper.run_scraper(email, password, scraper_type="attendance")
        print(f"Attendance scraper finished for {email} with success: {success}")
        
        active_scrapers[email] = {
            "status": "completed" if success else "failed",
            "updated_at": datetime.utcnow().isoformat()
        }
    except Exception as e:
        print(f"Attendance scraper error for {email}: {e}")
        import traceback
        traceback.print_exc()
        active_scrapers[email] = {"status": "failed", "error": str(e)}

def delayed_timetable_scraper(email, password, delay_seconds=1):
    """Run timetable scraper in background with a delay to avoid resource conflicts."""
    time.sleep(delay_seconds)  # Wait before starting to avoid two Chrome instances at once
    active_scrapers[f"timetable_{email}"] = {"status": "waiting"}
    
    try:
        # Import here to avoid circular imports
        import srm_scrapper
        print(f"Starting timetable scraper for {email} after {delay_seconds}s delay")
        active_scrapers[f"timetable_{email}"] = {"status": "running"}
        # Use the "timetable" type to only run timetable scraper
        success = srm_scrapper.run_scraper(email, password, scraper_type="timetable")
        print(f"Timetable scraper finished for {email} with success: {success}")
        active_scrapers[f"timetable_{email}"] = {
            "status": "completed" if success else "failed"
        }
    except Exception as e:
        print(f"Timetable scraper error for {email}: {e}")
        import traceback
        traceback.print_exc()
        active_scrapers[f"timetable_{email}"] = {"status": "failed", "error": str(e)}

def unified_async_scraper(email, password):
    """Run unified scraper in background to handle both attendance and timetable."""
    try:
        print(f"Starting unified scraper for {email}")
        # Initialize both statuses
        active_scrapers[email] = {"status": "running"}
        
        # For refresh, we only need to run the attendance scraper (which includes marks)
        # as timetable doesn't change frequently
        threading.Thread(
            target=async_scraper,
            args=(email, password),
            daemon=True
        ).start()
            
        print(f"Refresh scraper started for {email}")
    except Exception as e:
        print(f"Unified scraper error: {e}")
        import traceback
        traceback.print_exc()  # Print full traceback for debugging
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
        try:
            resp = supabase.table("users").select("*").eq("email", email).execute()
            if not resp.data or len(resp.data) == 0:
                # 2) Create new user with empty registration_number
                new_user = {
                    "email": email,
                    "password_hash": generate_password_hash(password, method='pbkdf2:sha256'),
                    "registration_number": ""
                }
                insert_resp = supabase.table("users").insert(new_user).execute()
                if not insert_resp.data:
                    raise Exception("Failed to create user record")
                user = insert_resp.data[0]
            else:
                user = resp.data[0]
                try:
                    # Try to verify with existing hash
                    if not check_password_hash(user["password_hash"], password):
                        # If verification fails, update to new hash
                        new_hash = generate_password_hash(password, method='pbkdf2:sha256')
                        update_resp = supabase.table("users").update({"password_hash": new_hash}).eq("id", user["id"]).execute()
                        if not update_resp.data:
                            raise Exception("Failed to update password hash")
                        user = update_resp.data[0]
                except ValueError as e:
                    if "unsupported hash type" in str(e):
                        # If old hash is incompatible, update to new hash
                        new_hash = generate_password_hash(password, method='pbkdf2:sha256')
                        update_resp = supabase.table("users").update({"password_hash": new_hash}).eq("id", user["id"]).execute()
                        if not update_resp.data:
                            raise Exception("Failed to update password hash")
                        user = update_resp.data[0]
                    else:
                        raise
        except Exception as e:
            print(f"Database error during user lookup/creation: {e}")
            return jsonify({"success": False, "error": "Database operation failed"}), 500

        # 4) Generate token with user["id"]
        token = jwt.encode({
            "email": email,
            "id": user["id"],
            "exp": datetime.utcnow() + timedelta(hours=24)
        }, os.getenv("JWT_SECRET", "default-secret-key"))

        # 5) First, check if user already has timetable data
        timetable_resp = supabase.table("timetable").select("*").eq("user_id", user["id"]).execute()
        if not timetable_resp.data or len(timetable_resp.data) == 0:
            # If no timetable data exists, we need to run timetable scraper first
            print(f"No timetable data found for {email}, starting timetable scraper first")
            # Start timetable scraper first
            threading.Thread(
                target=delayed_timetable_scraper,
                args=(email, password, 0),  # No delay for first run
                daemon=True
            ).start()
            
            # Then start attendance scraper with a delay
            threading.Thread(
                target=async_scraper,
                args=(email, password),
                daemon=True
            ).start()
        else:
            # If timetable data exists, just update attendance and marks
            print(f"Timetable data exists for {email}, updating attendance only")
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

        # Try to fetch attendance record for the user
        resp = supabase.table("attendance").select("attendance_data").eq("user_id", user_id).execute()
        if resp.data and len(resp.data) > 0:
            attendance_data = resp.data[0].get("attendance_data", {})
            return jsonify({"success": True, "attendance": attendance_data}), 200
        else:
            # If no attendance record exists, insert a new record using your upsert logic.
            # In a real scenario, you might trigger the scraper instead of inserting empty data.
            # For demonstration, we create a record with the scraped data.
            # (Ideally, the scraper would have run and inserted the data already.)
            default_attendance = {
                "registration_number": "", 
                "last_updated": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
                "records": []  # Or scraped records if available
            }
            in_resp = supabase.table("attendance").insert({
                "user_id": user_id,
                "attendance_data": default_attendance
            }).execute()
            if in_resp.data:
                return jsonify({"success": True, "attendance": default_attendance}), 200
            else:
                return jsonify({"success": False, "error": "Failed to create attendance record."}), 500
    except Exception as e:
        print(f"Error fetching attendance: {e}")
        return jsonify({"success": False, "error": str(e)}), 500
    

@app.route("/api/marks", methods=["GET", "OPTIONS"])
def get_marks():
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

        resp = supabase.table("marks").select("marks_data").eq("user_id", user_id).execute()
        if resp.data and len(resp.data) > 0:
            marks_data = resp.data[0].get("marks_data", {})
            return jsonify({"success": True, "marks": marks_data}), 200
        else:
            return jsonify({"success": False, "error": "No marks data found."}), 404
    except Exception as e:
        print(f"Error fetching marks: {e}")
        return jsonify({"success": False, "error": str(e)}), 500




@app.route("/api/timetable", methods=["GET", "OPTIONS", "POST"])
def get_user_timetable():
    if request.method == "OPTIONS":
        return jsonify({"success": True}), 200

    try:
        # 1) Validate token from the Authorization header
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return jsonify({"success": False, "error": "No token provided"}), 401

        token = auth_header.split(" ")[1]
        try:
            payload = jwt.decode(token, os.getenv('JWT_SECRET', 'default-secret-key'), algorithms=["HS256"])
            user_id = payload["id"]
            email = payload["email"]
        except jwt.ExpiredSignatureError:
            return jsonify({"success": False, "error": "Token expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"success": False, "error": "Invalid token"}), 401

        # 2) Check if we should use cached timetable data or fetch new data
        if request.method == "GET":
            # Try to get cached timetable data first
            tt_resp = supabase.table("timetable").select("*").eq("user_id", user_id).execute()
            if tt_resp.data and len(tt_resp.data) > 0:
                timetable_data = tt_resp.data[0]
                return jsonify({
                    "success": True,
                    "timetable": timetable_data["timetable_data"],
                    "batch": timetable_data["batch"],
                    "personal_details": timetable_data["personal_details"]
                }), 200
            else:
                return jsonify({
                    "success": False,
                    "error": "No timetable data available. Please refresh with password."
                }), 404
        
        # 3) If POST, get password and refresh timetable data
        if request.method == "POST":
            # Get the password from the request body
            data = request.get_json() or {}
            password = data.get("password")
            if not password:
                return jsonify({"success": False, "error": "Password required for timetable access"}), 400

            # Check timetable scraper status
            scraper_key = f"timetable_{email}"
            if scraper_key in active_scrapers and active_scrapers[scraper_key]["status"] == "completed":
                result = active_scrapers[scraper_key].get("result", {})
                if result.get("status") == "success":
                    return jsonify({
                        "success": True,
                        "timetable": result["merged_timetable"],
                        "batch": result["batch"],
                        "personal_details": result["personal_details"]
                    }), 200
            
            # Start a new scraper if none is running or previous one failed
            if scraper_key not in active_scrapers or active_scrapers[scraper_key]["status"] != "running":
                active_scrapers[scraper_key] = {"status": "running"}
                # Run in a separate thread to avoid blocking
                threading.Thread(
                    target=delayed_timetable_scraper,
                    args=(email, password),
                    daemon=True
                ).start()
                
                return jsonify({
                    "success": True,
                    "message": "Timetable scraper started. Please check status endpoint."
                }), 202
            else:
                return jsonify({
                    "success": True,
                    "message": "Timetable scraper already running. Please wait."
                }), 202

    except Exception as e:
        print(f"Error in timetable endpoint: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/timetable-status", methods=["GET"])
def get_timetable_status():
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

        scraper_key = f"timetable_{email}"
        status = active_scrapers.get(scraper_key, {"status": "not_started"})
        
        # If scraper completed, return the results too
        if status.get("status") == "completed" and "result" in status:
            result = status["result"]
            if result["status"] == "success":
                return jsonify({
                    "success": True,
                    "status": status["status"],
                    "timetable": result["merged_timetable"],
                    "batch": result["batch"],
                    "personal_details": result["personal_details"]
                })
        
        return jsonify({"success": True, "status": status})
    except Exception as e:
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
            "password_hash": generate_password_hash(password, method='pbkdf2:sha256'),
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

@app.route("/api/refresh-data", methods=["POST", "OPTIONS"])
def refresh_data():
    if request.method == "OPTIONS":
        return jsonify({"success": True}), 200
    
    try:
        # Get authorization header
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return jsonify({"success": False, "error": "No token provided"}), 401

        token = auth_header.split(" ")[1]
        
        try:
            # Decode JWT token to get user information
            payload = jwt.decode(token, os.getenv('JWT_SECRET', 'default-secret-key'), algorithms=["HS256"])
            user_id = payload["id"]
            email = payload["email"]
        except jwt.ExpiredSignatureError:
            return jsonify({"success": False, "error": "Token expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"success": False, "error": "Invalid token"}), 401
        
        # Get password from database or request
        user_resp = supabase.table("users").select("*").eq("id", user_id).execute()
        if not user_resp.data:
            return jsonify({"success": False, "error": "User not found"}), 404
            
        # Get stored password or fetch from request
        data = request.get_json() or {}
        password = data.get("password")
        
        # Start the unified scraper in background
        active_scrapers[email] = {"status": "running", "started_at": datetime.utcnow().isoformat()}
        
        # Update the timestamp in the attendance and marks tables
        current_time = datetime.utcnow().isoformat()
        
        # Run the unified scraper in a background thread
        threading.Thread(
            target=unified_async_scraper,
            args=(email, password if password else user_resp.data[0].get("password")),
            daemon=True
        ).start()
        
        return jsonify({
            "success": True,
            "message": "Refresh process started",
            "status": "running"
        }), 202
        
    except Exception as e:
        print(f"Error starting refresh: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/refresh-status", methods=["GET", "OPTIONS"])
def check_refresh_status():
    if request.method == "OPTIONS":
        return jsonify({"success": True}), 200
    
    try:
        # Get authorization header
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return jsonify({"success": False, "error": "No token provided"}), 401

        token = auth_header.split(" ")[1]
        
        try:
            # Decode JWT token to get user information
            payload = jwt.decode(token, os.getenv('JWT_SECRET', 'default-secret-key'), algorithms=["HS256"])
            user_id = payload["id"]
            email = payload["email"]
        except jwt.ExpiredSignatureError:
            return jsonify({"success": False, "error": "Token expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"success": False, "error": "Invalid token"}), 401
        
        # Get attendance scraper status
        status = active_scrapers.get(email, {"status": "not_started"})
        
        # If completed, get the updated timestamps from the database
        if status.get("status") == "completed":
            # Get attendance updated timestamp
            att_resp = supabase.table("attendance").select("created_at,updated_at").eq("user_id", user_id).execute()
            marks_resp = supabase.table("marks").select("created_at,updated_at").eq("user_id", user_id).execute()
            
            updated_at = None
            if att_resp.data and len(att_resp.data) > 0:
                updated_at = att_resp.data[0].get("updated_at")
            elif marks_resp.data and len(marks_resp.data) > 0:
                updated_at = marks_resp.data[0].get("updated_at")
                
            if updated_at:
                status["updated_at"] = updated_at
        
        return jsonify({
            "success": True,
            "status": status.get("status", "not_started"),
            "updated_at": status.get("updated_at", None)
        }), 200
        
    except Exception as e:
        print(f"Error checking refresh status: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    print(f"Starting server on port {port}...")
    app.run(host="0.0.0.0", port=port)









