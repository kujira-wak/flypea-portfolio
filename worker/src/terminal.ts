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

const SECRET_HEADERS = new Set([
  "authorization",
  "cookie",
  "proxy-authorization",
  "cf-access-jwt-assertion",
]);

const requestDetails = (request: Request) => {
  const headers = [...request.headers.entries()].sort(([a], [b]) => a.localeCompare(b));
  const rows = headers
    .map(([name, value]) => {
      const visibleValue = SECRET_HEADERS.has(name.toLowerCase()) ? "[redacted]" : value;
      return `<tr><th scope="row">${escapeHtml(name)}</th><td>${escapeHtml(visibleValue)}</td></tr>`;
    })
    .join("");
  const cf = (request as Request & { cf?: Record<string, unknown> }).cf ?? {};
  const edgeFields = [
    ["Country", cf.country],
    ["City", cf.city],
    ["Region", cf.region],
    ["Postal code", cf.postalCode],
    ["Timezone", cf.timezone],
    ["Coordinates", cf.latitude && cf.longitude ? `${cf.latitude}, ${cf.longitude}` : undefined],
    ["Network ASN", cf.asn],
    ["Network", cf.asOrganization],
    ["Edge location", cf.colo],
    ["HTTP protocol", cf.httpProtocol],
    ["TLS version", cf.tlsVersion],
  ].filter(([, value]) => value !== undefined && value !== null && value !== "");
  const edgeRows = edgeFields
    .map(
      ([name, value]) =>
        `<tr><th scope="row">${escapeHtml(String(name))}</th><td>${escapeHtml(String(value))}</td></tr>`,
    )
    .join("");

  return { headers: rows, edge: edgeRows };
};

const renderPage = (request: Request) => {
  const now = new Date();
  const userAgent = escapeHtml(getUserAgent(request));
  const time = formatJapanTime(now);
  const greeting = renderAsciiGreeting();
  const details = requestDetails(request);
  const ipAddress = escapeHtml(request.headers.get("cf-connecting-ip") ?? "Unavailable");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="robots" content="noindex, nofollow">
    <title>Hey, what's up? — flypea.tech</title>
    <style>
      :root { color-scheme: dark; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; background: #090b0a; color: #f3f4ed; }
      * { box-sizing: border-box; }
      body { margin: 0; padding: clamp(1rem, 4vw, 3.5rem); background: radial-gradient(ellipse at 10% 0%, #192219 0, #090b0a 52rem); }
      main { max-width: 64rem; margin: 0 auto; }
      .eyebrow, dt { font-size: .7rem; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; }
      .eyebrow { margin: 0 0 1rem; color: #9aa394; }
      h1 { margin: 0 0 1.25rem; font: inherit; font-size: clamp(1.5rem, 4vw, 2.5rem); font-weight: 800; letter-spacing: -.06em; }
      .intro { display: grid; gap: 1.25rem; grid-template-columns: 1fr auto; align-items: end; }
      .ip { border: 1px solid #39443a; background: #111612; border-radius: 1rem; padding: 1rem 1.25rem; color: #a8ff60; font-size: clamp(1rem, 2vw, 1.4rem); }
      .ip small { display: block; margin-bottom: .4rem; color: #9aa394; font-size: .65rem; letter-spacing: .12em; }
      pre { overflow-x: auto; margin: 1.5rem 0; border: 1px solid #39443a; border-radius: 1rem; background: #111612; color: #a8ff60; padding: 1.25rem; font: inherit; font-size: clamp(.52rem, 1.6vw, .95rem); line-height: 1.15; }
      section { margin-top: 1rem; border: 1px solid #29312b; border-radius: 1rem; background: #101310; overflow: hidden; }
      h2 { margin: 0; border-bottom: 1px solid #29312b; padding: 1rem 1.25rem; color: #c5cfbd; font: inherit; font-size: .72rem; letter-spacing: .13em; text-transform: uppercase; }
      table { width: 100%; border-collapse: collapse; font-size: .8rem; }
      th, td { padding: .75rem 1.25rem; border-bottom: 1px solid #202720; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
      th { width: 30%; color: #a8ff60; font-weight: 500; }
      td { color: #d6dbd2; }
      .time { margin-top: 1rem; color: #9aa394; font-size: .8rem; }
      .time strong { display: block; margin-top: .35rem; color: #f3f4ed; font-size: 1.1rem; }
      .note { color: #9aa394; font-size: .72rem; line-height: 1.7; }
      @media (max-width: 38rem) { .intro { grid-template-columns: 1fr; } th, td { padding: .65rem .8rem; } th { width: 36%; } }
    </style>
  </head>
  <body>
    <main>
      <p class="eyebrow">flypea.tech / request mirror</p>
      <div class="intro"><h1>Hey, what's up?</h1><div class="ip"><small>YOUR IP</small>${ipAddress}</div></div>
      <pre aria-hidden="true">${greeting}</pre>
      <p class="time">CURRENT TIME · JST<strong><time datetime="${now.toISOString()}">${time} JST</time></strong></p>
      <section><h2>Connection &amp; edge</h2><table><tbody><tr><th scope="row">Client IP</th><td>${ipAddress}</td></tr><tr><th scope="row">User-Agent</th><td>${userAgent}</td></tr>${details.edge}</tbody></table></section>
      <section><h2>Request headers</h2><table><tbody>${details.headers}</tbody></table></section>
      <p class="note">Sensitive authentication and cookie header values are hidden. This page reflects request details to the same requester and does not store them.</p>
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
