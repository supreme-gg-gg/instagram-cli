README — macOS Installer for instagram-cli

Overview

This folder contains a macOS installer package in the form of two executable shell scripts that make it easy for users to install and uninstall the instagram-cli command-line tool on macOS. The installer sets up a per-user virtual environment, installs the package from PyPI, and creates a symlink in ~/.local/bin so the command is available from any terminal session.

Repository

- GitHub: https://github.com/supreme-gg-gg/instagram-cli
- Main project page: https://github.com/supreme-gg-gg/instagram-cli

Contributing

Please see the project's contributing guide for development and contribution instructions: CONTRIBUTING.md

Files

- install.command — Guided installer script.
- uninstall.command — Guided uninstaller script.
- LICENSE — MIT license for these installer scripts.

Requirements

- macOS (Intel or Apple Silicon).
- zsh (default shell on modern macOS). The scripts use POSIX/bash compatible commands.
- Optional: Homebrew if Python 3 is not already installed.

Installation (Terminal)

1. Open Terminal.
2. Make the installer executable if it is not already:

   chmod +x /path/to/install.command

3. Run the installer:

   /path/to/install.command

The installer runs interactively and performs these steps:

- Detects or installs Python 3 (offers to install via Homebrew).
- Creates a virtual environment at ~/.instagram-cli-env.
- Activates the virtual environment and installs instagram-cli from PyPI.
- Creates ~/.local/bin (if needed) and symlinks the installed executable there.
- Ensures ~/.local/bin is on the user's PATH by appending an export to ~/.zprofile if necessary.

When distributing inside a DMG:

1. Mount the DMG by double-clicking the .dmg file.
2. Run the installer by double-clicking install.command in the mounted image (or run it from Terminal).
3. If macOS blocks execution, right-click -> Open -> Open in the security dialog.

Uninstallation

1. Make the uninstaller executable if it is not already:

   chmod +x /path/to/uninstall.command

2. Run the uninstaller:

   /path/to/uninstall.command

The uninstaller prompts for confirmation and then removes the symlink and the virtual environment. It does not automatically remove the PATH export from your profile to avoid breaking other tools.

Customization

- APP_NAME: The installer/uninstaller scripts define an APP_NAME variable near the top. Change this to match the package / entry point if you bundle a different CLI name.
- INSTALL_DIR: Default installation directory is ~/.<app>-env. Change the INSTALL_DIR variable to alter the location of the virtual environment.
- PROFILE: By default the scripts write the PATH export to ~/.zprofile. If your users use a different shell startup file, update the PROFILE variable.

Security and Best Practices

- Inspect the scripts before running them. The installer runs commands that may prompt for your password (Homebrew installation).
- The installer uses a per-user virtual environment; it does not require sudo and does not install system-wide Python packages.

Troubleshooting

Common Installation Issues

Conflicting Previous Installation

If you encounter an error like: ModuleNotFoundError: No module named 'instagram.api'

This typically means there's an old, broken installation on your system. The installer will automatically detect and replace conflicting installations, but if the automatic replacement fails, you can manually resolve it:

1. Find the conflicting installation:

   which instagram

2. Remove the old installation (example):

   sudo rm -f /Library/Frameworks/Python.framework/Versions/3.11/bin/instagram

3. Clear shell cache and test:

   hash -r
   instagram --version

General Troubleshooting

- If the command is not found after installation, open a new terminal session or run: source ~/.zprofile
- If pip install fails, check network connectivity and make sure the package name in APP_NAME is correct.

Custom icon and building a DMG

To have the DMG show a custom icon and have a nicer appearance, place your source PNG in installers/resources/ named icon-source.png (1024x1024 recommended). Use the helper script installers/helpers/build-macOS-dmg/build-dmg.sh to generate appicon.icns and build the DMG. Example:

chmod +x installers/helpers/build-macOS-dmg/build-dmg.sh
./installers/helpers/build-macOS-dmg/build-dmg.sh

Notes

- SetFile (to mark the volume icon) is provided by the Xcode command line tools: xcode-select --install.
- For a more polished DMG (background, icon layout, code signing, notarization), follow platform-specific guides and consider using create-dmg and Apple code signing tools.

License

These scripts are licensed under the MIT License. See LICENSE in this folder for details.

Contact

If you need further changes to the installer UX (for example, a graphical installer or notarized DMG), please open an issue or update the scripts and README with the requested behavior.
