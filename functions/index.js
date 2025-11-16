const functions = require('firebase-functions');
const admin = require('firebase-admin');
const fetch = require('node-fetch');

admin.initializeApp();

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

    // Add server timestamp
    const formData = {
      ...data,
      submittedAt: admin.firestore.Timestamp.now().toDate().toISOString(),
      serverProcessedAt: new Date().toISOString()
    };

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
