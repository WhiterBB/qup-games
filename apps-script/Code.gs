/**
 * Team counter for Quality Games.
 *
 * Setup:
 * 1. In your Google Form: Responses tab -> "Link to Sheets".
 * 2. Open that Sheet -> Extensions -> Apps Script, paste this file.
 * 3. Deploy -> New deployment -> type "Web app"
 *      Execute as: Me   |   Who has access: Anyone
 * 4. Copy the /exec URL into CONFIG.COUNT_ENDPOINT in main.js.
 *
 * Only a number is exposed, never the responses.
 * Assumes one form response (one row) per team.
 */
function doGet() {
  const cache = CacheService.getScriptCache();
  let count = cache.get('count');
  if (count === null) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0]; // "Form Responses 1"
    count = String(Math.max(0, sheet.getLastRow() - 1)); // minus header row
    cache.put('count', count, 30); // seconds
  }
  return ContentService
    .createTextOutput(JSON.stringify({ count: Number(count) }))
    .setMimeType(ContentService.MimeType.JSON);
}
