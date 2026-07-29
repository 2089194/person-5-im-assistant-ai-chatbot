const fs = require("fs");
const path = require("path");

const TOKENS_PATH = path.join(__dirname, "..", "..", "tokens.json");
const AUTHORITY = "https://login.microsoftonline.com/common/oauth2/v2.0";
const GRAPH = "https://graph.microsoft.com/v1.0";
const SCOPES = ["offline_access", "User.Read", "Mail.Send", "Calendars.ReadWrite"].join(" ");

function isConfigured() {
  return !!(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET && process.env.MICROSOFT_REDIRECT_URI);
}

function isConnected() {
  return fs.existsSync(TOKENS_PATH);
}

function getAuthUrl() {
  const params = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID,
    response_type: "code",
    redirect_uri: process.env.MICROSOFT_REDIRECT_URI,
    response_mode: "query",
    scope: SCOPES,
    prompt: "consent"
  });
  return `${AUTHORITY}/authorize?${params.toString()}`;
}

async function handleOAuthCallback(code) {
  const body = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID,
    client_secret: process.env.MICROSOFT_CLIENT_SECRET,
    redirect_uri: process.env.MICROSOFT_REDIRECT_URI,
    grant_type: "authorization_code",
    code
  });
  const res = await fetch(`${AUTHORITY}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  const tokens = await res.json();
  if (tokens.error) throw new Error(tokens.error_description || tokens.error);
  tokens.obtained_at = Date.now();
  fs.writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2));
  return tokens;
}

async function refreshTokens(tokens) {
  const body = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID,
    client_secret: process.env.MICROSOFT_CLIENT_SECRET,
    redirect_uri: process.env.MICROSOFT_REDIRECT_URI,
    grant_type: "refresh_token",
    refresh_token: tokens.refresh_token
  });
  const res = await fetch(`${AUTHORITY}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  const newTokens = await res.json();
  if (newTokens.error) throw new Error(newTokens.error_description || newTokens.error);
  newTokens.obtained_at = Date.now();
  // refresh responses sometimes omit refresh_token if unchanged
  if (!newTokens.refresh_token) newTokens.refresh_token = tokens.refresh_token;
  fs.writeFileSync(TOKENS_PATH, JSON.stringify(newTokens, null, 2));
  return newTokens;
}

async function getAccessToken() {
  if (!isConnected()) throw new Error("Outlook is not connected yet. Visit /auth/microsoft to connect.");
  let tokens = JSON.parse(fs.readFileSync(TOKENS_PATH, "utf-8"));
  const ageSeconds = (Date.now() - (tokens.obtained_at || 0)) / 1000;
  const expiresIn = tokens.expires_in || 3600;
  if (ageSeconds > expiresIn - 120) {
    tokens = await refreshTokens(tokens);
  }
  return tokens.access_token;
}

async function graphFetch(endpoint, options = {}) {
  const accessToken = await getAccessToken();
  const res = await fetch(`${GRAPH}${endpoint}`, {
    ...options,
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  if (res.status === 204) return null;
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "Microsoft Graph error");
  return data;
}

async function listEvents(timeMin, timeMax) {
  const params = new URLSearchParams({ startDateTime: timeMin, endDateTime: timeMax });
  const data = await graphFetch(`/me/calendarview?${params.toString()}`, {
    headers: { Prefer: 'outlook.timezone="UTC"' }
  });
  return (data.value || []).map(e => ({
    summary: e.subject,
    start: e.start?.dateTime,
    end: e.end?.dateTime
  }));
}

async function createEvent({ summary, description, start, end, attendees }) {
  const data = await graphFetch("/me/events", {
    method: "POST",
    body: JSON.stringify({
      subject: summary,
      body: { contentType: "Text", content: description || "" },
      start: { dateTime: start, timeZone: "UTC" },
      end: { dateTime: end, timeZone: "UTC" },
      attendees: (attendees || []).map(email => ({ emailAddress: { address: email }, type: "required" }))
    })
  });
  return { id: data.id, webLink: data.webLink };
}

async function sendEmail({ to, subject, body }) {
  await graphFetch("/me/sendMail", {
    method: "POST",
    body: JSON.stringify({
      message: {
        subject,
        body: { contentType: "Text", content: body },
        toRecipients: [{ emailAddress: { address: to } }]
      },
      saveToSentItems: true
    })
  });
  return { sent: true };
}

module.exports = {
  isConfigured,
  isConnected,
  getAuthUrl,
  handleOAuthCallback,
  listEvents,
  createEvent,
  sendEmail
};
