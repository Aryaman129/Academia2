from pyquery import PyQuery as pq
import json
import requests
import os

TimeTable = {}
Slots = []

# Updated base URL using the new SRM domain and endpoint for timetable pages
base_timetable_url = "https://academia.srmist.edu.in/srm_university/academia-academic-services/page/"

def get_timetable(index, element):
    DayName = "Day-" + str(index + 1)
    timetable_eachDay = {}
    for idx, value in enumerate(pq(element).find("td:nth-child(n + 2)")):
        timetable_eachDay[Slots[idx]] = pq(value).text()
    TimeTable[DayName] = timetable_eachDay

def getTimeTable(batch):
    batch = str(batch)
    if batch == "1":
        viewLinkName = "Unified_Time_Table_2024_Batch_1"
    elif batch == "2":
        viewLinkName = "Unified_Time_Table_2024_Batch_2"
    else:
        return json.dumps({"status": "error", "msg": "Error in batch name."})
    
    url = base_timetable_url + viewLinkName
    headers = {
        "Origin": "https://academia.srmist.edu.in",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
    }
    # Use GET request as per your network trace
    response = requests.get(url, headers=headers, verify=False)  # verify=False for testing only
    if response.status_code != 200:
        return json.dumps({"status": "error", "msg": "Failed to fetch timetable"})
    
    dom = response.text
    # The following parsing logic is similar to before; you may need to adjust the markers based on the actual HTML.
    s1 = '$("#zc-viewcontainer_' + viewLinkName + '").prepend(pageSanitizer.sanitize('
    s2 = '});</script>'
    a = dom.find(s1)
    b = dom.find(s2)
    if a == -1 or b == -1:
        return json.dumps({"status": "error", "msg": "Failed to parse timetable data"})
    content = dom[a + 56 + len(viewLinkName) : b - 5]
    dom_parsed = pq(content)
    for value in dom_parsed('table[width="400"]').find("tr").eq(0).find("td:nth-child(n + 2)"):
        Slots.append(pq(value).text().replace("\t", ""))
    dom_parsed('table[width="400"]').find("tr:nth-child(n + 5)").each(get_timetable)
    if len(TimeTable) > 3:
        return json.dumps({"status": "success", "data": TimeTable})
    else:
        return json.dumps({"status": "error", "msg": "Error occurred"})


