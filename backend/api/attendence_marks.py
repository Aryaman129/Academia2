import requests
from pyquery import PyQuery as pq
import json
import time

# ✅ SRM Login Credentials (Replace with actual username & password)
USERNAME = "am5965@srmist.edu.in"
PASSWORD = "Galactic@1296"

# ✅ URLs
LOGIN_URL = "https://academia.srmist.edu.in/login.do"
# Updated Attendance URL based on Network Tab:
ATTENDANCE_URL = "https://academia.srmist.edu.in/srm_university/academia-academic-services/page/My_Attendance"

# ✅ Headers (Mimic a browser request)
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36",
    "Referer": "https://academia.srmist.edu.in/",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
}

# ✅ Function to get fresh JSESSIONID
def get_session_token():
    session = requests.Session()
    
    # Send Login Request
    data = {
        "username": USERNAME,
        "password": PASSWORD
    }
    
    response = session.post(LOGIN_URL, data=data, headers=HEADERS)
    print("Login Response Cookies:", session.cookies.get_dict())
    
    if "JSESSIONID" in session.cookies:
        token = session.cookies["JSESSIONID"]
        print("✅ New JSESSIONID obtained:", token)
        return token
    else:
        print("❌ Failed to fetch JSESSIONID. Check credentials.")
        return None

# ✅ Function to fetch attendance and marks using GET request
def get_attendance_and_marks(token):
    if not token:
        return json.dumps({"status": "error", "msg": "No session token provided."})

    # Use the token in cookies (adjust if additional cookies are required)
    cookies = {
        "JSESSIONID": token,
        "iamcsr": token,
        "CT_CSRF_TOKEN": token
    }
    
    # We'll use a GET request now
    session = requests.Session()
    max_retries = 2
    for attempt in range(max_retries):
        try:
            response = session.get(ATTENDANCE_URL, headers=HEADERS, cookies=cookies, timeout=10)
            print(f"🔹 Attempt {attempt + 1}/{max_retries} - Status Code:", response.status_code)
            print("🔹 Response Headers:", response.headers)
            print("🔹 Response Text (first 500 chars):", response.text[:500])
            
            if response.status_code == 200:
                break
        except requests.exceptions.RequestException as e:
            print(f"🔴 Attempt {attempt + 1}/{max_retries} - Error:", e)
            time.sleep(2 ** attempt)
    else:
        return json.dumps({"status": "error", "msg": "Max retries reached. Connection failed."})

    # Parse the returned HTML using PyQuery
    dom = pq(response.text)

    AttendanceDetails = []
    Marks = []

    def get_attendancedata(index, element):
        if index == 0:
            AttendanceDetails.clear()
        
        CourseCode = pq(element).find("td").eq(0).text()
        if "Regular" not in CourseCode:
            return
        CourseCode = CourseCode[:-8]  # Remove "Regular"
        AttendanceDetails.append({
            "CourseCode": CourseCode,
            "CourseTitle": pq(element).find("td").eq(1).text(),
            "Category": pq(element).find("td").eq(2).text(),
            "FacultyName": pq(element).find("td").eq(3).text(),
            "Slot": pq(element).find("td").eq(4).text(),
            "RoomNo": pq(element).find("td").eq(5).text(),
            "HoursConducted": pq(element).find("td").eq(6).text(),
            "HoursAbsent": pq(element).find("td").eq(7).text(),
            "Attendance": pq(element).find("td").eq(8).text(),
            "UniversityPracticalDetails": pq(element).find("td").eq(9).text()
        })

    def get_marks(index, element):
        CourseCode = pq(element).find("td").eq(0).text()
        Marks_each = {}
        MarksTotal = 0
        for a in pq(element).find("td").eq(2).find("td"):
            testLabel = pq(a).find("strong").text()
            testMarks = pq(a).text().replace(testLabel, "").replace(" ", "")
            Marks_each[testLabel] = testMarks
            if testMarks != "Abs":
                try:
                    MarksTotal += float(testMarks)
                except ValueError:
                    continue
        Marks_each["CourseCode"] = CourseCode
        Marks_each["Total"] = MarksTotal
        Marks.append(Marks_each)

    # Adjust the selectors as per the actual structure of the HTML page
    dom('table').eq(1).find("tr:nth-child(n + 2)").each(get_attendancedata)
    # If there's another table for marks, adjust the index accordingly
    # For now, we'll assume attendance and marks are in the same table
    AttendanceAndMarks = []
    for value_att in AttendanceDetails:
        AttendanceAndMarks.append(value_att)

    if len(AttendanceAndMarks) > 0:
        return json.dumps({"status": "success", "data": AttendanceAndMarks})
    else:
        return json.dumps({"status": "error", "msg": "Error occurred in parsing attendance data."})

# Example usage
token = get_session_token()
if token:
    print(get_attendance_and_marks(token))
else:
    print(json.dumps({"status": "error", "msg": "Could not obtain session token."}))

