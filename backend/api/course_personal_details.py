from pyquery import PyQuery as pq
import json
import requests
import base64

url = "https://academia.srmuniv.ac.in/liveViewHeader.do"

def getCookieFromToken(token):
    try:
        token = base64.b64decode(token.encode()).decode()
        return json.loads(token)
    except:
        return "error"

def get_CourseDetails(index, element, CourseDetails):
    CourseCode = pq(element).find("td").eq(0).text()
    CourseDetails[CourseCode] = {
        "CourseCode": CourseCode,
        "CourseTitle": pq(element).find("td").eq(1).text(),
        "RegnType": pq(element).find("td").eq(2).text(),
        "Category": pq(element).find("td").eq(3).text(),
        "CourseType": pq(element).find("td").eq(4).text(),
        "FacultyName": pq(element).find("td").eq(5).text(),
        "Slot": pq(element).find("td").eq(6).text(),
        "RoomNo": pq(element).find("td").eq(7).text()
    }

def get_facultyadvisordetails(index, element, FacultyAdvisors):
    FacultyAdvisors.append({
        "FacultyAdvisorName": pq(element).find("strong").eq(0).text(),
        "FacultyAdvisorEmail": pq(element).find("font").eq(0).text()
    })

def get_personaldetails(dom):
    return {
        "RegistrationNumber": dom('table[cellspacing="1"]').eq(0).find('td').eq(1).text(),
        "Name": dom('table[cellspacing="1"]').eq(0).find('td').eq(3).text(),
        "Batch": dom('table[cellspacing="1"]').eq(0).find('td').eq(5).text(),
        "Mobile": dom('table[cellspacing="1"]').eq(0).find('td').eq(7).text(),
        "Program": dom('table[cellspacing="1"]').eq(0).find('td').eq(9).text(),
        "Department": dom('table[cellspacing="1"]').eq(0).find('td').eq(11).text(),
        "Semester": dom('table[cellspacing="1"]').eq(0).find('td').eq(13).text()
    }

def getCoursePersonalDetailsData(token, sem="ODD"):
    if sem not in ["EVEN", "ODD"]:
        return json.dumps({"status": "error", "msg": "Invalid semester"})

    viewLinkName = f"My_Time_Table_2018_19_{sem}"

    Cookies = getCookieFromToken(token)
    if Cookies == "error":
        return json.dumps({"status": "error", "msg": "Invalid token"})

    headers = {
        'Origin': 'https://academia.srmuniv.ac.in',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/62.0.3202.89 Safari/537.36'
    }
    data = {
        "sharedBy": "srm_university",
        "appLinkName": "academia-academic-services",
        "viewLinkName": viewLinkName,
        "urlParams": {},
        "isPageLoad": "true"
    }

    response = requests.post(url, data=data, headers=headers, cookies=Cookies)
    if response.status_code != 200:
        return json.dumps({"status": "error", "msg": "Failed to fetch data"})

    dom = pq(response.text)

    CourseDetails = {}
    FacultyAdvisors = []

    dom('table[border="1"]').find('tr:nth-child(n + 2)').each(lambda i, e: get_CourseDetails(i, e, CourseDetails))
    dom('td[align="center"]').each(lambda i, e: get_facultyadvisordetails(i, e, FacultyAdvisors))

    PersonalDetails = get_personaldetails(dom)

    return json.dumps({
        "status": "success",
        "data": {
            "PersonalDetails": PersonalDetails,
            "FacultyAdvisors": FacultyAdvisors,
            "CourseDetails": CourseDetails
        }
    })

def getCoursePersonalDetails(token):
    # Try fetching for EVEN semester first
    result = json.loads(getCoursePersonalDetailsData(token, "EVEN"))
    if result["status"] == "success" and result["data"]["PersonalDetails"]["RegistrationNumber"]:
        return json.dumps(result)

    # If EVEN semester data is missing, try ODD
    result = json.loads(getCoursePersonalDetailsData(token, "ODD"))
    if result["status"] == "success" and result["data"]["PersonalDetails"]["RegistrationNumber"]:
        return json.dumps(result)

    return json.dumps({"status": "error", "msg": "Could not retrieve details"})
