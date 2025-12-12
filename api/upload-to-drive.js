// api/upload-to-drive.js
// Updated to use OAuth2 instead of Service Account

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
    if (!process.env.GOOGLE_REFRESH_TOKEN) {
      return res.status(500).json({ 
        success: false, 
        error: 'Server not configured. Please set GOOGLE_REFRESH_TOKEN environment variable.' 
      });
    }

    // OAuth2 Client Configuration
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || 'http://localhost'
    );

    // Set refresh token
    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN
    });

    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    // Prepare file content
    const fileContent = JSON.stringify(jsonData, null, 2);
    const buffer = Buffer.from(fileContent, 'utf-8');

    // Create readable stream
    const { Readable } = require('stream');
    const stream = Readable.from(buffer);

    // File metadata with folder location
    const fileMetadata = {
      name: filename,
      mimeType: 'application/json',
      parents: ['YOUR_FOLDER_ID_HERE'] // Add this line
    };

    const media = {
      mimeType: 'application/json',
      body: stream,
    };

    console.log(`Uploading ${filename}...`);

    // Upload to Drive
    const file = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, webViewLink, name',
    });

    console.log(`File uploaded: ${file.data.id}`);

    // Make publicly accessible
    await drive.permissions.create({
      fileId: file.data.id,
      requestBody: {
        type: 'anyone',
        role: 'reader',
      },
    });

    const downloadLink = `https://drive.google.com/uc?export=download&id=${file.data.id}`;

    return res.status(200).json({
      success: true,
      fileId: file.data.id,
      downloadLink: downloadLink,
      webViewLink: file.data.webViewLink,
      fileName: file.data.name,
    });

  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Upload failed',
    });
  }
};
