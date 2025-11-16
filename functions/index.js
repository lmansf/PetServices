const functions = require('firebase-functions');
const admin = require('firebase-admin');
const fetch = require('node-fetch');
const express = require('express');
const bcrypt = require('bcrypt');

admin.initializeApp();

// Create Express app for authentication endpoints
const authApp = express();

// Manual CORS middleware - must be before other middleware
authApp.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.set('Access-Control-Max-Age', '3600');
  
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
  } else {
    next();
  }
});

authApp.use(express.json());

// Store your Dropbox credentials in Firebase environment config
// Run: firebase functions:config:set dropbox.access_token="YOUR_ACCESS_TOKEN"
// Run: firebase functions:config:set dropbox.app_key="YOUR_APP_KEY"
// Run: firebase functions:config:set dropbox.app_secret="YOUR_APP_SECRET"

exports.submitForm = functions.https.onCall(async (data, context) => {
  try {
    // Get Dropbox access token from environment config
    const accessToken = functions.config().dropbox?.access_token;
    
    if (!accessToken) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Dropbox access token not configured. Run: firebase functions:config:set dropbox.access_token="YOUR_TOKEN"'
      );
    }

    // Check if email already exists in form submissions
    const emailToCheck = data.email ? data.email.toLowerCase().trim() : '';
    if (emailToCheck) {
      console.log('Checking for existing email:', emailToCheck);
      
      // List all files in the form-submissions folder
      const listResponse = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          path: '/form-submissions',
          recursive: false
        })
      });

      if (listResponse.ok) {
        const folderContents = await listResponse.json();
        console.log(`Found ${folderContents.entries.length} existing submissions`);
        
        // Check each file for matching email
        for (const entry of folderContents.entries) {
          if (entry['.tag'] === 'file' && entry.name.endsWith('.json')) {
            // Download and check the file content
            const downloadResponse = await fetch('https://content.dropboxapi.com/2/files/download', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Dropbox-API-Arg': JSON.stringify({
                  path: entry.path_lower
                })
              }
            });
            
            if (downloadResponse.ok) {
              const fileContent = await downloadResponse.text();
              try {
                const existingData = JSON.parse(fileContent);
                const existingEmail = existingData.email ? existingData.email.toLowerCase().trim() : '';
                
                if (existingEmail === emailToCheck) {
                  console.log('Email already exists in submission:', entry.name);
                  throw new functions.https.HttpsError(
                    'already-exists',
                    'An account with this email address already exists. Please sign in with another account if you need to submit a different form.'
                  );
                }
              } catch (parseError) {
                // If it's our HttpsError, re-throw it
                if (parseError instanceof functions.https.HttpsError) {
                  throw parseError;
                }
                // Otherwise, just log and continue
                console.log('Could not parse file:', entry.name, parseError.message);
              }
            }
          }
        }
        console.log('Email is unique, proceeding with submission');
      } else {
        // If folder doesn't exist yet, that's okay - this is the first submission
        const errorData = await listResponse.text();
        console.log('List folder response (may be first submission):', errorData);
      }
    }

    // Add server timestamp and discount info
    const formData = {
      ...data,
      submittedAt: admin.firestore.Timestamp.now().toDate().toISOString(),
      serverProcessedAt: new Date().toISOString()
    };

    const rawDiscountCode = data.discountCode || '';
    const discountValidation = await validateDiscountCode(accessToken, rawDiscountCode);
    const userProvidedCode = rawDiscountCode.trim();

    if (userProvidedCode !== '' && !discountValidation.isValid) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Invalid discount code provided'
      );
    }

    if (discountValidation.isValid) {
      const canonicalName = discountValidation.canonicalName;
      formData[canonicalName] = true;
      formData.discountCode = canonicalName.toUpperCase();
    } else {
      delete formData.discountCode;
    }

    // Create filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `pet-services-form-${data.lastName || 'unknown'}-${timestamp}.json`;
    const filePath = `/form-submissions/${fileName}`;

    // Upload to Dropbox
    const response = await fetch('https://content.dropboxapi.com/2/files/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': JSON.stringify({
          path: filePath,
          mode: 'add',
          autorename: true,
          mute: false
        })
      },
      body: JSON.stringify(formData, null, 2)
    });

    if (!response.ok) {
      // Try to get error text (Dropbox may return plain text error)
      const errorText = await response.text();
      console.error('Dropbox API error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      
      let errorMessage = 'Failed to upload to Dropbox';
      try {
        const errorData = JSON.parse(errorText);
        errorMessage += ': ' + (errorData.error_summary || errorData.error || 'Unknown error');
      } catch (e) {
        errorMessage += ': ' + errorText.substring(0, 100);
      }
      
      throw new functions.https.HttpsError('internal', errorMessage);
    }

    const result = await response.json();

    return {
      success: true,
      dropboxPath: result.path_display,
      message: 'Form submitted successfully!'
    };

  } catch (error) {
    console.error('Error in submitForm:', error);
    
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// Helper function to interact with Dropbox
async function dropboxRequest(endpoint, options = {}) {
  const accessToken = functions.config().dropbox?.access_token;
  
  if (!accessToken) {
    throw new Error('Dropbox access token not configured');
  }

  const response = await fetch(`https://api.dropboxapi.com/2/${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      ...options.headers
    }
  });

  return response;
}

async function handleDropboxAccessIssue(response, res, contextLabel) {
  if (response.status !== 401) {
    return false;
  }

  let bodyText = '';
  try {
    bodyText = await response.text();
  } catch (err) {
    bodyText = '';
  }

  const isExpired = bodyText.includes('expired_access_token');
  console.error(`Dropbox auth issue while ${contextLabel}:`, bodyText || response.statusText);
  res.status(503).json({
    error: isExpired
      ? 'Taking a quick moment to refresh secure storage access. Please try again shortly.'
      : 'Unable to reach secure storage. Please try again in a minute.',
    code: isExpired ? 'DROPBOX_TOKEN_EXPIRED' : 'DROPBOX_AUTH_ERROR'
  });
  return true;
}

async function throwDropboxAccessIssue(response, contextLabel) {
  if (response.status !== 401) {
    return false;
  }

  let bodyText = '';
  try {
    bodyText = await response.text();
  } catch (err) {
    bodyText = '';
  }

  const isExpired = bodyText.includes('expired_access_token');
  console.error(`Dropbox auth issue while ${contextLabel}:`, bodyText || response.statusText);
  throw new functions.https.HttpsError(
    'failed-precondition',
    isExpired
      ? 'Taking a quick moment to refresh secure storage access. Please try again shortly.'
      : 'Unable to reach secure storage. Please try again in a minute.',
    {
      code: isExpired ? 'DROPBOX_TOKEN_EXPIRED' : 'DROPBOX_AUTH_ERROR',
      context: contextLabel
    }
  );
}

async function validateDiscountCode(accessToken, code) {
  const trimmedCode = (code || '').trim();
  if (trimmedCode === '') {
    return { isValid: false, canonicalName: '' };
  }

  console.log('Checking discount code:', trimmedCode);

  const listRootResponse = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      path: '',
      recursive: false
    })
  });

  if (listRootResponse.ok) {
    const rootContents = await listRootResponse.json();
    console.log('Root folder contents:', JSON.stringify(rootContents.entries.map(e => ({ name: e.name, tag: e['.tag'], path: e.path_lower }))));

    const discountsFolder = rootContents.entries.find(e =>
      e['.tag'] === 'folder' && e.name.toLowerCase() === 'discounts'
    );

    if (discountsFolder) {
      console.log('Found Discounts folder at:', discountsFolder.path_lower);

      const listDiscountsResponse = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          path: discountsFolder.path_lower,
          recursive: false
        })
      });

      if (listDiscountsResponse.ok) {
        const folderContents = await listDiscountsResponse.json();
        console.log('Discounts folder contents:', JSON.stringify(folderContents.entries.map(e => ({ name: e.name, tag: e['.tag'] }))));

        const matchingFolder = folderContents.entries.find(entry =>
          entry['.tag'] === 'folder' &&
          entry.name.toLowerCase() === trimmedCode.toLowerCase()
        );

        if (matchingFolder) {
          console.log('Valid discount code found:', matchingFolder.name);
          return { isValid: true, canonicalName: matchingFolder.name };
        }

        console.log('No matching folder found for discount code:', trimmedCode);
      } else {
        const errorData = await listDiscountsResponse.text().catch(() => '');
        console.log('List discounts folder error:', errorData || listDiscountsResponse.statusText);
      }
    } else {
      console.log('Discounts folder not found in root');
    }
  } else {
    const errorData = await listRootResponse.text().catch(() => '');
    console.log('List root folder error:', errorData || listRootResponse.statusText);
  }

  return { isValid: false, canonicalName: trimmedCode };
}

// Sign up endpoint
authApp.post('/signup', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const userFileName = `${normalizedEmail.replace(/[@.]/g, '_')}.json`;
    const userFilePath = `/All files/Apps/TestingForms/Trash A/${userFileName}`;

    // Check if user already exists
    const checkResponse = await dropboxRequest('files/get_metadata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: userFilePath })
    });

    if (await handleDropboxAccessIssue(checkResponse, res, 'checking for an existing user')) {
      return;
    }

    if (checkResponse.status === 200) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // Hash the password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Store user data
    const userData = {
      email: normalizedEmail,
      passwordHash,
      createdAt: new Date().toISOString()
    };

    const uploadResponse = await fetch('https://content.dropboxapi.com/2/files/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${functions.config().dropbox?.access_token}`,
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': JSON.stringify({
          path: userFilePath,
          mode: 'add',
          autorename: false
        })
      },
      body: JSON.stringify(userData, null, 2)
    });

    if (!uploadResponse.ok) {
      if (await handleDropboxAccessIssue(uploadResponse, res, 'saving the new user record')) {
        return;
      }
      const errorText = await uploadResponse.text();
      console.error('Dropbox upload error:', errorText);
      return res.status(500).json({ error: 'Failed to create user account' });
    }

    res.json({
      success: true,
      message: 'Account created successfully',
      email: normalizedEmail
    });

  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Sign in endpoint
authApp.post('/signin', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const userFileName = `${normalizedEmail.replace(/[@.]/g, '_')}.json`;
    const userFilePath = `/All files/Apps/TestingForms/Trash A/${userFileName}`;

    // Download user data from Dropbox
    const downloadResponse = await fetch('https://content.dropboxapi.com/2/files/download', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${functions.config().dropbox?.access_token}`,
        'Dropbox-API-Arg': JSON.stringify({ path: userFilePath })
      }
    });

    if (!downloadResponse.ok) {
      if (await handleDropboxAccessIssue(downloadResponse, res, 'loading the user record')) {
        return;
      }
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const userDataText = await downloadResponse.text();
    const userData = JSON.parse(userDataText);

    // Verify password
    const passwordMatch = await bcrypt.compare(password, userData.passwordHash);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Update last login time
    userData.lastLoginAt = new Date().toISOString();
    
    const uploadResponse = await fetch('https://content.dropboxapi.com/2/files/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${functions.config().dropbox?.access_token}`,
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': JSON.stringify({
          path: userFilePath,
          mode: 'overwrite'
        })
      },
      body: JSON.stringify(userData, null, 2)
    });

    if (!uploadResponse.ok) {
      if (await handleDropboxAccessIssue(uploadResponse, res, 'updating the last login time')) {
        return;
      }
      const errorText = await uploadResponse.text();
      console.error('Dropbox upload error during signin:', errorText);
      return res.status(500).json({ error: 'Failed to update last login' });
    }

    res.json({
      success: true,
      message: 'Signed in successfully',
      email: normalizedEmail
    });

  } catch (error) {
    console.error('Signin error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user profile data
exports.getUserProfile = functions.https.onCall(async (data, context) => {
  try {
    const { email } = data;

    if (!email) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Email is required'
      );
    }

    const accessToken = functions.config().dropbox?.access_token;
    
    if (!accessToken) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Dropbox access token not configured'
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // List all files in the form-submissions folder
    const listResponse = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        path: '/form-submissions',
        recursive: false
      })
    });

    if (!listResponse.ok) {
      if (listResponse.status === 409) {
        throw new functions.https.HttpsError('not-found', 'No profile data found');
      }
      await throwDropboxAccessIssue(listResponse, 'listing profile submissions');
      const errorText = await listResponse.text().catch(() => '');
      console.error('Dropbox error while listing profile submissions:', errorText || listResponse.statusText);
      throw new functions.https.HttpsError('internal', 'Unable to load profile data');
    }

    const folderContents = await listResponse.json();
    
    // Search through files to find matching email
    for (const entry of folderContents.entries) {
      if (entry['.tag'] === 'file' && entry.name.endsWith('.json')) {
        // Download and check the file content
        const downloadResponse = await fetch('https://content.dropboxapi.com/2/files/download', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Dropbox-API-Arg': JSON.stringify({
              path: entry.path_lower
            })
          }
        });
        
        if (!downloadResponse.ok) {
          if (downloadResponse.status === 409) {
            continue;
          }
          await throwDropboxAccessIssue(downloadResponse, 'downloading profile submission');
          const errorText = await downloadResponse.text().catch(() => '');
          console.error(`Dropbox download error for ${entry.name}:`, errorText || downloadResponse.statusText);
          continue;
        }

        const fileContent = await downloadResponse.text();
        try {
          const profileData = JSON.parse(fileContent);
          const profileEmail = profileData.email ? profileData.email.toLowerCase().trim() : '';
          
          if (profileEmail === normalizedEmail) {
            // Found the matching profile!
            return profileData;
          }
        } catch (parseError) {
          console.log('Could not parse file:', entry.name, parseError.message);
          continue;
        }
      }
    }

    // If no profile found
    throw new functions.https.HttpsError(
      'not-found',
      'No profile data found for this email'
    );

  } catch (error) {
    console.error('Error in getUserProfile:', error);
    
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// Update user profile data
exports.updateUserProfile = functions.https.onCall(async (data, context) => {
  try {
    const { email, updatedData } = data;

    if (!email || !updatedData) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Email and updated data are required'
      );
    }

    const accessToken = functions.config().dropbox?.access_token;
    
    if (!accessToken) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Dropbox access token not configured'
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // List all files in the form-submissions folder
    const listResponse = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        path: '/form-submissions',
        recursive: false
      })
    });

    if (!listResponse.ok) {
      if (listResponse.status === 409) {
        throw new functions.https.HttpsError('not-found', 'No profile data found');
      }
      await throwDropboxAccessIssue(listResponse, 'listing profile submissions for update');
      const errorText = await listResponse.text().catch(() => '');
      console.error('Dropbox error while listing submissions for update:', errorText || listResponse.statusText);
      throw new functions.https.HttpsError('internal', 'Unable to load profile data for update');
    }

    const folderContents = await listResponse.json();
    
    // Search through files to find matching email
    for (const entry of folderContents.entries) {
      if (entry['.tag'] === 'file' && entry.name.endsWith('.json')) {
        // Download and check the file content
        const downloadResponse = await fetch('https://content.dropboxapi.com/2/files/download', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Dropbox-API-Arg': JSON.stringify({
              path: entry.path_lower
            })
          }
        });
        
        if (!downloadResponse.ok) {
          if (downloadResponse.status === 409) {
            continue;
          }
          await throwDropboxAccessIssue(downloadResponse, 'downloading profile submission for update');
          const errorText = await downloadResponse.text().catch(() => '');
          console.error(`Dropbox download error for ${entry.name}:`, errorText || downloadResponse.statusText);
          continue;
        }

        const fileContent = await downloadResponse.text();
        try {
          const profileData = JSON.parse(fileContent);
          const profileEmail = profileData.email ? profileData.email.toLowerCase().trim() : '';
          
          if (profileEmail === normalizedEmail) {
            // Found the matching profile! Now update it
            const mergedData = {
              ...profileData,
              ...updatedData,
              lastUpdatedAt: new Date().toISOString()
            };

            // Upload updated data back to Dropbox
            const uploadResponse = await fetch('https://content.dropboxapi.com/2/files/upload', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/octet-stream',
                'Dropbox-API-Arg': JSON.stringify({
                  path: entry.path_lower,
                  mode: 'overwrite'
                })
              },
              body: JSON.stringify(mergedData, null, 2)
            });

            if (!uploadResponse.ok) {
              await throwDropboxAccessIssue(uploadResponse, 'saving updated profile');
              const errorText = await uploadResponse.text().catch(() => '');
              console.error('Dropbox upload error:', errorText || uploadResponse.statusText);
              throw new functions.https.HttpsError('internal', 'Failed to update profile');
            }

            return {
              success: true,
              message: 'Profile updated successfully'
            };
          }
        } catch (parseError) {
          console.log('Could not parse file:', entry.name, parseError.message);
          continue;
        }
      }
    }

    // If no profile found
    throw new functions.https.HttpsError(
      'not-found',
      'No profile data found for this email'
    );

  } catch (error) {
    console.error('Error in updateUserProfile:', error);
    
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
    throw new functions.https.HttpsError('internal', error.message);
  }
});

exports.applyLoyaltyPasscode = functions.https.onCall(async (data, context) => {
  try {
    const { email, passcode } = data || {};

    if (!email || !passcode || !passcode.trim()) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Email and passcode are required'
      );
    }

    const accessToken = functions.config().dropbox?.access_token;

    if (!accessToken) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Dropbox access token not configured'
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const validation = await validateDiscountCode(accessToken, passcode);

    if (!validation.isValid) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Invalid discount code provided'
      );
    }

    const canonicalCode = validation.canonicalName;
    const uppercaseCode = canonicalCode.toUpperCase();

    const listResponse = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        path: '/form-submissions',
        recursive: false
      })
    });

    if (!listResponse.ok) {
      if (listResponse.status === 409) {
        throw new functions.https.HttpsError('not-found', 'No profile data found');
      }
      await throwDropboxAccessIssue(listResponse, 'listing profile submissions for loyalty passcode update');
      const errorText = await listResponse.text().catch(() => '');
      console.error('Dropbox error while listing submissions for loyalty passcode update:', errorText || listResponse.statusText);
      throw new functions.https.HttpsError('internal', 'Unable to load profile data for loyalty update');
    }

    const folderContents = await listResponse.json();

    for (const entry of folderContents.entries) {
      if (entry['.tag'] === 'file' && entry.name.endsWith('.json')) {
        const downloadResponse = await fetch('https://content.dropboxapi.com/2/files/download', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Dropbox-API-Arg': JSON.stringify({
              path: entry.path_lower
            })
          }
        });

        if (!downloadResponse.ok) {
          if (downloadResponse.status === 409) {
            continue;
          }
          await throwDropboxAccessIssue(downloadResponse, 'downloading profile submission for loyalty passcode update');
          const errorText = await downloadResponse.text().catch(() => '');
          console.error(`Dropbox download error for ${entry.name}:`, errorText || downloadResponse.statusText);
          continue;
        }

        const fileContent = await downloadResponse.text();

        try {
          const profileData = JSON.parse(fileContent);
          const profileEmail = profileData.email ? profileData.email.toLowerCase().trim() : '';

          if (profileEmail === normalizedEmail) {
            const mergedData = {
              ...profileData,
              discountCode: uppercaseCode,
              lastUpdatedAt: new Date().toISOString()
            };

            mergedData[canonicalCode] = true;
            mergedData[uppercaseCode] = true;

            const uploadResponse = await fetch('https://content.dropboxapi.com/2/files/upload', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/octet-stream',
                'Dropbox-API-Arg': JSON.stringify({
                  path: entry.path_lower,
                  mode: 'overwrite'
                })
              },
              body: JSON.stringify(mergedData, null, 2)
            });

            if (!uploadResponse.ok) {
              await throwDropboxAccessIssue(uploadResponse, 'saving loyalty passcode update');
              const errorText = await uploadResponse.text().catch(() => '');
              console.error('Dropbox upload error:', errorText || uploadResponse.statusText);
              throw new functions.https.HttpsError('internal', 'Failed to update loyalty passcode');
            }

            return {
              success: true,
              discountCode: uppercaseCode
            };
          }
        } catch (parseError) {
          console.log('Could not parse file:', entry.name, parseError.message);
          continue;
        }
      }
    }

    throw new functions.https.HttpsError(
      'not-found',
      'No profile data found for this email'
    );

  } catch (error) {
    console.error('Error in applyLoyaltyPasscode:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError('internal', error.message);
  }
});

// Export the Express app as a Firebase Function with CORS wrapper
exports.auth = functions.https.onRequest((req, res) => {
  // Set CORS headers at the Firebase Function level
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  
  // Pass to Express app
  authApp(req, res);
});
