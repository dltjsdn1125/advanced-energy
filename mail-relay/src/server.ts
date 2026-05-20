/**
 * AE Mail Relay — Korean-IP backend for mail protocols.
 *
 * Deploy target: Oracle Cloud Always Free VM in Chuncheon region.
 * Vercel frontend POSTs to /api/* on this service; we connect to
 * mail.semigate.com from a Korean IP that the host whitelists.
 *
 * Endpoints (matching the Vercel app's existing /api/* contracts):
 *   POST /api/imap/messages
 *   POST /api/pop3/messages
 *   POST /api/webmail/messages
 *   POST /api/webmail/thread
 *   POST /api/webmail/attachment
 *   POST /api/mail/send
 *   GET  /healthz
 */
import express from "express";
import cors from "cors";
import { imapRoute } from "./routes/imap.js";
import { pop3Route } from "./routes/pop3.js";
import { webmailMessagesRoute } from "./routes/webmail-messages.js";
import { webmailThreadRoute } from "./routes/webmail-thread.js";
import { webmailAttachmentRoute } from "./routes/webmail-attachment.js";
import { mailSendRoute } from "./routes/mail-send.js";

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// CORS — allow the Vercel frontend. Set ALLOWED_ORIGIN env to lock down
// to a specific origin in production (e.g., https://advanced-energy.vercel.app).
const allowedOrigin = process.env.ALLOWED_ORIGIN || "*";
app.use(cors({ origin: allowedOrigin }));
app.use(express.json({ limit: "10mb" }));

app.get("/healthz", (_req, res) => {
  res.json({ ok: true, ts: Date.now(), region: process.env.RELAY_REGION || "unknown" });
});

app.post("/api/imap/messages", imapRoute);
app.post("/api/pop3/messages", pop3Route);
app.post("/api/webmail/messages", webmailMessagesRoute);
app.post("/api/webmail/thread", webmailThreadRoute);
app.post("/api/webmail/attachment", webmailAttachmentRoute);
app.post("/api/mail/send", mailSendRoute);

app.listen(PORT, () => {
  console.log(`[mail-relay] listening on :${PORT} (origin=${allowedOrigin})`);
});
