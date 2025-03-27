import os
from datetime import datetime, timedelta
import jwt
from flask import Flask, request, jsonify
from flask_cors import CORS
import time
import threading
from supabase import create_client, Client
import traceback
import json
from selenium import webdriver
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Set up Supabase client
SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_KEY')
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

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

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    email = data.get('email')
    password = data.get('password')

    try:
        # 1. Get cookies and create token
        cookies = get_srm_cookies(email, password)
        token = create_jwt_token(email)
        
        # 2. Store in Supabase
        store_cookies_and_token(email, cookies, token)
        
        # 3. Run full scraper with modified order
        def run_ordered_scraper():
            try:
                scraper = SRMScraper(email, password)
                driver = scraper.setup_driver()
                
                print("🔄 Starting full data scrape...")
                
                # CHANGE 1: Get timetable first (was previously after attendance)
                print("📅 Getting timetable data first...")
                timetable_html = scraper.get_timetable_page()
                if timetable_html:
                    timetable_success = scraper.parse_and_save_timetable(timetable_html, driver)
                    print(f"✅ Timetable scraping: {'Success' if timetable_success else 'Failed'}")
                
                # CHANGE 2: Then get attendance (was previously first)
                print("📊 Getting attendance data...")
                attendance_html = scraper.get_attendance_page()
                if attendance_html:
                    attendance_success = scraper.parse_and_save_attendance(attendance_html, driver)
                    marks_success = scraper.parse_and_save_marks(attendance_html, driver)
                    print(f"✅ Attendance scraping: {'Success' if attendance_success else 'Failed'}")
                    print(f"✅ Marks scraping: {'Success' if marks_success else 'Failed'}")
                
                driver.quit()
                print("✅ Full scrape completed!")
                
            except Exception as e:
                print(f"❌ Scraper error: {str(e)}")
                traceback.print_exc()
        
        # Start ordered scraper in background
        threading.Thread(
            target=run_ordered_scraper,
            daemon=True
        ).start()

        return jsonify({
            'success': True,
            'token': token,
            'message': 'Login successful, data scraping started'
        })

    except Exception as e:
        print(f"❌ Login error: {str(e)}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

# Add user endpoint to verify token
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
            print(f"Supabase error: {str(e)}")
            return jsonify({'error': 'Database error'}), 500
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Modify existing attendance endpoint to use token
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

# Modify existing timetable endpoint to use token
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

@app.route('/api/debug-token', methods=['GET'])
def debug_token():
    """Debug endpoint to verify token and cookies"""
    try:
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({'error': 'No token provided'}), 401
            
        token = auth_header.split(' ')[1]
        
        # Verify token
        try:
            email = verify_token(token)
            
            # Get data from Supabase
            user_data = supabase.table('user_cookies')\
                .select('*')\
                .eq('email', email)\
                .execute()
                
            if not user_data.data:
                return jsonify({
                    'error': 'User not found',
                    'token_valid': True,
                    'email': email,
                    'user_cookies_count': 0
                }), 404
                
            cookies = user_data.data[0].get('cookies', {})
            
            # Return details for debugging
            return jsonify({
                'success': True,
                'token_valid': True,
                'email': email,
                'cookie_count': len(cookies),
                'cookie_names': list(cookies.keys()) if cookies else [],
                'updated_at': user_data.data[0].get('updated_at'),
                'token_stored': user_data.data[0].get('token', '') == token
            })
        except Exception as e:
            return jsonify({
                'error': 'Invalid token: ' + str(e),
                'token_provided': token[:10] + '...'
            }), 401
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500 

@app.route('/api/test-attendance', methods=['GET'])
def test_attendance():
    """Test endpoint to verify attendance data including lab courses"""
    try:
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({'error': 'No token provided'}), 401
            
        token = auth_header.split(' ')[1]
        email = verify_token(token)
        
        # Get both cookies and attendance data
        cookies_data = supabase.table('user_cookies').select('*').eq('email', email).execute()
        attendance_data = supabase.table('attendance_data').select('*').eq('email', email).execute()
        
        # Prepare response
        response = {
            'cookie_status': {
                'has_cookies': bool(cookies_data.data),
                'cookie_count': len(cookies_data.data[0]['cookies']) if cookies_data.data else 0,
                'last_updated': cookies_data.data[0]['updated_at'] if cookies_data.data else None
            },
            'attendance_status': {
                'has_data': bool(attendance_data.data),
                'course_count': len(attendance_data.data[0]['data']) if attendance_data.data else 0,
                'lab_courses': []
            }
        }
        
        # Add lab course details
        if attendance_data.data:
            for course_code, course_data in attendance_data.data[0]['data'].items():
                if course_data.get('is_lab'):
                    response['attendance_status']['lab_courses'].append({
                        'code': course_code,
                        'name': course_data['name'],
                        'attendance': f"{course_data['present']}/{course_data['total']} ({course_data['percentage']}%)"
                    })
        
        return jsonify(response)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500 

@app.route('/api/check-cookies', methods=['GET'])
def check_cookies():
    """Debug endpoint to check stored cookies"""
    try:
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({'error': 'No token provided'}), 401
            
        token = auth_header.split(' ')[1]
        email = verify_token(token)
        
        # Get cookies from Supabase
        result = supabase.table('user_cookies').select('*').eq('email', email).execute()
        
        if not result.data:
            return jsonify({
                'success': False,
                'message': 'No cookies found for user',
                'email': email
            })
            
        cookies = result.data[0].get('cookies', {})
        
        # Also check the debug file if it exists
        file_cookies = {}
        try:
            with open('srm_cookies.json', 'r') as f:
                file_cookies = json.load(f)
        except:
            pass
            
        return jsonify({
            'success': True,
            'email': email,
            'database_cookies': {
                'count': len(cookies),
                'names': list(cookies.keys()),
                'last_updated': result.data[0].get('updated_at')
            },
            'file_cookies': {
                'count': len(file_cookies),
                'names': list(file_cookies.keys()) if file_cookies else []
            }
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500 

@app.route('/api/verify-cookies', methods=['GET'])
def verify_cookies():
    """Quick endpoint to verify cookie storage"""
    try:
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({'error': 'No token provided'}), 401
            
        token = auth_header.split(' ')[1]
        email = verify_token(token)
        
        # Check debug file
        file_cookies = {}
        try:
            with open('debug_cookies.json', 'r') as f:
                file_cookies = json.load(f)
        except:
            pass
            
        # Check database
        db_result = supabase.table('user_cookies').select('*').eq('email', email).execute()
        db_cookies = db_result.data[0].get('cookies', {}) if db_result.data else {}
        
        return jsonify({
            'success': True,
            'file': {
                'exists': bool(file_cookies),
                'cookieCount': len(file_cookies),
                'cookieNames': list(file_cookies.keys()) if file_cookies else []
            },
            'database': {
                'exists': bool(db_cookies),
                'cookieCount': len(db_cookies),
                'cookieNames': list(db_cookies.keys()) if db_cookies else []
            }
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500 

@app.route('/api/verify-session', methods=['GET'])
def verify_session():
    try:
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({'error': 'No token provided'}), 401
            
        token = auth_header.split(' ')[1]
        email = verify_token(token)
        
        # Get existing data from database
        attendance_data = supabase.table('attendance').select('*').eq('user_id', email).execute()
        
        if attendance_data.data:
            # Data exists, return immediately without scraping
            return jsonify({
                'status': 'success',
                'email': email,
                'hasData': True
            })
        else:
            # No data found, need to scrape
            return jsonify({
                'status': 'success',
                'email': email,
                'hasData': False
            })
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/refresh-data', methods=['POST'])
def refresh_data():
    """Refresh only attendance and marks data using stored cookies"""
    try:
        # Get token and verify
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({'error': 'No token provided'}), 401
            
        token = auth_header.split(' ')[1]
        email = verify_token(token)
        
        # Get user_id
        user_query = supabase.table("users").select("id").eq("email", email).execute()
        if not user_query.data:
            return jsonify({'error': 'User not found'}), 404
        user_id = user_query.data[0]['id']
        
        # Get stored cookies
        stored_data = supabase.table('user_cookies').select('*').eq('email', email).execute()
        if not stored_data.data:
            return jsonify({'error': 'No stored session found'}), 404
            
        cookies = stored_data.data[0].get('cookies', {})
        
        # Start attendance scraper
        def refresh_attendance_only():
            try:
                from srm_scrapper import SRMScraper
                scraper = SRMScraper(email, None)  # No password needed
                driver = scraper.setup_driver()
                
                # Apply stored cookies
                print("🔄 Applying stored cookies...")
                driver.get("https://academia.srmist.edu.in")
                for cookie in cookies:
                    driver.add_cookie(cookie)
                
                # Get attendance page
                print("📊 Fetching attendance data...")
                html_source = scraper.get_attendance_page()
                
                if html_source:
                    # Update attendance and marks
                    attendance_success = scraper.parse_and_save_attendance(html_source, driver)
                    marks_success = scraper.parse_and_save_marks(html_source, driver)
                    
                    print(f"✅ Data refresh completed - Attendance: {attendance_success}, Marks: {marks_success}")
                else:
                    print("❌ Failed to load attendance page")
                
                driver.quit()
                
            except Exception as e:
                print(f"❌ Refresh error: {str(e)}")
                traceback.print_exc()
        
        # Start refresh in background
        threading.Thread(
            target=refresh_attendance_only,
            daemon=True
        ).start()
        
        return jsonify({
            'success': True,
            'message': 'Refresh started'
        })
        
    except Exception as e:
        print(f"❌ Refresh error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/refresh-status', methods=['GET'])
def get_refresh_status():
    """Check when attendance was last updated"""
    try:
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({'error': 'No token provided'}), 401
            
        token = auth_header.split(' ')[1]
        email = verify_token(token)
        
        # Get user_id
        user_query = supabase.table("users").select("id").eq("email", email).execute()
        if not user_query.data:
            return jsonify({'error': 'User not found'}), 404
        user_id = user_query.data[0]['id']
        
        # Get last update times
        print(f"Checking status for user_id: {user_id}")
        attendance_data = supabase.table('attendance').select('updated_at').eq('user_id', user_id).execute()
        marks_data = supabase.table('marks').select('updated_at').eq('user_id', user_id).execute()
        
        print(f"Found attendance data: {attendance_data.data}")
        print(f"Found marks data: {marks_data.data}")
        
        return jsonify({
            'success': True,
            'attendance_last_update': attendance_data.data[0]['updated_at'] if attendance_data.data else None,
            'marks_last_update': marks_data.data[0]['updated_at'] if marks_data.data else None
        })
        
    except Exception as e:
        print(f"❌ Status check error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/quick-login', methods=['POST'])
def quick_login():
    """Login with email only if valid token exists in database"""
    try:
        data = request.json
        email = data.get('email')
        
        # Check if valid token exists in database
        stored_data = supabase.table('user_cookies').select('*').eq('email', email).execute()
        
        if not stored_data.data:
            return jsonify({
                'success': False,
                'message': 'No existing session found, please login with password'
            }), 404
            
        stored_token = stored_data.data[0].get('token')
        
        try:
            # Verify the stored token is still valid
            verify_token(stored_token)
            
            # Token valid, return it for new device
            return jsonify({
                'success': True,
                'token': stored_token,
                'user': {'email': email},
                'hasData': True  # Data already exists in database
            })
            
        except:
            return jsonify({
                'success': False,
                'message': 'Stored session expired, please login with password'
            }), 401
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500 