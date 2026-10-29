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
  const headerLines = headers
    .map(([name, value]) => {
      const visibleValue = SECRET_HEADERS.has(name.toLowerCase()) ? "[redacted]" : value;
      return `${escapeHtml(name)}: ${escapeHtml(visibleValue)}`;
    })
    .join("\n");
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
  const edgeLines = edgeFields
    .map(([name, value]) => `${escapeHtml(String(name))}: ${escapeHtml(String(value))}`)
    .join("\n");

  return { headers: headerLines, edge: edgeLines };
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
    <meta name="robots" content="noindex, nofollow">
    <title>Hey, what's up? — flypea.tech</title>
  </head>
  <body>
    <pre>${greeting}

Hey, what's up?
CURRENT TIME (JST): ${time}
CLIENT IP: ${ipAddress}
USER-AGENT: ${userAgent}

CONNECTION &amp; EDGE
${details.edge}

REQUEST HEADERS
${details.headers}

Sensitive authentication and cookie header values are redacted. This request data is not stored.</pre>
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
