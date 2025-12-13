// api/upload-to-drive.js
// Service Account - Upload to YOUR shared folder

const { google } = require('googleapis');

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed' 
    });
  }

  try {
    const { jsonData, filename } = req.body;

    if (!jsonData || !filename) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing jsonData or filename' 
      });
    }

    // Check for required environment variables
    if (!process.env.GOOGLE_SERVICE_ACCOUNT) {
      return res.status(500).json({ 
        success: false, 
        error: 'GOOGLE_SERVICE_ACCOUNT not configured' 
      });
    }

    if (!process.env.GOOGLE_DRIVE_FOLDER_ID) {
      return res.status(500).json({ 
        success: false, 
        error: 'GOOGLE_DRIVE_FOLDER_ID not configured. Please add your shared folder ID to Vercel environment variables.' 
      });
    }

    // Parse Service Account credentials
    let credentials;
    try {
      credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
    } catch (parseError) {
      console.error('Failed to parse credentials:', parseError);
      return res.status(500).json({ 
        success: false, 
        error: 'Invalid credentials format' 
      });
    }

    console.log('Authenticating with service account:', credentials.client_email);

    // Authenticate with Service Account
    const auth = new google.auth.GoogleAuth({
      credentials: credentials,
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });

    const authClient = await auth.getClient();
    const drive = google.drive({ version: 'v3', auth: authClient });

    console.log('Authentication successful');

    // Prepare file content
    const fileContent = JSON.stringify(jsonData, null, 2);
    const buffer = Buffer.from(fileContent, 'utf-8');

    // Create readable stream
    const { Readable } = require('stream');
    const stream = Readable.from(buffer);

    // Upload to YOUR shared folder
    const fileMetadata = {
      name: filename,
      mimeType: 'application/json',
      parents: [process.env.GOOGLE_DRIVE_FOLDER_ID]  // Your folder ID from environment variable
    };

    const media = {
      mimeType: 'application/json',
      body: stream,
    };

    console.log(`Uploading ${filename} to folder ${process.env.GOOGLE_DRIVE_FOLDER_ID}...`);

    // Upload to Drive
    const file = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, webViewLink, name',
    });

    console.log(`File uploaded successfully! ID: ${file.data.id}`);

    // Make publicly accessible
    console.log('Setting public permissions...');
    await drive.permissions.create({
      fileId: file.data.id,
      requestBody: {
        type: 'anyone',
        role: 'reader',
      },
    });

    console.log('File is now public');

    const downloadLink = `https://drive.google.com/uc?export=download&id=${file.data.id}`;

    return res.status(200).json({
      success: true,
      fileId: file.data.id,
      downloadLink: downloadLink,
      webViewLink: file.data.webViewLink,
      fileName: file.data.name,
      message: 'File uploaded successfully!'
    });

  } catch (error) {
    console.error('Upload error:', error);
    console.error('Error message:', error.message);
    
    let errorMessage = error.message || 'Upload failed';
    let hint = '';
    
    if (error.message.includes('File not found') || error.message.includes('Insufficient permissions')) {
      errorMessage = 'Cannot access folder';
      hint = 'Make sure the folder is shared with your service account email: ' + 
             (process.env.GOOGLE_SERVICE_ACCOUNT ? JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT).client_email : 'unknown');
    } else if (error.message.includes('storage quota')) {
      errorMessage = 'Storage quota error';
      hint = 'Make sure you are uploading to a folder in YOUR Google Drive that is shared with the service account.';
    }
    
    return res.status(500).json({
      success: false,
      error: errorMessage,
      hint: hint,
      details: error.message
    });
  }
};
