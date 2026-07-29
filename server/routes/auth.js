const express = require("express");
const router = express.Router();
const outlook = require("../services/outlook");

router.get("/api/status", (req, res) => {
  res.json({
    linearEnabled: !!process.env.LINEAR_API_KEY,
    outlookConfigured: outlook.isConfigured(),
    outlookConnected: outlook.isConnected()
  });
});

router.get("/auth/microsoft", (req, res) => {
  if (!outlook.isConfigured()) {
    return res.status(400).send("Microsoft OAuth is not configured. Set MICROSOFT_CLIENT_ID / MICROSOFT_CLIENT_SECRET / MICROSOFT_REDIRECT_URI in .env first.");
  }
  res.redirect(outlook.getAuthUrl());
});

router.get("/auth/microsoft/callback", async (req, res) => {
  try {
    const { code, error, error_description } = req.query;
    if (error) return res.status(400).send(`Microsoft OAuth error: ${error_description || error}`);
    if (!code) return res.status(400).send("Missing code param.");
    await outlook.handleOAuthCallback(code);
    res.redirect("/?outlook_connected=1");
  } catch (err) {
    console.error(err);
    res.status(500).send("Microsoft OAuth failed: " + err.message);
  }
});

module.exports = router;
