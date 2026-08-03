require('dotenv').config();
const express = require('express');
const cors = require('cors');
const wa = require('@open-wa/wa-automate');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_TOKEN = process.env.SECRET_TOKEN || 'my_super_secret_token_123';
const TARGET_NUMBERS = (process.env.TARGET_NUMBERS || '')
  .split(',')
  .map(num => num.trim())
  .filter(Boolean);

app.use(cors());
app.use(express.json());

let waClient = null;
let isReady = false;

// Initialize OpenWA Client
function startOpenWAServer() {
  console.log('🚀 Initializing OpenWA WhatsApp Client...');
  
  wa.create({
    sessionId: 'GOOGLE_FORM_BOT',
    multiDevice: true,
    authTimeout: 60,
    blockCrashLogs: true,
    disableSpins: true,
    headless: false,
    logConsole: false,
    popup: false,
    qrTimeout: 0,
    useChrome: true
  })
  .then(client => {
    waClient = client;
    isReady = true;
    console.log('✅ OpenWA WhatsApp Client Connected & Ready!');

    // Handle state changes
    client.onStateChanged(state => {
      console.log('🔄 WhatsApp State Changed:', state);
      if (state === 'CONFLICT' || state === 'UNLAUNCHED') client.forceRefocus();
    });
  })
  .catch(err => {
    console.error('❌ Failed to start OpenWA Client:', err);
  });
}

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'online',
    whatsappConnected: isReady,
    timestamp: new Date().toISOString()
  });
});

// Webhook Endpoint for Google Form Submissions
app.post('/api/webhook/google-form', async (req, res) => {
  try {
    const authHeader = req.headers['x-secret-token'] || req.query.token;
    const bodyToken = req.body.secretToken;

    // Validate Secret Token
    if (authHeader !== SECRET_TOKEN && bodyToken !== SECRET_TOKEN) {
      console.warn('⚠️ Unauthorized webhook attempt with invalid secret token');
      return res.status(401).json({ success: false, error: 'Unauthorized: Invalid secret token' });
    }

    if (!isReady || !waClient) {
      console.error('❌ Webhook received but WhatsApp client is not connected yet.');
      return res.status(503).json({ success: false, error: 'WhatsApp client is initializing. Try again shortly.' });
    }

    const { formTitle, timestamp, responses } = req.body;

    if (!responses || !Array.isArray(responses)) {
      return res.status(400).json({ success: false, error: 'Invalid payload. "responses" array is required.' });
    }

    // Format WhatsApp Message
    let message = `📋 *NEW GOOGLE FORM SUBMISSION*\n\n`;
    message += `📌 *Form:* ${formTitle || 'Google Form'}\n`;
    message += `⏰ *Submitted At:* ${timestamp || new Date().toLocaleString()}\n\n`;
    message += `📝 *Responses:*\n`;

    responses.forEach((item, index) => {
      message += `• *${item.question || `Question ${index + 1}`}:* ${item.answer || 'N/A'}\n`;
    });

    message += `\n⚡ *Automated notification via OpenWA*`;

    console.log(`\n📩 Received new submission for "${formTitle}". Sending to WhatsApp numbers:`, TARGET_NUMBERS);

    // Send WhatsApp Message to configured target numbers
    const sendPromises = TARGET_NUMBERS.map(async (number) => {
      // Ensure number ends with @c.us for OpenWA standard format
      const formattedNum = number.endsWith('@c.us') ? number : `${number}@c.us`;
      try {
        const result = await waClient.sendText(formattedNum, message);
        console.log(`✅ Message sent to ${formattedNum}:`, result ? 'SUCCESS' : 'FAILED');
        return { number: formattedNum, status: 'success' };
      } catch (sendErr) {
        console.error(`❌ Failed sending to ${formattedNum}:`, sendErr.message);
        return { number: formattedNum, status: 'error', error: sendErr.message };
      }
    });

    const results = await Promise.all(sendPromises);

    return res.json({
      success: true,
      message: 'Notification processing completed',
      results
    });

  } catch (error) {
    console.error('❌ Error processing webhook:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Start Express Server & OpenWA
app.listen(PORT, () => {
  console.log(`🌐 Server running on http://localhost:${PORT}`);
  console.log(`📍 Webhook endpoint: http://localhost:${PORT}/api/webhook/google-form`);
  startOpenWAServer();
});
