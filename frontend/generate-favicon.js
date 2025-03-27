const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Ensure the svg2png-cli is installed
try {
  execSync('npm install -g svg2png-cli');
  console.log('svg2png-cli installed successfully');
} catch (error) {
  console.error('Failed to install svg2png-cli:', error);
  process.exit(1);
}

// Paths
const svgPath = path.join(__dirname, 'public', 'acadia-logo.svg');
const pngPath = path.join(__dirname, 'public', 'favicon.png');
const icoPath = path.join(__dirname, 'public', 'favicon.ico');

// Convert SVG to PNG (64x64)
try {
  execSync(`npx svg2png-cli -i ${svgPath} -o ${pngPath} -w 64 -h 64`);
  console.log('PNG favicon generated successfully');
} catch (error) {
  console.error('Failed to generate PNG favicon:', error);
  process.exit(1);
}

// Convert PNG to ICO using ImageMagick if available
try {
  execSync(`convert ${pngPath} ${icoPath}`);
  console.log('ICO favicon generated successfully');
  
  // Clean up the temporary PNG
  fs.unlinkSync(pngPath);
} catch (error) {
  console.error('Failed to generate ICO favicon (ImageMagick may not be installed). Using PNG as favicon:', error);
  // Just rename the PNG to ICO in this case
  fs.copyFileSync(pngPath, icoPath);
}

console.log('Favicon generation complete'); 