const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('Starting asset generation...');

try {
  // Try to install sharp
  console.log('Installing sharp...');
  execSync('npm install --no-save sharp', { stdio: 'inherit' });
  
  // After installing sharp, import it and generate assets
  const sharp = require('sharp');
  const svgPath = path.join(__dirname, 'public', 'acadia-logo.svg');
  
  if (!fs.existsSync(svgPath)) {
    console.error(`SVG file not found: ${svgPath}`);
    process.exit(1);
  }
  
  console.log(`Found SVG file: ${svgPath}`);
  const svgBuffer = fs.readFileSync(svgPath);
  
  // Function to generate an image
  const generateImage = async (size, filename) => {
    try {
      await sharp(svgBuffer)
        .resize(size, size)
        .toFile(path.join(__dirname, 'public', filename));
      console.log(`Generated ${filename}`);
    } catch (err) {
      console.error(`Error generating ${filename}:`, err);
    }
  };
  
  // Generate all assets
  Promise.all([
    generateImage(192, 'logo192.png'),
    generateImage(512, 'logo512.png'),
    generateImage(64, 'favicon.ico')
  ]).then(() => {
    console.log('Asset generation complete!');
  }).catch(error => {
    console.error('Error during asset generation:', error);
  });
  
} catch (error) {
  console.error('Failed during asset generation:', error);
  process.exit(1);
} 