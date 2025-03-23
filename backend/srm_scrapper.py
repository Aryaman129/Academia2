import time
import json
import os
import re
import logging
import traceback
import sys
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

# Load environment variables from .env file
load_dotenv()

# ====== Logging Setup ======
# Set up logging BEFORE calling any functions that use it
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Environment variable logging for Render debugging
def log_environment():
    """Log environment variables to help debug Render deployment"""
    logger.info("=== Environment Variables ===")
    logger.info(f"Python version: {sys.version}")
    logger.info(f"Current directory: {os.getcwd()}")
    for key in ["PORT", "PYTHONUNBUFFERED", "PATH", "RENDER", "RENDER_SERVICE_ID"]:
        if key in os.environ:
            logger.info(f"{key}: {os.environ[key]}")
    logger.info("===========================")

# Call environment logging AFTER logger is defined
log_environment()

# ====== Supabase Configuration ======
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ====== URLs and Constants ======
BASE_URL = "https://academia.srmist.edu.in"
LOGIN_URL = BASE_URL
ATTENDANCE_PAGE_URL = BASE_URL + "/#Page:My_Attendance"
TIMETABLE_URL = BASE_URL + "/#Page:My_Time_Table_2023_24"

# Time slots mapping (for display only)
slot_times = {
    "1": "08:00-08:50",
    "2": "08:50-09:40",
    "3": "09:45-10:35",
    "4": "10:40-11:30",
    "5": "11:35-12:25",
    "6": "12:30-01:20",
    "7": "01:25-02:15",
    "8": "02:20-03:10",
    "9": "03:10-04:00",
    "10": "04:00-04:50",
    "11": "04:50-05:30",
    "12": "05:30-06:10"
}

# Hard-coded official timetables for two batches
batch_1_timetable = {
    "Day 1": {
        slot_times["1"]: "A", slot_times["2"]: "A/X", slot_times["3"]: "F/X", slot_times["4"]: "F",
        slot_times["5"]: "G", slot_times["6"]: "P6-", slot_times["7"]: "P7-", slot_times["8"]: "P8-",
        slot_times["9"]: "P9-", slot_times["10"]: "P10-", slot_times["11"]: "L11", slot_times["12"]: "L11"
    },
    "Day 2": {
        slot_times["1"]: "P11-", slot_times["2"]: "P12-/X", slot_times["3"]: "P13-/X", slot_times["4"]: "P14-",
        slot_times["5"]: "P15-", slot_times["6"]: "B", slot_times["7"]: "B", slot_times["8"]: "G",
        slot_times["9"]: "G", slot_times["10"]: "A", slot_times["11"]: "L21", slot_times["12"]: "L22"
    },
    "Day 3": {
        slot_times["1"]: "C", slot_times["2"]: "C/X", slot_times["3"]: "A/X", slot_times["4"]: "D",
        slot_times["5"]: "B", slot_times["6"]: "P26-", slot_times["7"]: "P27-", slot_times["8"]: "P28-",
        slot_times["9"]: "P29-", slot_times["10"]: "P30-", slot_times["11"]: "L31", slot_times["12"]: "L32"
    },
    "Day 4": {
        slot_times["1"]: "P31-", slot_times["2"]: "P32-/X", slot_times["3"]: "P33-/X", slot_times["4"]: "P34-",
        slot_times["5"]: "P35-", slot_times["6"]: "D", slot_times["7"]: "D", slot_times["8"]: "B",
        slot_times["9"]: "E", slot_times["10"]: "C", slot_times["11"]: "L41", slot_times["12"]: "L42"
    },
    "Day 5": {
        slot_times["1"]: "E", slot_times["2"]: "E/X", slot_times["3"]: "C/X", slot_times["4"]: "F",
        slot_times["5"]: "D", slot_times["6"]: "P46-", slot_times["7"]: "P47-", slot_times["8"]: "P48-",
        slot_times["9"]: "P49-", slot_times["10"]: "P50-", slot_times["11"]: "L51", slot_times["12"]: "L52"
    }
}

batch_2_timetable = {
    "Day 1": {
        slot_times["1"]: "P1-", slot_times["2"]: "P2-/X", slot_times["3"]: "P3-/X", slot_times["4"]: "P4-",
        slot_times["5"]: "P5-", slot_times["6"]: "A", slot_times["7"]: "A", slot_times["8"]: "F",
        slot_times["9"]: "F", slot_times["10"]: "G", slot_times["11"]: "L11", slot_times["12"]: "L12"
    },
    "Day 2": {
        slot_times["1"]: "B", slot_times["2"]: "B/X", slot_times["3"]: "G/X", slot_times["4"]: "G",
        slot_times["5"]: "A", slot_times["6"]: "P16-", slot_times["7"]: "P17-", slot_times["8"]: "P18-",
        slot_times["9"]: "P19-", slot_times["10"]: "P20-", slot_times["11"]: "L21", slot_times["12"]: "L22"
    },
    "Day 3": {
        slot_times["1"]: "P21-", slot_times["2"]: "P22-/X", slot_times["3"]: "P23-/X", slot_times["4"]: "P24-",
        slot_times["5"]: "P25-", slot_times["6"]: "C", slot_times["7"]: "C", slot_times["8"]: "A",
        slot_times["9"]: "D", slot_times["10"]: "B", slot_times["11"]: "L31", slot_times["12"]: "L32"
    },
    "Day 4": {
        slot_times["1"]: "D", slot_times["2"]: "D/X", slot_times["3"]: "B/X", slot_times["4"]: "E",
        slot_times["5"]: "C", slot_times["6"]: "P36-", slot_times["7"]: "P37-", slot_times["8"]: "P38-",
        slot_times["9"]: "P39-", slot_times["10"]: "P40-", slot_times["11"]: "L41", slot_times["12"]: "L42"
    },
    "Day 5": {
        slot_times["1"]: "P41-", slot_times["2"]: "P42-/X", slot_times["3"]: "P43-/X", slot_times["4"]: "P44-",
        slot_times["5"]: "P45-", slot_times["6"]: "E", slot_times["7"]: "E", slot_times["8"]: "C",
        slot_times["9"]: "F", slot_times["10"]: "D", slot_times["11"]: "L51", slot_times["12"]: "L52"
    }
}

class SRMScraper:
    """
    Unified scraper for SRM Academia portal data.
    Handles both timetable and attendance scraping with a single browser session.
    """
    def __init__(self, email, password):
        self.driver = None
        self.is_logged_in = False
        self.email = email
        self.password = password
        
    def setup_driver(self):
        """Initialize Chrome driver with appropriate options for Render deployment"""
        logger.info("Setting up Chrome driver...")
        
        chrome_options = Options()
        # Essential flags for Render's free tier
        chrome_options.add_argument('--headless')
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        chrome_options.add_argument('--disable-gpu')
        
        # Memory optimization flags (critical for Render free tier)
        chrome_options.add_argument('--disable-renderer-backgrounding')
        chrome_options.add_argument('--disable-background-timer-throttling')
        chrome_options.add_argument('--disable-backgrounding-occluded-windows')
        chrome_options.add_argument('--disable-client-side-phishing-detection')
        chrome_options.add_argument('--memory-pressure-off')
        chrome_options.add_argument('--single-process')  # Important for limiting memory usage
        chrome_options.add_argument('--remote-debugging-port=9222')  # Enable debugging
        
        # Basic optimization flags
        chrome_options.add_argument('--window-size=1920,1080')
        chrome_options.add_argument('--disable-extensions')
        chrome_options.add_argument('--disable-infobars')
        chrome_options.add_argument('--disable-notifications')
        chrome_options.add_argument('--disable-popup-blocking')
        chrome_options.add_argument('--start-maximized')
        chrome_options.add_argument('--disable-blink-features=AutomationControlled')
        chrome_options.add_experimental_option('excludeSwitches', ['enable-automation'])
        chrome_options.add_experimental_option('useAutomationExtension', False)
        
        try:
            # Try direct approach first
            logger.info("Attempting to initialize Chrome driver directly...")
            self.driver = webdriver.Chrome(options=chrome_options)
            logger.info("✅ Chrome driver successfully initialized directly")
            return self.driver
        except Exception as e1:
            logger.warning(f"⚠️ Direct initialization failed: {e1}")
            time.sleep(2)  # Small delay between attempts
            
            try:
                # Try with webdriver-manager
                logger.info("Attempting to initialize Chrome driver with webdriver-manager...")
                from selenium.webdriver.chrome.service import Service
                from webdriver_manager.chrome import ChromeDriverManager
                
                try:
                    # Try getting the path or directly installing
                    chrome_driver_path = ChromeDriverManager().install()
                    service = Service(executable_path=chrome_driver_path)
                    self.driver = webdriver.Chrome(service=service, options=chrome_options)
                    logger.info("✅ Chrome driver successfully initialized with webdriver-manager")
                    return self.driver
                except Exception as e:
                    logger.warning(f"⚠️ Failed to use install() method: {e}")
                    # Fallback to manual location
                    chrome_driver_path = "/opt/render/.local/share/webdriver/chromedriver"
                    if os.path.exists(chrome_driver_path):
                        service = Service(executable_path=chrome_driver_path)
                        self.driver = webdriver.Chrome(service=service, options=chrome_options)
                        logger.info("✅ Chrome driver successfully initialized with manual path")
                        return self.driver
                    else:
                        raise Exception("ChromeDriver not found at expected path")
                
            except Exception as e2:
                logger.warning(f"⚠️ Webdriver-manager initialization failed: {e2}")
                time.sleep(1)  # Small delay between attempts
                
                try:
                    # Final attempt with undetected_chromedriver
                    logger.info("Attempting to initialize with undetected_chromedriver...")
                    import undetected_chromedriver as uc
                    
                    # Set environment variables to debug undetected_chromedriver
                    os.environ['UC_LOG_LEVEL'] = 'DEBUG'
                    
                    # Make more resilient
                    for attempt in range(3):
                        try:
                            self.driver = uc.Chrome(headless=True, options=chrome_options)
                            logger.info("✅ Chrome driver successfully initialized with undetected_chromedriver")
                            return self.driver
                        except Exception as retry_error:
                            logger.warning(f"⚠️ undetected_chromedriver attempt {attempt+1} failed: {retry_error}")
                            time.sleep(2)  # Wait a bit before retrying
                        
                    # If we're here, all retry attempts failed
                    raise Exception("All undetected_chromedriver attempts failed")
                    
                except Exception as e3:
                    logger.error(f"❌ All initialization methods failed: {e3}")
                    logger.error("Please make sure Chrome is installed on this system.")
                    raise Exception("Failed to initialize Chrome driver after multiple attempts")

    def ensure_login(self):
        """Login if not already logged in, or reuse existing session"""
        # If already logged in, return True
        if self.is_logged_in:
            return True
            
        # Initialize driver if needed
        if not self.driver:
            self.setup_driver()
            
        # Perform login
        return self.login()
    
    def login(self):
        """Log in to SRM Academia portal with enhanced retry logic for Render"""
        try:
            self.driver.get(LOGIN_URL)
            wait = WebDriverWait(self.driver, 30)
            
            # Switch to iframe with retry
            for attempt in range(3):
                try:
                    wait.until(EC.frame_to_be_available_and_switch_to_it((By.ID, "signinFrame")))
                    logger.info("Switched to login iframe")
                    break
                except Exception as e:
                    logger.warning(f"⚠️ Attempt {attempt+1} to switch to iframe failed: {e}")
                    if attempt == 2:  # Last attempt failed
                        raise
                    time.sleep(2)
                
            # Enter email with retry
            for attempt in range(3):
                try:
                    email_field = wait.until(EC.presence_of_element_located((By.ID, "login_id")))
                    email_field.clear()  # Clear first
                    time.sleep(0.5)
                    email_field.send_keys(self.email)
                    logger.info(f"Entered email: {self.email}")
                    break
                except Exception as e:
                    logger.warning(f"⚠️ Attempt {attempt+1} to enter email failed: {e}")
                    if attempt == 2:  # Last attempt failed
                        raise
                    time.sleep(2)

            # Click Next button with retry
            for attempt in range(3):
                try:
                    next_btn = wait.until(EC.element_to_be_clickable((By.ID, "nextbtn")))
                    self.driver.execute_script("arguments[0].click();", next_btn)  # JavaScript click
                    logger.info("Clicked Next")
                    break
                except Exception as e:
                    logger.warning(f"⚠️ Attempt {attempt+1} to click Next failed: {e}")
                    if attempt == 2:  # Last attempt failed
                        raise
                    time.sleep(2)

            # ===== Critical Fix: Wait longer and switch iframe context if needed =====
            # Wait longer for the page transition to complete
            time.sleep(5)  # Increase from 2s to 5s
            
            # Check if we need to switch to iframe again
            try:
                # First check if we're already in the correct context
                password_field = self.driver.find_element(By.ID, "password")
            except:
                # If not, try to switch back to default and then to iframe again
                logger.info("Switching iframe context for password field")
                self.driver.switch_to.default_content()
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
                    password_field.send_keys(self.password)
                    logger.info("Entered password")
                    break
                except Exception as e:
                    logger.warning(f"⚠️ Attempt {attempt+1} to enter password failed: {e}")
                    if attempt == 2:  # Last attempt failed
                        # Try one more approach - use JavaScript to set the value
                        try:
                            logger.info("Trying JavaScript approach to enter password")
                            self.driver.execute_script(
                                'document.getElementById("password").value = arguments[0]', 
                                self.password
                            )
                            logger.info("Entered password via JavaScript")
                        except Exception as js_error:
                            logger.error(f"JavaScript password entry also failed: {js_error}")
                            raise
                    time.sleep(3)  # Increased wait between attempts

            # Click Sign In button with retry
            for attempt in range(3):
                try:
                    sign_in_btn = wait.until(EC.element_to_be_clickable((By.ID, "nextbtn")))
                    self.driver.execute_script("arguments[0].click();", sign_in_btn)  # JavaScript click
                    logger.info("Clicked Sign In")
                    break
                except Exception as e:
                    logger.warning(f"⚠️ Attempt {attempt+1} to click Sign In failed: {e}")
                    if attempt == 2:  # Last attempt failed
                        raise
                    time.sleep(2)

            time.sleep(5)
            
            # Switch back to default content
            self.driver.switch_to.default_content()
            
            # Verify login success
            if BASE_URL in self.driver.current_url:
                # Check for common dashboard elements
                try:
                    WebDriverWait(self.driver, 5).until(
                        EC.presence_of_element_located((By.XPATH, "//a[contains(@href, 'My_Attendance')]"))
                    )
                    logger.info("✅ Login verified with dashboard elements")
                except:
                    logger.warning("⚠️ Login appears successful but dashboard elements not found")
                
                self.is_logged_in = True
                return True
            else:
                logger.error("Login failed, check credentials or CAPTCHA")
                return False
                
        except Exception as e:
            logger.error(f"Error during login: {e}")
            return False

    def get_attendance_page(self):
        """Navigate to attendance page and get HTML"""
        if not self.ensure_login():
            return None
            
        logger.info("Navigating to attendance page")
        self.driver.get(ATTENDANCE_PAGE_URL)
        
        try:
            time.sleep(25)
            logger.info("Attendance page loaded successfully")
        except Exception as e:
            logger.warning(f"Timed out waiting for attendance page: {e}")
            # Fallback to a longer sleep if the element isn't found
            logger.info("Using fixed sleep time of 55 seconds")
        
        html_source = self.driver.page_source
        return html_source

    def extract_registration_number(self, soup):
        """Extract registration number from page HTML"""
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

    def get_user_id(self, registration_number):
        """Get or create user ID in Supabase"""
        try:
            resp = supabase.table("users").select("id, registration_number").eq("email", self.email).single().execute()
            user = resp.data
            if user:
                # If user has no registration_number or it's different, update it.
                if not user["registration_number"] or user["registration_number"] != registration_number:
                    supabase.table("users").update({"registration_number": registration_number}).eq("id", user["id"]).execute()
                return user["id"]
        except Exception as e:
            logger.error(f"No existing user found or error looking up user: {e}")

        # If no user found or error, create a new user with a dummy password
        new_user = {
            "email": self.email,
            "registration_number": registration_number,
            "password_hash": generate_password_hash("dummy_password")
        }
        insert_resp = supabase.table("users").insert(new_user).execute()
        if insert_resp.data:
            return insert_resp.data[0]["id"]
        else:
            logger.error(f"Error inserting user: {insert_resp.error}")
            return None

    def parse_and_save_attendance(self, html, driver):
        """Parse attendance data and save to Supabase"""
        soup = BeautifulSoup(html, "html.parser")
        registration_number = self.extract_registration_number(soup)
        if not registration_number:
            logger.error("Could not find Registration Number!")
            return False
        logger.info(f"Extracted Registration Number: {registration_number}")

        # Get or create the user in Supabase
        user_id = self.get_user_id(registration_number)
        if not user_id:
            logger.error("Could not retrieve or create user in Supabase.")
            return False

        # Extract all attendance tables from the page
        attendance_tables = [table for table in soup.find_all("table") if "Course Code" in table.text]
        if not attendance_tables:
            logger.error("No attendance table found!")
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
                        logger.warning(f"Error parsing row: {ex}")

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
            logger.error(f"Database operation timed out or failed: {e}")
            sel_resp = None

        if sel_resp and sel_resp.data and len(sel_resp.data) > 0:
            up_resp = supabase.table("attendance").update({
                "attendance_data": attendance_json,
                "updated_at": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
            }).eq("user_id", user_id).execute()
            if up_resp.data:
                logger.info("Attendance JSON updated successfully.")
            else:
                logger.error("Failed to update attendance JSON.")
        else:
            in_resp = supabase.table("attendance").insert({
                "user_id": user_id,
                "attendance_data": attendance_json
            }).execute()
            if in_resp.data:
                logger.info("Attendance JSON inserted successfully.")
            else:
                logger.error("Failed to insert attendance JSON.")

        return True

    def get_course_title(self, course_code, attendance_records):
        """
        Matches course codes to course titles using the attendance records of the logged-in user.
        Ignores case and the "Regular" suffix.
        Returns the course title if found; otherwise, falls back to the original course code.
        """
        if not attendance_records:
            logger.warning("No attendance records found, using fallback course code.")
            return course_code
        
        for record in attendance_records:
            stored_code = record.get("course_code", "").strip()
            # Check for an exact match (ignoring case)
            if stored_code.lower() == course_code.lower():
                return record.get("course_title", course_code)
            # Check match when "Regular" is removed
            if stored_code.replace("Regular", "").strip().lower() == course_code.replace("Regular", "").strip().lower():
                return record.get("course_title", course_code)
        
        logger.warning(f"No match found for {course_code}, using fallback course code.")
        return course_code

    def parse_and_save_marks(self, html, driver):
        """
        Scrapes the marks details from the page and upserts the data into the Supabase 'marks' table.
        This function handles any number of courses dynamically and includes multiple defense mechanisms.
        """
        soup = BeautifulSoup(html, "html.parser")
        
        # Extract registration number
        registration_number = self.extract_registration_number(soup)
        if not registration_number:
            logger.error("Could not find Registration Number for marks!")
            return False
        logger.info(f"Extracted Registration Number (marks): {registration_number}")
        
        # Get or create the user in Supabase
        user_id = self.get_user_id(registration_number)
        if not user_id:
            logger.error("Could not retrieve or create user in Supabase for marks.")
            return False

        # Fetch attendance records for the CURRENT user only
        try:
            attendance_resp = supabase.table("attendance").select("attendance_data").eq("user_id", user_id).execute()
        except Exception as e:
            logger.error(f"Error fetching attendance records: {e}")
            attendance_resp = None
        attendance_records = []
        if attendance_resp and attendance_resp.data and len(attendance_resp.data) > 0:
            attendance_data = attendance_resp.data[0].get("attendance_data", {})
            attendance_records = attendance_data.get("records", [])
        logger.info(f"Loaded {len(attendance_records)} attendance records for user {user_id}")
        
        # Locate the marks table by searching for "Test Performance"
        marks_table = None
        for table in soup.find_all("table"):
            header = table.find("tr")
            if header and "Test Performance" in header.get_text():
                marks_table = table
                break
        if not marks_table:
            logger.error("No marks table found!")
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
                            course_title = self.get_course_title(course_code, attendance_records)
                        except Exception as e:
                            logger.error(f"Error mapping course code {course_code}: {e}")
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
                    logger.info(f"Mapping: {course_code} → {course_title}")
                except Exception as row_err:
                    logger.warning(f"Error processing a row: {row_err}")
                    continue

        logger.info(f"Parsed {len(marks_records)} unique marks records.")

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
            logger.error(f"Error selecting marks record: {e}")
            sel_resp = None

        if sel_resp and sel_resp.data and len(sel_resp.data) > 0:
            try:
                up_resp = supabase.table("marks").update({
                    "marks_data": marks_json,
                    "updated_at": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
                }).eq("user_id", user_id).execute()
                if up_resp.data and len(up_resp.data) > 0:
                    logger.info("Marks JSON updated successfully.")
                else:
                    raise Exception("Update returned no data")
            except Exception as update_err:
                logger.error(f"Update failed; trying insert as fallback: {update_err}")
                try:
                    in_resp = supabase.table("marks").insert({
                        "user_id": user_id,
                        "marks_data": marks_json
                    }).execute()
                    if in_resp.data and len(in_resp.data) > 0:
                        logger.info("Marks JSON inserted successfully as fallback.")
                    else:
                        raise Exception("Fallback insert failed")
                except Exception as insert_err:
                    logger.error(f"Final failure in saving marks JSON: {insert_err}")
                    return False
        else:
            try:
                in_resp = supabase.table("marks").insert({
                    "user_id": user_id,
                    "marks_data": marks_json
                }).execute()
                if in_resp.data and len(in_resp.data) > 0:
                    logger.info("Marks JSON inserted successfully.")
                else:
                    raise Exception("Insert returned no data")
            except Exception as insert_err:
                logger.error(f"Initial insert failed: {insert_err}")
                return False

        return True

    # TIMETABLE SCRAPER METHODS

    def get_timetable_page(self):
        """Navigate to timetable page and get HTML"""
        if not self.ensure_login():
            return None
        
        logger.info(f"Navigating to timetable page: {TIMETABLE_URL}")
        self.driver.get(TIMETABLE_URL)
        time.sleep(25)  # Wait for the page to load
        
        html_source = self.driver.page_source
        return html_source

    def dump_page_source(self, filename="debug_page_source.html", num_chars=1000):
        """
        Writes the first 'num_chars' characters of the page source to a file.
        If you need the full source, set num_chars to None.
        """
        source = self.driver.page_source if num_chars is None else self.driver.page_source[:num_chars]
        with open(filename, "w", encoding="utf-8") as f:
            f.write(source)
        logger.info(f"Page source snippet dumped to {filename}")

    def parse_batch_number_from_page(self):
        """
        Extract batch number from either timetable or attendance page HTML.
        Returns the batch number as a string or None if not found.
        """
        try:
            WebDriverWait(self.driver, 50).until(
                EC.presence_of_element_located((By.XPATH, "//*[contains(text(),'Batch')]"))
            )
        except Exception as e:
            logger.warning(f"Timeout waiting for batch element: {e}")
            # We'll try to parse from the current page source anyway

        soup = BeautifulSoup(self.driver.page_source, "html.parser")
        
        # Method 1: Look for a table cell with "Batch:" label
        batch_label = soup.find("td", string=lambda text: text and "Batch:" in text)
        if batch_label:
            next_cell = batch_label.find_next("td")
            if next_cell:
                batch_text = next_cell.get_text(strip=True)
                if batch_text and batch_text.isdigit():
                    return batch_text
        
        # Method 2: Look for a table row with batch information
        batch_td = soup.find("td", string=lambda text: text and "Batch" in text and ":" not in text)
        if batch_td:
            # The batch number might be in the next cell
            next_td = batch_td.find_next("td")
            if next_td:
                batch_text = next_td.get_text(strip=True)
                if batch_text and batch_text.isdigit():
                    return batch_text
        
        # Method 3: Look for a specific pattern in the HTML
        batch_rows = soup.find_all("tr")
        for row in batch_rows:
            cells = row.find_all("td")
            for i, cell in enumerate(cells):
                if "Batch" in cell.get_text() and i+1 < len(cells):
                    batch_text = cells[i+1].get_text(strip=True)
                    if batch_text and batch_text.isdigit():
                        return batch_text
        
        # Method 4: Use regex to find batch number pattern in the HTML
        batch_pattern = re.compile(r'Batch:?\s*</td>\s*<td[^>]*>\s*(\d+)\s*</td>', re.IGNORECASE)
        match = batch_pattern.search(str(soup))
        if match:
            return match.group(1)
        
        # Method 5: Look for strong tag with batch number
        batch_strong = soup.find("strong", string=lambda text: text and text.isdigit() and len(text.strip()) == 1)
        if batch_strong:
            return batch_strong.get_text(strip=True)
        
        return None

    def scrape_timetable(self):
        """
        Scrapes the timetable table from the page.
        """
        html_source = self.get_timetable_page()
        if not html_source:
            return []
            
        max_retries = 3
        extracted_rows = []
        
        for attempt in range(max_retries):
            logger.info(f"Attempt {attempt+1}: Extracting timetable table...")
            soup = BeautifulSoup(self.driver.page_source, "html.parser")
            
            # Attempt to find the timetable
            table = soup.find("table", class_="course_tbl")
            if not table:
                # Some pages have a different class or structure
                for t in soup.find_all("table"):
                    if "Course Code" in t.get_text():
                        table = t
                        break

            if table:
                try:
                    rows = table.find_all("tr")
                    if len(rows) < 2:
                        continue
                    header_cells = rows[0].find_all(["th", "td"])
                    headers = [cell.get_text(strip=True) for cell in header_cells]

                    def col_index(name):
                        for i, h in enumerate(headers):
                            if name in h:
                                return i
                        return -1

                    idx_code = col_index("Course Code")
                    idx_title = col_index("Course Title")
                    idx_slot = col_index("Slot")
                    idx_gcr = col_index("GCR Code")
                    idx_faculty = col_index("Faculty")
                    idx_ctype = col_index("Course Type")
                    idx_room = col_index("Room")

                    data_rows = []
                    for row in rows[1:]:
                        cells = row.find_all("td")
                        if len(cells) > max(idx_code, idx_title, idx_slot, idx_faculty, idx_ctype, idx_room):
                            course_code = cells[idx_code].get_text(strip=True)
                            course_title = cells[idx_title].get_text(strip=True)
                            slot = cells[idx_slot].get_text(strip=True)
                            gcr_code = cells[idx_gcr].get_text(strip=True) if idx_gcr != -1 else ""
                            faculty_name = cells[idx_faculty].get_text(strip=True) if idx_faculty != -1 else ""
                            course_type = cells[idx_ctype].get_text(strip=True) if idx_ctype != -1 else ""
                            room_no = cells[idx_room].get_text(strip=True) if idx_room != -1 else ""

                            if course_code and course_title:
                                data_rows.append({
                                    "course_code": course_code,
                                    "course_title": course_title,
                                    "slot": slot,
                                    "gcr_code": gcr_code,
                                    "faculty_name": faculty_name,
                                    "course_type": course_type,
                                    "room_no": room_no
                                })

                    if data_rows:
                        logger.info(f"Extracted {len(data_rows)} course entries.")
                        extracted_rows = data_rows
                        break
                except Exception as e:
                    logger.warning(f"Error parsing table on attempt {attempt+1}: {e}")

            time.sleep(5)

        if not extracted_rows:
            logger.error("Failed to extract timetable table after retries.")
        return extracted_rows

    def is_empty_slot(self, slot_code):
        """Determine if a slot is empty"""
        if not slot_code or not slot_code.strip():
            return True
        if slot_code.lower() in ['empty', 'break', '-']:
            return True
        return False

    def merge_timetable_with_courses(self, course_data, batch_input=None, personal_details=None):
        """
        Merge course data with the appropriate timetable format based on batch
        """
        # Determine student's batch
        student_batch = None
        if batch_input in ["1", "2"]:
            student_batch = f"Batch {batch_input}"
            logger.info(f"Auto-detected batch: {student_batch}")
        elif personal_details:
            # If you already have a 'Batch' in personal_details, parse it
            raw_batch = personal_details.get("Batch", "").strip()
            if raw_batch in ["1", "2"]:
                student_batch = f"Batch {raw_batch}"
            else:
                match = re.search(r'(\d+)', raw_batch)
                if match and match.group(1) in ["1", "2"]:
                    student_batch = f"Batch {match.group(1)}"

        # If we still have no batch, return an error or fallback
        if not student_batch:
            logger.error("Could not auto-detect batch from the page.")
            return {"status": "error", "msg": "Could not auto-detect batch (must be 1 or 2)"}

        # Select the official timetable based on batch
        if "1" in student_batch:
            official_tt = batch_1_timetable
        elif "2" in student_batch:
            official_tt = batch_2_timetable
        else:
            logger.error(f"Invalid batch: {student_batch}")
            return {"status": "error", "msg": f"Invalid batch: {student_batch}"}

        # Build an enhanced slot-to-course mapping with lab handling
        logger.info("Building enhanced slot to course mapping with improved lab handling...")
        enhanced_mapping = {}
        multi_slot_labs = {}  # Keep track of multi-slot lab courses

        # First pass: Identify all courses and parse their slots
        for course in course_data:
            slot = course.get("slot", "").strip()
            if not slot:
                continue

            course_info = {
                "title": course.get("course_title", "").strip(),
                "faculty": course.get("faculty_name", "").strip(),
                "room": course.get("room_no", "").strip(),
                "code": course.get("course_code", "").strip(),
                "type": course.get("course_type", "").strip(),
                "gcr_code": course.get("gcr_code", "").strip()
            }

            # Handle regular slots with possible "/X" format
            if "/" in slot and "-" not in slot:
                slot_parts = [s.strip() for s in slot.split("/") if s.strip()]
                for part in slot_parts:
                    enhanced_mapping[part] = course_info

            # Special handling for multi-slot lab courses like "P37-P38-P39-P40-"
            elif "-" in slot:
                slot_codes = []

                # Split combined lab slots (handling both forms: "P37-P38-P39-" and "P37-38-39-")
                if re.search(r'P\d+-P\d+-', slot):  # Format: P37-P38-P39-
                    slot_parts = [s.strip() for s in re.findall(r'(P\d+)-', slot)]
                    slot_codes.extend(slot_parts)
                else:  # Format: P37-38-39- (without repeating P)
                    prefix_match = re.match(r'(P)(\d+)-', slot)
                    if prefix_match:
                        prefix = prefix_match.group(1)
                        numbers = re.findall(r'(\d+)-', slot)
                        slot_codes = [f"{prefix}{num}" for num in numbers]

                # Add dash to each slot code to match official timetable format
                slot_codes = [f"{code}-" for code in slot_codes]

                # Register these slot codes with the course
                for code in slot_codes:
                    enhanced_mapping[code] = course_info

                # Also register the full original slot for reference
                enhanced_mapping[slot] = course_info

                # Track this as a multi-slot lab for debugging
                multi_slot_labs[slot] = slot_codes

            # Regular single slot
            else:
                enhanced_mapping[slot] = course_info

        logger.info(f"Processed {len(course_data)} courses, found {len(multi_slot_labs)} multi-slot labs")
        for lab_slot, codes in multi_slot_labs.items():
            logger.info(f"Lab slot {lab_slot} mapped to individual codes: {', '.join(codes)}")

        # Define break codes: slots with no corresponding course info
        break_codes = set()
        for day, slots in official_tt.items():
            for _, slot_code in slots.items():
                if "/" in slot_code:
                    for part in slot_code.split("/"):
                        part = part.strip()
                        if part and part not in enhanced_mapping:
                            break_codes.add(part)
                else:
                    if slot_code and slot_code not in enhanced_mapping:
                        break_codes.add(slot_code)

        # Merge official timetable with the mapping
        logger.info("Merging timetable with course information...")
        merged_tt = {}
        for day, slots in official_tt.items():
            merged_day = {}
            for time_slot, slot_code in slots.items():
                merged_day[time_slot] = {
                    "time": time_slot,
                    "original_slot": slot_code,
                    "courses": [],
                    "display": ""
                }

                if self.is_empty_slot(slot_code):
                    continue

                # Handle multiple parts if present (e.g., "A/X")
                if "/" in slot_code:
                    parts = [s.strip() for s in slot_code.split("/") if s.strip()]
                    matched = []
                    for p in parts:
                        if p in enhanced_mapping:
                            matched.append(enhanced_mapping[p])

                    if matched:
                        titles = " / ".join(mc["title"] for mc in matched)
                        merged_day[time_slot] = {
                            "display": f"{titles} ({time_slot})",
                            "original_slot": slot_code,
                            "courses": matched,
                            "time": time_slot
                        }
                else:
                    if slot_code in enhanced_mapping:
                        course_info = enhanced_mapping[slot_code]
                        merged_day[time_slot] = {
                            "display": f"{course_info['title']} ({time_slot})",
                            "original_slot": slot_code,
                            "courses": [course_info],
                            "time": time_slot
                        }
                    else:
                        is_br = slot_code in break_codes or slot_code == "X"
                        merged_day[time_slot] = {
                            "display": "" if is_br else slot_code,
                            "original_slot": slot_code,
                            "courses": [],
                            "time": time_slot
                        }
            merged_tt[day] = merged_day

        logger.info("Timetable merging completed successfully")
        return {
            "status": "success",
            "batch": student_batch,
            "merged_timetable": merged_tt,
            "personal_details": personal_details,
            "course_data": course_data
        }

    def store_timetable_in_supabase(self, merged_result):
        """Store timetable data in Supabase for the current user"""
        merged_tt = merged_result.get("merged_timetable")
        batch = merged_result.get("batch")
        personal_details = merged_result.get("personal_details")
        course_data = merged_result.get("course_data")

        # Ensure GCR codes are included in course_data
        for course in course_data:
            if "gcr_code" not in course:
                course["gcr_code"] = ""  # Add empty GCR code if missing

        # Retrieve user id by email
        try:
            user_resp = supabase.table("users").select("id").eq("email", self.email).single().execute()
            if user_resp.data:
                user_id = user_resp.data["id"]
            else:
                # Create a new user with a dummy password if not found (should rarely happen)
                new_user = {
                    "email": self.email,
                    "password_hash": generate_password_hash("dummy_password"),
                    "registration_number": ""
                }
                user_resp = supabase.table("users").insert(new_user).execute()
                user_id = user_resp.data[0]["id"]
        except Exception as e:
            logger.error(f"Error retrieving user from Supabase: {e}")
            return False

        # Check if a timetable record already exists for this user
        try:
            tt_resp = supabase.table("timetable").select("id").eq("user_id", user_id).execute()
            timestamp = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
            if tt_resp.data and len(tt_resp.data) > 0:
                update_data = {
                    "timetable_data": merged_tt,
                    "batch": batch,
                    "personal_details": personal_details,
                    "course_data": course_data,
                    "updated_at": timestamp
                }
                up_resp = supabase.table("timetable").update(update_data).eq("user_id", user_id).execute()
                if up_resp.data:
                    logger.info("Timetable updated successfully in Supabase.")
                else:
                    logger.error("Failed to update timetable in Supabase.")
            else:
                insert_data = {
                    "user_id": user_id,
                    "timetable_data": merged_tt,
                    "batch": batch,
                    "personal_details": personal_details,
                    "course_data": course_data,
                    "updated_at": timestamp
                }
                in_resp = supabase.table("timetable").insert(insert_data).execute()
                if in_resp.data:
                    logger.info("Timetable inserted successfully in Supabase.")
                else:
                    logger.error("Failed to insert timetable in Supabase.")
        except Exception as e:
            logger.error(f"Error storing timetable in Supabase: {e}")
            return False
        return True

    def run_timetable_scraper(self):
        """Public interface to run the timetable scraper"""
        logger.info("Starting timetable scraper")
        try:
            self.setup_driver()
            success = self.ensure_login()
            if not success:
                logger.error("Failed to log in to Academia. Aborting timetable scraping.")
                return {"status": "error", "message": "Login failed"}
            
            # Step 1: Scrape timetable data
            course_data = self.scrape_timetable()
            if not course_data:
                logger.error("Failed to scrape timetable data")
                return {"status": "error", "message": "Failed to scrape timetable data"}
            
            # Step 2: Auto-detect the batch from the page
            auto_batch = self.parse_batch_number_from_page()
            logger.info(f"Scraped {len(course_data)} courses from timetable page; detected batch={auto_batch}")
            
            # Step 3: Merge timetable with course data
            merged_result = self.merge_timetable_with_courses(course_data, auto_batch)
            if merged_result["status"] != "success":
                self.driver.quit()
                return merged_result
            
            # Step 4: Store timetable data in Supabase
            store_success = self.store_timetable_in_supabase(merged_result)
            if not store_success:
                logger.error("Failed to store timetable in Supabase.")
            else:
                logger.info("Timetable stored in Supabase successfully.")
            
            self.driver.quit()
            logger.info("Timetable scraper finished successfully")
            
            return merged_result
        
        except Exception as e:
            logger.error(f"Error in timetable scraper: {str(e)}")
            if self.driver:
                self.driver.quit()
            return {"status": "error", "message": str(e)}

    def run_attendance_scraper(self):
        """Public interface to run the attendance scraper"""
        logger.info("Starting attendance scraper")
        try:
            self.driver = self.setup_driver()
            if self.driver is None:
                logger.error("Failed to initialize Chrome driver")
                return {"status": "error", "message": "Failed to initialize Chrome driver"}
            
            self.apply_timeouts()
            
            success = self.ensure_login()
            if not success:
                logger.error("Failed to log in to Academia. Aborting attendance scraping.")
                return {"status": "error", "message": "Login failed"}
                
            html_source = self.get_attendance_page()
            if not html_source:
                logger.error("Failed to load attendance page")
                return {"status": "error", "message": "Failed to load attendance page"}
                
            registration_number = self.extract_registration_number(BeautifulSoup(html_source, "html.parser"))
            if not registration_number:
                logger.error("Failed to extract registration number")
                return {"status": "error", "message": "Failed to extract registration number"}
                
            user_id = self.get_user_id(registration_number)
            if not user_id:
                logger.error("Failed to get or create user in database")
                return {"status": "error", "message": "Failed to get or create user in database"}
                
            result = self.parse_and_save_attendance(html_source, self.driver)
            marks_result = self.parse_and_save_marks(html_source, self.driver)
            
            self.driver.quit()
            logger.info("Attendance scraper finished successfully")
            
            combined_result = {
                "status": "success",
                "attendance": result,
                "marks": marks_result
            }
            return combined_result
            
        except Exception as e:
            logger.error(f"Error in attendance scraper: {str(e)}")
            if self.driver:
                self.driver.quit()
            return {"status": "error", "message": str(e)}

    def clear_browser_cache(self):
        """Clear browser cache to free up memory"""
        try:
            self.driver.execute_script("window.gc();")  # Force garbage collection
            self.driver.execute_cdp_cmd('Network.clearBrowserCache', {})
            logger.info("Browser cache cleared")
        except Exception as e:
            logger.warning(f"Failed to clear browser cache: {e}")

    def log_memory_usage(self):
        """Log current memory usage to help with debugging"""
        try:
            import psutil
            process = psutil.Process(os.getpid())
            logger.info(f"Memory usage: {process.memory_info().rss / 1024 / 1024:.2f} MB")
        except:
            logger.warning("Unable to log memory usage (psutil not available)")

    def apply_timeouts(self):
        """Apply various timeouts to improve reliability on Render"""
        if self.driver:
            self.driver.set_page_load_timeout(120)  # 2 minutes
            self.driver.set_script_timeout(60)  # 1 minute
            # Add implicit wait - careful with this as it affects all find_element calls
            self.driver.implicitly_wait(10)  # 10 seconds

    def run_unified_scraper(self):
        """Run both scrapers in a single session"""
        logger.info("Starting unified scraper")
        
        result = {
            "status": "error",
            "attendance_success": False,
            "timetable_success": False,
            "timetable_data": None,
            "message": "Not started"
        }
        
        try:
            # Setup driver (this now sets self.driver internally)
            self.driver = self.setup_driver()
            if self.driver is None:
                logger.error("Failed to initialize Chrome driver")
                result["message"] = "Failed to initialize Chrome driver"
                return result
            
            # Login (once for both scrapers)
            if not self.ensure_login():
                logger.error("Failed to log in to Academia. Aborting all scraping.")
                result["message"] = "Login failed"
                return result
            
            # 1. First, run attendance scraper
            try:
                logger.info("Starting attendance scraping...")
                html_source = self.get_attendance_page()
                
                if html_source:
                    attendance_success = self.parse_and_save_attendance(html_source, self.driver)
                    marks_success = self.parse_and_save_marks(html_source, self.driver)
                    result["attendance_success"] = attendance_success and marks_success
                    logger.info(f"Attendance scraping completed: success={result['attendance_success']}")
                    
                    # Clear cache between operations
                    self.clear_browser_cache()
                else:
                    logger.error("Failed to get attendance page")
            except Exception as e:
                logger.error(f"Error during attendance scraping: {str(e)}")
                traceback.print_exc()
                # Continue to timetable even if attendance fails
            
            # 2. Then run timetable scraper
            try:
                logger.info("Starting timetable scraping...")
                
                # Get course data
                course_data = self.scrape_timetable()
                if course_data:
                    # Detect batch number
                    auto_batch = self.parse_batch_number_from_page()
                    logger.info(f"Detected batch: {auto_batch}")
                    
                    # Merge timetable with course data
                    timetable_result = self.merge_timetable_with_courses(course_data, auto_batch)
                    
                    if timetable_result["status"] == "success":
                        # Store in Supabase
                        store_success = self.store_timetable_in_supabase(timetable_result)
                        result["timetable_success"] = store_success
                        result["timetable_data"] = timetable_result
                        logger.info(f"Timetable scraping completed: success={store_success}")
                    else:
                        logger.error(f"Timetable merging failed: {timetable_result.get('msg', 'Unknown error')}")
                else:
                    logger.error("Failed to get course data")
            except Exception as e:
                logger.error(f"Error during timetable scraping: {str(e)}")
                traceback.print_exc()
            
            # Update final status
            if result["attendance_success"] or result["timetable_success"]:
                result["status"] = "success"
                result["message"] = "At least one scraper completed successfully"
            else:
                result["message"] = "All scrapers failed"
            
            return result
        except Exception as e:
            logger.error(f"Error in unified scraper: {str(e)}")
            traceback.print_exc()
            result["message"] = str(e)
            return result
        finally:
            # Always clean up
            if self.driver:
                try:
                    self.driver.quit()
                    logger.info("Chrome driver closed")
                except:
                    pass

# Public interface to match the original script
def run_scraper(email, password, scraper_type="attendance"):
    """
    Run the specified scraper with the provided credentials
    
    scraper_type can be:
    - "attendance": Just run attendance scraper
    - "timetable": Just run timetable scraper
    - "unified": Run both scrapers in a single browser session (recommended for Render)
    """
    scraper = SRMScraper(email, password)
    
    if scraper_type.lower() == "attendance":
        return scraper.run_attendance_scraper()
    elif scraper_type.lower() == "timetable":
        return scraper.run_timetable_scraper()
    elif scraper_type.lower() == "unified":
        return scraper.run_unified_scraper()
    else:
        return {"status": "error", "message": f"Unknown scraper type: {scraper_type}"}

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="SRM Academia Scraper")
    parser.add_argument("--email", required=True, help="SRM Academia email")
    parser.add_argument("--password", required=True, help="SRM Academia password")
    parser.add_argument("--type", choices=["attendance", "timetable", "unified"], default="attendance",
                      help="Type of scraper to run (attendance, timetable, or unified)")
    
    args = parser.parse_args()
    
    result = run_scraper(args.email, args.password, args.type)
    
    if result["status"] == "success":
        print(f"{args.type.capitalize()} data scraped successfully!")
    else:
        print(f"Error: {result.get('message', 'Unknown error')}")