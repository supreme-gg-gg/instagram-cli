#!/bin/bash

set -euo pipefail

APP_NAME="instagram"
INSTALL_DIR="$HOME/.${APP_NAME}-cli"
LOCAL_BIN="$HOME/.local/bin/$APP_NAME"
PROFILE="$HOME/.zprofile"
EXPORT_LINE='export PATH="$HOME/.local/bin:$PATH"'

# Colors when running in a TTY
if [ -t 1 ]; then
  GREEN='\033[0;32m'
  YELLOW='\033[0;33m'
  RED='\033[0;31m'
  BLUE='\033[0;34m'
  BOLD='\033[1m'
  RESET='\033[0m'
else
  GREEN='' ; YELLOW='' ; RED='' ; BLUE='' ; BOLD='' ; RESET=''
fi

echo -e "${BOLD}${BLUE}1/3${RESET} Preparing to uninstall $APP_NAME"

read -p "Are you sure you want to uninstall $APP_NAME? This will remove the virtual environment and the symlink. (y/N): " confirm
if [[ "${confirm:-n}" != "y" ]]; then
  echo "Uninstall aborted by user."
  exit 0
fi

# Remove symlink
if [ -L "$LOCAL_BIN" ]; then
  rm -f "$LOCAL_BIN"
  echo "Removed symlink at $LOCAL_BIN"
else
  echo "No symlink found at $LOCAL_BIN"
fi

# Remove venv
if [ -d "$INSTALL_DIR" ]; then
  rm -rf "$INSTALL_DIR"
  echo "Removed virtual environment at $INSTALL_DIR"
else
  echo "No virtual environment found at $INSTALL_DIR"
fi

# Optionally remove PATH export from profile if it exists and no other tools rely on it
if [ -f "$PROFILE" ]; then
  if grep -Fxq "$EXPORT_LINE" "$PROFILE"; then
    echo "Found PATH export in $PROFILE. Leaving it in place to avoid removing entries other tools may need."
  fi
fi

echo -e "${GREEN}Uninstall complete.${RESET}"
