#!/bin/bash
set -e

echo "Starting custom build process..."

# Copy Vercel-specific .npmrc file to home directory
echo "Setting up npmrc configuration"
cp .npmrc-vercel ~/.npmrc

# Create a "nothing" package to use as a substitute for PhantomJS
mkdir -p node_modules/@npm/nothing
cat > node_modules/@npm/nothing/package.json << EOL
{
  "name": "@npm/nothing",
  "version": "1.0.0",
  "description": "Empty package",
  "main": "index.js"
}
EOL
echo "module.exports = {};" > node_modules/@npm/nothing/index.js

# Force npm to use the "nothing" package
cat >> ~/.npmrc << EOL

phantomjs=@npm/nothing
phantomjs-prebuilt=@npm/nothing
EOL

# Create an explicit installation hint file
echo "process.env.PHANTOMJS_SKIP_DOWNLOAD = 'true';" > install-hint.js

# Install dependencies with special flags
cd frontend 
echo "Installing frontend dependencies"
PHANTOMJS_SKIP_DOWNLOAD=true npm install --no-optional --no-package-lock --no-fund

# Run our removal script to clean up any PhantomJS installations
echo "Running PhantomJS removal script"
cd ..
node remove-phantom.js

# Generate assets
echo "Generating assets"
cd frontend
npm run prepare-assets

# Build the application
echo "Building application"
SKIP_PREFLIGHT_CHECK=true PHANTOMJS_SKIP_DOWNLOAD=true npm run build

echo "Build completed successfully!" 