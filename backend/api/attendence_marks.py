from pyquery import PyQuery as pq
import json
import requests
import os

AttendanceDetails = []
Marks = []
url = "https://academia.srmuniv.ac.in/liveViewHeader.do"

# Load cookies from environment variables
cookies = {
    "JSESSIONID": os.getenv("JSESSIONID"),
    "iamcsr": os.getenv("IAMCSR"),
    "CT_CSRF_TOKEN": os.getenv("CT_CSRF_TOKEN"),
}

def get_attendancedata(index, element):
    global AttendanceDetails

    if index == 0:
        AttendanceDetails = []

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


def getAttendenceAndMarks():
    viewLinkName = "My_Attendance"

    headers = {
        "Origin": "https://academia.srmuniv.ac.in",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/62.0.3202.89 Safari/537.36",
    }
    data = {
        "sharedBy": "srm_university",
        "appLinkName": "academia-academic-services",
        "viewLinkName": viewLinkName,
        "urlParams": {},
        "isPageLoad": "true",
    }

    response = requests.post(url, data=data, headers=headers, cookies=cookies)

    if response.status_code != 200:
        return json.dumps({"status": "error", "msg": "Failed to fetch attendance and marks"})

    dom = pq(response.text)

    dom('table[border="1"]').eq(0).find("tr:nth-child(n + 2)").each(get_attendancedata)
    dom('table[align="center"]').eq(2).find("tr:nth-child(n + 2)").each(get_marks)

    AttendanceAndMarks = []

    for value_att in AttendanceDetails:
        for value_marks in Marks:
            if value_att["CourseCode"] == value_marks["CourseCode"]:
                req_marks = value_marks.copy()
                req_marks.pop("CourseCode", None)
                value_att["Marks"] = req_marks
        AttendanceAndMarks.append(value_att)

    if len(AttendanceAndMarks) > 5:
        return json.dumps({"status": "success", "data": AttendanceAndMarks})
    else:
        return json.dumps({"status": "error", "msg": "Error occurred"})

