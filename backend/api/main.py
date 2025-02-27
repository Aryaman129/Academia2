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

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)

# Enable CORS for the entire app
CORS(app)

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

