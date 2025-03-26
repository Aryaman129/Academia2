import json

def login_and_get_cookies(self):
    """Login and return cookies using exact same code as srm_login.py"""
    try:
        self.driver = self.setup_driver()
        self.driver.get(LOGIN_URL)

        wait = WebDriverWait(self.driver, 30)  # Wait up to 30 seconds

        # ✅ Switch to the iframe before interacting with elements
        wait.until(EC.frame_to_be_available_and_switch_to_it((By.ID, "signinFrame")))
        print("✅ Switched to iframe")

        # ✅ Find and fill the email field
        email_field = wait.until(EC.presence_of_element_located((By.ID, "login_id")))
        email_field.send_keys(self.email)
        print("✅ Entered email")

        # ✅ Click "Next" Button
        next_button = wait.until(EC.element_to_be_clickable((By.ID, "nextbtn")))
        next_button.click()
        print("✅ Clicked Next")

        # ✅ Wait for the password field to become interactable
        time.sleep(2)  # Small delay to allow transition

        password_field = wait.until(EC.element_to_be_clickable((By.ID, "password")))
        password_field.send_keys(self.password)
        print("✅ Entered password")

        # ✅ Click "Sign In" Button
        sign_in_button = wait.until(EC.element_to_be_clickable((By.ID, "nextbtn")))
        sign_in_button.click()
        print("✅ Clicked Sign In")

        time.sleep(5)  # Wait for login to complete

        # ✅ Extract session cookies - EXACT SAME CODE AS srm_login.py
        cookies = {cookie['name']: cookie['value'] for cookie in self.driver.get_cookies()}

        # ✅ Save cookies to a file (for debugging)
        with open("srm_cookies.json", "w") as file:
            json.dump(cookies, file)

        print("✅ Cookies saved successfully!")
        
        # Close the driver
        self.driver.quit()

        # Return the cookies
        return {
            'success': True,
            'cookies': cookies
        }

    except Exception as e:
        print(f"❌ Error during login: {str(e)}")
        if self.driver:
            self.driver.quit()
        return {
            'success': False,
            'message': str(e)
        } 