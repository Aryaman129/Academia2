import time
import json
import os
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from bs4 import BeautifulSoup
from supabase import create_client, Client
from werkzeug.security import generate_password_hash  # NEW import

# ====== Supabase Configuration ======
SUPABASE_URL = "https://zqzitiypvwexenxbkazf.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpxeml0aXlwdndleGVueGJrYXpmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MDMwODQ1MiwiZXhwIjoyMDU1ODg0NDUyfQ.3EHSC4cxhrq-UjBotQIMvvnUILLc19F_8ROq7RfSEYk"
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ====== Selenium Setup ======
BASE_URL = "https://academia.srmist.edu.in"
LOGIN_URL = BASE_URL
ATTENDANCE_PAGE_URL = "https://academia.srmist.edu.in/#Page:My_Attendance"
driver_path = r"C:\Users\Lenovo\Desktop\Academia2\Academia2\chromedriver-win64\chromedriver.exe"

chrome_options = Options()
chrome_options.add_argument("--headless")
chrome_options.add_argument("--disable-gpu")
chrome_options.add_argument("--no-sandbox")
chrome_options.add_argument("--window-size=1920,1080")
chrome_options.add_argument("--ignore-certificate-errors")
chrome_options.add_argument("--allow-running-insecure-content")

service = Service(driver_path)
driver = webdriver.Chrome(service=service, options=chrome_options)

print("✅ ChromeDriver initialized. Waiting before asking for input...")
time.sleep(2)

# Global variables for credentials (will be overwritten in run_scraper)
username = ""
password = ""

# ====== Function: Login ======
def login():
    driver.get(LOGIN_URL)
    wait = WebDriverWait(driver, 30)
    wait.until(EC.frame_to_be_available_and_switch_to_it((By.ID, "signinFrame")))
    print("✅ Switched to iframe")
    email_field = wait.until(EC.presence_of_element_located((By.ID, "login_id")))
    email_field.send_keys(username)
    print("✅ Entered email")
    next_button = wait.until(EC.element_to_be_clickable((By.ID, "nextbtn")))
    next_button.click()
    print("✅ Clicked Next")
    time.sleep(2)
    password_field = wait.until(EC.element_to_be_clickable((By.ID, "password")))
    password_field.send_keys(password)
    print("✅ Entered password")
    sign_in_button = wait.until(EC.element_to_be_clickable((By.ID, "nextbtn")))
    sign_in_button.click()
    print("✅ Clicked Sign In")
    time.sleep(5)
    if BASE_URL in driver.current_url:
        print("✅ Login successful")
    else:
        print("❌ Login failed, check credentials or CAPTCHA requirements")
        driver.quit()
        exit()

# ====== Function: Navigate to Attendance Page ======
def get_attendance_page():
    driver.get(ATTENDANCE_PAGE_URL)
    print("⏳ Waiting for attendance page to load...")
    time.sleep(55)
    html_source = driver.page_source
    with open("attendance_page.html", "w", encoding="utf-8") as f:
        f.write(html_source)
    print("✅ Saved attendance page HTML for inspection.")
    return html_source

# ====== Helper: Extract Registration Number with Multiple Attempts ======
def extract_registration_number(soup):
    registration_number = None

    # Method 1: Look for a <td> that contains "Registration Number" and then get next <td>
    label_td = soup.find("td", string=lambda text: text and "Registration Number" in text)
    if label_td:
        value_td = label_td.find_next("td")
        if value_td:
            # Try finding a <strong> or <b> within it
            strong_elem = value_td.find("strong") or value_td.find("b")
            if strong_elem:
                registration_number = strong_elem.get_text(strip=True)
            else:
                registration_number = value_td.get_text(strip=True)
    
    # Method 2: If not found, loop through rows to see if the number is in the second <td>
    if not registration_number:
        for row in soup.find_all("tr"):
            tds = row.find_all("td")
            if len(tds) >= 2 and "Registration" in tds[0].get_text():
                registration_number = tds[1].get_text(strip=True)
                break

    # Method 3: As a last resort, use regex to search the entire text
    if not registration_number:
        import re
        match = re.search(r'RA\d{10,}', soup.get_text())
        if match:
            registration_number = match.group(0)

    return registration_number

# ====== Helper: Get or Insert User and Return UUID ======
def get_user_uuid(registration_number, username):
    try:
        # Try to retrieve the user by registration_number
        response = supabase.table("users").select("id").eq("registration_number", registration_number).single().execute()
        if response.data:
            return response.data["id"]
    except Exception as e:
        print("No existing user found for registration number, inserting new user...")
    
    # Insert new user with a dummy password hash (since our table requires it)
    new_user = {
        "email": username,
        "registration_number": registration_number,
        "password_hash": generate_password_hash("dummy_password")  # Provide a dummy hash
    }
    insert_response = supabase.table("users").insert(new_user).execute()
    if insert_response.data:
        return insert_response.data[0]["id"]
    else:
        print(f"❌ Error inserting user: {insert_response.error}")
        return None

# ====== Function: Parse and Save Attendance Data to Supabase ======
def parse_and_save_attendance(html):
    soup = BeautifulSoup(html, "html.parser")
    registration_number = extract_registration_number(soup)
    if not registration_number:
        print("❌ Could not find Registration Number!")
        return
    print(f"📌 Extracted Registration Number: {registration_number}")

    # Get or create the user and retrieve UUID
    user_uuid = get_user_uuid(registration_number, username)
    if not user_uuid:
        print("❌ Could not retrieve or create user in Supabase.")
        return

    attendance = []
    tables = soup.find_all("table")
    attendance_table = None
    for table in tables:
        if "Course Code" in table.text:  # Identify the attendance table by header
            attendance_table = table
            break

    if not attendance_table:
        print("❌ No attendance table found!")
        return

    rows = attendance_table.find_all("tr")[1:]
    print(f"🔍 Found {len(rows)} rows in attendance table.")
    for row in rows:
        cols = row.find_all("td")
        # Skip header row repeated in the table
        if len(cols) >= 8 and "Course Code" not in cols[0].text.strip():
            try:
                record = {
                    "registration_number": registration_number,
                    "user_id": user_uuid,
                    "course_code": cols[0].text.strip(),
                    "course_title": cols[1].text.strip(),
                    "category": cols[2].text.strip(),
                    "faculty": cols[3].text.strip(),
                    "slot": cols[4].text.strip(),
                    "hours_conducted": int(cols[5].text.strip()) if cols[5].text.strip().isdigit() else 0,
                    "hours_absent": int(cols[6].text.strip()) if cols[6].text.strip().isdigit() else 0,
                    "attendance_percentage": float(cols[7].text.strip()) if cols[7].text.strip().replace('.', '', 1).isdigit() else 0.0
                }
                attendance.append(record)
            except Exception as ex:
                print(f"⚠️ Error parsing row {rows.index(row)}: {ex}")

    # We'll keep track of course codes present in this scrape for later deletion
    present_courses = []
    for record in attendance:
        present_courses.append(record["course_code"])

    # For each attendance record, do update if exists, else insert
    for record in attendance:
        select_resp = supabase.table("attendance").select("id") \
            .eq("registration_number", record["registration_number"]) \
            .eq("course_code", record["course_code"]) \
            .execute()

        if select_resp.data and len(select_resp.data) > 0:
            update_data = {
                "course_title": record["course_title"],
                "category": record["category"],
                "faculty": record["faculty"],
                "slot": record["slot"],
                "hours_conducted": record["hours_conducted"],
                "hours_absent": record["hours_absent"],
                "attendance_percentage": record["attendance_percentage"]
            }
            update_resp = supabase.table("attendance").update(update_data) \
                .eq("registration_number", record["registration_number"]) \
                .eq("course_code", record["course_code"]) \
                .execute()
            if update_resp.data:
                print(f"✅ Updated: {record}")
            else:
                print(f"❌ Failed to update: {record}, Error: {update_resp.error if hasattr(update_resp, 'error') else 'No error attribute'}")
        else:
            insert_resp = supabase.table("attendance").insert(record).execute()
            if insert_resp.data:
                print(f"✅ Inserted: {record}")
            else:
                print(f"❌ Failed to insert: {record}, Error: {insert_resp.error if hasattr(insert_resp, 'error') else 'No error attribute'}")

    # Build a string of course codes for deletion filter
    present_courses_str = "(" + ",".join([f"\"{course}\"" for course in present_courses]) + ")"

    delete_resp = supabase.table("attendance").delete() \
        .eq("registration_number", registration_number) \
        .filter("course_code", "not.in", present_courses_str) \
        .execute()

    if delete_resp.data:
        print(f"✅ Deleted old records not in current scrape: {delete_resp.data}")
    else:
        print("✅ No old records to delete.")

# ====== New Function: Run Scraper (for import) ======
def run_scraper(email, pwd):
    global username, password
    username = email
    password = pwd
    login()
    html = get_attendance_page()
    parse_and_save_attendance(html)
    driver.quit()
    print("🛑 ChromeDriver session closed.")

# ====== Main Execution Flow ======
if __name__ == "__main__":
    # For command-line testing, if not called from frontend
    email_input = input("Enter your email: ")
    pwd_input = input("Enter your password: ")
    run_scraper(email_input, pwd_input)






