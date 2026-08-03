/**
 * GOOGLE APPS SCRIPT FOR GOOGLE FORM TO WHATSAPP NOTIFICATION VIA OPENWA
 * 
 * SETUP INSTRUCTIONS:
 * 1. Open your Google Form (or the Google Sheet linked to your Form).
 * 2. Click on the 3 dots (Top Right) -> "Script editor" (or Extensions -> Apps Script in Google Sheet).
 * 3. Delete any default code in Code.gs and paste this entire code below.
 * 4. Update WEBHOOK_URL and SECRET_TOKEN variables below.
 * 5. Click "Save" (Disk Icon).
 * 6. Click "Triggers" (Clock Icon on the left sidebar).
 * 7. Click "+ Add Trigger" (bottom right button).
 * 8. Set options:
 *    - Choose which function to run: onFormSubmit
 *    - Choose which deployment should run: Head
 *    - Select event source: From form (or From spreadsheet)
 *    - Select event type: On form submit
 * 9. Click "Save" and authorize permissions when prompted.
 */

// CONFIGURATION: Set your webhook URL and secret token here
const WEBHOOK_URL = "https://pounce-matted-earthworm.ngrok-free.dev/api/webhook/google-form";
const SECRET_TOKEN = "MyPrivateKey99";

/**
 * Trigger function called automatically on Form Submit
 */
function onFormSubmit(e) {
  try {
    var formTitle = "Google Form Submission";
    var timestamp = new Date().toLocaleString();
    var responses = [];

    if (e && e.response) {
      // Triggered directly from Google Form
      try {
        var form = FormApp.getActiveForm();
        if (form) {
          formTitle = form.getTitle();
        }
      } catch (err) {
        formTitle = "Google Form";
      }

      var itemResponses = e.response.getItemResponses();
      for (var i = 0; i < itemResponses.length; i++) {
        var itemResponse = itemResponses[i];
        responses.push({
          question: itemResponse.getItem().getTitle(),
          answer: itemResponse.getResponse() ? itemResponse.getResponse().toString() : ""
        });
      }
      timestamp = e.response.getTimestamp().toLocaleString();

    } else if (e && e.values) {
      // Triggered from Google Sheet linked to Google Form
      var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
      formTitle = sheet.getName() + " Response";
      timestamp = e.values[0] || new Date().toLocaleString();

      var headers = sheet.getRange(1, 1, 1, e.values.length).getValues()[0];
      for (var j = 1; j < e.values.length; j++) {
        responses.push({
          question: headers[j] || "Field " + j,
          answer: e.values[j] || ""
        });
      }

    } else {
      // Fallback for manual test run inside Script Editor
      Logger.log("Running manual test...");
      formTitle = "Test Form Submission";
      responses = [
        { question: "Customer Name", answer: "John Doe" },
        { question: "Phone Number", answer: "+91 9876543210" },
        { question: "Requirement", answer: "Home Deep Cleaning Service" }
      ];
    }

    var payload = {
      formTitle: formTitle,
      timestamp: timestamp,
      secretToken: SECRET_TOKEN,
      responses: responses
    };

    var options = {
      method: "post",
      contentType: "application/json",
      headers: {
        "x-secret-token": SECRET_TOKEN
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    Logger.log("Sending payload to webhook: " + WEBHOOK_URL);
    var response = UrlFetchApp.fetch(WEBHOOK_URL, options);
    Logger.log("Webhook Response Code: " + response.getResponseCode());
    Logger.log("Webhook Response Body: " + response.getContentText());

  } catch (error) {
    Logger.log("Error in onFormSubmit: " + error.toString());
  }
}
