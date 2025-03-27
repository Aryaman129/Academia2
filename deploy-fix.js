const fs = require('fs');
const path = require('path');

console.log('Running PhantomJS dependency fix script at root level...');

// Create an empty phantomjs directory to trick the installer
const phantomDir = path.join(__dirname, 'node_modules', 'phantomjs');
if (!fs.existsSync(phantomDir)) {
  console.log(`Creating dummy phantomjs directory: ${phantomDir}`);
  fs.mkdirSync(phantomDir, { recursive: true });
  
  // Create a dummy package.json to prevent reinstall
  fs.writeFileSync(
    path.join(phantomDir, 'package.json'),
    JSON.stringify({
      name: "phantomjs",
      version: "2.1.1",
      description: "Dummy package to prevent installation",
      main: "index.js"
    }, null, 2)
  );
  
  // Create a dummy index.js
  fs.writeFileSync(
    path.join(phantomDir, 'index.js'),
    'module.exports = { path: "phantomjs-mock" };'
  );

  // Create a fake install.js that does nothing
  fs.writeFileSync(
    path.join(phantomDir, 'install.js'),
    'console.log("Skipping PhantomJS installation");'
  );
  
  console.log('Created dummy phantomjs package to prevent installation issues');
} else {
  console.log('PhantomJS directory already exists');
}

// Also check for frontend node_modules
const frontendPhantomDir = path.join(__dirname, 'frontend', 'node_modules', 'phantomjs');
if (!fs.existsSync(frontendPhantomDir)) {
  console.log(`Creating dummy frontend phantomjs directory: ${frontendPhantomDir}`);
  fs.mkdirSync(frontendPhantomDir, { recursive: true });
  
  // Copy the same files
  fs.writeFileSync(
    path.join(frontendPhantomDir, 'package.json'),
    JSON.stringify({
      name: "phantomjs",
      version: "2.1.1",
      description: "Dummy package to prevent installation",
      main: "index.js"
    }, null, 2)
  );
  
  fs.writeFileSync(
    path.join(frontendPhantomDir, 'index.js'),
    'module.exports = { path: "phantomjs-mock" };'
  );

  fs.writeFileSync(
    path.join(frontendPhantomDir, 'install.js'),
    'console.log("Skipping PhantomJS installation");'
  );
}

console.log('PhantomJS dependency fix completed'); 