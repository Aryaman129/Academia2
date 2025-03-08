import time
import json
import os
import traceback
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from bs4 import BeautifulSoup
from supabase import create_client, Client
from werkzeug.security import generate_password_hash

# ====== Supabase Configuration ======
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
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

print("✅ (scrape_attendance) Module loaded. No global driver created.")
time.sleep(1)

# Global variables for credentials (will be overwritten in run_scraper)
username = ""
password = ""

def login(driver):
    driver.get(LOGIN_URL)
    wait = WebDriverWait(driver, 30)
    wait.until(EC.frame_to_be_available_and_switch_to_it((By.ID, "signinFrame")))
    print("✅ Switched to iframe")
    email_field = wait.until(EC.presence_of_element_located((By.ID, "login_id")))
    email_field.send_keys(username)
    print(f"✅ Entered email: {username}")
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
        return True
    else:
        print("❌ Login failed, check credentials or CAPTCHA requirements")
        driver.quit()
        return False

def get_attendance_page(driver):
    driver.get(ATTENDANCE_PAGE_URL)
    print("⏳ Waiting for attendance page to load...")
    time.sleep(55)
    html_source = driver.page_source
    with open("attendance_page.html", "w", encoding="utf-8") as f:
        f.write(html_source)
    print("✅ Saved attendance page HTML for inspection.")
    return html_source

def extract_registration_number(soup):
    registration_number = None
    label_td = soup.find("td", string=lambda text: text and "Registration Number" in text)
    if label_td:
        value_td = label_td.find_next("td")
        if value_td:
            strong_elem = value_td.find("strong") or value_td.find("b")
            if strong_elem:
                registration_number = strong_elem.get_text(strip=True)
            else:
                registration_number = value_td.get_text(strip=True)
    if not registration_number:
        for row in soup.find_all("tr"):
            tds = row.find_all("td")
            if len(tds) >= 2 and "Registration" in tds[0].get_text():
                registration_number = tds[1].get_text(strip=True)
                break
    if not registration_number:
        import re
        match = re.search(r'RA\d{10,}', soup.get_text())
        if match:
            registration_number = match.group(0)
    return registration_number

def get_user_id(registration_number, email):
    """
    1. Look up the user by email.
    2. If found, update their registration_number if empty.
    3. Return the user's id.
    """
    try:
        resp = supabase.table("users").select("id, registration_number").eq("email", email).single().execute()
        user = resp.data
        if user:
            # If user has no registration_number or it's different, update it.
            if not user["registration_number"] or user["registration_number"] != registration_number:
                supabase.table("users").update({"registration_number": registration_number}).eq("id", user["id"]).execute()
            return user["id"]
    except Exception as e:
        print(f"No existing user found or error looking up user: {e}")

    # If no user found or error, create a new user with a dummy password
    new_user = {
        "email": email,
        "registration_number": registration_number,
        "password_hash": generate_password_hash("dummy_password")
    }
    insert_resp = supabase.table("users").insert(new_user).execute()
    if insert_resp.data:
        return insert_resp.data[0]["id"]
    else:
        print(f"❌ Error inserting user: {insert_resp.error}")
        return None

def parse_and_save_attendance(html, driver):
    soup = BeautifulSoup(html, "html.parser")
    registration_number = extract_registration_number(soup)
    if not registration_number:
        print("❌ Could not find Registration Number!")
        return False
    print(f"📌 Extracted Registration Number: {registration_number}")

    # Get the user id by email; update the user record with the scraped registration number if needed.
    user_id = get_user_id(registration_number, username)
    if not user_id:
        print("❌ Could not retrieve or create user in Supabase.")
        return False

    # Find the attendance table in the page
    attendance_table = None
    for table in soup.find_all("table"):
        if "Course Code" in table.text:
            attendance_table = table
            break
    if not attendance_table:
        print("❌ No attendance table found!")
        return False

    rows = attendance_table.find_all("tr")[1:]
    print(f"🔍 Found {len(rows)} rows in attendance table.")
    attendance_records = []

    # Build attendance records for each row
    for row in rows:
        cols = row.find_all("td")
        if len(cols) >= 8 and "Course Code" not in cols[0].text.strip():
            try:
                record = {
                    "user_id": user_id,
                    "registration_number": registration_number,
                    "course_code": cols[0].text.strip(),
                    "course_title": cols[1].text.strip(),
                    "category": cols[2].text.strip(),
                    "faculty": cols[3].text.strip(),
                    "slot": cols[4].text.strip(),
                    "hours_conducted": int(cols[5].text.strip()) if cols[5].text.strip().isdigit() else 0,
                    "hours_absent": int(cols[6].text.strip()) if cols[6].text.strip().isdigit() else 0,
                    "attendance_percentage": float(cols[7].text.strip()) if cols[7].text.strip().replace('.', '', 1).isdigit() else 0.0
                }
                attendance_records.append(record)
            except Exception as ex:
                print(f"⚠️ Error parsing row: {ex}")

    # Deduplicate records based on (registration_number, course_code)
    unique_records = {}
    for rec in attendance_records:
        key = (rec["registration_number"], rec["course_code"])
        unique_records[key] = rec
    attendance_records = list(unique_records.values())
    print(f"✅ Parsed {len(attendance_records)} unique attendance records.")

    # For each record, update if it exists, else insert
    for rec in attendance_records:
        sel_resp = supabase.table("attendance").select("id") \
            .eq("user_id", rec["user_id"]) \
            .eq("course_code", rec["course_code"]) \
            .execute()
        if sel_resp.data and len(sel_resp.data) > 0:
            update_data = {
                "registration_number": rec["registration_number"],
                "course_title": rec["course_title"],
                "category": rec["category"],
                "faculty": rec["faculty"],
                "slot": rec["slot"],
                "hours_conducted": rec["hours_conducted"],
                "hours_absent": rec["hours_absent"],
                "attendance_percentage": rec["attendance_percentage"]
            }
            up_resp = supabase.table("attendance").update(update_data) \
                .eq("user_id", rec["user_id"]) \
                .eq("course_code", rec["course_code"]) \
                .execute()
            if up_resp.data:
                print(f"✅ Updated: {rec}")
            else:
                print(f"❌ Failed to update: {rec}")
        else:
            in_resp = supabase.table("attendance").insert(rec).execute()
            if in_resp.data:
                print(f"✅ Inserted: {rec}")
            else:
                print(f"❌ Failed to insert: {rec}")
                
    # Delete any attendance records for this user not in the current scrape
    present_courses = [r["course_code"] for r in attendance_records]
    present_courses_str = "(" + ",".join([f"\"{c}\"" for c in present_courses]) + ")"
    del_resp = supabase.table("attendance").delete() \
        .eq("user_id", user_id) \
        .filter("course_code", "not.in", present_courses_str) \
        .execute()
    if del_resp.data:
        print(f"✅ Deleted old records not in current scrape: {del_resp.data}")
    else:
        print("✅ No old records to delete.")

    return True


def run_scraper(email, pwd):
    global username, password
    username = email
    password = pwd
    print(f"run_scraper called with {username} / {password}")

    local_service = Service(driver_path)
    local_driver = webdriver.Chrome(service=local_service, options=chrome_options)
    print("✅ New ChromeDriver instance created for scraper thread.")

    try:
        if not login(local_driver):
            return False
        html = get_attendance_page(local_driver)
        success = parse_and_save_attendance(html, local_driver)
        return success
    except Exception as e:
        print(f"Scraper exception: {e}")
        return False
    finally:
        local_driver.quit()
        print("🛑 Local ChromeDriver instance closed.")

if __name__ == "__main__":
    email_input = input("Enter your email: ")
    pwd_input = input("Enter your password: ")
    outcome = run_scraper(email_input, pwd_input)
    print(f"Scraper outcome: {outcome}")








