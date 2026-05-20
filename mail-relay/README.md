# ae-mail-relay

Standalone Node.js mail backend for advanced-energy. Designed to run on **Oracle Cloud Always Free in Chuncheon (한국 IP)** to bypass Vercel's US-IP block at mail.semigate.com.

## Architecture

```
Browser (anywhere)
    │
    ▼
Vercel frontend (US, fast CDN)
    │
    │  fetch(NEXT_PUBLIC_MAIL_RELAY + "/api/...")
    ▼
mail-relay (Oracle Cloud 춘천, 한국 IP)  ◄── this repo
    │
    ├─ /api/imap/messages
    ├─ /api/pop3/messages
    ├─ /api/webmail/*
    └─ /api/mail/send
    │
    ▼
mail.semigate.com  (allows Korean IPs)
```

## Local development

```bash
npm install
npm run dev   # runs on :3000
curl http://localhost:3000/healthz
```

## Deploying to Oracle Cloud

See [ORACLE_CLOUD_SETUP.md](./ORACLE_CLOUD_SETUP.md) for the full step-by-step guide (create VM, set firewall, install Node, register systemd service).

## Wiring the Vercel frontend

On the Vercel project, set environment variable:

```
NEXT_PUBLIC_MAIL_RELAY = https://your-relay-host.com
```

The frontend's `src/lib/mailRelay.ts` reroutes every mail-protocol fetch to this URL while leaving other API calls (auth, settings, Outlook COM) on Vercel.

## Endpoints

All accept POST with JSON body and match the Vercel app's existing contracts.

| Path | Purpose |
|---|---|
| `POST /api/imap/messages` | List inbox via IMAP, retries 3x with hostname variants |
| `POST /api/pop3/messages` | List inbox via POP3, paginated via offset |
| `POST /api/webmail/messages` | MAILNARA webmail HTTPS list, 4 URL variants |
| `POST /api/webmail/thread` | Single mail body + attachments |
| `POST /api/webmail/attachment` | Proxy attachment download with session cookie |
| `POST /api/mail/send` | SMTP send with port fallback |
| `GET /healthz` | Liveness probe |

## Configuration (env vars)

| Var | Default | Notes |
|---|---|---|
| `PORT` | 3000 | Listen port |
| `ALLOWED_ORIGIN` | `*` | CORS origin (lock to Vercel URL in prod) |
| `RELAY_REGION` | unknown | Reported via /healthz |
