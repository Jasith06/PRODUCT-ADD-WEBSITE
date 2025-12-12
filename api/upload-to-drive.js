// api/upload-to-drive.js
// Vercel Serverless Function for Google Drive Upload

const { google } = require('googleapis');

module.exports = async (req, res) => {
  // Enable CORS for all origins
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed. Use POST.' 
    });
  }

  try {
    // Parse request body
    const { jsonData, filename } = req.body;

    // Validate input
    if (!jsonData) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing jsonData in request body' 
      });
    }

    if (!filename) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing filename in request body' 
      });
    }

    // Check if credentials are available
    if (!process.env.GOOGLE_CREDENTIALS) {
      console.error('GOOGLE_CREDENTIALS environment variable not set');
      return res.status(500).json({ 
        success: false, 
        error: 'Server configuration error: Google credentials not configured' 
      });
    }

    // Parse Google credentials from environment variable
    let credentials;
    try {
      credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    } catch (parseError) {
      console.error('Failed to parse GOOGLE_CREDENTIALS:', parseError);
      return res.status(500).json({ 
        success: false, 
        error: 'Invalid Google credentials format' 
      });
    }

    // Authenticate with Google Drive using Service Account
    const auth = new google.auth.GoogleAuth({
      credentials: credentials,
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });

    const authClient = await auth.getClient();
    const drive = google.drive({ version: 'v3', auth: authClient });

    // Prepare file content
    const fileContent = JSON.stringify(jsonData, null, 2);
    const buffer = Buffer.from(fileContent, 'utf-8');

    // Create a readable stream from buffer
    const { Readable } = require('stream');
    const stream = Readable.from(buffer);

    // File metadata
    const fileMetadata = {
      name: filename,
      mimeType: 'application/json',
    };

    // Media object
    const media = {
      mimeType: 'application/json',
      body: stream,
    };

    console.log(`Uploading file: ${filename} (${buffer.length} bytes)`);

    // Upload file to Google Drive
    const file = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, webViewLink, name',
    });

    console.log(`File uploaded successfully. ID: ${file.data.id}`);

    // Make file publicly accessible (anyone with link can read)
    await drive.permissions.create({
      fileId: file.data.id,
      requestBody: {
        type: 'anyone',
        role: 'reader',
      },
    });

    console.log('File permissions set to public');

    // Generate direct download link
    const downloadLink = `https://drive.google.com/uc?export=download&id=${file.data.id}`;

    // Return success response
    return res.status(200).json({
      success: true,
      fileId: file.data.id,
      downloadLink: downloadLink,
      webViewLink: file.data.webViewLink,
      fileName: file.data.name,
      message: 'File uploaded successfully to Google Drive'
    });

  } catch (error) {
    // Log the full error for debugging
    console.error('Upload error:', error);
    console.error('Error stack:', error.stack);

    // Return error response
    return res.status(500).json({
      success: false,
      error: error.message || 'Unknown error occurred during upload',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};
