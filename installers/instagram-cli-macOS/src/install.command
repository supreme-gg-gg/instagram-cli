#!/bin/bash

set -euo pipefail

APP_NAME="instagram" 
INSTALL_DIR="$HOME/.${APP_NAME}-env"
LOCAL_BIN="$HOME/.local/bin"
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

# Find a compatible Python version (3.10, 3.11, or 3.12)
echo -e "${BOLD}${BLUE}1/6${RESET} Checking for a compatible Python 3 version (3.10-3.12)..."
PYTHON3=""
# Check for specific versions first, from newest to oldest compatible
for v in 12 11 10; do
  if command -v "python3.$v" &>/dev/null; then
    PYTHON3="$(command -v "python3.$v")"
    break
  fi
done

# Fallback to generic python3 if specific versions are not found
if [ -z "$PYTHON3" ]; then
  if command -v python3 &> /dev/null; then
    # Check if the generic python3 is within the compatible range
    PY_VERSION=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
    if [[ "$PY_VERSION" == "3.10" || "$PY_VERSION" == "3.11" || "$PY_VERSION" == "3.12" ]]; then
      PYTHON3=$(command -v python3)
    fi
  fi
fi

if [ -z "$PYTHON3" ]; then
  echo "No compatible Python version (3.10-3.12) found."

  read -p "Do you want to install Python 3.12 using Homebrew? (y/N): " confirm
  if [[ "${confirm:-n}" != "y" ]]; then
    echo "Exiting setup."
    exit 1
  fi

  # Check for Homebrew
  if ! command -v brew &> /dev/null; then
    echo "Installing Homebrew (this may prompt for your password)..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> "$HOME/.zprofile"
    eval "$(/opt/homebrew/bin/brew shellenv)"
  fi

  echo "Installing Python 3.12..."
  brew install python@3.12

  PYTHON3="$(brew --prefix)/opt/python@3.12/bin/python3.12"
fi

echo -e "${GREEN}Using Python at $PYTHON3${RESET}"

# Create venv
echo -e "${BOLD}${BLUE}2/6${RESET} Preparing installation directory: $INSTALL_DIR"
if [ -d "$INSTALL_DIR" ]; then
  read -p "An existing installation was found. Overwrite? (y/N): " confirm
  if [[ "${confirm:-n}" != "y" ]]; then
    echo "Installation aborted by user."
    exit 1
  fi
  rm -rf "$INSTALL_DIR"
fi

echo "Creating virtual environment..."
"$PYTHON3" -m venv "$INSTALL_DIR"
source "$INSTALL_DIR/bin/activate"

# Install package from the bundled wheel
echo -e "${BOLD}${BLUE}3/6${RESET} Installing package from bundled wheel"
pip install --upgrade pip setuptools wheel >/dev/null

# The wheel is in the 'dist' subdirectory of the installer contents
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WHEEL_FILE=$(find "$SCRIPT_DIR/dist" -name "*.whl" | head -n 1)

if [ -z "$WHEEL_FILE" ]; then
  echo -e "${RED}Error: could not find the wheel file in the installer.${RESET}"
  echo "The installer is corrupted or was not built correctly."
  exit 1
fi

if ! pip install "$WHEEL_FILE"; then
  echo -e "${RED}Failed to install $APP_NAME from the bundled wheel. Please check the logs for more details.${RESET}"
  exit 1
fi

# Check for conflicting installations and always replace them
echo -e "${BOLD}${BLUE}3.5/6${RESET} Checking for conflicting installations..."
# Find where the command is located, if anywhere, before we modify the PATH or create symlinks
EXISTING_PATH=""
if command -v "$APP_NAME" &>/dev/null; then
  EXISTING_PATH=$(command -v "$APP_NAME")
fi

# If a path was found AND it's not our new installation, it's a conflict that needs to be resolved
if [ -n "$EXISTING_PATH" ] && [[ "$EXISTING_PATH" != "$INSTALL_DIR/bin/$APP_NAME" ]] && [[ "$EXISTING_PATH" != "$LOCAL_BIN/$APP_NAME" ]]; then
  echo -e "${YELLOW}Found conflicting installation of '$APP_NAME' at: $EXISTING_PATH${RESET}"
  echo "This will be replaced with the new installation to avoid conflicts."
  
  # Always try to replace - first try without sudo, then with sudo if needed
  echo "Replacing $EXISTING_PATH with symlink to $INSTALL_DIR/bin/$APP_NAME..."
  if rm -f "$EXISTING_PATH" 2>/dev/null && ln -sf "$INSTALL_DIR/bin/$APP_NAME" "$EXISTING_PATH" 2>/dev/null; then
    echo -e "${GREEN}Successfully replaced $EXISTING_PATH with symlink to new installation.${RESET}"
  else
    # Need elevated permissions
    echo -e "${YELLOW}Replacement requires elevated permissions. Using sudo...${RESET}"
    if sudo rm -f "$EXISTING_PATH" && sudo ln -sf "$INSTALL_DIR/bin/$APP_NAME" "$EXISTING_PATH"; then
      echo -e "${GREEN}Successfully replaced $EXISTING_PATH with symlink to new installation (using sudo).${RESET}"
    else
      echo -e "${RED}Failed to replace $EXISTING_PATH automatically.${RESET}"
      echo "You can manually replace it with: sudo rm -f \"$EXISTING_PATH\" && sudo ln -sf \"$INSTALL_DIR/bin/$APP_NAME\" \"$EXISTING_PATH\""
    fi
  fi
  
  # Clear shell command cache so it picks up the new symlink
  if command -v hash &>/dev/null; then
    hash -r 2>/dev/null || true
  fi
elif [ -n "$EXISTING_PATH" ]; then
  echo "Found existing '$APP_NAME' at: $EXISTING_PATH (will be updated)"
fi

# Set up ~/.local/bin for symlink
echo -e "${BOLD}${BLUE}4/6${RESET} Creating user bin directory and symlink"
mkdir -p "$LOCAL_BIN"
ln -sf "$INSTALL_DIR/bin/$APP_NAME" "$LOCAL_BIN/$APP_NAME"

# Ensure the new command is available and preferred
CURRENT_CMD="$(command -v "$APP_NAME" 2>/dev/null || true)"
if [ -n "$CURRENT_CMD" ] && [ "$CURRENT_CMD" != "$INSTALL_DIR/bin/$APP_NAME" ] && [ "$CURRENT_CMD" != "$LOCAL_BIN/$APP_NAME" ]; then
  echo -e "${YELLOW}Note:${RESET} '$APP_NAME' still resolves to: $CURRENT_CMD"
  echo "Creating additional symlink in /usr/local/bin to ensure the new installation is preferred..."
  SUDO_TARGET="/usr/local/bin/$APP_NAME"
  # Create directory and symlink using sudo - link directly to the venv executable
  if sudo mkdir -p "/usr/local/bin" && sudo ln -sf "$INSTALL_DIR/bin/$APP_NAME" "$SUDO_TARGET"; then
    echo -e "${GREEN}Created $SUDO_TARGET pointing to the new installation.${RESET}"
    # Refresh shell command hash cache so the current shell picks up the change
    if command -v hash &>/dev/null; then
      hash -r 2>/dev/null || true
    fi
    echo "Now '$APP_NAME' resolves to: $(command -v "$APP_NAME" 2>/dev/null || echo 'not found')"
  else
    echo -e "${RED}Failed to create $SUDO_TARGET. You can run:${RESET}"
    echo -e "  ${BOLD}sudo ln -sf \"$INSTALL_DIR/bin/$APP_NAME\" \"$SUDO_TARGET\"${RESET}"
  fi
fi

# Compute and store a SHA-256 fingerprint for the installed executable
FINGERPRINT_FILE="$INSTALL_DIR/FINGERPRINT"
# Resolve target path; prefer which if available, otherwise use the symlink path we just created
TARGET_PATH="$(which "$APP_NAME" 2>/dev/null || echo "$LOCAL_BIN/$APP_NAME")"

# Choose a hashing command: prefer sha256sum, fallback to shasum -a 256 (macOS)
if command -v sha256sum &> /dev/null; then
  HASH_CMD="sha256sum"
elif command -v shasum &> /dev/null; then
  HASH_CMD="shasum -a 256"
else
  HASH_CMD=""
fi

if [ -n "$HASH_CMD" ]; then
  if [ -f "$TARGET_PATH" ]; then
    # compute only the hash value (first column)
    FINGERPRINT=$($HASH_CMD "$TARGET_PATH" 2>/dev/null | awk '{print $1}')
    if [ -n "$FINGERPRINT" ]; then
      echo "$FINGERPRINT" > "$FINGERPRINT_FILE"
      echo "Installed file fingerprint (sha256): $FINGERPRINT"
    else
      echo "Warning: failed to compute fingerprint for $TARGET_PATH"
    fi
  else
    echo "Warning: could not locate installed executable to fingerprint ($TARGET_PATH)"
  fi
else
  echo "Warning: no sha256 hashing tool available (sha256sum or shasum). Skipping fingerprint generation."
fi

# Add to PATH if needed
echo -e "${BOLD}${BLUE}5/6${RESET} Ensuring $LOCAL_BIN is on your PATH"
if [[ ":$PATH:" != *":$LOCAL_BIN:"* ]]; then
  if [ -f "$PROFILE" ]; then
    if ! grep -Fxq "$EXPORT_LINE" "$PROFILE"; then
      echo "$EXPORT_LINE" >> "$PROFILE"
      echo "Added $LOCAL_BIN to your PATH (via $PROFILE)"
    else
      echo "$LOCAL_BIN already configured in $PROFILE"
    fi
  else
    echo "$EXPORT_LINE" >> "$PROFILE"
    echo "Created $PROFILE and added $LOCAL_BIN to your PATH"
  fi
  # Make it available for the current shell session
  export PATH="$HOME/.local/bin:$PATH"
else
  echo "$LOCAL_BIN already in PATH for this session"
fi

# Final message
echo -e "${BOLD}${BLUE}6/6${RESET} Finalizing installation"

echo ""
echo -e "${GREEN}Done!${RESET} You can now run 'instagram' from any new terminal session."
echo "If it doesn't work immediately, run: source $PROFILE or open a new terminal."
echo "Runing 'instagram --version' to verify the installation."

instagram --version 

exit 0