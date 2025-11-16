# Dropbox Integration Setup Guide

## Step 1: Install Firebase Functions Dependencies

Run this command in your terminal:

```powershell
cd functions; npm install; cd ..
```

## Step 2: Configure Your Dropbox App Key

You mentioned you have an app key. Here's where to use it:

### Option A: Using Access Token (Simpler, but less secure)

If you generated an access token from the Dropbox App Console, use this command:

```powershell
firebase functions:config:set dropbox.access_token="YOUR_ACCESS_TOKEN_HERE"
```

Replace `YOUR_ACCESS_TOKEN_HERE` with your actual Dropbox access token.

### Option B: Using OAuth Flow (More secure, recommended for production)

If you want to use the app key and secret for OAuth:

```powershell
firebase functions:config:set dropbox.app_key="YOUR_APP_KEY_HERE"
firebase functions:config:set dropbox.app_secret="YOUR_APP_SECRET_HERE"
firebase functions:config:set dropbox.access_token="YOUR_ACCESS_TOKEN_HERE"
```

**Note:** For now, Option A (access token) is the quickest way to get started.

## Step 3: Deploy Firebase Functions

```powershell
firebase deploy --only functions
```

## Step 4: Test Your Form

1. Open your website
2. Fill out the form at `/firstform.html`
3. Submit it
4. Check your Dropbox `/form-submissions/` folder for the JSON file

## Step 5: View Configuration (Optional)

To see your current configuration:

```powershell
firebase functions:config:get
```

## Troubleshooting

### If you get "Dropbox access token not configured":
- Make sure you ran the `firebase functions:config:set` command
- Deploy functions again: `firebase deploy --only functions`

### If you get authentication errors:
- Check that your Dropbox access token is valid
- Make sure your Dropbox app has `files.content.write` permission enabled

### To remove/update configuration:
```powershell
firebase functions:config:unset dropbox.access_token
firebase functions:config:set dropbox.access_token="NEW_TOKEN"
firebase deploy --only functions
```

## Security Notes

✅ Your Dropbox credentials are now stored securely in Firebase's environment config
✅ They are never exposed in your client-side code
✅ Form submissions are also backed up to Firebase Firestore
✅ Only authenticated requests can trigger the function

## What Happens When a Form is Submitted:

1. Form data is sent to Firebase Cloud Function
2. Function uploads JSON file to Dropbox `/form-submissions/` folder
3. Function also saves a copy to Firebase Firestore (backup)
4. User receives success message
5. Form is reset

## File Naming Convention:

Files are saved as: `pet-services-form-[LastName]-[Timestamp].json`

Example: `pet-services-form-Smith-2025-11-16T14-30-45-123Z.json`
