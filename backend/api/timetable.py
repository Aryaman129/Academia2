from pyquery import PyQuery as pq
import json
import requests
import os

TimeTable = {}
Slots = []

url = "https://academia.srmuniv.ac.in/liveViewHeader.do"

# Load cookies from environment variables
cookies = {
    "JSESSIONID": os.getenv("JSESSIONID"),
    "iamcsr": os.getenv("IAMCSR"),
    "CT_CSRF_TOKEN": os.getenv("CT_CSRF_TOKEN"),
}

def get_timetable(index, element):
    DayName = "Day-" + str(index + 1)
    timetable_eachDay = {}

    for index, value in enumerate(pq(element).find("td:nth-child(n + 2)")):
        timetable_eachDay[Slots[index]] = pq(value).text()

    TimeTable[DayName] = timetable_eachDay


def getTimeTable(batch):
    batch = str(batch)

    if batch == "1":
        viewLinkName = "Common_Time_Table_Batch_1"
    elif batch == "2":
        viewLinkName = "Common_Time_Table_Batch_2"
    else:
        return json.dumps({"status": "error", "msg": "Error in batch name."})

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
        return json.dumps({"status": "error", "msg": "Failed to fetch timetable"})

    dom = response.text

    s1 = '$("#zc-viewcontainer_' + viewLinkName + '").prepend(pageSanitizer.sanitize('
    s2 = '});</script>'

    a, b = dom.find(s1), dom.find(s2)
    dom = pq(dom[a + 56 + len(viewLinkName) : b - 5])

    for value in dom('table[width="400"]').find("tr").eq(0).find("td:nth-child(n + 2)"):
        Slots.append(pq(value).text().replace("\t", ""))

    dom('table[width="400"]').find("tr:nth-child(n + 5)").each(get_timetable)

    if len(TimeTable) > 3:
        return json.dumps({"status": "success", "data": TimeTable})
    else:
        return json.dumps({"status": "error", "msg": "Error occurred"})

