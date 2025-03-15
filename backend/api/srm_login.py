from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time
import json

LOGIN_URL = "https://academia.srmist.edu.in"

def get_srm_cookies(username, password):
    driver = webdriver.Chrome()
    driver.get(LOGIN_URL)

    wait = WebDriverWait(driver, 30)  # Wait up to 30 seconds

    # ✅ Switch to the iframe before interacting with elements
    wait.until(EC.frame_to_be_available_and_switch_to_it((By.ID, "signinFrame")))
    print("✅ Switched to iframe")

    # ✅ Find and fill the email field
    email_field = wait.until(EC.presence_of_element_located((By.ID, "login_id")))
    email_field.send_keys(username)
    print("✅ Entered email")

    # ✅ Click "Next" Button
    next_button = wait.until(EC.element_to_be_clickable((By.ID, "nextbtn")))
    next_button.click()
    print("✅ Clicked Next")

    # ✅ Wait for the password field to become interactable
    time.sleep(2)  # Small delay to allow transition

    password_field = wait.until(EC.element_to_be_clickable((By.ID, "password")))
    password_field.send_keys(password)
    print("✅ Entered password")

    # ✅ Click "Sign In" Button
    sign_in_button = wait.until(EC.element_to_be_clickable((By.ID, "nextbtn")))
    sign_in_button.click()
    print("✅ Clicked Sign In")

    time.sleep(5)  # Wait for login to complete

    # ✅ Extract session cookies
    cookies = {cookie['name']: cookie['value'] for cookie in driver.get_cookies()}

    # ✅ Save cookies to a file
    with open("srm_cookies.json", "w") as file:
        json.dump(cookies, file)

    print("✅ Cookies saved successfully!")
    driver.quit()

# Run the function
get_srm_cookies("am5965@srmist.edu.in", "Galactic@1296")






