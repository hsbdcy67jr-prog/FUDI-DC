#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ "$(uname -m)" != "arm64" ]]; then
  echo "Build this app on an Apple Silicon Mac; Intel Macs are out of scope." >&2
  exit 1
fi

swift build --package-path macos --configuration release
BIN="$ROOT/macos/.build/arm64-apple-macosx/release/FUDI-DC"
APP="$ROOT/dist/FUDI-DC.app"
rm -rf "$APP" "$ROOT/dist/FUDI-DC.dmg"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources/Web"
cp "$BIN" "$APP/Contents/MacOS/FUDI-DC"
cp index.html app.js notebook.js catalog.js api-config.js workbench.js styles.css "$APP/Contents/Resources/Web/"

cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleExecutable</key><string>FUDI-DC</string>
  <key>CFBundleIdentifier</key><string>com.fudidc.app</string>
  <key>CFBundleName</key><string>FUDI-DC</string>
  <key>CFBundleDisplayName</key><string>FUDI-DC</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>1.0.0</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>LSMinimumSystemVersion</key><string>14.0</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>NSPrincipalClass</key><string>NSApplication</string>
  <key>LSApplicationCategoryType</key><string>public.app-category.education</string>
  <key>NSAppTransportSecurity</key><dict><key>NSAllowsArbitraryLoads</key><false/></dict>
</dict></plist>
PLIST

codesign --force --deep --sign - "$APP"
mkdir -p "$ROOT/dist/dmg"
cp -R "$APP" "$ROOT/dist/dmg/"
hdiutil create -volname "FUDI-DC" -srcfolder "$ROOT/dist/dmg" -ov -format UDZO "$ROOT/dist/FUDI-DC.dmg"
rm -rf "$ROOT/dist/dmg"
echo "Created dist/FUDI-DC.dmg (Apple Silicon, unsigned/not notarized)."
