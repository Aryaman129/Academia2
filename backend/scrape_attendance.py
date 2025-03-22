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
from dotenv import load_dotenv
from webdriver_manager.chrome import ChromeDriverManager
# import tensorflow.lite as tflite

#options = tflite.InterpreterOptions()
# options.experimental_enable_delegate_fallback = True  # Fallback if XNNPACK fails

# interpreter = tflite.Interpreter(model_path="your_model.tflite", options=options)
# interpreter.allocate_tensors()


# Load environment variables from .env file
load_dotenv()


# ====== Supabase Configuration ======
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ====== Selenium Setup ======
BASE_URL = "https://academia.srmist.edu.in"
LOGIN_URL = BASE_URL
ATTENDANCE_PAGE_URL = "https://academia.srmist.edu.in/#Page:My_Attendance"

def setup_driver():
    print("Setting up Chrome driver...")
    
    chrome_options = webdriver.ChromeOptions()
    chrome_options.add_argument("--headless")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--disable-gpu")
    
    # For Render's free tier, we need to use Selenium Wire approach
    chrome_options.add_argument("--disable-extensions")
    chrome_options.add_argument("--remote-debugging-port=9222")
    
    try:
        # Try direct approach first
        print("Attempting to initialize Chrome driver directly...")
        driver = webdriver.Chrome(options=chrome_options)
        print("✅ Chrome driver successfully initialized directly")
        return driver
    except Exception as e1:
        print(f"⚠️ Direct initialization failed: {e1}")
        
        try:
            # Try with webdriver-manager
            print("Attempting to initialize Chrome driver with webdriver-manager...")
            from selenium.webdriver.chrome.service import Service
            from webdriver_manager.chrome import ChromeDriverManager
            
            # Instead of using install(), which is causing the tuple error
            chrome_driver_path = ChromeDriverManager().driver_path
            if not chrome_driver_path:
                chrome_driver_path = ChromeDriverManager().install()
                
            service = Service(executable_path=chrome_driver_path)
            driver = webdriver.Chrome(service=service, options=chrome_options)
            print("✅ Chrome driver successfully initialized with webdriver-manager")
            return driver
        except Exception as e2:
            print(f"⚠️ Webdriver-manager initialization failed: {e2}")
            
            try:
                # Final attempt with undetected_chromedriver
                print("Attempting to initialize with undetected_chromedriver...")
                import undetected_chromedriver as uc
                driver = uc.Chrome(headless=True, options=chrome_options)
                print("✅ Chrome driver successfully initialized with undetected_chromedriver")
                return driver
            except Exception as e3:
                print(f"❌ All initialization methods failed: {e3}")
                print("Please make sure Chrome is installed on this system.")
                raise Exception("Failed to initialize Chrome driver after multiple attempts")

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

    # Get or create the user in Supabase
    user_id = get_user_id(registration_number, username)
    if not user_id:
        print("❌ Could not retrieve or create user in Supabase.")
        return False

    # Extract all attendance tables from the page
    attendance_tables = [table for table in soup.find_all("table") if "Course Code" in table.text]
    if not attendance_tables:
        print("❌ No attendance table found!")
        return False

    # Collect attendance records from all tables
    attendance_records = []
    for attendance_table in attendance_tables:
        rows = attendance_table.find_all("tr")[1:]  # skip header row
        for row in rows:
            cols = row.find_all("td")
            if len(cols) >= 8:
                try:
                    record = {
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

    # Optional: Deduplicate records if needed
    unique_records = {}
    for rec in attendance_records:
        key = (registration_number, rec["course_code"], rec["category"])
        if key not in unique_records:
            unique_records[key] = rec
    attendance_records = list(unique_records.values())
    print(f"✅ Parsed {len(attendance_records)} unique attendance records.")

    # Build the JSON object for all attendance data
    attendance_json = {
        "registration_number": registration_number,
        "last_updated": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        "records": attendance_records
    }

    # Upsert the JSON object in Supabase
    sel_resp = supabase.table("attendance").select("id").eq("user_id", user_id).execute()
    if sel_resp.data and len(sel_resp.data) > 0:
        up_resp = supabase.table("attendance").update({
            "attendance_data": attendance_json,
            "updated_at": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
        }).eq("user_id", user_id).execute()
        if up_resp.data:
            print("✅ Attendance JSON updated successfully.")
        else:
            print("❌ Failed to update attendance JSON.")
    else:
        in_resp = supabase.table("attendance").insert({
            "user_id": user_id,
            "attendance_data": attendance_json
        }).execute()
        if in_resp.data:
            print("✅ Attendance JSON inserted successfully.")
        else:
            print("❌ Failed to insert attendance JSON.")

    return True

def get_course_title(course_code, attendance_records):
    """
    Matches course codes to course titles using the attendance records of the logged-in user.
    Ignores case and the "Regular" suffix.
    Returns the course title if found; otherwise, falls back to the original course code.
    """
    if not attendance_records:
        print("⚠️ No attendance records found, using fallback course code.")
        return course_code
    
    for record in attendance_records:
        stored_code = record.get("course_code", "").strip()
        # Check for an exact match (ignoring case)
        if stored_code.lower() == course_code.lower():
            return record.get("course_title", course_code)
        # Check match when "Regular" is removed
        if stored_code.replace("Regular", "").strip().lower() == course_code.replace("Regular", "").strip().lower():
            return record.get("course_title", course_code)
    
    print(f"⚠️ No match found for {course_code}, using fallback course code.")
    return course_code

def parse_and_save_marks(html, driver):
    """
    Scrapes the marks details from the page and upserts the data into the Supabase 'marks' table.
    This function handles any number of courses dynamically and includes multiple defense mechanisms.
    """
    soup = BeautifulSoup(html, "html.parser")
    
    # Extract registration number
    registration_number = extract_registration_number(soup)
    if not registration_number:
        print("❌ Could not find Registration Number for marks!")
        return False
    print(f"📌 Extracted Registration Number (marks): {registration_number}")
    
    # Get or create the user in Supabase
    user_id = get_user_id(registration_number, username)
    if not user_id:
        print("❌ Could not retrieve or create user in Supabase for marks.")
        return False

    # Fetch attendance records for the CURRENT user only
    try:
        attendance_resp = supabase.table("attendance").select("attendance_data").eq("user_id", user_id).execute()
    except Exception as e:
        print(f"❌ Error fetching attendance records: {e}")
        attendance_resp = None
    attendance_records = []
    if attendance_resp and attendance_resp.data and len(attendance_resp.data) > 0:
        attendance_data = attendance_resp.data[0].get("attendance_data", {})
        attendance_records = attendance_data.get("records", [])
    print(f"📌 Loaded {len(attendance_records)} attendance records for user {user_id}")
    
    # Locate the marks table by searching for "Test Performance"
    marks_table = None
    for table in soup.find_all("table"):
        header = table.find("tr")
        if header and "Test Performance" in header.get_text():
            marks_table = table
            break
    if not marks_table:
        print("❌ No marks table found!")
        return False

    marks_records = []
    rows = marks_table.find_all("tr")
    if rows:
        for row in rows[1:]:  # Skip header row
            try:
                cells = row.find_all("td")
                if len(cells) < 3:
                    continue

                course_code = cells[0].get_text(strip=True)
                fallback_title = cells[1].get_text(strip=True)

                # Try to map course title using attendance records
                if attendance_records:
                    try:
                        course_title = get_course_title(course_code, attendance_records)
                    except Exception as e:
                        print(f"❌ Error mapping course code {course_code}: {e}")
                        course_title = fallback_title
                else:
                    course_title = fallback_title

                # The third cell contains a nested table with test details
                nested_table = cells[2].find("table")
                tests = []
                if nested_table:
                    test_cells = nested_table.find_all("td")
                    for tc in test_cells:
                        strong_elem = tc.find("strong")
                        if not strong_elem:
                            continue
                        test_info = strong_elem.get_text(strip=True)
                        parts = test_info.split("/")
                        test_code = parts[0].strip()
                        try:
                            max_marks = float(parts[1].strip()) if len(parts) == 2 else 0.0
                        except:
                            max_marks = 0.0
                        br = tc.find("br")
                        obtained_text = br.next_sibling.strip() if br and br.next_sibling else "0"
                        try:
                            obtained_marks = float(obtained_text) if obtained_text.replace(".", "").isdigit() else obtained_text
                        except:
                            obtained_marks = obtained_text
                        tests.append({
                            "test_code": test_code,
                            "max_marks": max_marks,
                            "obtained_marks": obtained_marks
                        })
                
                marks_records.append({
                    "course_name": course_title,
                    "tests": tests
                })
                print(f"🔍 Mapping: {course_code} → {course_title}")
            except Exception as row_err:
                print(f"⚠️ Error processing a row: {row_err}")
                continue

    print(f"✅ Parsed {len(marks_records)} unique marks records.")

    # Build JSON object for marks data
    marks_json = {
        "registration_number": registration_number,
        "last_updated": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        "records": marks_records
    }

    # Save data in Supabase using update/insert pattern with defense mechanisms
    try:
        sel_resp = supabase.table("marks").select("id").eq("user_id", user_id).execute()
    except Exception as e:
        print(f"❌ Error selecting marks record: {e}")
        sel_resp = None

    if sel_resp and sel_resp.data and len(sel_resp.data) > 0:
        try:
            up_resp = supabase.table("marks").update({
                "marks_data": marks_json,
                "updated_at": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
            }).eq("user_id", user_id).execute()
            if up_resp.data and len(up_resp.data) > 0:
                print("✅ Marks JSON updated successfully.")
            else:
                raise Exception("Update returned no data")
        except Exception as update_err:
            print("❌ Update failed; trying insert as fallback:", update_err)
            try:
                in_resp = supabase.table("marks").insert({
                    "user_id": user_id,
                    "marks_data": marks_json
                }).execute()
                if in_resp.data and len(in_resp.data) > 0:
                    print("✅ Marks JSON inserted successfully as fallback.")
                else:
                    raise Exception("Fallback insert failed")
            except Exception as insert_err:
                print("❌ Final failure in saving marks JSON:", insert_err)
                return False
    else:
        try:
            in_resp = supabase.table("marks").insert({
                "user_id": user_id,
                "marks_data": marks_json
            }).execute()
            if in_resp.data and len(in_resp.data) > 0:
                print("✅ Marks JSON inserted successfully.")
            else:
                raise Exception("Insert returned no data")
        except Exception as insert_err:
            print("❌ Initial insert failed:", insert_err)
            return False

    return True




def run_scraper(email, pwd):
    global username, password
    username = email
    password = pwd
    print(f"run_scraper called with {username} / {password}")

    local_driver = setup_driver()
    print("✅ New ChromeDriver instance created for scraper thread.")

    try:
        if not login(local_driver):
            return False
        html = get_attendance_page(local_driver)
        attendance_success = parse_and_save_attendance(html, local_driver)
        marks_success = parse_and_save_marks(html, local_driver)  # New marks scraping call
        return attendance_success and marks_success
    except Exception as e:
        print(f"Scraper exception: {e}")
        return False
    finally:
        local_driver.quit()
        print("🛑 Local ChromeDriver instance closed.")



if __name__ == "__main__":
    email_input = 'lb2523@srmist.edu.in'
    pwd_input = '@Madhav13'
    outcome = run_scraper(email_input, pwd_input)
    print(f"Scraper outcome: {outcome}")