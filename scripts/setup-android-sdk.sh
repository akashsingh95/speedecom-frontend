#!/bin/bash
set -e

echo "======================================"
echo "    Android SDK Setup Script"
echo "======================================"
echo "This script downloads and configures"
echo "the Android Command Line Tools."
echo "======================================"

# Determine install location
export ANDROID_HOME=$HOME/.android-sdk

echo "Checking if ANDROID_HOME exists at $ANDROID_HOME..."
if [ ! -d "$ANDROID_HOME" ]; then
    echo "Creating $ANDROID_HOME..."
    mkdir -p "$ANDROID_HOME"
fi

cd "$ANDROID_HOME"

# Check if cmdline-tools is already installed
if [ -d "cmdline-tools/latest/bin" ]; then
    echo "Android cmdline-tools already seems to be installed."
else
    echo "Downloading Android command line tools..."
    # URL from https://developer.android.com/studio#command-line-tools-only (Linux)
    wget -q --show-progress "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip" -O cmdline-tools.zip
    
    echo "Extracting tools..."
    unzip -q cmdline-tools.zip
    rm cmdline-tools.zip

    # The extracted folder is named cmdline-tools, but it needs to be inside a 'latest' directory
    # Structure needs to be: cmdline-tools/latest/bin
    mkdir -p cmdline-tools/latest
    mv cmdline-tools/bin cmdline-tools/latest/
    mv cmdline-tools/lib cmdline-tools/latest/
    mv cmdline-tools/source.properties cmdline-tools/latest/ 2>/dev/null || true
    mv cmdline-tools/NOTICE.txt cmdline-tools/latest/ 2>/dev/null || true
fi

# Set path temporarily for this script
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools

echo "Accepting SDK licenses (this might take a few seconds)..."
yes | sdkmanager --licenses > /dev/null

echo "Installing necessary SDK components (platforms, build-tools)..."
sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0" "platforms;android-35" "build-tools;35.0.0" "platforms;android-36"

echo "======================================"
echo "Setup Complete!"
echo "Please ensure ANDROID_HOME is set in your bashrc/zshrc if you want it globally accessible."
echo "======================================"
