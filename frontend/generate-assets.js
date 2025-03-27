const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

console.log('Installing sharp...');
exec('npm install --no-save sharp', (error, stdout, stderr) => {
  if (error) {
    console.error(`Error installing sharp: ${error.message}`);
    return;
  }
  
  if (stderr) {
    console.error(`stderr: ${stderr}`);
  }
  
  console.log(`stdout: ${stdout}`);
  
  // After installing sharp, import it and generate assets
  const sharp = require('sharp');
  const svgPath = path.join(__dirname, 'public', 'acadia-logo.svg');
  const svgBuffer = fs.readFileSync(svgPath);
  
  // Generate logo192.png
  sharp(svgBuffer)
    .resize(192, 192)
    .toFile(path.join(__dirname, 'public', 'logo192.png'))
    .then(() => console.log('Generated logo192.png'))
    .catch(err => console.error('Error generating logo192.png:', err));
  
  // Generate logo512.png
  sharp(svgBuffer)
    .resize(512, 512)
    .toFile(path.join(__dirname, 'public', 'logo512.png'))
    .then(() => console.log('Generated logo512.png'))
    .catch(err => console.error('Error generating logo512.png:', err));
  
  // Generate favicon.ico (actually a png, browsers will accept it)
  sharp(svgBuffer)
    .resize(64, 64)
    .toFile(path.join(__dirname, 'public', 'favicon.ico'))
    .then(() => console.log('Generated favicon.ico'))
    .catch(err => console.error('Error generating favicon.ico:', err));
}); 