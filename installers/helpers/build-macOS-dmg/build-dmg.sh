#!/usr/bin/env bash
# insall create-dmg from brew
# brew install create-dmg
# run bash -x build-dmg.sh 2>&1 | tee build-dmg.log 
# in the dir of this script to debug and build the DMG
set -euo pipefail

# Helper script to generate appicon.icns from installers/resources/icon-source.png
# and build a DMG from installers/instagram-cli-macOS/
# This script lives outside the DMG source folder so it can be reused and maintained
# independently from the files that go into the DMG.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
ICON_SRC="$REPO_ROOT/installers/resources/icon-source.png"
# Use a temporary iconset dir to avoid polluting the repo
ICONSET_DIR="$(mktemp -d "${TMPDIR:-/tmp}/ig-iconset.XXXXXX.iconset")"
DMG_SRC_DIR="$REPO_ROOT/installers/instagram-cli-macOS"
# If installer code was moved under src inside the DMG folder, ensure we copy that into DMG root
if [ -d "$DMG_SRC_DIR/src" ]; then
  echo "Installer source detected in $DMG_SRC_DIR/src"
  DMG_CONTENTS_DIR="$DMG_SRC_DIR/src"
else
  echo "Warning: expected installer source in $DMG_SRC_DIR/src not found; continuing using $DMG_SRC_DIR as DMG contents"
  DMG_CONTENTS_DIR="$DMG_SRC_DIR"
fi
OUTPUT_DMG="$DMG_SRC_DIR/instagram-cli-macOS.dmg"

ICON_FILES=("$DMG_SRC_DIR/appicon.icns" "$DMG_SRC_DIR/.VolumeIcon.icns" "$DMG_SRC_DIR/build-appicon.icns" "$REPO_ROOT/installers/build-appicon.icns")
# Always cleanup temp iconset and icon files on exit
trap 'rm -rf "$ICONSET_DIR"; rm -f "${ICON_FILES[@]}"' EXIT

echo "Repository root: $REPO_ROOT"

echo "Using DMG source folder: $DMG_SRC_DIR"

echo "DMG contents will be sourced from: $DMG_CONTENTS_DIR"

if [ ! -f "$ICON_SRC" ]; then
  echo "Error: icon source not found at $ICON_SRC"
  echo "Please place your 1024x1024 PNG at: $ICON_SRC"
  exit 1
fi

echo "Cleaning previous icon files in DMG folder..."
rm -f "$DMG_SRC_DIR/appicon.icns" "$DMG_SRC_DIR/.VolumeIcon.icns" "$DMG_SRC_DIR/build-appicon.icns" "$REPO_ROOT/installers/build-appicon.icns"
mkdir -p "$ICONSET_DIR"

echo "Generating iconset from $ICON_SRC"
sips -z 16 16     "$ICON_SRC" --out "$ICONSET_DIR/icon_16x16.png"
sips -z 32 32     "$ICON_SRC" --out "$ICONSET_DIR/icon_16x16@2x.png"
sips -z 32 32     "$ICON_SRC" --out "$ICONSET_DIR/icon_32x32.png"
sips -z 64 64     "$ICON_SRC" --out "$ICONSET_DIR/icon_32x32@2x.png"
sips -z 128 128   "$ICON_SRC" --out "$ICONSET_DIR/icon_128x128.png"
sips -z 256 256   "$ICON_SRC" --out "$ICONSET_DIR/icon_128x128@2x.png"
sips -z 256 256   "$ICON_SRC" --out "$ICONSET_DIR/icon_256x256.png"
sips -z 512 512   "$ICON_SRC" --out "$ICONSET_DIR/icon_256x256@2x.png"
sips -z 512 512   "$ICON_SRC" --out "$ICONSET_DIR/icon_512x512.png"
sips -z 1024 1024 "$ICON_SRC" --out "$ICONSET_DIR/icon_512x512@2x.png"

if ! command -v iconutil >/dev/null 2>&1; then
  echo "Error: iconutil not found. Please run on macOS with Xcode command line tools installed."
  exit 1
fi

# Validate iconset contents (required by iconutil)
REQUIRED_ICONS=(
  icon_16x16.png
  icon_16x16@2x.png
  icon_32x32.png
  icon_32x32@2x.png
  icon_128x128.png
  icon_128x128@2x.png
  icon_256x256.png
  icon_256x256@2x.png
  icon_512x512.png
  icon_512x512@2x.png
)
for rf in "${REQUIRED_ICONS[@]}"; do
  if [ ! -f "$ICONSET_DIR/$rf" ]; then
    echo "Error: missing required icon file: $ICONSET_DIR/$rf"
    ls -la "$ICONSET_DIR" || true
    exit 1
  fi
done

echo "Converting iconset to appicon.icns"
iconutil -c icns -o "$DMG_SRC_DIR/appicon.icns" "$ICONSET_DIR"
if [ ! -f "$DMG_SRC_DIR/appicon.icns" ]; then
  echo "Error: failed to create $DMG_SRC_DIR/appicon.icns"
  exit 1
fi

# Keep a persistent copy in installers/ to avoid accidental deletion during the build
cp -f "$DMG_SRC_DIR/appicon.icns" "$REPO_ROOT/installers/build-appicon.icns" || true
chmod 0644 "$REPO_ROOT/installers/build-appicon.icns" || true
# Also ensure the DMG source and contents have the .VolumeIcon copy
cp -f "$DMG_SRC_DIR/appicon.icns" "$DMG_SRC_DIR/.VolumeIcon.icns" || true
cp -f "$DMG_SRC_DIR/appicon.icns" "$DMG_CONTENTS_DIR/.VolumeIcon.icns" || true

# Diagnostic listing
echo "Created appicon files:" 
ls -la "$DMG_SRC_DIR/appicon.icns" "$REPO_ROOT/installers/build-appicon.icns" "$DMG_CONTENTS_DIR/.VolumeIcon.icns" 2>/dev/null || true

if command -v SetFile >/dev/null 2>&1; then
  # mark the .VolumeIcon.icns as having a custom icon and mark the folder so iconutil/hdiutil preserve it
  /usr/bin/SetFile -a C "$DMG_SRC_DIR/.VolumeIcon.icns" || true
  /usr/bin/SetFile -a C "$DMG_CONTENTS_DIR/.VolumeIcon.icns" || true
  /usr/bin/SetFile -a C "$DMG_SRC_DIR" || true
else
  echo "Warning: SetFile not available. Install Xcode command line tools (xcode-select --install) to ensure the DMG volume icon is set."
fi

# Ensure installer scripts are executable before packaging
echo "Making installer scripts executable..."
find "$DMG_CONTENTS_DIR" -name "*.command" -exec chmod +x {} +

# Build the Python wheel to be included in the DMG
echo "Building Python wheel..."
if ! python3 -m pip show build &>/dev/null; then
  echo "Installing Python 'build' package..."
  python3 -m pip install build
fi

# Define a directory for the wheel inside the DMG contents
WHEEL_DIR="$DMG_CONTENTS_DIR/dist"
mkdir -p "$WHEEL_DIR"

# Build the wheel directly into the prepared directory
python3 -m build --wheel --outdir "$WHEEL_DIR" "$REPO_ROOT"

# Find the generated wheel file
WHEEL_FILE=$(find "$WHEEL_DIR" -name "*.whl" | head -n 1)
if [ -z "$WHEEL_FILE" ]; then
  echo "Error: wheel file not found after build."
  exit 1
fi
echo "Successfully built wheel: $(basename "$WHEEL_FILE")"

    # Clean up build artifacts from repo root if they exist
    rm -rf "$REPO_ROOT/dist" "$REPO_ROOT/build" "$REPO_ROOT"/*.egg-info
    # NOTE: do NOT remove generated .icns files here — they are needed later when embedding
    # The trap defined at script start will remove temporary icon files on exit.
    if [ -f "$DMG_SRC_DIR/appicon.icns" ]; then
      echo "Debug: appicon exists? yes"
      ls -la "$DMG_SRC_DIR/appicon.icns" || true
      echo "appicon.icns xattr:"; xattr -l "$DMG_SRC_DIR/appicon.icns" 2>/dev/null || echo "(no xattr)"
    else
      echo "Debug: appicon exists? no"
    fi

echo "Listing DMG source dir contents for debugging:" 
ls -la "$DMG_SRC_DIR" || true
echo "Listing DMG contents dir (what will be packaged):"
ls -la "$DMG_CONTENTS_DIR" || true

# do not abort if icon missing; continue to try embedding later and print diagnostics
# Build DMG
if command -v create-dmg >/dev/null 2>&1; then
  echo "Using create-dmg to build $OUTPUT_DMG"
  
  # Remove old DMG if it exists, since --overwrite is not available in all versions
  rm -f "$OUTPUT_DMG"

  DMG_ARGS=(
    --volname "Instagram CLI Installer"
    --window-pos 200 120
    --window-size 800 400
    --icon-size 100
    --icon "install.command" 250 190
    --hide-extension "install.command"
    --icon "uninstall.command" 550 190
    --hide-extension "uninstall.command"
  )

  if [ -f "$DMG_SRC_DIR/background.png" ]; then
    DMG_ARGS+=(--background "$DMG_SRC_DIR/background.png")
  fi

  create-dmg \
    "${DMG_ARGS[@]}" \
    "$OUTPUT_DMG" \
    "$DMG_CONTENTS_DIR/"
else
  echo "create-dmg not found; falling back to hdiutil"
  echo "Building compressed DMG to $OUTPUT_DMG"
  # Create a read-write temp image, attach it, write files and metadata, then convert to compressed UDZO
  VOLNAME="Instagram CLI Installer"
  TEMP_RAW="$DMG_SRC_DIR/instagram-cli-raw.dmg"
  MOUNT_POINT="/Volumes/instagram-cli-temp"

  echo "Creating read-write DMG at $TEMP_RAW"
  # remove existing temp files if present
  rm -f "$TEMP_RAW"
  hdiutil create -size 100m -fs HFS+ -volname "$VOLNAME" -format UDRW -ov "$TEMP_RAW"

  echo "Attaching temp DMG at $MOUNT_POINT"
  mkdir -p "$MOUNT_POINT"
  ATTACH_OUT=$(hdiutil attach "$TEMP_RAW" -mountpoint "$MOUNT_POINT" -nobrowse -noverify -noautoopen -readwrite 2>&1) || (echo "$ATTACH_OUT"; exit 1)

  echo "Copying DMG source files into mounted image"
  # Use rsync to preserve metadata where possible
  rsync -a "$DMG_CONTENTS_DIR/" "$MOUNT_POINT/"

  echo "Installing volume icon inside mounted image"
  cp -f "$DMG_SRC_DIR/appicon.icns" "$MOUNT_POINT/.VolumeIcon.icns" || true
  if command -v SetFile >/dev/null 2>&1; then
    /usr/bin/SetFile -a C "$MOUNT_POINT/.VolumeIcon.icns" || true
    /usr/bin/SetFile -a C "$MOUNT_POINT" || true
  fi

  # Ensure installer scripts are executable at DMG root
  find "$MOUNT_POINT" -maxdepth 1 -name "*.command" -exec chmod +x {} + || true

  sync
  sleep 1

  echo "Detaching mounted image"
  hdiutil detach "$MOUNT_POINT" || hdiutil detach "$MOUNT_POINT" -force || true

  echo "Converting raw DMG to compressed UDZO: $OUTPUT_DMG"
  hdiutil convert "$TEMP_RAW" -format UDZO -imagekey zlib-level=9 -ov -o "$OUTPUT_DMG"

  echo "Cleaning up temp raw image"
  rm -f "$TEMP_RAW"
fi

if [ -f "$DMG_SRC_DIR/appicon.icns" ]; then
  # Prefer DeRez/Rez on PATH, but fall back to xcrun if available (Xcode toolchain)
  DEREZ_CMD=""
  REZ_CMD=""
  if command -v DeRez >/dev/null 2>&1; then
    DEREZ_CMD="DeRez"
  elif xcrun --find DeRez >/dev/null 2>&1; then
    DEREZ_CMD="xcrun DeRez"
  fi
  if command -v Rez >/dev/null 2>&1; then
    REZ_CMD="Rez"
  elif xcrun --find Rez >/dev/null 2>&1; then
    REZ_CMD="xcrun Rez"
  fi

  if [ -n "$DEREZ_CMD" ] && [ -n "$REZ_CMD" ] && command -v sips >/dev/null 2>&1; then
    echo "Embedding icon resource into $OUTPUT_DMG using: $DEREZ_CMD and $REZ_CMD"
    TMP_ICON="$(mktemp "${TMPDIR:-/tmp}/ig-dmg-icon.XXXXXX.icns")"
    ICON_RSRC="$(mktemp "${TMPDIR:-/tmp}/ig-dmg-icon.XXXXXX.rsrc")"
    cp -f "$DMG_SRC_DIR/appicon.icns" "$TMP_ICON"
    # Ensure resource fork info exists
    sips -i "$TMP_ICON" || true
    # Extract icns resource (use the resolved command)
    eval "$DEREZ_CMD -only icns \"$TMP_ICON\" > \"$ICON_RSRC\"" || true
    # Append resource to the flat DMG
    if eval "$REZ_CMD -append \"$ICON_RSRC\" -o \"$OUTPUT_DMG\""; then
      # Mark the dmg file as having a custom icon
      if command -v SetFile >/dev/null 2>&1; then
        /usr/bin/SetFile -a C "$OUTPUT_DMG" || true
      fi
      echo "Embedded icon into $OUTPUT_DMG"
    else
      echo "Warning: Rez failed to append icon resource to $OUTPUT_DMG"
    fi
    rm -f "$TMP_ICON" "$ICON_RSRC"
  else
    echo "Warning: DeRez/Rez (or xcrun) and sips not available; cannot embed icon into DMG file itself. Install Xcode command line tools."
    if command -v xcrun >/dev/null 2>&1; then
      echo "You can try: xcrun --find Rez && xcrun --find DeRez"
    fi
  fi
 fi

echo "DMG built at: $OUTPUT_DMG"

echo "Cleanup complete"

exit 0
