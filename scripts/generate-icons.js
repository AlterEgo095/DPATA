// Simple icon generator for PWA
const fs = require('fs');
const path = require('path');

// SVG template for PlagiatIA icon (shield with checkmark)
function createIconSVG(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#059669;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#047857;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="url(#grad)"/>
  <g transform="translate(${size * 0.25}, ${size * 0.2}) scale(${size * 0.005})">
    <path d="M256 32L64 112v160c0 141.4 82.4 272.4 192 332.8 109.6-60.4 192-191.4 192-332.8V112L256 32z" fill="white" fill-opacity="0.95"/>
    <path d="M208 224l-48 48-32-32-24 24 56 56 72-72-24-24z" fill="#059669"/>
  </g>
</svg>`;
}

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const iconsDir = path.join(__dirname, '..', 'public', 'icons');

// Ensure icons directory exists
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Generate SVG icons (PNG would require sharp which may not be available)
sizes.forEach(size => {
  const svg = createIconSVG(size);
  fs.writeFileSync(path.join(iconsDir, `icon-${size}x${size}.svg`), svg);
  console.log(`Created icon-${size}x${size}.svg`);
});

console.log('Icons generated! Note: Convert SVG to PNG for full PWA support.');
