require("dotenv").config();
const path = require("path");
const express = require("express");

const chatRoutes = require("./routes/chat");
const authRoutes = require("./routes/auth");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "25mb" })); // generous limit for base64 file attachments
app.use(express.static(path.join(__dirname, "..", "public")));

app.use("/api", chatRoutes);
app.use("/", authRoutes);

app.listen(PORT, () => {
  console.log(`Nexus is running: http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("WARNING: ANTHROPIC_API_KEY is not set in .env — chat will fail until you add it.");
  }
  if (!process.env.LINEAR_API_KEY) {
    console.warn("INFO: LINEAR_API_KEY not set — Linear tools disabled.");
  }
});
