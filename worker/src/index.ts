/// <reference types="@cloudflare/workers-types" />

interface RateLimitResult {
  success: boolean;
}

interface RateLimitBinding {
  limit(options: { key: string }): Promise<RateLimitResult>;
}

interface Env {
  DB: D1Database;
  REACTION_RATE_LIMITER?: RateLimitBinding;
  REACTION_COOKIE_NAME?: string;
  COOKIE_SECRET: string;
  ADMIN_TOKEN: string;
  SITE_ORIGIN: string;
}

interface ReactionRow {
  article_id: string;
  count: number;
}

interface AdminRow extends ReactionRow {
  last_7_days: number;
  last_30_days: number;
  latest_at: number;
}

const encoder = new TextEncoder();
const ARTICLE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_IDS = 100;
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

const json = (body: unknown, init: ResponseInit = {}) => {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(body), { ...init, headers });
};

const getCookie = (request: Request, name: string) => {
  const cookies = request.headers.get("cookie")?.split(";") ?? [];
  for (const cookie of cookies) {
    const [key, ...value] = cookie.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return null;
};

const bytesToBase64Url = (bytes: Uint8Array) => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
};

const hmacKey = (secret: string) =>
  crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);

const sign = async (value: string, secret: string) => {
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(value));
  return bytesToBase64Url(new Uint8Array(signature));
};

const readVoter = async (request: Request, env: Env) => {
  const cookieName = env.REACTION_COOKIE_NAME ?? "flypea_reaction";
  const stored = getCookie(request, cookieName);
  if (stored) {
    const separator = stored.lastIndexOf(".");
    if (separator > 0) {
      const value = stored.slice(0, separator);
      const signature = stored.slice(separator + 1);
      const expected = await sign(value, env.COOKIE_SECRET);
      if (signature === expected) return { value, cookie: null };
    }
  }

  const value = crypto.randomUUID();
  const signature = await sign(value, env.COOKIE_SECRET);
  const cookie = `${cookieName}=${encodeURIComponent(`${value}.${signature}`)}; Path=/api/reactions; Max-Age=${COOKIE_MAX_AGE}; HttpOnly; Secure; SameSite=Lax`;
  return { value, cookie };
};

const voterId = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return bytesToBase64Url(new Uint8Array(digest));
};

const withCookie = (response: Response, cookie: string | null) => {
  if (!cookie) return response;
  const headers = new Headers(response.headers);
  headers.append("set-cookie", cookie);
  return new Response(response.body, { status: response.status, headers });
};

const validArticleId = (value: string) => value.length <= 80 && ARTICLE_ID_PATTERN.test(value);

const sameOrigin = (request: Request, env: Env) => {
  const origin = request.headers.get("origin");
  return !origin || origin === env.SITE_ORIGIN;
};

const getCounts = async (env: Env, ids: string[], visitorId: string) => {
  if (ids.length === 0) return {};
  const placeholders = ids.map(() => "?").join(",");
  const [countsResult, reactedResult] = await env.DB.batch([
    env.DB.prepare(
      `SELECT article_id, COUNT(*) AS count FROM reactions WHERE article_id IN (${placeholders}) GROUP BY article_id`,
    ).bind(...ids),
    env.DB.prepare(
      `SELECT article_id FROM reactions WHERE voter_id = ? AND article_id IN (${placeholders})`,
    ).bind(visitorId, ...ids),
  ]);
  const counts = new Map(
    (countsResult.results as unknown as ReactionRow[]).map((row) => [
      row.article_id,
      Number(row.count),
    ]),
  );
  const reacted = new Set(
    (reactedResult.results as unknown as Array<{ article_id: string }>).map(
      (row) => row.article_id,
    ),
  );

  return Object.fromEntries(
    ids.map((id) => [id, { count: counts.get(id) ?? 0, reacted: reacted.has(id) }]),
  );
};

const handleAdmin = async (request: Request, env: Env) => {
  if (!env.ADMIN_TOKEN || request.headers.get("authorization") !== `Bearer ${env.ADMIN_TOKEN}`) {
    return json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await env.DB.prepare(
    `SELECT
      article_id,
      COUNT(*) AS count,
      SUM(created_at >= unixepoch() - 604800) AS last_7_days,
      SUM(created_at >= unixepoch() - 2592000) AS last_30_days,
      MAX(created_at) AS latest_at
    FROM reactions
    GROUP BY article_id
    ORDER BY count DESC, article_id ASC`,
  ).all<AdminRow>();
  const summary = await env.DB.prepare(
    "SELECT COUNT(*) AS reactions, COUNT(DISTINCT voter_id) AS voters FROM reactions",
  ).first<{ reactions: number; voters: number }>();

  return json({
    totals: {
      reactions: Number(summary?.reactions ?? 0),
      voters: Number(summary?.voters ?? 0),
      articles: result.results.length,
    },
    articles: result.results.map((row) => ({
      id: row.article_id,
      count: Number(row.count),
      last7Days: Number(row.last_7_days),
      last30Days: Number(row.last_30_days),
      latestAt: Number(row.latest_at),
    })),
  });
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const apiRoot = "/api/reactions";

    try {
      if (request.method === "OPTIONS") return new Response(null, { status: 204 });
      if (url.pathname === `${apiRoot}/admin/stats` && request.method === "GET") {
        return handleAdmin(request, env);
      }
      if (url.pathname !== apiRoot && !url.pathname.startsWith(`${apiRoot}/`)) {
        return json({ error: "not_found" }, { status: 404 });
      }

      const voter = await readVoter(request, env);
      const visitorId = await voterId(voter.value);

      if (
        (url.pathname === apiRoot || url.pathname === `${apiRoot}/batch`) &&
        request.method === "GET"
      ) {
        const ids = [...new Set((url.searchParams.get("ids") ?? "").split(",").filter(Boolean))];
        if (ids.length > MAX_IDS || ids.some((id) => !validArticleId(id))) {
          return withCookie(json({ error: "invalid_ids" }, { status: 400 }), voter.cookie);
        }
        return withCookie(json({ reactions: await getCounts(env, ids, visitorId) }), voter.cookie);
      }

      const articleId = decodeURIComponent(url.pathname.slice(`${apiRoot}/`.length));
      if (!validArticleId(articleId)) {
        return withCookie(json({ error: "invalid_article_id" }, { status: 400 }), voter.cookie);
      }
      if (!sameOrigin(request, env)) {
        return withCookie(json({ error: "invalid_origin" }, { status: 403 }), voter.cookie);
      }
      if (request.method !== "PUT" && request.method !== "DELETE") {
        return withCookie(json({ error: "method_not_allowed" }, { status: 405 }), voter.cookie);
      }

      const rateLimit = await env.REACTION_RATE_LIMITER?.limit({ key: visitorId });
      if (rateLimit && !rateLimit.success) {
        return withCookie(json({ error: "rate_limited" }, { status: 429 }), voter.cookie);
      }

      if (request.method === "PUT") {
        await env.DB.prepare("INSERT OR IGNORE INTO reactions (article_id, voter_id) VALUES (?, ?)")
          .bind(articleId, visitorId)
          .run();
      } else {
        await env.DB.prepare("DELETE FROM reactions WHERE article_id = ? AND voter_id = ?")
          .bind(articleId, visitorId)
          .run();
      }

      const reactions = await getCounts(env, [articleId], visitorId);
      return withCookie(json({ reaction: reactions[articleId] }), voter.cookie);
    } catch (error) {
      console.error("reaction_api_error", error);
      return json({ error: "internal_error" }, { status: 500 });
    }
  },
} satisfies ExportedHandler<Env>;
