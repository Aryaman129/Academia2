const fs = require('fs');
const path = require('path');

console.log('Running PhantomJS dependency fix script...');

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
    'console.log("This is a dummy phantomjs package");'
  );
  
  console.log('Created dummy phantomjs package to prevent installation issues');
} else {
  console.log('PhantomJS directory already exists');
}

console.log('PhantomJS dependency fix completed'); 