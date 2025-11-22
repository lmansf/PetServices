# Authentication Setup Guide

> **Note:** The legacy email/password sign-in experience has been removed while we rebuild authentication with Google SSO. The steps below describe the previous implementation and are retained for reference only.

## Overview
This authentication system uses:
- **Express.js** for API endpoints
- **bcrypt** for password hashing
- **Dropbox** for storing user credentials
- **Firebase Functions** for hosting the API

## Setup Instructions

### 1. Configure Dropbox Access Token
The authentication system needs a Dropbox access token to store user data. Set it up with:

```bash
firebase functions:config:set dropbox.access_token="YOUR_DROPBOX_ACCESS_TOKEN"
```

### 2. Create Dropbox Folder Structure
Make sure the following folder exists in your Dropbox:
```
All files/Apps/TestingForms/Trash A/
```

This is where user credentials will be stored as JSON files.

### 3. Deploy Firebase Functions
Deploy the authentication endpoints to Firebase:

```bash
firebase deploy --only functions
```

### 4. Update API URL
After deployment, Firebase will provide a URL for your function. It will look like:
```
https://YOUR-PROJECT-ID.cloudfunctions.net/auth
```

Update the `AUTH_API_URL` in `auth.js` with your actual URL:
```javascript
const AUTH_API_URL = 'https://YOUR-PROJECT-ID.cloudfunctions.net/auth';
```

## How It Works

### Sign Up Process
1. User enters email and password (minimum 8 characters)
2. Password is hashed using bcrypt with 10 salt rounds
3. User data is stored in Dropbox at: `/All files/Apps/TestingForms/Trash A/{email}.json`
4. File contains: email, passwordHash, and createdAt timestamp

### Sign In Process
1. User enters email and password
2. System retrieves user file from Dropbox
3. Password is compared with stored hash using bcrypt
4. On success, user session is stored in sessionStorage
5. User is redirected to home page

### Security Features
- Passwords are hashed with bcrypt (never stored in plain text)
- Email addresses are normalized (lowercase, trimmed)
- Duplicate accounts are prevented
- Password minimum length requirement (8 characters)
- Secure session management with sessionStorage

## Files Created

1. **functions/index.js** - Updated with authentication endpoints
2. **signin.html** - Authentication form (sign in/sign up)
3. **auth.js** - Client-side authentication logic
4. **AUTH_SETUP.md** - This setup guide

## API Endpoints

### POST /auth/signup
Creates a new user account.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Account created successfully",
  "email": "user@example.com"
}
```

### POST /auth/signin
Authenticates a user.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Signed in successfully",
  "email": "user@example.com"
}
```

## ✅ DEPLOYMENT COMPLETE

Your authentication system is now live at:
- **Auth API**: https://us-central1-amandaspetservices-55506.cloudfunctions.net/auth
- **Sign-in page**: https://amandaspetservices-55506.web.app/signin.html

## Testing Locally

To test the authentication system locally:

```bash
cd functions
npm run serve
```

This will start the Firebase emulator. Update `AUTH_API_URL` in `auth.js` to:
```javascript
const AUTH_API_URL = 'http://localhost:5001/amandaspetservices-55506/us-central1/auth';
```

## User Data Structure

Each user file in Dropbox contains:
```json
{
  "email": "user@example.com",
  "passwordHash": "$2b$10$...",
  "createdAt": "2025-11-16T12:00:00.000Z",
  "lastLoginAt": "2025-11-16T12:30:00.000Z"
}
```

## Session Management

After successful authentication:
- User email is stored in `sessionStorage`
- Use `window.authHelpers.checkAuth()` to verify login status
- Use `window.authHelpers.signOut()` to log out
- Use `window.authHelpers.getUserEmail()` to get current user

## Next Steps

1. Update `AUTH_API_URL` in `auth.js` after deployment
2. Test sign up and sign in functionality
3. Add authentication checks to protected pages
4. Consider implementing JWT tokens for enhanced security
5. Add password reset functionality if needed
