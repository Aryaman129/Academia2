''' import time          
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
import traceback
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
        time.sleep(3)  # Add small delay between attempts
        
        try:
            # Try with webdriver-manager
            print("Attempting to initialize Chrome driver with webdriver-manager...")
            from selenium.webdriver.chrome.service import Service
            from webdriver_manager.chrome import ChromeDriverManager
            
            try:
                # Try getting the path or directly installing
                chrome_driver_path = ChromeDriverManager().install()
                service = Service(executable_path=chrome_driver_path)
                driver = webdriver.Chrome(service=service, options=chrome_options)
                print("✅ Chrome driver successfully initialized with webdriver-manager")
                return driver
            except Exception as e:
                print(f"⚠️ Failed to use install() method: {e}")
                # Fallback to manual location
                chrome_driver_path = "/opt/render/.local/share/webdriver/chromedriver"
                if os.path.exists(chrome_driver_path):
                    service = Service(executable_path=chrome_driver_path)
                    driver = webdriver.Chrome(service=service, options=chrome_options)
                    print("✅ Chrome driver successfully initialized with manual path")
                    return driver
                else:
                    raise Exception("ChromeDriver not found at expected path")
                
        except Exception as e2:
            print(f"⚠️ Webdriver-manager initialization failed: {e2}")
            time.sleep(1)  # Add small delay between attempts
            
            try:
                # Final attempt with undetected_chromedriver
                print("Attempting to initialize with undetected_chromedriver...")
                import undetected_chromedriver as uc
                
                # Set environment variables to debug undetected_chromedriver
                os.environ['UC_LOG_LEVEL'] = 'DEBUG'
                
                # Make more resilient
                for attempt in range(3):
                    try:
                        driver = uc.Chrome(headless=True, options=chrome_options)
                        print("✅ Chrome driver successfully initialized with undetected_chromedriver")
                        return driver
                    except Exception as retry_error:
                        print(f"⚠️ undetected_chromedriver attempt {attempt+1} failed: {retry_error}")
                        time.sleep(2)  # Wait a bit before retrying
                        
                # If we're here, all retry attempts failed
                raise Exception("All undetected_chromedriver attempts failed")
                
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
    
    try:
        # Switch to iframe with retry
        for attempt in range(3):
            try:
                wait.until(EC.frame_to_be_available_and_switch_to_it((By.ID, "signinFrame")))
                print("✅ Switched to iframe")
                break
            except Exception as e:
                print(f"⚠️ Attempt {attempt+1} to switch to iframe failed: {e}")
                if attempt == 2:  # Last attempt failed
                    raise
                time.sleep(2)
                
        # Enter email with retry
        for attempt in range(3):
            try:
                email_field = wait.until(EC.presence_of_element_located((By.ID, "login_id")))
                email_field.clear()  # Clear first
                time.sleep(0.5)
                email_field.send_keys(username)
                print(f"✅ Entered email: {username}")
                break
            except Exception as e:
                print(f"⚠️ Attempt {attempt+1} to enter email failed: {e}")
                if attempt == 2:  # Last attempt failed
                    raise
                time.sleep(2)

        # Click Next button with retry
        for attempt in range(3):
            try:
                next_button = wait.until(EC.element_to_be_clickable((By.ID, "nextbtn")))
                driver.execute_script("arguments[0].click();", next_button)  # JavaScript click
                print("✅ Clicked Next")
                break
            except Exception as e:
                print(f"⚠️ Attempt {attempt+1} to click Next failed: {e}")
                if attempt == 2:  # Last attempt failed
                    raise
                time.sleep(2)

        # ===== Critical Fix: Wait longer and switch iframe context if needed =====
        # Wait longer for the page transition to complete
        time.sleep(5)  # Increase from 2s to 5s
        
        # Check if we need to switch to iframe again
        try:
            # First check if we're already in the correct context
            password_field = driver.find_element(By.ID, "password")
        except:
            # If not, try to switch back to default and then to iframe again
            print("Switching iframe context for password field")
            driver.switch_to.default_content()
            wait.until(EC.frame_to_be_available_and_switch_to_it((By.ID, "signinFrame")))
        
        # Enter password with retry - now with better iframe handling
        for attempt in range(3):
            try:
                # Wait explicitly for password field to be visible and interactable
                password_field = wait.until(
                    EC.element_to_be_clickable((By.ID, "password"))
                )
                time.sleep(1)  # Small delay for stability
                password_field.clear()  # Clear first
                time.sleep(0.5)
                password_field.send_keys(password)
                print("✅ Entered password")
                break
            except Exception as e:
                print(f"⚠️ Attempt {attempt+1} to enter password failed: {e}")
                if attempt == 2:  # Last attempt failed
                    # Try one more approach - use JavaScript to set the value
                    try:
                        print("Trying JavaScript approach to enter password")
                        driver.execute_script(
                            'document.getElementById("password").value = arguments[0]', 
                            password
                        )
                        print("Entered password via JavaScript")
                    except Exception as js_error:
                        print(f"JavaScript password entry also failed: {js_error}")
                        raise
                time.sleep(3)  # Increased wait between attempts

        # Click Sign In button with retry
        for attempt in range(3):
            try:
                sign_in_button = wait.until(EC.element_to_be_clickable((By.ID, "nextbtn")))
                driver.execute_script("arguments[0].click();", sign_in_button)  # JavaScript click
                print("✅ Clicked Sign In")
                break
            except Exception as e:
                print(f"⚠️ Attempt {attempt+1} to click Sign In failed: {e}")
                if attempt == 2:  # Last attempt failed
                    raise
                time.sleep(2)

        time.sleep(5)
        
        # Switch back to default content
        driver.switch_to.default_content()
        
        if BASE_URL in driver.current_url:
            # Check for common dashboard elements
            try:
                WebDriverWait(driver, 5).until(
                    EC.presence_of_element_located((By.XPATH, "//a[contains(@href, 'My_Attendance')]"))
                )
                print("✅ Login verified with dashboard elements")
            except:
                print("⚠️ Login appears successful but dashboard elements not found")
            return True
        else:
            print("❌ Login failed, check credentials or CAPTCHA requirements")
            driver.quit()
            return False
    except Exception as e:
        print(f"❌ Login error: {e}")
        driver.quit()
        return False

def get_attendance_page(driver):
    driver.get(ATTENDANCE_PAGE_URL)
    print("⏳ Waiting for attendance page to load...")
    
    try:
        # Wait for a specific element that indicates the page has loaded
        WebDriverWait(driver, 60).until(
            EC.presence_of_element_located((By.XPATH, "//table[contains(., 'Course Code')]"))
        )
        print("✅ Attendance page loaded successfully.")
    except Exception as e:
        print(f"⚠️ Timed out waiting for attendance page: {e}")
        # Fallback to a shorter sleep if the element isn't found
        time.sleep(20)
    
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
                    # Check if this is a lab course by looking for "Lab" in the course code or title
                    course_code = cols[0].text.strip()
                    course_title = cols[1].text.strip()
                    is_lab = "Lab" in course_code or "Lab" in course_title or "LAB" in course_code
                    
                    # For lab courses, we need to handle potentially missing data
                    if is_lab:
                        print(f"🔬 Detected lab course: {course_code} - {course_title}")
                    
                    # Extract attendance data, handling potential issues with labs
                    try:
                        hours_conducted = int(cols[5].text.strip()) if cols[5].text.strip().isdigit() else 0
                    except:
                        print(f"⚠️ Error parsing hours conducted for {course_code}, defaulting to 0")
                        hours_conducted = 0
                        
                    try:
                        hours_absent = int(cols[6].text.strip()) if cols[6].text.strip().isdigit() else 0
                    except:
                        print(f"⚠️ Error parsing hours absent for {course_code}, defaulting to 0")
                        hours_absent = 0
                        
                    try:
                        attendance_percent_text = cols[7].text.strip()
                        attendance_percentage = float(attendance_percent_text) if attendance_percent_text.replace('.', '', 1).isdigit() else 0.0
                    except:
                        print(f"⚠️ Error parsing attendance percentage for {course_code}, calculating from hours")
                        # Calculate percentage if possible
                        if hours_conducted > 0:
                            attendance_percentage = ((hours_conducted - hours_absent) / hours_conducted) * 100
                        else:
                            attendance_percentage = 0.0
                    
                    record = {
                        "course_code": course_code,
                        "course_title": course_title,
                        "category": cols[2].text.strip(),
                        "faculty": cols[3].text.strip(),
                        "slot": cols[4].text.strip(),
                        "hours_conducted": hours_conducted,
                        "hours_absent": hours_absent,
                        "attendance_percentage": attendance_percentage,
                        "is_lab": is_lab
                    }
                    attendance_records.append(record)
                    print(f"✅ Parsed attendance for: {course_code}")
                except Exception as ex:
                    print(f"⚠️ Error parsing row: {ex}")
                    traceback.print_exc()

    # Special handling for semiconductor lab or any other problematic labs
    lab_courses = [rec for rec in attendance_records if rec["is_lab"]]
    print(f"📊 Found {len(lab_courses)} lab courses")
    
    # Check for semiconductor lab specifically - fix if needed
    semiconductor_labs = [rec for rec in attendance_records if "SEMICOND" in rec["course_code"].upper() or "SEMICOND" in rec["course_title"].upper()]
    if not semiconductor_labs:
        print("🔍 Checking for semiconductor lab through alternative methods...")
        # Try to find it in the page directly
        semiconductor_elements = soup.find_all(string=lambda text: "SEMICOND" in text.upper() if text else False)
        if semiconductor_elements:
            print(f"📌 Found semiconductor lab mentions: {len(semiconductor_elements)}")
            # Try to extract data around these elements
            
            # Add fallback record if needed
            for element in semiconductor_elements:
                parent_row = element.find_parent("tr")
                if parent_row:
                    cols = parent_row.find_all("td")
                    if len(cols) >= 4:
                        # Create partial record with available data
                        course_code = cols[0].text.strip() if len(cols) > 0 else "SEMICONDUCTOR LAB"
                        course_title = cols[1].text.strip() if len(cols) > 1 else "Semiconductor Devices Lab"
                        
                        # Check if we already have this course
                        if not any(rec["course_code"] == course_code for rec in attendance_records):
                            record = {
                                "course_code": course_code,
                                "course_title": course_title,
                                "category": cols[2].text.strip() if len(cols) > 2 else "PC",
                                "faculty": cols[3].text.strip() if len(cols) > 3 else "Unknown",
                                "slot": cols[4].text.strip() if len(cols) > 4 else "L3+L4",
                                "hours_conducted": 0,  # Default values
                                "hours_absent": 0,
                                "attendance_percentage": 0.0,
                                "is_lab": True,
                                "data_source": "fallback"  # Mark as fallback data
                            }
                            attendance_records.append(record)
                            print(f"✅ Added fallback semiconductor lab record")

    # Optional: Deduplicate records if needed
    unique_records = {}
    for rec in attendance_records:
        key = (registration_number, rec["course_code"])
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
    try:
        sel_resp = supabase.table("attendance").select("id").eq("user_id", user_id).execute(timeout=10)
    except Exception as e:
        print(f"Database operation timed out or failed: {e}")
        sel_resp = None

    if sel_resp and sel_resp.data and len(sel_resp.data) > 0:
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
    email_input = input("Enter your email: ")
    pwd_input = input("Enter your password: ")
    outcome = run_scraper(email_input, pwd_input)
    print(f"Scraper outcome: {outcome}")'''