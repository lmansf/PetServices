const functions = require('firebase-functions');
const admin = require('firebase-admin');
const jwt = require('jsonwebtoken');
// node-fetch and express are no longer needed for the core auth/db logic
// but we keep admin initialized.

admin.initializeApp();
const db = admin.firestore();

const ADMIN_SETTINGS_DOC = 'config/adminSettings';
const DEFAULT_ADMIN_EMAILS = [
  'smansfld1@gmail.com',
  'lmansf96@gmail.com',
  'amansfld1@gmail.com'
];
const ADMIN_EMAIL_CACHE_TTL_MS = 5 * 60 * 1000;
const ADMIN_JWT_TTL_SECONDS = 30 * 60;

const resolvedAdminSecret = process.env.ADMIN_JWT_SECRET || functions.config()?.admin?.jwt_secret;
if (!resolvedAdminSecret) {
  console.warn('[admin] ADMIN_JWT_SECRET missing; falling back to development secret. Configure admin.jwt_secret before production deploy.');
}
const ADMIN_JWT_SECRET = resolvedAdminSecret || 'dev-only-admin-secret';

let cachedAdminEmails = null;
let cachedAdminFetchTs = 0;

const normalizeEmail = (email = '') => email.trim().toLowerCase();

async function readAdminSettings() {
  const docRef = db.doc(ADMIN_SETTINGS_DOC);
  const snapshot = await docRef.get();
  if (!snapshot.exists) {
    await docRef.set({
      emails: DEFAULT_ADMIN_EMAILS,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    return { emails: DEFAULT_ADMIN_EMAILS };
  }
  const data = snapshot.data() || {};
  if (!Array.isArray(data.emails)) {
    await docRef.set({ emails: DEFAULT_ADMIN_EMAILS }, { merge: true });
    return { emails: DEFAULT_ADMIN_EMAILS };
  }
  return data;
}

async function getAdminEmails() {
  const now = Date.now();
  if (Array.isArray(cachedAdminEmails) && now - cachedAdminFetchTs < ADMIN_EMAIL_CACHE_TTL_MS) {
    return cachedAdminEmails;
  }
  const settings = await readAdminSettings();
  cachedAdminEmails = (settings.emails || []).map(normalizeEmail);
  cachedAdminFetchTs = now;
  return cachedAdminEmails;
}

async function isAdminEmail(email) {
  if (!email) return false;
  const allowed = await getAdminEmails();
  return allowed.includes(normalizeEmail(email));
}

function signAdminJwt(uid, email) {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + ADMIN_JWT_TTL_SECONDS;
  const payload = { sub: uid, email, role: 'admin', iss: 'aps-admin', iat, exp };
  return { token: jwt.sign(payload, ADMIN_JWT_SECRET, { algorithm: 'HS256' }), expiresAt: exp };
}

function verifyAdminJwt(token) {
  try {
    return jwt.verify(token, ADMIN_JWT_SECRET, { algorithms: ['HS256'] });
  } catch (err) {
    console.error('[admin] token verification failed', err);
    throw new functions.https.HttpsError('permission-denied', 'Invalid admin token');
  }
}

async function ensureAdminAccess(context, options = {}) {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  }

  const uid = context.auth.uid;
  const email = normalizeEmail(context.auth.token.email || '');

  if (!email || !(await isAdminEmail(email))) {
    throw new functions.https.HttpsError('permission-denied', 'Not authorized');
  }

  if (options.requireJwt !== false) {
    const adminToken = options.token;
    if (!adminToken) {
      throw new functions.https.HttpsError('permission-denied', 'Missing admin token');
    }
    const decoded = verifyAdminJwt(adminToken);
    if (decoded.sub !== uid) {
      throw new functions.https.HttpsError('permission-denied', 'Admin token mismatch');
    }
  }

  return { uid, email };
}

// --------------------------------------------------------------------------
//  1. Issue Admin Token (Callable)
//  Returns a short-lived JWT for verified admin accounts.
// --------------------------------------------------------------------------
exports.issueAdminToken = functions.https.onCall(async (data, context) => {
  const { uid, email } = await ensureAdminAccess(context, { requireJwt: false });
  const { token, expiresAt } = signAdminJwt(uid, email);
  return { token, expiresAt };
});

// --------------------------------------------------------------------------
//  2. Submit Form / Create Profile
//  Saves user profile data to Firestore under the 'users' collection.
// --------------------------------------------------------------------------
exports.submitForm = functions.https.onCall(async (data, context) => {
  // Ensure the user is authenticated via Firebase Auth
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'You must be signed in to submit your profile.'
    );
  }

  try {
    const uid = context.auth.uid;
    const email = context.auth.token.email || data.email;
    
    // Prepare the data
    const profileData = {
      ...data,
      email: email, // Ensure email matches auth
      uid: uid,
      submittedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      profileComplete: true,
      providerAutoCreated: false
    };

    // Validate Discount Code (Simple check against a hardcoded list or DB)
    // For now, we'll keep the logic simple. You can add a 'discounts' collection later.
    if (data.discountCode) {
      const code = data.discountCode.trim().toUpperCase();
      // Example validation logic could go here
      profileData.discountCode = code;
    }

    // Save to Firestore: users/{uid}
    try {
      await db.collection('users').doc(uid).set(profileData, { merge: true });
    } catch (dbError) {
      console.error("Firestore write failed:", dbError);
      // Check for "NOT_FOUND" which usually means the database doesn't exist
      if (dbError.code === 5 || (dbError.message && dbError.message.includes('NOT_FOUND'))) {
        console.error("CRITICAL: Firestore database not found. Ensure the database is created in the Firebase Console.");
        throw new functions.https.HttpsError('internal', 'Database configuration error: Firestore not found.');
      }
      throw dbError;
    }

    return {
      success: true,
      message: 'Profile saved successfully!'
    };

  } catch (error) {
    console.error('Error in submitForm:', error);
    // Re-throw HTTPS errors as-is
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// --------------------------------------------------------------------------
//  3. Get User Profile
//  Retrieves the profile for the currently logged-in user.
// --------------------------------------------------------------------------
exports.getUserProfile = functions.https.onCall(async (data, context) => {
  // STRICT SECURITY: Only allow authenticated users to get THEIR OWN profile.
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'You must be signed in to view your profile.'
    );
  }

  const uid = context.auth.uid;

  try {
    const userRef = db.collection('users').doc(uid);
    const doc = await userRef.get();

    if (!doc.exists) {
      const email = context.auth.token.email || '';
      const displayName = context.auth.token.name || '';
      const baseProfile = {
        email,
        displayName,
        providerAutoCreated: true,
        profileComplete: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      await userRef.set(baseProfile, { merge: true });

      return {
        email,
        displayName,
        providerAutoCreated: true,
        profileComplete: false,
        profileDocumentExists: false
      };
    }

    const data = doc.data() || {};
    return {
      ...data,
      providerAutoCreated: !!data.providerAutoCreated,
      profileComplete: data.profileComplete === true,
      profileDocumentExists: true
    };

  } catch (error) {
    console.error('Error fetching profile:', error);
    throw new functions.https.HttpsError('internal', 'Unable to fetch profile');
  }
});

// --------------------------------------------------------------------------
//  4. Update User Profile
// --------------------------------------------------------------------------
exports.updateUserProfile = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  }

  const uid = context.auth.uid;
  const { updatedData } = data;

  try {
    await db.collection('users').doc(uid).set({
      ...updatedData,
      lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    return { success: true, message: 'Profile updated' };
  } catch (error) {
    console.error('Error updating profile:', error);
    throw new functions.https.HttpsError('internal', 'Failed to update profile');
  }
});

// --------------------------------------------------------------------------
//  5. Apply Promotion / Promocode
// --------------------------------------------------------------------------
exports.applyPromotionPasscode = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  }

  const uid = context.auth.uid;
  const { passcode } = data;
  
  // Simple validation logic (replace with DB lookup if needed)
  const validCodes = ['DOGMOM', 'VIP2025']; 
  const normalizedCode = (passcode || '').toUpperCase().trim();

  if (!validCodes.includes(normalizedCode)) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid passcode');
  }

  try {
    await db.collection('users').doc(uid).set({
      discountCode: normalizedCode,
      [`promotion_${normalizedCode}`]: true,
      lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    return { success: true, discountCode: normalizedCode };
  } catch (error) {
    console.error('Error applying code:', error);
    throw new functions.https.HttpsError('internal', 'Failed to apply code');
  }
});

// Backwards compatibility: keep old function name as an alias
exports.applyLoyaltyPasscode = exports.applyPromotionPasscode;

// --------------------------------------------------------------------------
//  6. Get All Users (Admin Only)
// --------------------------------------------------------------------------
exports.getAllUsers = functions.https.onCall(async (data, context) => {
  const payload = data || {};
  await ensureAdminAccess(context, { token: payload.adminToken });

  try {
    const snapshot = await db.collection('users').orderBy('submittedAt', 'desc').get();
    const users = [];
    snapshot.forEach(doc => {
      users.push({ id: doc.id, ...doc.data() });
    });
    return users;
  } catch (error) {
    console.error('Error fetching users:', error);
    throw new functions.https.HttpsError('internal', 'Failed to fetch users');
  }
});

// --------------------------------------------------------------------------
//  7. Admin Update User Profile
// --------------------------------------------------------------------------
exports.adminUpdateUserProfile = functions.https.onCall(async (data, context) => {
  const payload = data || {};
  await ensureAdminAccess(context, { token: payload.adminToken });

  const { targetUid, updatedData } = payload;
  if (!targetUid || !updatedData) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing targetUid or updatedData');
  }

  try {
    await db.collection('users').doc(targetUid).set({
      ...updatedData,
      lastAdminUpdate: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    return { success: true, message: 'User profile updated by admin' };
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw new functions.https.HttpsError('internal', 'Failed to update user profile');
  }
});

// Note: The 'auth' export (Express app) is removed because we are now using 
// Firebase Auth directly on the client side.
