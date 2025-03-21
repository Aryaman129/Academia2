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

# ------------------------ ADJUST THIS IF NEEDED -----------------------
TIMETABLE_URL = "https://academia.srmist.edu.in/#Page:My_Time_Table_2023_24"
CHROMEDRIVER_PATH = r"C:\Users\Lenovo\Desktop\Academia2\chromedriver-win64\chromedriver.exe"
# ----------------------------------------------------------------------

BASE_URL = "https://academia.srmist.edu.in"
LOGIN_URL = BASE_URL

chrome_options = Options()
chrome_options.add_argument("--headless")
chrome_options.add_argument("--disable-gpu")
chrome_options.add_argument("--no-sandbox")
chrome_options.add_argument("--window-size=1920,1080")
chrome_options.add_argument("--ignore-certificate-errors")
chrome_options.add_argument("--allow-running-insecure-content")

def login_srm(driver, username, password):
    """Logs into academia.srmist.edu.in with the same logic as your attendance code."""
    driver.get(LOGIN_URL)
    wait = WebDriverWait(driver, 30)

    # Switch to the login iframe
    wait.until(EC.frame_to_be_available_and_switch_to_it((By.ID, "signinFrame")))
    print("✅ Switched to iframe")

    # Enter email
    email_field = wait.until(EC.presence_of_element_located((By.ID, "login_id")))
    email_field.clear()
    email_field.send_keys(username)
    print(f"✅ Entered email: {username}")

    # Click Next
    next_button = wait.until(EC.element_to_be_clickable((By.ID, "nextbtn")))
    next_button.click()
    print("✅ Clicked Next")
    time.sleep(2)

    # Enter password
    password_field = wait.until(EC.element_to_be_clickable((By.ID, "password")))
    password_field.clear()
    password_field.send_keys(password)
    print("✅ Entered password")

    # Click Sign In
    sign_in_button = wait.until(EC.element_to_be_clickable((By.ID, "nextbtn")))
    sign_in_button.click()
    print("✅ Clicked Sign In")

    time.sleep(5)  # Wait for login to complete
    driver.switch_to.default_content()  # exit the iframe

    if BASE_URL in driver.current_url:
        print("✅ Login successful")
        return True
    else:
        print("❌ Login failed, check credentials or CAPTCHA requirements")
        return False

def scrape_timetable(driver):
    """
    Scrapes the timetable data using multiple approaches to ensure reliable data extraction.
    """
    print(f"⏳ Navigating to timetable page: {TIMETABLE_URL}")
    driver.get(TIMETABLE_URL)

    # Wait for the page to load
    time.sleep(10)  # Initial wait

    # Save the HTML for debugging
    html_source = driver.page_source
    with open("timetable_page_debug.html", "w", encoding="utf-8") as f:
        f.write(html_source)
    print("✅ Saved page HTML for debugging")

    # Multiple attempts to find and parse the table
    max_retries = 5
    for attempt in range(max_retries):
        print(f"📊 Attempt {attempt + 1} to extract table data...")
        
        # Get updated page source each attempt
        html_source = driver.page_source
        soup = BeautifulSoup(html_source, "html.parser")
        
        # Try multiple approaches to find the table
        
        # Approach 1: Find by class name
        table = soup.find("table", class_="course_tbl")
        
        # Approach 2: Find by table containing specific text
        if not table:
            for t in soup.find_all("table"):
                if "Course Code" in t.get_text():
                    table = t
                    break
        
        # Approach 3: Find by div class and then table
        if not table:
            cnt_div = soup.find("div", class_="cntDiv")
            if cnt_div:
                table = cnt_div.find("table")
        
        if table:
            # Try to extract data from the table
            try:
                # First, get all rows
                rows = table.find_all("tr")
                if len(rows) < 2:  # Need at least header + one data row
                    continue
                
                # Get headers (try multiple approaches)
                headers = []
                header_row = rows[0]
                header_cells = header_row.find_all(["th", "td"])
                
                if not header_cells:
                    # Try finding headers by strong tags
                    header_cells = header_row.find_all("strong")
                
                headers = [cell.get_text(strip=True) for cell in header_cells]
                
                # Map column indices
                col_map = {
                    "s_no": next((i for i, h in enumerate(headers) if "S.No" in h or "S No" in h), 0),
                    "course_code": next((i for i, h in enumerate(headers) if "Course Code" in h), 1),
                    "course_title": next((i for i, h in enumerate(headers) if "Course Title" in h), 2),
                    "credit": next((i for i, h in enumerate(headers) if "Credit" in h), 3),
                    "regn_type": next((i for i, h in enumerate(headers) if "Regn" in h), 4),
                    "category": next((i for i, h in enumerate(headers) if "Category" in h), 5),
                    "course_type": next((i for i, h in enumerate(headers) if "Course Type" in h), 6),
                    "faculty_name": next((i for i, h in enumerate(headers) if "Faculty" in h), 7),
                    "slot": next((i for i, h in enumerate(headers) if "Slot" in h), 8),
                    "gcr_code":  next((i for i, h in enumerate(headers) if "GCR Code" in h), 9),
                    "room_no": next((i for i, h in enumerate(headers) if "Room" in h), 10),
                    "academic_year": next((i for i, h in enumerate(headers) if "Academic Year" in h), 11)
                }
                
                # Extract data rows
                data_rows = []
                for row in rows[1:]:  # Skip header row
                    cells = row.find_all("td")
                    if len(cells) >= 8:  # Ensure we have enough cells
                        row_data = {
                            "s_no": cells[col_map["s_no"]].get_text(strip=True),
                            "course_code": cells[col_map["course_code"]].get_text(strip=True),
                            "course_title": cells[col_map["course_title"]].get_text(strip=True),
                            "credit": cells[col_map["credit"]].get_text(strip=True),
                            "regn_type": cells[col_map["regn_type"]].get_text(strip=True),
                            "category": cells[col_map["category"]].get_text(strip=True),
                            "course_type": cells[col_map["course_type"]].get_text(strip=True),
                            "faculty_name": cells[col_map["faculty_name"]].get_text(strip=True),
                            "slot": cells[col_map["slot"]].get_text(strip=True),
                            "gcr_code": cells[col_map["gcr_code"]].get_text(strip=True),
                            "room_no": cells[col_map["room_no"]].get_text(strip=True) if len(cells) > col_map["room_no"] else "",
                            "academic_year": cells[col_map["academic_year"]].get_text(strip=True) if len(cells) > col_map["academic_year"] else ""
                        }
                        
                        # Only add rows that have at least course code and title
                        if row_data["course_code"] and row_data["course_title"]:
                            data_rows.append(row_data)
                
                if data_rows:
                    print(f"✅ Successfully extracted {len(data_rows)} courses")
                    return data_rows
                
            except Exception as e:
                print(f"⚠️ Error parsing table on attempt {attempt + 1}: {str(e)}")
        
        # If we haven't found data yet, wait and try again
        time.sleep(10)
    
    print("❌ Failed to extract table data after all attempts")
    return []

def run_scraper(username, password):
    print("🚀 Starting Timetable Scraper")
    # Setup ChromeDriver
    service = Service(CHROMEDRIVER_PATH)
    driver = webdriver.Chrome(service=service, options=chrome_options)

    try:
        # 1) Log in
        if not login_srm(driver, username, password):
            driver.quit()
            return

        # 2) Scrape timetable
        data_rows = scrape_timetable(driver)
        if not data_rows:
            print("❌ No data scraped or table not found.")
        else:
            print("✅ Successfully scraped timetable data:")
            print(json.dumps(data_rows, indent=2))
            
            # Save the data to a JSON file
            with open("timetable_data.json", "w", encoding="utf-8") as f:
                json.dump(data_rows, f, indent=2)
            print("✅ Saved data to timetable_data.json")

    except Exception as e:
        print(f"❌ Exception: {e}")
    finally:
        driver.quit()
        print("🛑 ChromeDriver session closed.")

if __name__ == "__main__":
    username = 'pp3282@srmist.edu.in'
    password = 'Bhilwara@9921'
    run_scraper(username, password)

