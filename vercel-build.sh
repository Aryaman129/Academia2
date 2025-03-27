#!/bin/bash
set -e

echo "Starting custom build process..."

# Create a completely clean install environment
echo "Setting up environment variables"
export PHANTOMJS_SKIP_DOWNLOAD=true
export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
export SKIP_PREFLIGHT_CHECK=true
export NODE_OPTIONS="--max-old-space-size=4096"
export npm_config_ignore_scripts=true

# Create a temporary minimal package.json for installation
cd frontend
echo "Creating minimal package.json for clean installation"
cat > package.json.minimal << EOL
{
  "name": "acadia-temp",
  "version": "0.1.0",
  "private": true,
  "dependencies": {},
  "scripts": {
    "build": "react-scripts build"
  }
}
EOL

# Backup original package.json
cp package.json package.json.orig

# Use the minimal version for installation
mv package.json.minimal package.json

# Install dependencies one by one, without any install scripts
echo "Installing core dependencies"
npm install --no-package-lock --no-save --ignore-scripts react react-dom react-scripts react-router-dom

echo "Installing remaining dependencies"
npm install --no-package-lock --no-save --ignore-scripts @supabase/supabase-js axios tailwindcss
npm install --no-package-lock --no-save --ignore-scripts @testing-library/jest-dom @testing-library/react @testing-library/user-event
npm install --no-package-lock --no-save --ignore-scripts web-vitals jspdf

echo "Installing dev dependencies"
npm install --no-package-lock --no-save --ignore-scripts --save-dev crypto-browserify

# Restore original package.json
mv package.json.orig package.json

# Generate assets directly using Node
echo "Generating assets directly"
node generate-assets.js

# Build the application
echo "Building application"
npx react-scripts build

echo "Build completed successfully!" 