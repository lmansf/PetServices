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

    // Validate discount code if provided (only if non-empty after trimming)
    let discountCodeValid = false;
    const trimmedDiscountCode = data.discountCode ? data.discountCode.trim() : '';
    
    if (trimmedDiscountCode !== '') {
      console.log('Checking discount code:', trimmedDiscountCode);
      
      // First, let's see what's at the root level to understand the folder structure
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
        
        // Look for Discounts folder in root
        const discountsFolder = rootContents.entries.find(e => 
          e['.tag'] === 'folder' && e.name.toLowerCase() === 'discounts'
        );
        
        if (discountsFolder) {
          console.log('Found Discounts folder at:', discountsFolder.path_lower);
          
          // Now list contents of Discounts folder
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
            
            // Check if discount code matches any folder name (case-insensitive)
            const matchingFolder = folderContents.entries.find(entry => 
              entry['.tag'] === 'folder' && 
              entry.name.toLowerCase() === trimmedDiscountCode.toLowerCase()
            );
            
            if (matchingFolder) {
              discountCodeValid = true;
              console.log('Valid discount code found:', matchingFolder.name);
            } else {
              console.log('No matching folder found for discount code:', trimmedDiscountCode);
            }
          }
        } else {
          console.log('Discounts folder not found in root');
        }
      } else {
        const errorData = await listRootResponse.text();
        console.log('List root folder error:', errorData);
      }
      
      // If discount code was provided but is invalid, throw error
      if (!discountCodeValid) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Invalid discount code provided'
        );
      }
    }

    // Add server timestamp and discount info
    const formData = {
      ...data,
      submittedAt: admin.firestore.Timestamp.now().toDate().toISOString(),
      serverProcessedAt: new Date().toISOString()
    };
    
    // Add discount code validation result to form data
    if (discountCodeValid && trimmedDiscountCode !== '') {
      formData[trimmedDiscountCode] = true;
    }
    
    // Remove the discountCode field from final submission (we're using the named field instead)
    delete formData.discountCode;

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
