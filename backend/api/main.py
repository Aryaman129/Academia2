from flask import Flask
from flask import request as rq
from api import token_srm  # ✅ Correct way to import from 'api' folder
from api import attendence_marks
from api import timetable
from api import course_personal_details
import json
from flask import Response
from dotenv import load_dotenv
import os
from flask_cors import CORS  # Import CORS
import threading
import time
from datetime import datetime

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)

# Enable CORS for the entire app
CORS(app)

# Dictionary to store refresh status for each user
refresh_status = {}

# Background scraper function
def run_background_scraper(user_id, token):
    try:
        refresh_status[user_id] = {"status": "in_progress", "started_at": datetime.now().isoformat()}
        
        # Call the attendance and marks scraper
        attendence_marks.get_attendance_and_marks(token)
        
        # Update status to completed with timestamp
        refresh_status[user_id] = {
            "status": "completed", 
            "updated_at": datetime.now().isoformat()
        }
    except Exception as e:
        refresh_status[user_id] = {"status": "error", "error": str(e)}
        print(f"Error in background scraper: {e}")

@app.route('/')
def home():
    json_o = {"status": "success", "msg": "*** ACADEMIA API WITH PYTHON *** By Yogesh Kumawat"}
    json_o = json.dumps(json_o)
    return json_o

@app.route('/token', methods=['GET', 'POST'])
def request():
    if 'email' in rq.args and 'pass' in rq.args:
        response = token_srm.getToken(rq.args.get('email'), rq.args.get('pass'))
        response = Response(response, status=200, mimetype='application/json')
        return response
    else:
        response = {"status":"error", "msg":"Error in Input Parameters"}
        response = json.dumps(response)
        response = Response(response, status=200, mimetype='application/json')
        return response

@app.route('/api/refresh-data', methods=['POST'])
def refresh_data():
    # Get token from Authorization header
    auth_header = rq.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        response = {"status": "error", "message": "Invalid or missing Authorization header"}
        return Response(json.dumps(response), status=401, mimetype='application/json')
    
    token = auth_header.split(' ')[1]
    
    # Extract user_id from token or request
    # This is a simplified example - you should extract the user ID from the token
    if 'user_id' in rq.json:
        user_id = rq.json['user_id']
    else:
        # Get some identifier from the token or use the token itself
        user_id = token[:20]  # Use part of token as identifier
    
    # Start background scraper thread
    scraper_thread = threading.Thread(target=run_background_scraper, args=(user_id, token))
    scraper_thread.daemon = True
    scraper_thread.start()
    
    response = {"status": "started", "message": "Refresh process started"}
    return Response(json.dumps(response), status=200, mimetype='application/json')

@app.route('/api/refresh-status', methods=['GET'])
def check_refresh_status():
    # Get token from Authorization header
    auth_header = rq.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        response = {"status": "error", "message": "Invalid or missing Authorization header"}
        return Response(json.dumps(response), status=401, mimetype='application/json')
    
    token = auth_header.split(' ')[1]
    
    # Extract user_id from token or request (same as in refresh-data)
    if 'user_id' in rq.args:
        user_id = rq.args.get('user_id')
    else:
        # Get some identifier from the token or use the token itself
        user_id = token[:20]  # Use part of token as identifier
    
    # Get status for user
    status = refresh_status.get(user_id, {"status": "not_started"})
    
    return Response(json.dumps(status), status=200, mimetype='application/json')

@app.route('/AttAndMarks', methods=['GET', 'POST'])
def AttAndMarks():
    if 'token' in rq.args:
        token = str(rq.args.get('token'))
        att_marks = attendence_marks.get_attendance_and_marks(token)
        response = Response(att_marks, status=200, mimetype='application/json')
        return response
    else:
        response = {"status": "error", "msg": "Error in Input Parameters"}
        response = json.dumps(response)
        response = Response(response, status=200, mimetype='application/json')
        return response

@app.route('/TimeTable', methods=['GET', 'POST'])
def TimeTable():
    if 'batch' in rq.args and 'token' in rq.args:
        batchNo = rq.args.get('batch')
        token = rq.args.get('token')
        timeTable = timetable.getTimeTable(token, batchNo)
        response = Response(timeTable, status=200, mimetype='application/json')
        return response
    else:
        response = {"status": "error", "msg": "Error in Input Parameters"}
        response = json.dumps(response)
        response = Response(response, status=200, mimetype='application/json')
        return response

@app.route('/PersonalDetails', methods=['GET', 'POST'])
def getPersonalDetails():
    if 'token' in rq.args:
        token = rq.args.get('token')
        details = course_personal_details.getCoursePersonalDetails(token)
        response = Response(details, status=200, mimetype='application/json')
        return response
    else:
        response = {"status": "error", "msg": "Error in Input Parameters"}
        response = json.dumps(response)
        response = Response(response, status=200, mimetype='application/json')
        return response

if __name__ == '__main__':
    app.run(debug=True)

