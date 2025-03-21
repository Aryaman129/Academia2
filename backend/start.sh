#!/bin/bash

# Ensure we're in the correct directory
cd "$(dirname "$0")"

# Install dependencies if not already installed
pip install -r requirements.txt

# Run the application
python attendance_api.py 