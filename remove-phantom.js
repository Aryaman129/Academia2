const fs = require('fs');
const path = require('path');

console.log('Starting PhantomJS removal script...');

function findAndRemovePhantomJSInNodeModules(nodeModulesDir) {
  try {
    if (!fs.existsSync(nodeModulesDir)) {
      console.log(`Directory ${nodeModulesDir} does not exist.`);
      return;
    }

    let count = 0;
    
    // Get all immediate subdirectories of node_modules
    const entries = fs.readdirSync(nodeModulesDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(nodeModulesDir, entry.name);
      
      // Check if this is a phantomjs directory
      if (entry.isDirectory() && (
          entry.name === 'phantomjs' || 
          entry.name === 'phantomjs-prebuilt' || 
          entry.name.includes('phantom')
      )) {
        console.log(`Found PhantomJS-related directory: ${fullPath}`);
        
        // Create a dummy package
        fs.writeFileSync(
          path.join(fullPath, 'package.json'),
          JSON.stringify({
            name: entry.name,
            version: "2.1.1",
            description: "PhantomJS mock",
            main: "index.js"
          }, null, 2)
        );
        
        // Create a dummy index.js
        fs.writeFileSync(
          path.join(fullPath, 'index.js'),
          'module.exports = { path: "phantomjs-mock" };'
        );
        
        // Replace install.js if it exists
        const installPath = path.join(fullPath, 'install.js');
        if (fs.existsSync(installPath)) {
          fs.writeFileSync(
            installPath,
            'console.log("PhantomJS installation skipped");'
          );
        }
        
        count++;
      }
      
      // Check if this is a node_modules subdirectory
      if (entry.isDirectory() && entry.name === 'node_modules') {
        count += findAndRemovePhantomJSInNodeModules(fullPath);
      }
      
      // Check if this is a package that might contain a nested node_modules
      if (entry.isDirectory() && entry.name[0] !== '.') {
        const nestedNodeModules = path.join(fullPath, 'node_modules');
        if (fs.existsSync(nestedNodeModules)) {
          count += findAndRemovePhantomJSInNodeModules(nestedNodeModules);
        }
      }
    }
    
    return count;
  } catch (error) {
    console.error(`Error processing ${nodeModulesDir}:`, error);
    return 0;
  }
}

// Process root node_modules
const rootCount = findAndRemovePhantomJSInNodeModules(path.join(__dirname, 'node_modules'));
console.log(`Processed ${rootCount} PhantomJS-related directories in root node_modules.`);

// Process frontend node_modules
const frontendCount = findAndRemovePhantomJSInNodeModules(path.join(__dirname, 'frontend', 'node_modules'));
console.log(`Processed ${frontendCount} PhantomJS-related directories in frontend node_modules.`);

console.log('PhantomJS removal script completed.'); 