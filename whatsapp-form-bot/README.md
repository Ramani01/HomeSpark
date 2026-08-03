# 🚀 Google Form to WhatsApp Notification Automation (using OpenWA)

Automatically receive instant WhatsApp notifications whenever a customer fills out your Google Form using **OpenWA** (`@open-wa/wa-automate`) and **Google Apps Script**.

---

## 📁 Project Structure

```
whatsapp-form-bot/
├── package.json          # Node.js project configuration & dependencies
├── server.js            # Express server & OpenWA WhatsApp integration
├── .env                 # Environment configuration (Port, Phone, Token)
├── .env.example         # Template environment file
├── GoogleAppsScript.gs  # Google Apps Script code to paste into Google Forms
└── README.md            # Setup guide
```

---

## 🛠️ Step 1: Install & Configure Node.js Server

1. Open your terminal in the `whatsapp-form-bot` directory:
   ```bash
   cd whatsapp-form-bot
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure your `.env` file:
   - Edit `.env` and set `TARGET_NUMBERS` to your WhatsApp phone number with country code ending in `@c.us` (e.g. `919876543210@c.us` for India +91 9876543210).
   - Set a custom `SECRET_TOKEN` (e.g. `my_super_secret_token_123`).

4. Start the OpenWA Server:
   ```bash
   npm start
   ```

5. **Authenticate WhatsApp**:
   - On first startup, Chrome/Chromium browser window or QR code will appear.
   - Open WhatsApp on your mobile phone -> **Linked Devices** -> **Link a Device**.
   - Scan the QR code. Once scanned, you'll see:
     `✅ OpenWA WhatsApp Client Connected & Ready!`

---

## 🌐 Step 2: Make Your Local Server Public (using Ngrok)

Because Google Forms runs on Google's cloud servers, it needs a public URL to reach your local server.

1. Download & Install [Ngrok](https://ngrok.com/) (or use `npx localtunnel`).
2. Run ngrok pointing to port 3000:
   ```bash
   ngrok http 3000
   ```
3. Copy your HTTPS Forwarding URL (e.g. `https://abc1-23-45-67-89.ngrok-free.app`).
4. Your complete Webhook URL will be:
   `https://abc1-23-45-67-89.ngrok-free.app/api/webhook/google-form`

---

## 📝 Step 3: Set Up Google Apps Script in Google Form

1. Open your **Google Form**.
2. Click the **3 dots** icon (top-right next to Send button) -> Select **Script editor** (or open the linked Google Sheet -> **Extensions** -> **Apps Script**).
3. Paste the entire code from [`GoogleAppsScript.gs`](./GoogleAppsScript.gs) into `Code.gs`.
4. Update the two variables at the top:
   ```javascript
   const WEBHOOK_URL = "https://YOUR-NGROK-URL.ngrok-free.app/api/webhook/google-form";
   const SECRET_TOKEN = "my_super_secret_token_123";
   ```
5. Click **Save** (disk icon).

---

## ⏰ Step 4: Add the Form Submit Trigger

1. In Google Apps Script Editor, click **Triggers** (Clock icon on the left navigation bar).
2. Click **+ Add Trigger** (bottom right button).
3. Configure the trigger parameters:
   - **Choose which function to run:** `onFormSubmit`
   - **Choose which deployment should run:** `Head`
   - **Select event source:** `From form` (or `From spreadsheet`)
   - **Select event type:** `On form submit`
4. Click **Save**.
5. Grant permissions if Google asks for authorization.

---

## 🧪 Step 5: Test the Automation

### Method A: Test via Terminal (cURL / PowerShell)
You can test your server directly without filling the form:
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/webhook/google-form" -Method Post -Headers @{"x-secret-token"="my_super_secret_token_123"} -ContentType "application/json" -Body '{"formTitle":"Test Contact Form","timestamp":"2026-08-03 14:45:00","responses":[{"question":"Full Name","answer":"Jane Doe"},{"question":"Phone","answer":"+919876543210"},{"question":"Message","answer":"Hello from OpenWA!"}]}'
```

### Method B: Live Google Form Test
1. Fill out your live Google Form as a customer.
2. Submit the form.
3. Check your WhatsApp — you will instantly receive a formatted WhatsApp notification!

---

## 🔒 Security & Best Practices
- **Secret Token**: Only requests with the correct `x-secret-token` header will be processed by your webhook server.
- **Session Persistence**: OpenWA saves session data in `_sessions/` so you don't need to scan the QR code every time you restart the server.
- **Cloud Deployment**: For 24/7 continuous operation without keeping your computer on, host `whatsapp-form-bot` on a VPS (Ubuntu/Debian) or cloud service (Railway, Render, DigitalOcean).
