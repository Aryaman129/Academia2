import os
from datetime import datetime, timedelta
import jwt
from flask import Flask, request, jsonify, current_app
from flask_cors import CORS
import time
import threading
from supabase import create_client, Client
from scrape_attendance import setup_driver, login as login_attendance
from scrape_timetable import login_srm
import traceback

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Set up Supabase client
SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_KEY')
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Track scraper status
scraper_status = {"status": "idle"}

def create_jwt_token(email):
    """Create JWT token with 30-day expiry"""
    return jwt.encode(
        {
            'email': email,
            'exp': datetime.utcnow() + timedelta(days=30)
        },
        os.environ.get('JWT_SECRET', 'your-secret-key'),
        algorithm='HS256'
    )

def verify_token(token):
    """Verify JWT token"""
    try:
        payload = jwt.decode(
            token, 
            os.environ.get('JWT_SECRET', 'your-secret-key'), 
            algorithms=['HS256']
        )
        return payload['email']
    except Exception as e:
        raise ValueError(f'Invalid token: {str(e)}')

def async_scraper(email, password):
    """Run the attendance scraper in a separate thread"""
    from scrape_attendance import run_scraper
    scraper_status["status"] = "running"
    try:
        result = run_scraper(email, password)
        scraper_status["status"] = "completed" if result else "failed"
        return result
    except Exception as e:
        scraper_status["status"] = "failed"
        scraper_status["error"] = str(e)
        print(f"Scraper error: {e}")
        traceback.print_exc()
        return False

def async_timetable_scraper(email, password):
    """Run the timetable scraper in a separate thread"""
    from scrape_timetable import scrape_timetable
    try:
        # Add delay to prevent resource contention with attendance scraper
        time.sleep(5)
        driver = setup_driver()
        login_srm(driver, email, password)
        result = scrape_timetable(driver)
        return result
    except Exception as e:
        print(f"Timetable scraper error: {e}")
        traceback.print_exc()
        return False
    finally:
        if 'driver' in locals() and driver:
            driver.quit()

def start_scrapers(email, password):
    """Start all scrapers in background threads"""
    # Start attendance scraper thread
    attendance_thread = threading.Thread(target=async_scraper, args=(email, password))
    attendance_thread.daemon = True
    attendance_thread.start()
    
    # Start timetable scraper thread with delay
    timetable_thread = threading.Thread(target=async_timetable_scraper, args=(email, password))
    timetable_thread.daemon = True
    timetable_thread.start()

@app.route('/api/login', methods=['POST'])
def login():
    """Login endpoint that stores cookies and token"""
    data = request.json
    email = data.get('email')
    password = data.get('password')

    try:
        # Start scrapers in background threads
        start_scrapers(email, password)
        
        # Get cookies from login process
        driver = setup_driver()
        try:
            # Use the robust login from scrape_attendance
            login_attendance(driver)
            # Extract cookies after successful login
            cookies = {cookie['name']: cookie['value'] for cookie in driver.get_cookies()}
            
            # Create JWT token
            token = create_jwt_token(email)
            
            # Store in Supabase
            try:
                supabase.table('user_cookies').upsert({
                    'email': email,
                    'cookies': cookies,
                    'token': token,
                    'updated_at': datetime.now().isoformat()
                }).execute()
                print(f"✅ Stored cookies and token for {email}")
            except Exception as e:
                print(f"⚠️ Error storing in Supabase: {str(e)}")
            
            return jsonify({
                'success': True,
                'token': token,
                'user': {'email': email}
            })
        except Exception as e:
            print(f"⚠️ Login error: {str(e)}")
            return jsonify({'error': str(e)}), 500
        finally:
            driver.quit()
    except Exception as e:
        print(f"❌ Critical error: {str(e)}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/user', methods=['GET'])
def get_user():
    """Get user info from token"""
    try:
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({'error': 'No token provided'}), 401
            
        token = auth_header.split(' ')[1]
        
        # Verify token
        try:
            email = verify_token(token)
        except Exception as e:
            return jsonify({'error': 'Invalid token'}), 401
        
        # Get user data from Supabase
        try:
            user_data = supabase.table('user_cookies')\
                .select('updated_at')\
                .eq('email', email)\
                .execute()
                
            if not user_data.data:
                return jsonify({'error': 'User not found'}), 404
                
            return jsonify({
                'success': True,
                'user': {
                    'email': email,
                    'last_update': user_data.data[0]['updated_at']
                }
            })
        except Exception as e:
            print(f"⚠️ Supabase error: {str(e)}")
            return jsonify({'error': 'Database error'}), 500
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/scraper-status', methods=['GET'])
def get_scraper_status():
    """Get current scraper status"""
    try:
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({'error': 'No token provided'}), 401
            
        token = auth_header.split(' ')[1]
        verify_token(token)  # Just verify the token
        
        return jsonify({
            'success': True,
            'status': scraper_status
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 401

@app.route('/api/attendance', methods=['GET'])
def get_attendance():
    """Get attendance data"""
    try:
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({'error': 'No token provided'}), 401
            
        token = auth_header.split(' ')[1]
        email = verify_token(token)
        
        # Get attendance data from database
        attendance_data = supabase.table('attendance_data')\
            .select('*')\
            .eq('email', email)\
            .execute()
            
        if not attendance_data.data:
            return jsonify({'error': 'No attendance data found'}), 404
            
        return jsonify({
            'success': True,
            'data': attendance_data.data[0]
        })
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/timetable', methods=['GET'])
def get_timetable():
    """Get timetable data"""
    try:
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({'error': 'No token provided'}), 401
            
        token = auth_header.split(' ')[1]
        email = verify_token(token)
        
        # Get timetable data from database
        timetable_data = supabase.table('timetable_data')\
            .select('*')\
            .eq('email', email)\
            .execute()
            
        if not timetable_data.data:
            return jsonify({'error': 'No timetable data found'}), 404
            
        return jsonify({
            'success': True,
            'data': timetable_data.data[0]
        })
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'ok'}) 