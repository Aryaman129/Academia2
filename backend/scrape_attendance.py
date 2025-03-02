import time
import os
from dotenv import load_dotenv
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from bs4 import BeautifulSoup
from supabase import create_client, Client

# ✅ Load environment variables
load_dotenv()

# ✅ Supabase Configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ✅ Selenium Setup (Ensure the path is correct)
CHROMEDRIVER_PATH = r"C:\Users\Lenovo\Desktop\Academia2\Academia2\chromedriver-win64\chromedriver.exe"
chrome_options = Options()
chrome_options.add_argument("--headless")
chrome_options.add_argument("--disable-gpu")
chrome_options.add_argument("--no-sandbox")
chrome_options.add_argument("--window-size=1920,1080")
chrome_options.add_argument("--ignore-certificate-errors")

service = Service(CHROMEDRIVER_PATH)
driver = webdriver.Chrome(service=service, options=chrome_options)

# ✅ Function: Login to Academia
def login(username, password):
    driver.get("https://academia.srmist.edu.in")
    wait = WebDriverWait(driver, 30)

    try:
        wait.until(EC.frame_to_be_available_and_switch_to_it((By.ID, "signinFrame")))
        print("✅ Switched to iframe")
    except:
        print("❌ Could not find signin frame!")
        return False

    email_field = wait.until(EC.presence_of_element_located((By.ID, "login_id")))
    email_field.send_keys(username)
    wait.until(EC.element_to_be_clickable((By.ID, "nextbtn"))).click()

    time.sleep(2)
    password_field = wait.until(EC.presence_of_element_located((By.ID, "password")))
    password_field.send_keys(password)
    wait.until(EC.element_to_be_clickable((By.ID, "nextbtn"))).click()

    time.sleep(5)

    if "academia.srmist.edu.in" in driver.current_url:
        print("✅ Login successful")
        return True
    else:
        print("❌ Login failed, check credentials or CAPTCHA requirements")
        driver.quit()
        return False

# ✅ Function: Scrape Attendance
def scrape_attendance():
    driver.get("https://academia.srmist.edu.in/#Page:My_Attendance")
    print("⏳ Waiting for attendance page to load...")
    time.sleep(55)  # Ensure the page loads fully
    return driver.page_source

# ✅ Function: Parse & Store Attendance
def parse_and_store_attendance(html, user_id):
    soup = BeautifulSoup(html, "html.parser")
    attendance_table = soup.find("table")
    
    if not attendance_table:
        print("❌ No attendance table found!")
        return

    attendance_records = []
    rows = attendance_table.find_all("tr")[1:]  # Skip header row

    for row in rows:
        cols = row.find_all("td")
        if len(cols) >= 8:
            record = {
                "user_id": user_id,
                "course_code": cols[0].text.strip(),
                "course_title": cols[1].text.strip(),
                "hours_conducted": int(cols[5].text.strip()) if cols[5].text.strip().isdigit() else 0,
                "hours_absent": int(cols[6].text.strip()) if cols[6].text.strip().isdigit() else 0,
                "attendance_percentage": float(cols[7].text.strip()) if cols[7].text.strip().replace('.', '', 1).isdigit() else 0.0
            }
            attendance_records.append(record)

    if not attendance_records:
        print("❌ No valid attendance records found.")
        return

    # ✅ Insert or Update Records
    for record in attendance_records:
        supabase.table("attendance").upsert(record, on_conflict=["user_id", "course_code"]).execute()
    
    print("✅ Attendance data stored successfully.")

# ✅ Function to Run Scraper
def run_scraper(username, password, user_id):
    if login(username, password):
        html = scrape_attendance()
        parse_and_store_attendance(html, user_id)
        driver.quit()
        print("🛑 ChromeDriver session closed.")




