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
        print(f"🔄 Starting login process for {email}")
        
        # First get cookies
        from srm_login import get_srm_cookies  # Import the exact function
        
        try:
            # Get cookies first using the proven function
            print("📝 Getting cookies using srm_login.py...")
            cookies = get_srm_cookies(email, password)
            print(f"🍪 Extracted cookies: {list(cookies.keys())}")
            
            # Create JWT token
            token = create_jwt_token(email)
            
            # Store in Supabase
            try:
                cookie_data = {
                    'email': email,
                    'cookies': cookies,
                    'token': token,
                    'updated_at': datetime.now().isoformat()
                }
                
                print(f"💾 Storing cookies in Supabase: {list(cookies.keys())}")
                
                # Delete old record
                supabase.table('user_cookies').delete().eq('email', email).execute()
                print("✅ Deleted old cookie record")
                
                # Insert new record
                result = supabase.table('user_cookies').insert(cookie_data).execute()
                print(f"✅ Stored new cookie record")
                
                # Verify storage
                verify = supabase.table('user_cookies').select('*').eq('email', email).execute()
                if verify.data:
                    print(f"✅ Verified cookie storage - found {len(verify.data[0]['cookies'])} cookies")
                else:
                    print("⚠️ Could not verify cookie storage")
                
            except Exception as e:
                print(f"❌ Supabase storage error: {str(e)}")
                return jsonify({'error': f'Failed to store cookies: {str(e)}'}), 500
            
            # Now start the scrapers in background
            print("🔄 Starting scrapers in background...")
            threading.Thread(
                target=start_scrapers,
                args=(email, password),
                daemon=True
            ).start()
            
            return jsonify({
                'success': True,
                'token': token,
                'user': {'email': email},
                'cookieCount': len(cookies)
            })
            
        except Exception as e:
            print(f"❌ Cookie extraction error: {str(e)}")
            return jsonify({'error': str(e)}), 500
            
    except Exception as e:
        print(f"❌ Login error: {str(e)}")
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