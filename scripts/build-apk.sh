#!/bin/bash
set -e

# Ensure we are running from the client directory
cd "$(dirname "$0")/.."
CLIENT_DIR=$(pwd)

# Cleanup function to restore backup config even if script fails
function cleanup {
    if [ -f "$CLIENT_DIR/capacitor.config.json.bak" ]; then
        mv "$CLIENT_DIR/capacitor.config.json.bak" "$CLIENT_DIR/capacitor.config.json"
        echo "Restored original capacitor.config.json"
    fi
}
trap cleanup EXIT

echo "======================================"
echo "    Capacitor Android APK Builder"
echo "======================================"

# 1. Setup Environment
# Look for Android SDK if ANDROID_HOME isn't set
if [ -z "$ANDROID_HOME" ]; then
    if [ -d "$HOME/.android-sdk" ]; then
        export ANDROID_HOME="$HOME/.android-sdk"
    else
        echo "ERROR: ANDROID_HOME is not set and ~/.android-sdk does not exist."
        echo "Please run the setup-android-sdk.sh script first."
        exit 1
    fi
fi
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools

# 2. Check for .env.production
if [ ! -f ".env.production" ]; then
    echo "WARNING: .env.production file not found in the client directory."
    echo "Are you sure you want to build without it? Variables like VITE_API_URL might be missing."
    echo "Sleeping for 5 seconds... Press Ctrl+C to abort."
    sleep 5
fi

# 3. Configure Capacitor to point to production client (Bypass CORS)
echo "--- Configuring Capacitor Server URL ---"
if [ -f ".env.production" ]; then
    # Extract VITE_API_URL safely
    VITE_API_URL=$(grep '^VITE_API_URL=' .env.production | cut -d '=' -f2 | tr -d '\r')
    if [ -n "$VITE_API_URL" ]; then
        # Assuming the base URL is before /api and the client is served at /client/
        BASE_URL=${VITE_API_URL%/api*}
        CLIENT_URL="${BASE_URL}/client/"
        echo "Detected Production Client URL: $CLIENT_URL"
        
        # Backup original config
        cp capacitor.config.json capacitor.config.json.bak
        
        # Inject server.url and allowNavigation into capacitor.config.json using Node.js
        node -e "
const fs = require('fs');
const config = JSON.parse(fs.readFileSync('capacitor.config.json', 'utf8'));
const urlObj = new URL('$CLIENT_URL');
config.server = { 
    url: '$CLIENT_URL', 
    cleartext: true,
    allowNavigation: [
        urlObj.hostname,
        '*.' + urlObj.hostname
    ]
};
fs.writeFileSync('capacitor.config.json', JSON.stringify(config, null, 2));
"
        echo "Successfully updated capacitor.config.json to point to $CLIENT_URL"
    else
        echo "WARNING: VITE_API_URL not found in .env.production. Proceeding with local web assets."
    fi
else
    echo "WARNING: .env.production not found. Proceeding with local web assets."
fi

# 4. Build Vite App (Required to ensure dist exists for Capacitor)
echo "--- Building Web App ---"
npm run build

# 5. Sync Capacitor
echo "--- Syncing Capacitor to Android ---"
npx cap sync android

# 6. Build APK via Gradle
echo "--- Building APK via Gradle ---"
cd android
./gradlew assembleDebug

echo "======================================"
echo "Build Successful!"
echo "Your APK should be located at:"
echo "client/android/app/build/outputs/apk/debug/app-debug.apk"
echo "======================================"
