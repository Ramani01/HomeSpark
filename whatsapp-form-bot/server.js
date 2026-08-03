require('dotenv').config();
const express = require('express');
const cors = require('cors');
const qrcodeTerminal = require('qrcode-terminal');
const QRCode = require('qrcode');
const pino = require('pino');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');

const app = express();
const PORT = process.env.PORT || 5000;
const SECRET_TOKEN = process.env.SECRET_TOKEN || 'MyPrivateKey99';

app.use(cors());
app.use(express.json());

let isReady = false;
let qrCodeDataUrl = null;
let sock = null;

async function startBaileys() {
  console.log('🚀 Initializing Lightweight Baileys WhatsApp Client (30MB RAM)...');
  
  const { state, saveCreds } = await useMultiFileAuthState('baileys_auth_info');
  const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1015901307] }));

  sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\n==================================================');
      console.log('📱 SCAN THIS QR CODE WITH YOUR WHATSAPP PHONE:');
      console.log('==================================================\n');
      qrcodeTerminal.generate(qr, { small: true });
      console.log('👉 Or open the /qr page in your browser!');
      console.log('==================================================\n');

      QRCode.toDataURL(qr, (err, url) => {
        if (!err) qrCodeDataUrl = url;
      });
    }

    if (connection === 'close') {
      isReady = false;
      const statusCode = (lastDisconnect?.error)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log('⚠️ Connection closed due to', lastDisconnect?.error?.message || 'Disconnect', ', reconnecting:', shouldReconnect);
      if (shouldReconnect) {
        setTimeout(startBaileys, 3000);
      } else {
        console.log('❌ Logged out from WhatsApp. Clear auth folder to re-scan.');
      }
    } else if (connection === 'open') {
      isReady = true;
      qrCodeDataUrl = null;
      console.log('✅ WHATSAPP BOT IS CONNECTED AND READY! (30MB Lightweight Engine)');
    }
  });
}

startBaileys();

// Visual QR Code Page for browser viewing
app.get('/qr', (req, res) => {
  if (isReady) {
    return res.send(`
      <html>
        <body style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; font-family:sans-serif; background:#f0f2f5;">
          <div style="background:white; padding:40px; border-radius:15px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); text-align:center;">
            <h1 style="color:#25D366; font-size:32px;">✅ WhatsApp Connected & Ready!</h1>
            <p style="color:#555; font-size:18px;">Lightweight 30MB Baileys Bot is active 24/7 in the Cloud.</p>
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
            <p>Please wait 1-2 seconds while Baileys initializes.</p>
          </div>
          <script>setTimeout(() => location.reload(), 2000);</script>
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
        <script>setTimeout(() => location.reload(), 3000);</script>
      </body>
    </html>
  `);
});

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'online',
    whatsappConnected: isReady,
    engine: 'Baileys Lightweight 30MB',
    timestamp: new Date().toISOString()
  });
});

// Webhook Endpoint for Google Form Submissions
app.post('/api/webhook/google-form', async (req, res) => {
  try {
    require('dotenv').config({ override: true });
    const activeSecretToken = process.env.SECRET_TOKEN || 'MyPrivateKey99';
    const authHeader = req.headers['x-secret-token'] || req.query.token;
    const bodyToken = req.body.secretToken;

    if (authHeader !== activeSecretToken && bodyToken !== activeSecretToken) {
      console.warn('⚠️ Unauthorized webhook attempt with invalid secret token');
      return res.status(401).json({ success: false, error: 'Unauthorized: Invalid secret token' });
    }

    if (!isReady || !sock) {
      console.error('❌ Webhook received but WhatsApp client is not connected yet.');
      return res.status(503).json({ success: false, error: 'WhatsApp client is not connected. Scan QR code at /qr' });
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

    message += `\n⚡ *Automated notification via 24/7 Cloud Bot*`;

    const targetNumbers = (process.env.TARGET_NUMBERS || '')
      .split(',')
      .map(num => num.trim())
      .filter(Boolean);

    console.log(`\n📩 Received submission for "${formTitle}". Sending to WhatsApp numbers:`, targetNumbers);

    const sendPromises = targetNumbers.map(async (number) => {
      const cleanNum = number.replace(/[^0-9]/g, '');
      const formattedNum = `${cleanNum}@s.whatsapp.net`;
      try {
        await sock.sendMessage(formattedNum, { text: message });
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

// Keep-alive self-ping every 5 minutes so Render cloud server never sleeps
const SERVER_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
setInterval(() => {
  try {
    const clientHttp = SERVER_URL.startsWith('https') ? require('https') : require('http');
    clientHttp.get(`${SERVER_URL}/health`, (res) => {
      console.log('⏰ Keep-alive ping sent to keep server awake.');
    }).on('error', () => {});
  } catch (e) {}
}, 5 * 60 * 1000);

// Start Express Server
app.listen(PORT, () => {
  console.log(`🌐 Server running on http://localhost:${PORT}`);
  console.log(`📍 Webhook endpoint: http://localhost:${PORT}/api/webhook/google-form`);
  console.log(`📱 QR Code page: http://localhost:${PORT}/qr`);
});
