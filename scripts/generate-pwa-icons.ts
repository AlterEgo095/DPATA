// Script de génération des icônes PWA PNG
// Convertit les SVG en PNG pour toutes les tailles requises

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import sharp from 'sharp';

const ICONS_DIR = join(process.cwd(), 'public', 'icons');
const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

// Couleurs PlagiatIA
const COLORS = {
  primary: '#059669',
  primaryDark: '#047857',
  background: '#064e3b',
  white: '#FFFFFF',
  whiteOpacity: 'rgba(255,255,255,0.95)',
};

// Génère un SVG pour une taille donnée
function generateSVG(size: number): string {
  const radius = size * 0.2; // Coins arrondis ~20%
  
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${COLORS.primary};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${COLORS.primaryDark};stop-opacity:1" />
    </linearGradient>
  </defs>
  <!-- Fond arrondi avec dégradé -->
  <rect width="${size}" height="${size}" rx="${radius}" fill="url(#grad)"/>
  <!-- Bouclier (shield) -->
  <g transform="translate(${size * 0.25}, ${size * 0.2}) scale(${size * 0.0025})">
    <path d="M256 32L64 112v160c0 141.4 82.4 272.4 192 332.8 109.6-60.4 192-191.4 192-332.8V112L256 32z" fill="${COLORS.white}" fill-opacity="0.95"/>
    <!-- Checkmark -->
    <path d="M208 224l-48 48-32-32-24 24 56 56 72-72-24-24z" fill="${COLORS.primary}"/>
  </g>
</svg>`;
}

async function main() {
  console.log('🎨 Génération des icônes PWA PNG...\n');
  
  for (const size of SIZES) {
    const svgBuffer = Buffer.from(generateSVG(size));
    const outputPath = join(ICONS_DIR, `icon-${size}x${size}.png`);
    
    try {
      await sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toFile(outputPath);
      
      console.log(`  ✅ icon-${size}x${size}.png (${(svgBuffer.length / 1024).toFixed(1)} KB)`);
    } catch (error) {
      console.error(`  ❌ Erreur pour ${size}x${size}:`, error);
    }
  }
  
  // Générer également un favicon.ico (16x16 et 32x32)
  const faviconSvg = generateSVG(32);
  const faviconPath = join(process.cwd(), 'public', 'favicon.ico');
  
  try {
    await sharp(Buffer.from(faviconSvg))
      .resize(32, 32)
      .png()
      .toFile(faviconPath.replace('.ico', '.png'));
    console.log('  ✅ favicon.png (32x32)');
  } catch (e) {
    console.error('  ⚠️ Erreur favicon:', e);
  }
  
  console.log('\n🎉 Terminé ! Les icônes PWA sont prêtes.');
}

main().catch(console.error);
