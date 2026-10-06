# 📱 Super Simple Guide to Building the SpeedEcom Mobile App

Welcome! This guide is written so that **anyone** can build the Android App (APK) for SpeedEcom in just a few clicks. 

You don't need to be a programmer or know how to use complex tools like Android Studio. Just follow these easy steps! 🚀

---

## Step 1: Get Your Computer Ready (Just Once!)

Before we build the app, your computer needs a helper tool called **Java**. Think of it as the engine that builds Android apps.

1. Open your **Terminal** (the black command screen).
2. Copy and paste this exact command, then press **Enter**:
   ```bash
   sudo apt-get update && sudo apt-get install -y openjdk-21-jdk unzip wget
   ```
*(If it asks for a password, type your computer password. You won't see the letters as you type, but it's working!)*

---

## Step 2: Download Android Tools 🛠️

Now we need the official Android tools. We made a magic script that does all the boring downloading for you!

1. Make sure your terminal is open inside the `client` folder.
2. Type this and press **Enter**:
   ```bash
   npm run setup:android
   ```
☕ *Sit back and relax! This will download everything needed and automatically accept all of Google's long software licenses.*

---

## Step 3: Tell the App Where Your Website Is 🔗

The mobile app needs to know your live website address so it can connect to it securely.

1. In the `client` folder, type this to create a special settings file:
   ```bash
   cp .env.production.example .env.production
   ```
2. Open that new `.env.production` file in any text editor.
3. You will see a line that looks like this:
   `VITE_API_URL=https://speedecomsolution.com/api`
4. Make sure that link is exactly right for your website!

*(Don't worry about anything else! The script is super smart and will automatically hook up the app to your website securely.)*

---

## Step 4: Build the App! 🏗️

This is the fun part. Let's make the actual app!

1. In your terminal, type:
   ```bash
   npm run build:apk
   ```

**What is happening?**
The computer is doing all the heavy lifting. It's packaging your website, putting it inside an Android shell, and converting it into an `.apk` file that phones can understand. This might take a minute or two.

---

## Step 5: Put It On Your Phone! 📲

When the screen says **"Build Successful!"**, you are done! 🥳

You will find your brand new app file hiding right here:
👉 `client/android/app/build/outputs/apk/debug/app-debug.apk`

**How to get it on your phone:**
1. Send the `app-debug.apk` file to your Android phone (you can email it to yourself, use a USB cable, Google Drive, or WhatsApp).
2. Open the file on your phone.
3. Your phone might say "For your security, your phone is not allowed to install unknown apps". 
   - Tap **Settings** 
   - Turn on **"Allow from this source"**
4. Tap **Install**, and then open your shiny new SpeedEcom app! 🎉

---

## 🚑 Uh oh! Something went wrong? (Troubleshooting)

**Q: My app opens, but it's just a blank white screen!**
* **Fix:** Double-check your `.env.production` file from Step 3. Ensure the URL is spelled perfectly and your live website is actually working on the internet!

**Q: The terminal says "invalid source release: 21" when building!**
* **Fix:** Your computer didn't use the correct Java engine. Make sure you ran the command in Step 1 exactly as written to install `openjdk-21-jdk`.

**Q: The app opens but looks broken or is showing old stuff!**
* **Fix:** Completely uninstall the old app from your phone, and then install the new `app-debug.apk` again.
