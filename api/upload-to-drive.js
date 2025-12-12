// api/upload-to-drive.js
// RECOMMENDED: Service Account Version (No manual authorization needed)

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

    // Check for Service Account credentials
    if (!process.env.GOOGLE_SERVICE_ACCOUNT) {
      return res.status(500).json({ 
        success: false, 
        error: 'Server not configured. Missing GOOGLE_SERVICE_ACCOUNT environment variable.' 
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

    // Authenticate with Service Account
    const auth = new google.auth.GoogleAuth({
      credentials: credentials,
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });

    const authClient = await auth.getClient();
    const drive = google.drive({ version: 'v3', auth: authClient });

    // Prepare file content
    const fileContent = JSON.stringify(jsonData, null, 2);
    const buffer = Buffer.from(fileContent, 'utf-8');

    // Create readable stream
    const { Readable } = require('stream');
    const stream = Readable.from(buffer);

    // File metadata
    const fileMetadata = {
      name: filename,
      mimeType: 'application/json',
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
