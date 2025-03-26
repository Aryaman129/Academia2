def parse_and_save_attendance(driver, email):
    """Parse and save attendance data with improved lab course handling"""
    try:
        print("📊 Starting attendance parsing...")
        attendance_data = {}
        
        # Wait for the attendance table
        WebDriverWait(driver, 20).until(
            EC.presence_of_element_located((By.CLASS_NAME, "table-responsive"))
        )
        
        # Get all rows from the attendance table
        rows = driver.find_elements(By.CSS_SELECTOR, "table tbody tr")
        print(f"Found {len(rows)} course rows")
        
        for row in rows:
            try:
                columns = row.find_elements(By.TAG_NAME, "td")
                if len(columns) < 4:
                    continue
                
                # Extract course details
                course_name = columns[1].text.strip()
                course_code = columns[0].text.strip()
                
                # Determine if it's a lab course
                is_lab = any(lab_indicator in course_name.lower() 
                           for lab_indicator in ['lab', 'laboratory', 'practical'])
                
                # Special handling for semiconductor lab
                is_semiconductor_lab = 'semiconductor' in course_name.lower() and is_lab
                
                # Extract attendance details
                attendance_text = columns[3].text.strip()
                
                # Handle different attendance format for labs
                if is_lab:
                    # Try multiple attendance text formats
                    attendance_parts = attendance_text.replace('(', '').replace(')', '').split('/')
                    if len(attendance_parts) >= 2:
                        present = float(attendance_parts[0])
                        total = float(attendance_parts[1])
                    else:
                        # Fallback for different format
                        present = float(attendance_text.split()[0])
                        total = float(attendance_text.split()[-1])
                else:
                    # Regular course attendance
                    attendance_parts = attendance_text.split('/')
                    present = float(attendance_parts[0])
                    total = float(attendance_parts[1])
                
                # Calculate percentage
                percentage = (present / total * 100) if total > 0 else 0
                
                # Store the data
                attendance_data[course_code] = {
                    'name': course_name,
                    'present': present,
                    'total': total,
                    'percentage': round(percentage, 2),
                    'is_lab': is_lab,
                    'is_semiconductor_lab': is_semiconductor_lab
                }
                
                print(f"✅ Processed {course_name}: {present}/{total} ({percentage:.2f}%)")
                
            except Exception as e:
                print(f"⚠️ Error processing row: {str(e)}")
                continue
        
        if not attendance_data:
            print("❌ No attendance data found!")
            return False
        
        # Save to Supabase
        try:
            result = supabase.table('attendance_data').upsert({
                'email': email,
                'data': attendance_data,
                'updated_at': datetime.now().isoformat()
            }).execute()
            print("✅ Attendance data saved to Supabase")
            return True
            
        except Exception as e:
            print(f"❌ Failed to save attendance: {str(e)}")
            return False
            
    except Exception as e:
        print(f"❌ Error in parse_and_save_attendance: {str(e)}")
        traceback.print_exc()
        return False 