// Draws the LifeLink app icon and splash (a blood drop with a heartbeat line)
// as the source images @capacitor/assets turns into every Android size.
// Run from mobile/: node assets/make-icons.mjs && npx capacitor-assets generate --android
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const RED = '#ee2b2b';
const DROP = 'M512 170 C512 170 270 450 270 610 A242 242 0 0 0 754 610 C754 450 512 170 512 170 Z';
const PULSE = '330,640 430,640 470,560 520,720 565,600 595,640 694,640';

// A drop of one colour with the pulse in the other, scaled around the centre
const mark = (drop, pulse, scale) => `
  <g transform="translate(512 512) scale(${scale}) translate(-512 -512)">
    <path fill="${drop}" d="${DROP}" />
    <polyline fill="none" stroke="${pulse}" stroke-width="40" stroke-linecap="round" stroke-linejoin="round" points="${PULSE}" />
  </g>`;
const svg = (size, body, background) => Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">
     ${background ? `<rect width="1024" height="1024" fill="${background}" />` : ''}${body}
   </svg>`);

const out = [
  // Adaptive icon: white drop kept inside the safe zone, on a red layer
  ['icon-foreground.png', svg(1024, mark('#ffffff', RED, 0.62))],
  ['icon-background.png', svg(1024, '', RED)],
  // Older launchers: one full square image
  ['icon-only.png', svg(1024, mark('#ffffff', RED, 0.8), RED)],
  // Splash: a red drop on white (the app is light everywhere)
  ['splash.png', svg(2732, mark(RED, '#ffffff', 0.32), '#ffffff')],
  ['splash-dark.png', svg(2732, mark(RED, '#ffffff', 0.32), '#ffffff')],
];
for (const [name, image] of out) {
  await sharp(image).png().toFile(fileURLToPath(new URL(name, import.meta.url)));
  console.log('wrote', name);
}
