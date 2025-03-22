# When making Supabase calls:
try:
    # Set a reasonable timeout to avoid hanging
    resp = supabase.table("users").select("id").eq("email", email).execute(timeout=10)
except Exception as e:
    logger.error(f"Database request timed out: {e}")
    # Handle appropriately 

# Add these options to both setup_driver functions (in chrome_options)
chrome_options.add_argument("--renderer-process-limit=1")
chrome_options.add_argument("--single-process")
chrome_options.add_argument("--ignore-certificate-errors")
chrome_options.add_argument("--disable-popup-blocking")
chrome_options.add_argument("--disable-plugins-discovery") 