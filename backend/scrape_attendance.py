import time
import os
import json
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
ATTENDANCE_PAGE_URL = f"{BASE_URL}/#Page:My_Attendance"
driver_path = r"C:\Users\Lenovo\Desktop\Academia2\Academia2\chromedriver-win64\chromedriver.exe"

chrome_options = Options()
chrome_options.add_argument("--headless")
chrome_options.add_argument("--disable-gpu")
chrome_options.add_argument("--no-sandbox")

service = Service(driver_path)
driver = webdriver.Chrome(service=service, options=chrome_options)

# ====== Function: Login ======
def login(username, password):
    driver.get(BASE_URL)
    wait = WebDriverWait(driver, 30)
    wait.until(EC.frame_to_be_available_and_switch_to_it((By.ID, "signinFrame")))
    
    email_field = wait.until(EC.presence_of_element_located((By.ID, "login_id")))
    email_field.send_keys(username)
    wait.until(EC.element_to_be_clickable((By.ID, "nextbtn"))).click()
    
    time.sleep(2)
    password_field = wait.until(EC.element_to_be_clickable((By.ID, "password")))
    password_field.send_keys(password)
    wait.until(EC.element_to_be_clickable((By.ID, "nextbtn"))).click()
    
    time.sleep(5)
    if BASE_URL in driver.current_url:
        print("✅ Login successful")
        return True
    else:
        print("❌ Login failed, check credentials or CAPTCHA requirements")
        driver.quit()
        return False

# ====== Function: Retrieve Attendance Page ======
def get_attendance_page():
    driver.get(ATTENDANCE_PAGE_URL)
    print("⏳ Waiting for attendance page to load...")
    time.sleep(55)
    return driver.page_source

# ====== Helper: Get User UUID from Registration Number ======
def get_user_uuid(registration_number, email):
    try:
        response = supabase.table("users").select("id").eq("registration_number", registration_number).maybe_single().execute()
        if response.data:
            return response.data["id"]
    except Exception:
        pass

    # Insert new user if not found
    new_user = {
        "email": email,
        "registration_number": registration_number,
        "password_hash": generate_password_hash("dummy_password")
    }
    insert_response = supabase.table("users").insert(new_user).execute()
    return insert_response.data[0]["id"] if insert_response.data else None

# ====== Function: Parse & Store Attendance Data ======
def parse_and_save_attendance(html, email):
    soup = BeautifulSoup(html, "html.parser")
    
    reg_elem = soup.find(string=lambda x: x and "Registration Number" in x)
    if reg_elem:
        registration_number = reg_elem.find_next(string=True).strip()
    else:
        print("❌ Could not find Registration Number!")
        return

    user_uuid = get_user_uuid(registration_number, email)
    if not user_uuid:
        print("❌ Could not retrieve user UUID.")
        return

    attendance = []
    attendance_table = next((table for table in soup.find_all("table") if "Course Code" in table.text), None)

    if attendance_table:
        rows = attendance_table.find_all("tr")[1:]
        for row in rows:
            cols = row.find_all("td")
            if len(cols) >= 8 and "Course Code" not in cols[0].text.strip():
                try:
                    record = {
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
                    print(f"⚠️ Error parsing row: {ex}")

    if not attendance:
        print("❌ No valid attendance records found.")
        return

    for record in attendance:
        response = supabase.table("attendance").insert(record).execute()
        if response.data:
            print(f"✅ Inserted into Supabase: {record}")
        else:
            print(f"❌ Failed to insert: {record}")

# ====== Main Execution ======
email = input("Enter your email: ")
password = input("Enter your password: ")

if login(email, password):
    html = get_attendance_page()
    parse_and_save_attendance(html, email)
    driver.quit()
    print("✅ Process completed.")