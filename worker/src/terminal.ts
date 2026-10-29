/// <reference types="@cloudflare/workers-types" />

import { renderAsciiGreeting } from "../../src/lib/ascii-greeting.ts";

const escapeHtml = (value: string) =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

const getUserAgent = (request: Request) => {
  const userAgent = request.headers
    .get("user-agent")
    ?.split("")
    .map((character) => {
      const code = character.charCodeAt(0);
      return code <= 0x1f || (code >= 0x7f && code <= 0x9f) ? " " : character;
    })
    .join("")
    .trim();

  if (!userAgent) return "Not provided";
  return userAgent.length > 1024 ? `${userAgent.slice(0, 1024)}…` : userAgent;
};

const formatJapanTime = (date: Date) =>
  new Intl.DateTimeFormat("ja-JP-u-ca-gregory-nu-latn", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(date);

const renderPage = (request: Request) => {
  const now = new Date();
  const userAgent = escapeHtml(getUserAgent(request));
  const time = formatJapanTime(now);
  const greeting = renderAsciiGreeting();

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="robots" content="noindex, nofollow">
    <title>Hey, what's up? — flypea.tech</title>
    <style>
      :root { color-scheme: light; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; background: #f5f3eb; color: #11120f; }
      * { box-sizing: border-box; }
      body { margin: 0; padding: clamp(1.25rem, 5vw, 4rem); }
      main { max-width: 56rem; margin: 0 auto; }
      .eyebrow, dt { font-size: .75rem; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
      .eyebrow { margin: 0 0 1.5rem; color: #56594f; }
      h1 { margin: 0 0 1.5rem; font: inherit; font-size: 1.25rem; font-weight: 700; }
      pre { overflow-x: auto; margin: 0; border: 1px solid #11120f; background: #11120f; color: #6dde3b; padding: 1rem; font: inherit; font-size: clamp(.52rem, 1.6vw, .95rem); line-height: 1.15; }
      dl { display: grid; gap: .5rem; margin: 2rem 0; }
      dt { margin-top: 1rem; color: #56594f; }
      dd { margin: 0; line-height: 1.7; overflow-wrap: anywhere; }
      a { color: inherit; text-underline-offset: .25em; }
    </style>
  </head>
  <body>
    <main>
      <p class="eyebrow">flypea.tech / text-only hello</p>
      <h1>Hey, what's up?</h1>
      <pre aria-hidden="true">${greeting}</pre>
      <dl>
        <dt>User-Agent</dt>
        <dd><code>${userAgent}</code></dd>
        <dt>Current time · Japan Standard Time</dt>
        <dd><time datetime="${now.toISOString()}">${time} JST</time></dd>
      </dl>
    </main>
  </body>
</html>`;
};

export const handleTerminalRequest = (request: Request) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { allow: "GET, HEAD", "cache-control": "no-store" },
    });
  }

  const headers = new Headers({
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
    "content-security-policy":
      "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
    "referrer-policy": "no-referrer",
    "x-robots-tag": "noindex, nofollow",
    "x-content-type-options": "nosniff",
  });

  return new Response(request.method === "HEAD" ? null : renderPage(request), {
    headers,
  });
};
