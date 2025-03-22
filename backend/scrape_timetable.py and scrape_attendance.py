# Add these options to both setup_driver functions
chrome_options.add_argument("--disable-renderer-backgrounding")
chrome_options.add_argument("--disable-backgrounding-occluded-windows")
chrome_options.add_argument("--enable-low-end-device-mode")
chrome_options.add_argument("--disable-sync")
chrome_options.add_argument("--disable-translate")
chrome_options.add_argument("--disable-features=NetworkService") 