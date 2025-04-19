import time
import json
import os
import re
import logging
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.by import By
from bs4 import BeautifulSoup
from supabase import create_client, Client
from dotenv import load_dotenv
from werkzeug.security import generate_password_hash  # Imported for user creation if needed
from webdriver_manager.chrome import ChromeDriverManager
import traceback 


# Load environment variables from .env file
load_dotenv()

# ====== Supabase Configuration ======
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ---------------------------------------------------------------------
# Logging Setup
# ---------------------------------------------------------------------
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------
# URLs and Timetable Constants
# ---------------------------------------------------------------------
BASE_URL = "https://academia.srmist.edu.in"
LOGIN_URL = BASE_URL
TIMETABLE_URL = "https://academia.srmist.edu.in/#Page:My_Time_Table_2023_24"

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

def login_srm(driver, username, password):
    driver.get(LOGIN_URL)
    wait = WebDriverWait(driver, 30)
    
    try:
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
                email_field.send_keys(username)
                logger.info(f"Entered email: {username}")
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
                driver.execute_script("arguments[0].click();", next_btn)  # JavaScript click
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
            password_field = driver.find_element(By.ID, "password")
        except:
            # If not, try to switch back to default and then to iframe again
            logger.info("Switching iframe context for password field")
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
                logger.info("Entered password")
                break
            except Exception as e:
                logger.warning(f"⚠️ Attempt {attempt+1} to enter password failed: {e}")
                if attempt == 2:  # Last attempt failed
                    # Try one more approach - use JavaScript to set the value
                    try:
                        logger.info("Trying JavaScript approach to enter password")
                        driver.execute_script(
                            'document.getElementById("password").value = arguments[0]', 
                            password
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
                driver.execute_script("arguments[0].click();", sign_in_btn)  # JavaScript click
                logger.info("Clicked Sign In")
                break
            except Exception as e:
                logger.warning(f"⚠️ Attempt {attempt+1} to click Sign In failed: {e}")
                if attempt == 2:  # Last attempt failed
                    raise
                time.sleep(2)

        time.sleep(5)
        
        # Switch back to default content
        driver.switch_to.default_content()
        
        if BASE_URL in driver.current_url:
            logger.info("Login successful")
            return True
        else:
            logger.error("Login failed, check credentials or CAPTCHA")
            return False
    except Exception as e:
        logger.error(f"Error during SRM login: {e}")
        return False

def scrape_timetable(driver):
    """
    Scrapes the timetable table (and optionally the batch info) from the page.
    """
    logger.info(f"Navigating to timetable page: {TIMETABLE_URL}")
    driver.get(TIMETABLE_URL)
    time.sleep(50)  # Wait for the page to load

    max_retries = 3
    extracted_rows = []
    for attempt in range(max_retries):
        logger.info(f"Attempt {attempt+1}: Extracting timetable table...")
        soup = BeautifulSoup(driver.page_source, "html.parser")
        
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
                                "gcr_code": gcr_code,  # Ensure GCR code is included
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


def dump_page_source(driver, filename="debug_page_source.html", num_chars=1000):
    """
    Writes the first 'num_chars' characters of the page source to a file.
    If you need the full source, set num_chars to None.
    """
    source = driver.page_source if num_chars is None else driver.page_source[:num_chars]
    with open(filename, "w", encoding="utf-8") as f:
        f.write(source)
    print(f"Page source snippet dumped to {filename}")



def debug_print_red_tags(driver):
    
    soup = BeautifulSoup(driver.page_source, "html.parser")

    red_tags = soup.find_all(
        lambda tag: tag.has_attr('style') and '#ff0000' in tag['style'].lower()
    )

    for i, tag in enumerate(red_tags, 1):
        print(f"--- Red tag #{i} ---")
        print("Tag HTML:", tag)
        print("Tag text:", tag.get_text(strip=True))
        print("Style:", tag['style'])
        print("-------------")




def parse_batch_number_from_page(driver):
    
    dump_page_source(driver, filename="debug_page_source.html", num_chars=1000)
# Wait up to 30 seconds for an element containing "Batch" to be visible.
    WebDriverWait(driver, 50).until(
    EC.presence_of_element_located((By.XPATH, "//*[contains(text(),'Batch')]"))
    )
    """
    Extract batch number from either timetable or attendance page HTML.
    Returns the batch number as a string or None if not found.
    """
    soup = BeautifulSoup(driver.page_source, "html.parser")
    
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
    # This pattern matches "Batch:</td><td>2</td>" or similar structures
    batch_rows = soup.find_all("tr")
    for row in batch_rows:
        cells = row.find_all("td")
        for i, cell in enumerate(cells):
            if "Batch" in cell.get_text() and i+1 < len(cells):
                batch_text = cells[i+1].get_text(strip=True)
                if batch_text and batch_text.isdigit():
                    return batch_text
    
    # Method 4: Use regex to find batch number pattern in the HTML
    # This is a fallback method
    batch_pattern = re.compile(r'Batch:?\s*</td>\s*<td[^>]*>\s*(\d+)\s*</td>', re.IGNORECASE)
    match = batch_pattern.search(str(soup))
    if match:
        return match.group(1)
    
    # Method 5: Look for strong tag with batch number
    batch_strong = soup.find("strong", string=lambda text: text and text.isdigit() and len(text.strip()) == 1)
    if batch_strong:
        return batch_strong.get_text(strip=True)
    
    return None



def merge_timetable_with_courses(course_data, batch_input=None, personal_details=None):
    """
    We removed the manual input() code. If batch_input is None, we return an error.
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

    # IMPROVED: Build a better slot-to-course mapping with lab handling
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
            "gcr_code": course.get("gcr_code", "").strip()  # Ensure GCR code is included
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
        logger.info(f"  Lab slot {lab_slot} mapped to individual codes: {', '.join(codes)}")

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

            if is_empty_slot(slot_code):
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

def is_empty_slot(slot_code):
    if not slot_code or not slot_code.strip():
        return True
    if slot_code.lower() in ['empty', 'break', '-']:
        return True
    return False

def store_timetable_in_supabase(email, merged_result):
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
        user_resp = supabase.table("users").select("id").eq("email", email).single().execute()
        if user_resp.data:
            user_id = user_resp.data["id"]
        else:
            # Create a new user with a dummy password if not found (should rarely happen)
            new_user = {
                "email": email,
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

def setup_driver():
    print("Setting up Chrome driver...")
    
    chrome_options = webdriver.ChromeOptions()
    chrome_options.add_argument("--headless")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--disable-gpu")
    
    # Add these resource-saving options
    chrome_options.add_argument("--disable-extensions")
    chrome_options.add_argument("--remote-debugging-port=9222")
    chrome_options.add_argument("--disable-software-rasterizer")
    chrome_options.add_argument("--disable-desktop-notifications")
    chrome_options.add_argument("--disable-default-apps")
    chrome_options.add_argument("--disable-infobars")
    chrome_options.add_argument("--disable-features=site-per-process")
    chrome_options.add_argument("--disable-features=TranslateUI")
    chrome_options.add_argument("--disable-features=BlinkGenPropertyTrees")
    chrome_options.add_argument("--disk-cache-size=1")
    chrome_options.add_argument("--media-cache-size=1")
    chrome_options.add_argument("--js-flags=--expose-gc")
    chrome_options.add_argument("--aggressive-cache-discard")
    chrome_options.add_argument("--disable-application-cache")
    chrome_options.add_argument("--disable-offline-load-stale-cache")
    chrome_options.add_argument("--disable-web-resources-cache")
    chrome_options.add_argument("--memory-pressure-off")
    chrome_options.add_argument("--process-per-site")
    
    # Limit memory use explicitly 
    chrome_options.add_argument("--js-flags=--max-old-space-size=128")
    
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

def main_flow(username, password, driver_path=None):
    """
    Updated main_flow:
    1. Login
    2. Scrape timetable
    3. Auto-detect batch from the page
    4. Merge timetable
    5. Store in Supabase
    """
    driver = setup_driver()

    try:
        # Step 1: Login
        if not login_srm(driver, username, password):
            driver.quit()
            return {"status": "error", "msg": "Login failed"}

        # Step 2: Scrape timetable data
        course_data = scrape_timetable(driver)
        if not course_data:
            driver.quit()
            return {"status": "error", "msg": "Failed to scrape timetable data"}

        # Step 3: Auto-detect the batch from the page
        auto_batch = parse_batch_number_from_page(driver)

        logger.info(f"Scraped {len(course_data)} courses from timetable page; detected batch={auto_batch}")

        # Step 4: Merge timetable with course data
        merged_result = merge_timetable_with_courses(course_data, auto_batch)

        if merged_result["status"] != "success":
            driver.quit()
            return merged_result

        # Step 5: Store timetable data in Supabase
        store_success = store_timetable_in_supabase(username, merged_result)
        if not store_success:
            logger.error("Failed to store timetable in Supabase.")
        else:
            logger.info("Timetable stored in Supabase successfully.")

        return merged_result

    except Exception as e:
        logger.error(f"Error in main flow: {e}")
        return {"status": "error", "msg": str(e)}
    finally:
        driver.quit()
        logger.info("ChromeDriver session closed.")

# SQL snippet remains the same
"""
-- Run this SQL in your Supabase SQL editor to create the timetable table:

CREATE TABLE timetable (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    timetable_data JSONB,
    batch VARCHAR(10),
    personal_details JSONB,
    course_data JSONB,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user FOREIGN KEY(user_id) REFERENCES users(id)
);
"""

# For quick testing
if __name__ == "__main__":
    print("==========================================")
    print("= Auto-detect Batch in Timetable Scraper =")
    print("==========================================")

    user_email = input("Enter your email: ")
    user_pass = input("Enter your password: ")

    cd_path = r"C:\Users\Lenovo\Desktop\Academia2\chromedriver-win64\chromedriver.exe"  # <-- Update to your actual ChromeDriver path
    if not os.path.exists(cd_path):
        raise ValueError("Invalid ChromeDriver path.")

    result = main_flow(user_email, user_pass, driver_path=cd_path)
    if result["status"] != "success":
        print(f"❌ Error: {result['msg']}")
    else:
        print(f"\n✅ Timetable merged for {result['batch']}!\n")
        student = result["personal_details"] or {}
        print("Personal Details:")
        print(f"  Name: {student.get('Name','N/A')}")
        print(f"  Reg No: {student.get('Registration Number','N/A')}")

        out_filename = f"timetable_{student.get('Registration Number','unknown')}.json"
        with open(out_filename, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2)
        print(f"\n✅ Timetable saved to {out_filename}")

        # Print simplified timetable
        print("\nSimplified Timetable:")
        merged_tt = result["merged_timetable"]
        for day, slots in merged_tt.items():
            print(f"\n{day}:")
            for time_interval, slotinfo in sorted(slots.items(), key=lambda x: list(slot_times.values()).index(x[0])):
                if slotinfo["courses"]:
                    ctitles = [c["title"] for c in slotinfo["courses"]]
                    print(f"  {time_interval} => {' / '.join(ctitles)}")
                else:
                    if slotinfo["original_slot"] and slotinfo["original_slot"] not in ["X", "-"]:
                        print(f"  {time_interval} => {slotinfo['original_slot']}")
                    else:
                        print(f"  {time_interval} => Empty")
