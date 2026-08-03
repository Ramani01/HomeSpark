require('dotenv').config();
const express = require('express');
const cors = require('cors');
const qrcodeTerminal = require('qrcode-terminal');
const QRCode = require('qrcode');
const { Client, LocalAuth } = require('whatsapp-web.js');

const app = express();
const PORT = process.env.PORT || 5000;
const SECRET_TOKEN = process.env.SECRET_TOKEN || 'my_super_secret_token_123';
const TARGET_NUMBERS = (process.env.TARGET_NUMBERS || '')
  .split(',')
  .map(num => num.trim())
  .filter(Boolean);

app.use(cors());
app.use(express.json());

let isReady = false;
let qrCodeDataUrl = null;

// Initialize WhatsApp Web Client
console.log('🚀 Initializing WhatsApp Web Client...');

const client = new Client({
  authStrategy: new LocalAuth({ clientId: 'GOOGLE_FORM_BOT' }),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ]
  }
});

// QR Code Event - Generated instantly
client.on('qr', (qr) => {
  console.log('\n==================================================');
  console.log('📱 SCAN THIS QR CODE WITH YOUR WHATSAPP PHONE:');
  console.log('==================================================\n');
  qrcodeTerminal.generate(qr, { small: true });
  console.log('👉 Or open http://localhost:5000/qr in your browser!');
  console.log('==================================================\n');

  // Convert to Data URL for browser display
  QRCode.toDataURL(qr, (err, url) => {
    if (!err) qrCodeDataUrl = url;
  });
});

// Authenticated Event
client.on('authenticated', () => {
  console.log('🔑 WhatsApp Authenticated Successfully!');
});

// Ready Event
client.on('ready', () => {
  isReady = true;
  qrCodeDataUrl = null;
  console.log('✅ WHATSAPP BOT IS CONNECTED AND READY!');
});

client.on('disconnected', (reason) => {
  isReady = false;
  console.warn('⚠️ WhatsApp Disconnected:', reason);
});

client.initialize();

// QR Code Page Endpoint for browser viewing
app.get('/qr', (req, res) => {
  if (isReady) {
    return res.send(`
      <html>
        <body style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; font-family:sans-serif; background:#f0f2f5;">
          <div style="background:white; padding:40px; border-radius:15px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); text-align:center;">
            <h1 style="color:#25D366; font-size:32px;">✅ WhatsApp Connected & Ready!</h1>
            <p style="color:#555; font-size:18px;">Your bot is logged in and ready to send Google Form notifications.</p>
          </div>
        </body>
      </html>
    `);
  }

  if (!qrCodeDataUrl) {
    return res.send(`
      <html>
        <body style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; font-family:sans-serif; background:#f0f2f5;">
          <div style="background:white; padding:40px; border-radius:15px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); text-align:center;">
            <h2>⏳ Generating QR Code...</h2>
            <p>Please wait 3-5 seconds while WhatsApp initializes.</p>
          </div>
          <script>setTimeout(() => location.reload(), 3000);</script>
        </body>
      </html>
    `);
  }

  res.send(`
    <html>
      <head><title>Scan WhatsApp QR Code</title></head>
      <body style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; font-family:sans-serif; background:#f0f2f5;">
        <div style="background:white; padding:30px; border-radius:15px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); text-align:center;">
          <h1 style="color:#075e54; margin-bottom:5px;">📱 Link WhatsApp</h1>
          <p style="color:#555;">Open WhatsApp on phone $\\rightarrow$ <b>Linked Devices</b> $\\rightarrow$ <b>Link a Device</b></p>
          <img src="${qrCodeDataUrl}" style="width:280px; height:280px; margin:15px 0; border:4px solid #25D366; border-radius:10px; padding:10px;" />
          <p style="color:#888; font-size:12px;">Auto-reloads until connected...</p>
        </div>
        <script>setTimeout(() => location.reload(), 4000);</script>
      </body>
    </html>
  `);
});

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

    if (authHeader !== SECRET_TOKEN && bodyToken !== SECRET_TOKEN) {
      console.warn('⚠️ Unauthorized webhook attempt with invalid secret token');
      return res.status(401).json({ success: false, error: 'Unauthorized: Invalid secret token' });
    }

    if (!isReady) {
      console.error('❌ Webhook received but WhatsApp client is not connected yet.');
      return res.status(503).json({ success: false, error: 'WhatsApp client is not connected. Scan QR code at http://localhost:5000/qr' });
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

    message += `\n⚡ *Automated notification via WhatsApp Web*`;

    require('dotenv').config({ override: true });
    const targetNumbers = (process.env.TARGET_NUMBERS || '')
      .split(',')
      .map(num => num.trim())
      .filter(Boolean);

    console.log(`\n📩 Received submission for "${formTitle}". Sending to WhatsApp numbers:`, targetNumbers);

    const sendPromises = targetNumbers.map(async (number) => {
      const cleanNum = number.replace(/[^0-9]/g, '');
      const formattedNum = `${cleanNum}@c.us`;
      try {
        const result = await client.sendMessage(formattedNum, message);
        console.log(`✅ Message sent to ${formattedNum}: SUCCESS`);
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

// Start Express Server
app.listen(PORT, () => {
  console.log(`🌐 Server running on http://localhost:${PORT}`);
  console.log(`📍 Webhook endpoint: http://localhost:${PORT}/api/webhook/google-form`);
  console.log(`📱 QR Code page: http://localhost:${PORT}/qr`);
});
