def login_and_get_cookies(self):
    """Login and return cookies without starting scrapers"""
    try:
        self.driver = self.setup_driver()
        if not self.driver:
            return {
                'success': False,
                'message': 'Failed to initialize Chrome driver'
            }
            
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
                    self.driver.execute_script("arguments[0].click();", next_btn)
                    logger.info("Clicked Next")
                    break
                except Exception as e:
                    logger.warning(f"⚠️ Attempt {attempt+1} to click Next failed: {e}")
                    if attempt == 2:  # Last attempt failed
                        raise
                    time.sleep(2)

            time.sleep(2)
            
            # Enter password with retry
            for attempt in range(3):
                try:
                    password_field = wait.until(EC.element_to_be_clickable((By.ID, "password")))
                    password_field.clear()
                    time.sleep(0.5)
                    password_field.send_keys(self.password)
                    logger.info("Entered password")
                    break
                except Exception as e:
                    logger.warning(f"⚠️ Attempt {attempt+1} to enter password failed: {e}")
                    if attempt == 2:
                        raise
                    time.sleep(2)

            # Click Sign In button with retry
            for attempt in range(3):
                try:
                    sign_in_btn = wait.until(EC.element_to_be_clickable((By.ID, "nextbtn")))
                    self.driver.execute_script("arguments[0].click();", sign_in_btn)
                    logger.info("Clicked Sign In")
                    break
                except Exception as e:
                    logger.warning(f"⚠️ Attempt {attempt+1} to click Sign In failed: {e}")
                    if attempt == 2:
                        raise
                    time.sleep(2)

            time.sleep(5)
            
            # Extract cookies
            all_cookies = self.driver.get_cookies()
            cookies = {cookie['name']: cookie['value'] for cookie in all_cookies}
            
            if not cookies:
                return {
                    'success': False,
                    'message': 'No cookies captured after login'
                }
                
            logger.info(f"Successfully captured {len(cookies)} cookies")
            
            return {
                'success': True,
                'cookies': cookies
            }
            
        except Exception as e:
            logger.error(f"Login error: {str(e)}")
            return {
                'success': False,
                'message': str(e)
            }
        finally:
            if self.driver:
                self.driver.quit()
                logger.info("Chrome driver closed")
                
    except Exception as e:
        logger.error(f"Critical error: {str(e)}")
        return {
            'success': False,
            'message': str(e)
        } 