/**
 * Converts public/icon.png to public/icon.ico using PNG2ICO approach.
 * Uses electron's nativeImage API via a temp script, or falls back to 
 * creating a minimal valid ICO from the PNG data.
 */
const fs = require('fs');
const path = require('path');

const pngPath = path.join(__dirname, '..', 'public', 'icon.png');
const icoPath = path.join(__dirname, '..', 'public', 'icon.ico');

if (!fs.existsSync(pngPath)) {
  console.error('public/icon.png not found!');
  process.exit(1);
}

// Check if PNG to ICO conversion is available via png-to-ico or similar
// Try to use a raw ICO file header approach with embedded PNG
const pngData = fs.readFileSync(pngPath);

// ICO format: ICONDIR header + ICONDIRENTRY + image data
// We embed the PNG directly (modern ICO supports PNG-compressed images)
const width = 256;  // Target size (we embed full PNG as-is for 256x256)
const height = 256;
const numImages = 1;

// ICONDIR: 6 bytes
const iconDir = Buffer.alloc(6);
iconDir.writeUInt16LE(0, 0);        // Reserved, must be 0
iconDir.writeUInt16LE(1, 2);        // Type: 1 = ICO
iconDir.writeUInt16LE(numImages, 4); // Number of images

// ICONDIRENTRY: 16 bytes
const iconDirEntry = Buffer.alloc(16);
iconDirEntry.writeUInt8(0, 0);       // Width: 0 = 256
iconDirEntry.writeUInt8(0, 1);       // Height: 0 = 256
iconDirEntry.writeUInt8(0, 2);       // Color count: 0 = no palette
iconDirEntry.writeUInt8(0, 3);       // Reserved
iconDirEntry.writeUInt16LE(1, 4);    // Planes
iconDirEntry.writeUInt16LE(32, 6);   // Bit count
iconDirEntry.writeUInt32LE(pngData.length, 8);  // Size of image data
iconDirEntry.writeUInt32LE(6 + 16, 12);          // Offset to image data

const icoBuffer = Buffer.concat([iconDir, iconDirEntry, pngData]);
fs.writeFileSync(icoPath, icoBuffer);

console.log(`Created ${icoPath} (${icoBuffer.length} bytes) with embedded PNG`);
