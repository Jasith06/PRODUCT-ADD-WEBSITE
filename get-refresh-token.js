// get-refresh-token.js
// Run this ONCE locally to get your refresh token
// Usage: node get-refresh-token.js

const { google } = require('googleapis');
const http = require('http');
const url = require('url');
const open = require('open');
const fs = require('fs');

// Read credentials from credentials.json
const credentials = JSON.parse(fs.readFileSync('credentials.json', 'utf8'));
const { client_id, client_secret } = credentials.installed;

const oauth2Client = new google.auth.OAuth2(
  client_id,
  client_secret,
  'http://localhost:3000/oauth2callback'
);

const scopes = [
  'https://www.googleapis.com/auth/drive.file'
];

// Generate auth URL
const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: scopes,
  prompt: 'consent' // Force to get refresh token
});

console.log('🚀 Starting OAuth2 flow...\n');
console.log('📋 Step 1: Opening browser for authorization...');
console.log('   If browser doesn\'t open, visit this URL:');
console.log('   ' + authUrl + '\n');

// Create a local server to receive the callback
const server = http.createServer(async (req, res) => {
  if (req.url.indexOf('/oauth2callback') > -1) {
    const qs = new url.URL(req.url, 'http://localhost:3000').searchParams;
    const code = qs.get('code');
    
    if (code) {
      res.end('✅ Authorization successful! You can close this window and return to the terminal.');
      
      try {
        const { tokens } = await oauth2Client.getToken(code);
        
        console.log('\n✅ Authorization successful!');
        console.log('\n📝 Add these environment variables to Vercel:\n');
        console.log('GOOGLE_CLIENT_ID=' + client_id);
        console.log('GOOGLE_CLIENT_SECRET=' + client_secret);
        console.log('GOOGLE_REFRESH_TOKEN=' + tokens.refresh_token);
        console.log('\n💡 Copy the above values to Vercel Dashboard → Settings → Environment Variables');
        console.log('💡 Then redeploy your application.\n');
        
        server.close();
        process.exit(0);
      } catch (error) {
        console.error('❌ Error getting tokens:', error);
        res.end('Error: ' + error.message);
        server.close();
        process.exit(1);
      }
    } else {
      res.end('❌ No authorization code received');
      server.close();
      process.exit(1);
    }
  }
});

server.listen(3000, () => {
  console.log('🌐 Local server started on http://localhost:3000\n');
  // Open browser automatically
  open(authUrl).catch(() => {
    console.log('⚠️ Could not open browser automatically. Please open the URL manually.');
  });
});

// Handle timeout
setTimeout(() => {
  console.log('\n⏱️ Timeout: No authorization received within 2 minutes');
  console.log('Please run the script again and authorize within 2 minutes.');
  server.close();
  process.exit(1);
}, 120000); // 2 minutes timeout
