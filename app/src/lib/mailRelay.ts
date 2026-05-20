/**
 * Mail API endpoint resolver.
 *
 * When NEXT_PUBLIC_MAIL_RELAY is set (e.g., https://relay.example.com), all mail
 * protocol requests are routed to the relay running on a Korean-IP VM (Oracle
 * Cloud Chuncheon or similar). When unset, requests stay on Vercel's local
 * Next.js routes — useful for local development and for endpoints that don't
 * need a Korean IP (Outlook COM, settings).
 *
 * Only these endpoints are rerouted; everything else stays on the Vercel host.
 */
const RELAY_PATHS = new Set<string>([
  "/api/imap/messages",
  "/api/pop3/messages",
  "/api/webmail/messages",
  "/api/webmail/thread",
  "/api/webmail/attachment",
  "/api/mail/send",
]);

export function mailApi(path: string): string {
  const relay = process.env.NEXT_PUBLIC_MAIL_RELAY?.replace(/\/$/, "");
  if (relay && RELAY_PATHS.has(path)) return `${relay}${path}`;
  return path;
}
