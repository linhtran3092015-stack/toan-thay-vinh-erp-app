// Generates the PWA icon set in public/icons from public/icons/icon.svg
// (rounded, transparent corners) and public/icons/icon-maskable.svg
// (full-bleed, content inside the 80% safe zone).
//
// Usage: node scripts/generate-pwa-icons.mjs
// Replace the two SVG sources with the real logo and re-run.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const iconsDir = path.join(root, "public", "icons");

const BRAND = "#B83C30"; // --erp-accent (default "terracotta" palette)

function markSvg({ rounded }) {
  const radius = rounded ? 112 : 0;
  // Maskable icons must keep the content inside the central 80% circle.
  const fontSize = rounded ? 232 : 196;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${radius}" ry="${radius}" fill="${BRAND}"/>
  <text x="256" y="256" fill="#FFFFFF" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="${fontSize}" font-weight="700" text-anchor="middle" dominant-baseline="central" letter-spacing="-8">TV</text>
</svg>
`;
}

const targets = [
  { file: "icon-192.png", size: 192, source: "icon.svg" },
  { file: "icon-512.png", size: 512, source: "icon.svg" },
  { file: "icon-512-maskable.png", size: 512, source: "icon-maskable.svg" },
  { file: "apple-touch-icon.png", size: 180, source: "icon-maskable.svg" },
  { file: "favicon-32.png", size: 32, source: "icon.svg" },
];

await mkdir(iconsDir, { recursive: true });

const sources = {
  "icon.svg": markSvg({ rounded: true }),
  "icon-maskable.svg": markSvg({ rounded: false }),
};
for (const [name, svg] of Object.entries(sources)) {
  await writeFile(path.join(iconsDir, name), svg);
}

for (const target of targets) {
  await sharp(Buffer.from(sources[target.source]))
    .resize(target.size, target.size)
    .png()
    .toFile(path.join(iconsDir, target.file));
  console.log(`wrote public/icons/${target.file}`);
}
