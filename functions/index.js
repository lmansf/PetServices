const functions = require('firebase-functions');
const admin = require('firebase-admin');
// node-fetch and express are no longer needed for the core auth/db logic
// but we keep admin initialized.

admin.initializeApp();
const db = admin.firestore();

// --------------------------------------------------------------------------
//  1. Submit Form / Create Profile
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
      profileComplete: true
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
//  2. Get User Profile
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
    const doc = await db.collection('users').doc(uid).get();
    
    if (!doc.exists) {
      // If no profile exists yet, return basic info from Auth
      // We can safely use context.auth.token here
      return {
        email: context.auth.token.email,
        displayName: context.auth.token.name || '',
        profileComplete: false
      };
    }

    return doc.data();

  } catch (error) {
    console.error('Error fetching profile:', error);
    throw new functions.https.HttpsError('internal', 'Unable to fetch profile');
  }
});

// --------------------------------------------------------------------------
//  3. Update User Profile
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
//  4. Apply Loyalty Passcode
// --------------------------------------------------------------------------
exports.applyLoyaltyPasscode = functions.https.onCall(async (data, context) => {
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
      [`loyalty_${normalizedCode}`]: true,
      lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    return { success: true, discountCode: normalizedCode };
  } catch (error) {
    console.error('Error applying code:', error);
    throw new functions.https.HttpsError('internal', 'Failed to apply code');
  }
});

// --------------------------------------------------------------------------
//  Helper: Check Admin Privileges
// --------------------------------------------------------------------------
function checkAdmin(context) {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  }
  const adminEmails = ['amansfld@gmail.com', 'lmansf96@gmail.com'];
  const userEmail = context.auth.token.email || '';
  
  if (!adminEmails.includes(userEmail.toLowerCase())) {
     throw new functions.https.HttpsError('permission-denied', 'Not authorized');
  }
}

// --------------------------------------------------------------------------
//  5. Get All Users (Admin Only)
// --------------------------------------------------------------------------
exports.getAllUsers = functions.https.onCall(async (data, context) => {
  checkAdmin(context);

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
//  6. Admin Update User Profile
// --------------------------------------------------------------------------
exports.adminUpdateUserProfile = functions.https.onCall(async (data, context) => {
  checkAdmin(context);

  const { targetUid, updatedData } = data;
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
