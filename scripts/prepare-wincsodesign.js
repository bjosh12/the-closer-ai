/**
 * Workaround for electron-builder winCodeSign symlink error on Windows.
 * Extracts the winCodeSign archive but skips macOS symlinks that require elevated privileges.
 * Run this ONCE before npm run build.
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

if (process.platform !== 'win32') {
  console.log('Not on Windows, skipping winCodeSign preparation.');
  process.exit(0);
}

const WINCSODESIGN_VERSION = 'winCodeSign-2.6.0';
const CACHE_DIR = path.join(os.homedir(), 'AppData', 'Local', 'electron-builder', 'Cache', 'winCodeSign');
const TARGET_DIR = path.join(CACHE_DIR, WINCSODESIGN_VERSION);
const ARCHIVE = path.join(CACHE_DIR, `${WINCSODESIGN_VERSION}.7z`);
const DOWNLOAD_URL = `https://github.com/electron-userland/electron-builder-binaries/releases/download/${WINCSODESIGN_VERSION}/${WINCSODESIGN_VERSION}.7z`;
const SEVEN_ZIP = path.join(__dirname, '..', 'node_modules', '7zip-bin', 'win', 'x64', '7za.exe');

// Check if already extracted (look for a Windows binary)
const marker = path.join(TARGET_DIR, 'windows-10', 'ia32', 'signtool.exe');
if (fs.existsSync(marker)) {
  console.log('winCodeSign cache already populated, skipping.');
  process.exit(0);
}

fs.mkdirSync(TARGET_DIR, { recursive: true });

// Download if not present
if (!fs.existsSync(ARCHIVE) || fs.statSync(ARCHIVE).size < 100000) {
  console.log(`Downloading ${WINCSODESIGN_VERSION}...`);
  execSync(`powershell -Command "Invoke-WebRequest -Uri '${DOWNLOAD_URL}' -OutFile '${ARCHIVE}'"`, { stdio: 'inherit' });
}

// Extract, ignoring errors from macOS symlinks
console.log(`Extracting ${WINCSODESIGN_VERSION} (macOS symlink errors are expected and ignored)...`);
try {
  execSync(`"${SEVEN_ZIP}" x -bd -y "${ARCHIVE}" "-o${TARGET_DIR}" -x!darwin`, { stdio: 'inherit' });
} catch (e) {
  // Non-zero exit due to symlinks — check if Windows files are there
  if (fs.existsSync(marker)) {
    console.log('Extraction completed (macOS symlink errors ignored, Windows files OK).');
  } else {
    console.error('Extraction failed and Windows signtool.exe not found.');
    process.exit(1);
  }
}

console.log('winCodeSign cache ready.');
