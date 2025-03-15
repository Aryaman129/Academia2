"""
Updated Course Personal Details Module (2025)

This module fetches course personal details from the SRM Academia portal
using the exact same login mechanism as the working attendance scraper.
"""

import time
import json
import base64
import logging
import requests
from bs4 import BeautifulSoup
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.by import By

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Constants
BASE_URL = "https://academia.srmist.edu.in"
TIMETABLE_URL = f"{BASE_URL}/#Page:My_Time_Table"

def get_srm_token(username, password, driver_path=None):
    """
    Log in to SRM portal and generate token from session cookies.
    Uses the exact same login logic as the working attendance scraper.
    
    Args:
        username (str): SRM login email/username
        password (str): SRM login password
        driver_path (str, optional): Path to ChromeDriver. If None, will use webdriver_manager.
        
    Returns:
        str: Base64 encoded token containing authentication cookies
    """
    LOGIN_URL = "https://academia.srmist.edu.in"
    
    chrome_options = Options()
    chrome_options.add_argument("--headless")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--window-size=1920,1080")
    chrome_options.add_argument("--ignore-certificate-errors")
    chrome_options.add_argument("--allow-running-insecure-content")
    
    try:
        # Use webdriver_manager if no driver path is provided
        if not driver_path:
            from webdriver_manager.chrome import ChromeDriverManager
            from selenium.webdriver.chrome.service import Service
            service = Service(ChromeDriverManager().install())
            driver = webdriver.Chrome(service=service, options=chrome_options)
            logger.info("Using webdriver_manager to install ChromeDriver")
        else:
            service = Service(driver_path)
            driver = webdriver.Chrome(service=service, options=chrome_options)
            logger.info(f"Using ChromeDriver at: {driver_path}")
    except Exception as e:
        logger.error(f"Failed to initialize ChromeDriver: {e}")
        return None
    
    try:
        driver.get(LOGIN_URL)
        wait = WebDriverWait(driver, 30)
        
        # Switch to login iframe - EXACTLY as in scrape_attendance.py
        wait.until(EC.frame_to_be_available_and_switch_to_it((By.ID, "signinFrame")))
        logger.info("Switched to login iframe")
        
        # Enter email/username
        email_field = wait.until(EC.presence_of_element_located((By.ID, "login_id")))
        email_field.send_keys(username)
        logger.info(f"Entered email: {username}")
        
        # Click Next
        next_button = wait.until(EC.element_to_be_clickable((By.ID, "nextbtn")))
        next_button.click()
        logger.info("Clicked Next")
        time.sleep(2)
        
        # Enter password
        password_field = wait.until(EC.element_to_be_clickable((By.ID, "password")))
        password_field.send_keys(password)
        logger.info("Entered password")
        
        # Click Sign In
        sign_in_button = wait.until(EC.element_to_be_clickable((By.ID, "nextbtn")))
        sign_in_button.click()
        logger.info("Clicked Sign In")
        time.sleep(5)
        
        # Check if login was successful
        if BASE_URL in driver.current_url:
            logger.info("Login successful")
        else:
            logger.error("Login failed, check credentials or CAPTCHA requirements")
            driver.quit()
            return None
            
    except Exception as e:
        logger.error(f"Error during SRM login: {e}")
        driver.quit()
        return None
    
    # Extract required cookies
    cookies = driver.get_cookies()
    required_keys = {"JSESSIONID", "iamcsr", "CT_CSRF_TOKEN"}
    filtered = {cookie['name']: cookie['value'] for cookie in cookies if cookie['name'] in required_keys}
    
    # Additional check for all required cookies
    missing_keys = required_keys - set(filtered.keys())
    if missing_keys:
        logger.warning(f"Missing required cookies: {missing_keys}")
    
    # Save the token
    token_json = json.dumps(filtered)
    token_b64 = base64.b64encode(token_json.encode()).decode()
    logger.info("SRM token generated successfully")
    
    # Now navigate to the timetable page and get the HTML
    try:
        logger.info("Navigating to timetable page...")
        driver.get(TIMETABLE_URL)
        logger.info("Waiting for timetable page to load...")
        time.sleep(55)  # Initial wait
        
        # Wait for the page to fully load (looking for the table)
        max_retries = 1
        for retry in range(max_retries):
            if "Course Code" in driver.page_source:
                logger.info("Timetable page loaded successfully")
                break
            logger.info(f"Waiting for timetable content (attempt {retry+1}/{max_retries})...")
            time.sleep(10)
        
        # Save the HTML for debugging
        html_source = driver.page_source
        with open("timetable_page.html", "w", encoding="utf-8") as f:
            f.write(html_source)
        logger.info("Saved timetable page HTML for inspection")
        
        # Parse the HTML to extract course details
        course_details = parse_timetable_html(html_source)
        driver.quit()
        
        return {
            "token": token_b64,
            "course_details": course_details
        }
        
    except Exception as e:
        logger.error(f"Error fetching timetable page: {e}")
        driver.quit()
        return {
            "token": token_b64,
            "course_details": None
        }

def parse_timetable_html(html_content):
    """
    Parse the timetable HTML to extract course details.
    
    Args:
        html_content (str): HTML content of the timetable page
        
    Returns:
        dict: Dictionary containing personal details and course details
    """
    try:
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # Initialize the result structure
        result = {
            "status": "success",
            "data": {
                "PersonalDetails": {},
                "CourseDetails": {}
            }
        }
        
        # Extract personal details
        # Based on the screenshot format
        reg_number_elem = soup.find(string="Registration Number:")
        if reg_number_elem:
            reg_number = reg_number_elem.find_next().text.strip()
        else:
            # Try alternative approach
            reg_number_label = soup.find(lambda tag: tag.name and "Registration Number" in tag.text)
            if reg_number_label:
                reg_number = reg_number_label.find_next().text.strip()
            else:
                reg_number = ""
        
        # Extract other personal details similarly
        name_elem = soup.find(string="Name:")
        name = name_elem.find_next().text.strip() if name_elem else ""
        
        batch_elem = soup.find(string="Batch:")
        batch = batch_elem.find_next().text.strip() if batch_elem else ""
        
        mobile_elem = soup.find(string="Mobile:")
        mobile = mobile_elem.find_next().text.strip() if mobile_elem else ""
        
        program_elem = soup.find(string="Program:")
        program = program_elem.find_next().text.strip() if program_elem else ""
        
        department_elem = soup.find(string="Department:")
        department = department_elem.find_next().text.strip() if department_elem else ""
        
        semester_elem = soup.find(string="Semester:")
        semester = semester_elem.find_next().text.strip() if semester_elem else ""
        
        # If the above approach doesn't work, try a more direct approach
        if not reg_number:
            # Look for the registration number directly in the page
            reg_number_text = soup.find(text=lambda t: t and "RA" in t and len(t) > 10)
            if reg_number_text:
                reg_number = reg_number_text.strip()
        
        # Store personal details
        result["data"]["PersonalDetails"] = {
            "RegistrationNumber": reg_number,
            "Name": name,
            "Batch": batch,
            "Mobile": mobile,
            "Program": program,
            "Department": department,
            "Semester": semester
        }
        
        # Extract course details from the table
        # Find the table with course details
        course_table = None
        for table in soup.find_all("table"):
            if table.find("th", string=lambda s: s and "Course Code" in s):
                course_table = table
                break
        
        if not course_table:
            # Try another approach - look for a table with "Slot" in it
            for table in soup.find_all("table"):
                if table.find("th", string=lambda s: s and "Slot" in s):
                    course_table = table
                    break
        
        if course_table:
            # Extract rows (skip header)
            rows = course_table.find_all("tr")[1:]
            for row in rows:
                cells = row.find_all("td")
                if len(cells) >= 9:  # Ensure we have enough cells
                    try:
                        course_code = cells[1].text.strip()
                        if not course_code:
                            continue
                            
                        result["data"]["CourseDetails"][course_code] = {
                            "CourseCode": course_code,
                            "CourseTitle": cells[2].text.strip(),
                            "Credit": cells[3].text.strip(),
                            "RegnType": cells[4].text.strip(),
                            "Category": cells[5].text.strip(),
                            "CourseType": cells[6].text.strip(),
                            "FacultyName": cells[7].text.strip(),
                            "Slot": cells[8].text.strip(),
                            "RoomNo": cells[10].text.strip() if len(cells) > 10 else ""
                        }
                    except Exception as e:
                        logger.error(f"Error parsing row: {e}")
                        continue
        
        # If we couldn't extract course details, try a more direct approach
        if not result["data"]["CourseDetails"]:
            # Look for slot information directly
            slot_elements = soup.find_all(string=lambda s: s and s.strip() in ["A", "B", "C", "D", "E", "F", "G"])
            for slot_elem in slot_elements:
                # Try to find the course title and code near this slot
                row = slot_elem.find_parent("tr")
                if row:
                    cells = row.find_all("td")
                    if len(cells) >= 3:
                        course_code = cells[1].text.strip() if len(cells) > 1 else ""
                        course_title = cells[2].text.strip() if len(cells) > 2 else ""
                        slot = slot_elem.strip()
                        
                        if course_code and course_title and slot:
                            result["data"]["CourseDetails"][course_code] = {
                                "CourseCode": course_code,
                                "CourseTitle": course_title,
                                "Slot": slot
                            }
        
        # Save the extracted data for debugging
        with open("extracted_course_details.json", "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2)
        logger.info("Saved extracted course details to JSON file")
        
        return result
    except Exception as e:
        logger.error(f"Error parsing timetable HTML: {e}")
        return {
            "status": "error",
            "msg": f"Error parsing timetable HTML: {str(e)}"
        }

def get_course_personal_details(token=None, username=None, password=None, driver_path=None):
    """
    Main function to get course personal details.
    Either provide a token or username/password.
    
    Args:
        token (str, optional): Base64 encoded token containing authentication cookies
        username (str, optional): SRM login email/username
        password (str, optional): SRM login password
        driver_path (str, optional): Path to ChromeDriver
        
    Returns:
        str: JSON string containing course personal details
    """
    # If token is provided, try to use it
    if token:
        try:
            # Parse the token to get cookies
            token_json = base64.b64decode(token.encode()).decode()
            cookies = json.loads(token_json)
            
            # We need to use Selenium to get the timetable page
            logger.info("Using provided token to log in")
            
            # Initialize Selenium
            chrome_options = Options()
            chrome_options.add_argument("--headless")
            chrome_options.add_argument("--disable-gpu")
            chrome_options.add_argument("--no-sandbox")
            chrome_options.add_argument("--window-size=1920,1080")
            
            if not driver_path:
                from webdriver_manager.chrome import ChromeDriverManager
                service = Service(ChromeDriverManager().install())
                driver = webdriver.Chrome(service=service, options=chrome_options)
            else:
                service = Service(driver_path)
                driver = webdriver.Chrome(service=service, options=chrome_options)
            
            # Go to the base URL first
            driver.get(BASE_URL)
            
            # Add the cookies
            for name, value in cookies.items():
                driver.add_cookie({"name": name, "value": value, "domain": "academia.srmist.edu.in"})
            
            # Navigate to the timetable page
            logger.info("Navigating to timetable page...")
            driver.get(TIMETABLE_URL)
            logger.info("Waiting for timetable page to load...")
            time.sleep(55)
            
            # Wait for the page to fully load
            max_retries = 1
            for retry in range(max_retries):
                if "Course Code" in driver.page_source:
                    logger.info("Timetable page loaded successfully")
                    break
                logger.info(f"Waiting for timetable content (attempt {retry+1}/{max_retries})...")
                time.sleep(10)
            
            # Save the HTML for debugging
            html_source = driver.page_source
            with open("timetable_page_token.html", "w", encoding="utf-8") as f:
                f.write(html_source)
            logger.info("Saved timetable page HTML for inspection")
            
            # Parse the HTML to extract course details
            course_details = parse_timetable_html(html_source)
            driver.quit()
            
            return json.dumps(course_details)
            
        except Exception as e:
            logger.error(f"Error using token: {e}")
            # If token fails, fall back to username/password if provided
            if username and password:
                logger.info("Token failed, falling back to username/password")
            else:
                return json.dumps({"status": "error", "msg": f"Error using token: {str(e)}"})
    
    # If we get here, either token failed or wasn't provided
    if username and password:
        try:
            result = get_srm_token(username, password, driver_path)
            if result:
                return json.dumps(result["course_details"])
            else:
                return json.dumps({"status": "error", "msg": "Failed to log in with provided credentials"})
        except Exception as e:
            logger.error(f"Error logging in with credentials: {e}")
            return json.dumps({"status": "error", "msg": f"Error logging in: {str(e)}"})
    
    return json.dumps({"status": "error", "msg": "No valid authentication method provided"})

# Alias for backward compatibility
def getCoursePersonalDetails(token=None, username=None, password=None, driver_path=None):
    """Alias for get_course_personal_details for backward compatibility."""
    return get_course_personal_details(token, username, password, driver_path)

# For direct testing
if __name__ == "__main__":
    import getpass
    
    print("SRM Academia Course Personal Details Scraper")
    print("-------------------------------------------")
    
    username = input("Enter your SRM email: ")
    password = getpass.getpass("Enter your password: ")
    
    print("\nLogging in and fetching course details...")
    result = get_course_personal_details(username=username, password=password)
    
    print("\nResult:")
    parsed_result = json.loads(result)
    if parsed_result.get("status") == "success":
        print("✅ Successfully fetched course details!")
        
        # Print personal details
        personal = parsed_result.get("data", {}).get("PersonalDetails", {})
        print(f"\nStudent: {personal.get('Name', 'N/A')}")
        print(f"Reg No: {personal.get('RegistrationNumber', 'N/A')}")
        print(f"Batch: {personal.get('Batch', 'N/A')}")
        
        # Print course details
        courses = parsed_result.get("data", {}).get("CourseDetails", {})
        print(f"\nFound {len(courses)} courses:")
        for code, details in courses.items():
            print(f"  {code}: {details.get('CourseTitle', 'N/A')} (Slot: {details.get('Slot', 'N/A')})")
    else:
        print(f"❌ Error: {parsed_result.get('msg', 'Unknown error')}")

