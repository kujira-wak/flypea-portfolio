/// <reference types="@cloudflare/workers-types" />

export interface RateLimitResult {
  success: boolean;
}

export interface RateLimitBinding {
  limit(options: { key: string }): Promise<RateLimitResult>;
}

export interface GardenEnv {
  DB: D1Database;
  COOKIE_SECRET: string;
  ADMIN_TOKEN: string;
  SITE_ORIGIN: string;
  GARDEN_COOKIE_NAME?: string;
  GARDEN_COORDINATOR?: DurableObjectNamespace;
  GARDEN_RATE_LIMITER?: RateLimitBinding;
  GARDEN_READ_RATE_LIMITER?: RateLimitBinding;
  GARDEN_PLAYER_RATE_LIMITER?: RateLimitBinding;
}

export interface GardenPlayerRow {
  player_id: string;
  nickname: string;
  growth_ticks: number;
  care_ticks: number;
  gloves_level: number;
  rain_barrel_level: number;
  last_settled_at_ms: number;
  passive_remainder_milliticks: number;
  action_tokens_milli: number;
  action_refill_at_ms: number;
  certified_actions: number;
  revision: number;
  hidden: number;
  session_version: number;
  recovery_code_hash: string;
  growth_reached_at_ms: number;
  created_at_ms: number;
  updated_at_ms: number;
}

interface GardenCommandRow {
  command_hash: string;
  response_json: string;
}

interface GardenActionCare {
  type: "care";
  count: number;
}

interface GardenActionBuy {
  type: "buy";
  upgrade: Upgrade;
}

type GardenAction = GardenActionCare | GardenActionBuy;
type Upgrade = "gloves" | "rainBarrel";

interface ParsedCommand {
  commandId: string;
  actions: GardenAction[];
}

interface PurchaseResult {
  upgrade: Upgrade;
  level: number;
  costTicks: number;
}

interface ActionResult {
  acceptedCare: number;
  purchases: PurchaseResult[];
}

interface GardenState {
  nickname: string;
  growthTicks: number;
  careTicks: number;
  lengthMm: number;
  glovesLevel: number;
  rainBarrelLevel: number;
  careTicksPerAction: number;
  passiveTicksPerSecond: number;
  nextGlovesCostTicks: number | null;
  nextRainBarrelCostTicks: number | null;
  certifiedActions: number;
  revision: number;
  title: string;
  unlockedScenes: string[];
  cardUnlocked: boolean;
  createdAt: string;
  updatedAt: string;
  settledAt: string;
  serverTime: string;
}

class GardenError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: Record<string, unknown>;

  constructor(code: string, status: number, details: Record<string, unknown> = {}) {
    super(code);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

const encoder = new TextEncoder();
const GARDEN_API_ROOT = "/api/garden";
const INTERNAL_HOST = "garden.internal";
const DEFAULT_COOKIE_NAME = "flypea_garden";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
const MAX_BODY_BYTES = 8_192;
const MAX_COMMAND_ACTIONS = 16;
const MAX_COMMAND_HISTORY = 64;
const MAX_OFFLINE_MS = 24 * 60 * 60 * 1_000;
const MAX_CARE_PER_SECOND = 25;
const TOKEN_CAPACITY_MILLI = 2_000;
const TOKEN_COST_MILLI = TOKEN_CAPACITY_MILLI / MAX_CARE_PER_SECOND;
const TOKEN_REFILL_MILLI_PER_MS = 2;
const MAX_SAFE_TICKS = 9_000_000_000_000_000;
const UNAFFORDABLE_COST_TICKS = MAX_SAFE_TICKS + 1;
const CARD_UNLOCK_TICKS = 6_000 * 8;
const INITIAL_GROWTH_TICKS = 10 * 8;
const COMMAND_ID_PATTERN = /^[A-Za-z0-9_-]{16,80}$/;
const PLAYER_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RECOVERY_CODE_PATTERN = /^[0-9A-F]{32}$/;
const HMAC_HASH_PATTERN = /^[A-Za-z0-9_-]{43}$/;

const SCENES = [
  { id: "plot", thresholdTicks: 0 },
  { id: "table", thresholdTicks: 100 * 8 },
  { id: "room", thresholdTicks: 1_000 * 8 },
  { id: "street", thresholdTicks: 6_000 * 8 },
  { id: "skyline", thresholdTicks: 10_000 * 8 },
  { id: "clouds", thresholdTicks: 100_000 * 8 },
  { id: "horizon", thresholdTicks: 1_000_000 * 8 },
  { id: "orbit", thresholdTicks: 10_000_000 * 8 },
] as const;

const TITLES = [
  { title: "ORBITAL SPECIMEN", thresholdTicks: 10_000_000 * 8 },
  { title: "HORIZON KEEPER", thresholdTicks: 1_000_000 * 8 },
  { title: "CLOUD GARDENER", thresholdTicks: 100_000 * 8 },
  { title: "SKYLINE GROWER", thresholdTicks: 10_000 * 8 },
  { title: "ARCHIVE SPECIMEN", thresholdTicks: 6_000 * 8 },
  { title: "ROOM GARDENER", thresholdTicks: 1_000 * 8 },
  { title: "TABLE GROWER", thresholdTicks: 100 * 8 },
  { title: "TINY CULTIVATOR", thresholdTicks: 0 },
] as const;

const EFFECTIVE_GROWTH_SQL = `MIN(
  ${MAX_SAFE_TICKS},
  growth_ticks + CAST((
    MIN(MAX(? - last_settled_at_ms, 0), ${MAX_OFFLINE_MS}) *
      (4 + rain_barrel_level * 8) +
      passive_remainder_milliticks
  ) / 1000 AS INTEGER)
)`;

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

const base64UrlToBytes = (value: string) => {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const padded = value
      .replaceAll("-", "+")
      .replaceAll("_", "/")
      .padEnd(Math.ceil(value.length / 4) * 4, "=");
    const binary = atob(padded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
};

const hmacKey = (secret: string) =>
  crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);

const signBytes = async (value: string, secret: string) =>
  new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(value)));

const sign = async (value: string, secret: string) =>
  bytesToBase64Url(await signBytes(value, secret));

const verifySignature = async (value: string, signature: string, secret: string) => {
  const bytes = base64UrlToBytes(signature);
  if (!bytes) return false;
  return crypto.subtle.verify("HMAC", await hmacKey(secret), bytes, encoder.encode(value));
};

const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return bytesToBase64Url(new Uint8Array(digest));
};

const gardenCookieName = (env: GardenEnv) => env.GARDEN_COOKIE_NAME ?? DEFAULT_COOKIE_NAME;

const gardenCookie = async (env: GardenEnv, playerId: string, sessionVersion: number) => {
  const value = `${playerId}:${sessionVersion}`;
  const signature = await sign(`garden-session:${value}`, env.COOKIE_SECRET);
  return `${gardenCookieName(env)}=${encodeURIComponent(`${value}.${signature}`)}; Path=/api/garden; Max-Age=${COOKIE_MAX_AGE_SECONDS}; HttpOnly; Secure; SameSite=Strict`;
};

const clearGardenCookie = (env: GardenEnv) =>
  `${gardenCookieName(env)}=; Path=/api/garden; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;

const withCookie = (response: Response, cookie: string) => {
  const headers = new Headers(response.headers);
  headers.append("set-cookie", cookie);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

const sameOrigin = (request: Request, env: GardenEnv) => {
  const origin = request.headers.get("origin");
  return !origin || origin === env.SITE_ORIGIN;
};

const requireSameOrigin = (request: Request, env: GardenEnv) => {
  if (!sameOrigin(request, env)) throw new GardenError("invalid_origin", 403);
};

const readBoundedBody = async (request: Request) => {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    throw new GardenError("payload_too_large", 413);
  }
  if (!request.body) throw new GardenError("invalid_json", 400);

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    byteLength += value.byteLength;
    if (byteLength > MAX_BODY_BYTES) {
      await reader.cancel().catch(() => undefined);
      throw new GardenError("payload_too_large", 413);
    }
    chunks.push(value);
  }
  const body = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
};

const parseJson = async (request: Request): Promise<unknown> => {
  try {
    const body = await readBoundedBody(request);
    return JSON.parse(new TextDecoder().decode(body));
  } catch (error) {
    if (error instanceof GardenError) throw error;
    throw new GardenError("invalid_json", 400);
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const containsControlCharacter = (value: string) =>
  Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 31 || (codePoint >= 127 && codePoint <= 159);
  });

export const normalizeNickname = (value: unknown) => {
  if (typeof value !== "string") throw new GardenError("invalid_nickname", 400);
  const nickname = value.normalize("NFC").trim();
  const byteLength = encoder.encode(nickname).byteLength;
  if (
    nickname.length === 0 ||
    Array.from(nickname).length > 24 ||
    byteLength > 96 ||
    containsControlCharacter(nickname)
  ) {
    throw new GardenError("invalid_nickname", 400);
  }
  return nickname;
};

const safeInteger = (value: number) =>
  Number.isSafeInteger(value) && value >= 0 && value <= MAX_SAFE_TICKS;

const saturatingAdd = (left: number, right: number) => {
  if (!safeInteger(left) || !safeInteger(right)) return MAX_SAFE_TICKS;
  if (right > MAX_SAFE_TICKS - left) return MAX_SAFE_TICKS;
  return left + right;
};

const checkedAdd = (left: number, right: number, field: string) => {
  if (!safeInteger(left) || !safeInteger(right) || right > MAX_SAFE_TICKS - left) {
    throw new GardenError("numeric_limit", 409, { field });
  }
  return left + right;
};

const scaledLevelValue = (base: number, level: number) => {
  if (!Number.isSafeInteger(level) || level < 0) return MAX_SAFE_TICKS;
  if (level > Math.floor((MAX_SAFE_TICKS - base) / 8)) return MAX_SAFE_TICKS;
  return base + level * 8;
};

export const careTicksPerAction = (glovesLevel: number) => scaledLevelValue(8, glovesLevel);

export const passiveTicksPerSecond = (rainBarrelLevel: number) =>
  scaledLevelValue(4, rainBarrelLevel);

export const upgradeCostTicks = (upgrade: Upgrade, level: number) => {
  if (!Number.isSafeInteger(level) || level < 0) return UNAFFORDABLE_COST_TICKS;
  let cost = upgrade === "gloves" ? 160 : 240;
  if (level > 256) return UNAFFORDABLE_COST_TICKS;
  for (let index = 0; index < level; index += 1) {
    if (cost > Math.floor((MAX_SAFE_TICKS / 8) * 5)) {
      return UNAFFORDABLE_COST_TICKS;
    }
    const quotient = Math.floor(cost / 5);
    const remainder = cost % 5;
    cost = quotient * 8 + Math.ceil((remainder * 8) / 5);
  }
  return cost <= MAX_SAFE_TICKS ? cost : UNAFFORDABLE_COST_TICKS;
};

const publicCost = (cost: number) => (cost <= MAX_SAFE_TICKS ? cost : null);

const titleForGrowth = (growthTicks: number) =>
  TITLES.find(({ thresholdTicks }) => growthTicks >= thresholdTicks)?.title ??
  TITLES.at(-1)?.title ??
  "TINY CULTIVATOR";

const scenesForGrowth = (growthTicks: number) =>
  SCENES.filter(({ thresholdTicks }) => growthTicks >= thresholdTicks).map(({ id }) => id);

const iso = (timestamp: number) => new Date(timestamp).toISOString();

const makeState = (row: GardenPlayerRow, now: number): GardenState => ({
  nickname: row.nickname,
  growthTicks: row.growth_ticks,
  careTicks: row.care_ticks,
  lengthMm: row.growth_ticks / 8,
  glovesLevel: row.gloves_level,
  rainBarrelLevel: row.rain_barrel_level,
  careTicksPerAction: careTicksPerAction(row.gloves_level),
  passiveTicksPerSecond: passiveTicksPerSecond(row.rain_barrel_level),
  nextGlovesCostTicks: publicCost(upgradeCostTicks("gloves", row.gloves_level)),
  nextRainBarrelCostTicks: publicCost(upgradeCostTicks("rainBarrel", row.rain_barrel_level)),
  certifiedActions: row.certified_actions,
  revision: row.revision,
  title: titleForGrowth(row.growth_ticks),
  unlockedScenes: scenesForGrowth(row.growth_ticks),
  cardUnlocked: row.growth_ticks >= CARD_UNLOCK_TICKS,
  createdAt: iso(row.created_at_ms),
  updatedAt: iso(row.updated_at_ms),
  settledAt: iso(row.last_settled_at_ms),
  serverTime: iso(now),
});

export const settleGardenRow = (source: GardenPlayerRow, now: number) => {
  const row = { ...source };
  if (!Number.isSafeInteger(now) || now <= row.last_settled_at_ms) {
    return { row, changed: false, earnedTicks: 0 };
  }

  const passiveElapsedMs = Math.min(now - row.last_settled_at_ms, MAX_OFFLINE_MS);
  const rate = passiveTicksPerSecond(row.rain_barrel_level);
  const numerator =
    BigInt(passiveElapsedMs) * BigInt(rate) + BigInt(row.passive_remainder_milliticks);
  const rawEarnedTicks = numerator / 1_000n;
  const earnedTicks = Number(
    rawEarnedTicks > BigInt(MAX_SAFE_TICKS) ? BigInt(MAX_SAFE_TICKS) : rawEarnedTicks,
  );
  row.passive_remainder_milliticks = Number(numerator % 1_000n);
  row.growth_ticks = saturatingAdd(row.growth_ticks, earnedTicks);
  row.care_ticks = saturatingAdd(row.care_ticks, earnedTicks);
  row.last_settled_at_ms = now;

  const refillElapsedMs = Math.max(0, now - row.action_refill_at_ms);
  row.action_tokens_milli = Math.min(
    TOKEN_CAPACITY_MILLI,
    row.action_tokens_milli + refillElapsedMs * TOKEN_REFILL_MILLI_PER_MS,
  );
  row.action_refill_at_ms = now;
  row.revision = saturatingAdd(row.revision, 1);
  row.updated_at_ms = now;
  if (earnedTicks > 0) row.growth_reached_at_ms = now;

  return { row, changed: true, earnedTicks };
};

const parseCommand = async (request: Request): Promise<ParsedCommand> => {
  const body = await parseJson(request);
  if (!isRecord(body) || typeof body.commandId !== "string" || !Array.isArray(body.actions)) {
    throw new GardenError("invalid_command", 400);
  }
  if (!COMMAND_ID_PATTERN.test(body.commandId)) {
    throw new GardenError("invalid_command_id", 400);
  }
  if (body.actions.length === 0 || body.actions.length > MAX_COMMAND_ACTIONS) {
    throw new GardenError("invalid_actions", 400);
  }

  let careCount = 0;
  const actions = body.actions.map((action): GardenAction => {
    if (!isRecord(action) || typeof action.type !== "string") {
      throw new GardenError("invalid_action", 400);
    }
    if (action.type === "care") {
      const count = action.count ?? 1;
      if (!Number.isInteger(count) || Number(count) < 1 || Number(count) > MAX_CARE_PER_SECOND) {
        throw new GardenError("invalid_care_count", 400);
      }
      careCount += Number(count);
      return { type: "care", count: Number(count) };
    }
    if (action.type === "buy" && (action.upgrade === "gloves" || action.upgrade === "rainBarrel")) {
      return { type: "buy", upgrade: action.upgrade };
    }
    throw new GardenError("invalid_action", 400);
  });
  if (careCount > MAX_CARE_PER_SECOND) throw new GardenError("too_many_care_actions", 400);
  return { commandId: body.commandId, actions };
};

export const executeGardenActions = (
  source: GardenPlayerRow,
  actions: GardenAction[],
  now: number,
) => {
  const { row } = settleGardenRow(source, now);
  const result: ActionResult = { acceptedCare: 0, purchases: [] };
  let gameplayChanged = false;

  for (const action of actions) {
    if (action.type === "care") {
      const available = Math.floor(row.action_tokens_milli / TOKEN_COST_MILLI);
      const accepted = Math.min(action.count, available);
      if (accepted === 0) continue;
      const gainedBigInt = BigInt(careTicksPerAction(row.gloves_level)) * BigInt(accepted);
      if (gainedBigInt > BigInt(MAX_SAFE_TICKS)) {
        throw new GardenError("numeric_limit", 409, { field: "growthTicks" });
      }
      const gained = Number(gainedBigInt);
      row.action_tokens_milli -= accepted * TOKEN_COST_MILLI;
      row.growth_ticks = checkedAdd(row.growth_ticks, gained, "growthTicks");
      row.care_ticks = checkedAdd(row.care_ticks, gained, "careTicks");
      row.certified_actions = checkedAdd(row.certified_actions, accepted, "certifiedActions");
      row.growth_reached_at_ms = now;
      result.acceptedCare += accepted;
      gameplayChanged = true;
      continue;
    }

    const level = action.upgrade === "gloves" ? row.gloves_level : row.rain_barrel_level;
    const costTicks = upgradeCostTicks(action.upgrade, level);
    if (costTicks > MAX_SAFE_TICKS) {
      throw new GardenError("upgrade_limit", 409, { upgrade: action.upgrade });
    }
    if (row.care_ticks < costTicks) {
      throw new GardenError("insufficient_care", 409, {
        upgrade: action.upgrade,
        requiredCareTicks: costTicks,
        availableCareTicks: row.care_ticks,
      });
    }
    row.care_ticks -= costTicks;
    if (action.upgrade === "gloves") row.gloves_level += 1;
    else row.rain_barrel_level += 1;
    result.purchases.push({ upgrade: action.upgrade, level: level + 1, costTicks });
    gameplayChanged = true;
  }

  if (gameplayChanged) {
    row.revision = checkedAdd(row.revision, 1, "revision");
    row.updated_at_ms = now;
  }
  return { row, result };
};

const commandFingerprint = (actions: GardenAction[]) => JSON.stringify(actions);

const getPlayer = async (env: GardenEnv, playerId: string) =>
  env.DB.prepare("SELECT * FROM garden_players WHERE player_id = ?")
    .bind(playerId)
    .first<GardenPlayerRow>();

const gameplayUpdateStatement = (env: GardenEnv, row: GardenPlayerRow) =>
  env.DB.prepare(
    `UPDATE garden_players SET
      growth_ticks = ?,
      care_ticks = ?,
      gloves_level = ?,
      rain_barrel_level = ?,
      last_settled_at_ms = ?,
      passive_remainder_milliticks = ?,
      action_tokens_milli = ?,
      action_refill_at_ms = ?,
      certified_actions = ?,
      revision = ?,
      growth_reached_at_ms = ?,
      updated_at_ms = ?
    WHERE player_id = ?`,
  ).bind(
    row.growth_ticks,
    row.care_ticks,
    row.gloves_level,
    row.rain_barrel_level,
    row.last_settled_at_ms,
    row.passive_remainder_milliticks,
    row.action_tokens_milli,
    row.action_refill_at_ms,
    row.certified_actions,
    row.revision,
    row.growth_reached_at_ms,
    row.updated_at_ms,
    row.player_id,
  );

const settlePlayer = async (env: GardenEnv, playerId: string, now: number) => {
  const current = await getPlayer(env, playerId);
  if (!current) throw new GardenError("garden_not_found", 404);
  const settled = settleGardenRow(current, now);
  if (settled.changed) await gameplayUpdateStatement(env, settled.row).run();
  return settled.row;
};

const readCredential = async (request: Request, env: GardenEnv) => {
  const stored = getCookie(request, gardenCookieName(env));
  if (!stored) return null;
  const separator = stored.lastIndexOf(".");
  if (separator <= 0) return null;
  const value = stored.slice(0, separator);
  const signature = stored.slice(separator + 1);
  if (!(await verifySignature(`garden-session:${value}`, signature, env.COOKIE_SECRET))) {
    return null;
  }
  const versionSeparator = value.lastIndexOf(":");
  if (versionSeparator <= 0) return null;
  const playerId = value.slice(0, versionSeparator);
  const sessionVersion = Number(value.slice(versionSeparator + 1));
  if (!PLAYER_ID_PATTERN.test(playerId) || !Number.isSafeInteger(sessionVersion)) return null;
  const row = await env.DB.prepare(
    "SELECT player_id, session_version FROM garden_players WHERE player_id = ?",
  )
    .bind(playerId)
    .first<{ player_id: string; session_version: number }>();
  if (!row || Number(row.session_version) !== sessionVersion) return null;
  return { playerId, sessionVersion };
};

const requireCredential = async (request: Request, env: GardenEnv) => {
  const credential = await readCredential(request, env);
  if (!credential) throw new GardenError("unauthorized", 401);
  return credential;
};

const randomRecoveryCode = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const compact = [...bytes]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
  return compact.match(/.{1,4}/g)?.join("-") ?? compact;
};

const normalizeRecoveryCode = (value: unknown) => {
  if (typeof value !== "string") throw new GardenError("invalid_recovery_code", 400);
  const normalized = value.replaceAll("-", "").replaceAll(" ", "").toUpperCase();
  if (!RECOVERY_CODE_PATTERN.test(normalized)) {
    throw new GardenError("invalid_recovery_code", 400);
  }
  return normalized;
};

const recoveryHash = async (normalizedCode: string, env: GardenEnv) =>
  sign(`garden-recovery:${normalizedCode}`, env.COOKIE_SECRET);

const rateLimitKey = (request: Request, scope: string) => {
  const address = request.headers.get("cf-connecting-ip") ?? "unknown";
  return `${scope}:${address}`;
};

const enforceRateLimit = async (limiter: RateLimitBinding | undefined, key: string) => {
  const result = await limiter?.limit({ key });
  if (result && !result.success) throw new GardenError("rate_limited", 429);
};

const registerPlayer = async (request: Request, env: GardenEnv) => {
  await enforceRateLimit(env.GARDEN_RATE_LIMITER, rateLimitKey(request, "garden-register"));
  if (await readCredential(request, env)) throw new GardenError("already_registered", 409);
  const body = await parseJson(request);
  if (!isRecord(body)) throw new GardenError("invalid_registration", 400);
  const nickname = normalizeNickname(body.nickname);
  const now = Date.now();
  const playerId = crypto.randomUUID();
  const recoveryCode = randomRecoveryCode();
  const codeHash = await recoveryHash(normalizeRecoveryCode(recoveryCode), env);
  const row: GardenPlayerRow = {
    player_id: playerId,
    nickname,
    growth_ticks: INITIAL_GROWTH_TICKS,
    care_ticks: 0,
    gloves_level: 0,
    rain_barrel_level: 0,
    last_settled_at_ms: now,
    passive_remainder_milliticks: 0,
    action_tokens_milli: TOKEN_CAPACITY_MILLI,
    action_refill_at_ms: now,
    certified_actions: 0,
    revision: 1,
    hidden: 0,
    session_version: 1,
    recovery_code_hash: codeHash,
    growth_reached_at_ms: now,
    created_at_ms: now,
    updated_at_ms: now,
  };
  await env.DB.prepare(
    `INSERT INTO garden_players (
      player_id, nickname, growth_ticks, care_ticks, gloves_level, rain_barrel_level,
      last_settled_at_ms, passive_remainder_milliticks, action_tokens_milli,
      action_refill_at_ms, certified_actions, revision, hidden, session_version,
      recovery_code_hash, growth_reached_at_ms, created_at_ms, updated_at_ms
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      row.player_id,
      row.nickname,
      row.growth_ticks,
      row.care_ticks,
      row.gloves_level,
      row.rain_barrel_level,
      row.last_settled_at_ms,
      row.passive_remainder_milliticks,
      row.action_tokens_milli,
      row.action_refill_at_ms,
      row.certified_actions,
      row.revision,
      row.hidden,
      row.session_version,
      row.recovery_code_hash,
      row.growth_reached_at_ms,
      row.created_at_ms,
      row.updated_at_ms,
    )
    .run();
  const response = json({ state: makeState(row, now), recoveryCode }, { status: 201 });
  return withCookie(response, await gardenCookie(env, playerId, row.session_version));
};

const finalizeRecovery = async (
  env: GardenEnv,
  playerId: string,
  oldHash: string,
  nextHash: string,
) => {
  const current = await getPlayer(env, playerId);
  if (!current || current.recovery_code_hash !== oldHash) {
    throw new GardenError("invalid_recovery_code", 401);
  }
  const now = Date.now();
  const settled = settleGardenRow(current, now);
  const row = settled.row;
  row.session_version = checkedAdd(current.session_version, 1, "sessionVersion");
  row.recovery_code_hash = nextHash;
  row.revision = checkedAdd(row.revision, 1, "revision");
  row.updated_at_ms = now;
  const result = await env.DB.prepare(
    `UPDATE garden_players
      SET growth_ticks = ?,
          care_ticks = ?,
          gloves_level = ?,
          rain_barrel_level = ?,
          last_settled_at_ms = ?,
          passive_remainder_milliticks = ?,
          action_tokens_milli = ?,
          action_refill_at_ms = ?,
          certified_actions = ?,
          revision = ?,
          growth_reached_at_ms = ?,
          updated_at_ms = ?,
          session_version = ?,
          recovery_code_hash = ?
      WHERE player_id = ? AND recovery_code_hash = ? AND session_version = ?`,
  )
    .bind(
      row.growth_ticks,
      row.care_ticks,
      row.gloves_level,
      row.rain_barrel_level,
      row.last_settled_at_ms,
      row.passive_remainder_milliticks,
      row.action_tokens_milli,
      row.action_refill_at_ms,
      row.certified_actions,
      row.revision,
      row.growth_reached_at_ms,
      row.updated_at_ms,
      row.session_version,
      row.recovery_code_hash,
      row.player_id,
      oldHash,
      current.session_version,
    )
    .run();
  if (Number(result.meta.changes ?? 0) !== 1) {
    throw new GardenError("invalid_recovery_code", 401);
  }
  return {
    state: makeState(row, now),
    sessionVersion: row.session_version,
  };
};

const coordinateRecovery = async (
  env: GardenEnv,
  playerId: string,
  oldHash: string,
  nextHash: string,
) => {
  if (!env.GARDEN_COORDINATOR) {
    return finalizeRecovery(env, playerId, oldHash, nextHash);
  }
  const stub = env.GARDEN_COORDINATOR.getByName(playerId);
  const response = await stub.fetch(
    new Request(`https://${INTERNAL_HOST}${GARDEN_API_ROOT}/recover`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-garden-operation": "recover",
        "x-garden-player-id": playerId,
      },
      body: JSON.stringify({ oldHash, nextHash }),
    }),
  );
  const body = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    const code = typeof body.error === "string" ? body.error : "internal_error";
    throw new GardenError(code, response.status);
  }
  const sessionVersion = Number(body.sessionVersion);
  if (!isRecord(body.state) || !Number.isSafeInteger(sessionVersion)) {
    throw new GardenError("internal_error", 500);
  }
  return { state: body.state as unknown as GardenState, sessionVersion };
};

const recoverPlayer = async (request: Request, env: GardenEnv) => {
  await enforceRateLimit(env.GARDEN_RATE_LIMITER, rateLimitKey(request, "garden-recover"));
  const body = await parseJson(request);
  if (!isRecord(body)) throw new GardenError("invalid_recovery", 400);
  const oldHash = await recoveryHash(normalizeRecoveryCode(body.recoveryCode), env);
  const match = await env.DB.prepare(
    "SELECT player_id FROM garden_players WHERE recovery_code_hash = ?",
  )
    .bind(oldHash)
    .first<{ player_id: string }>();
  if (!match) throw new GardenError("invalid_recovery_code", 401);

  const nextRecoveryCode = randomRecoveryCode();
  const nextHash = await recoveryHash(normalizeRecoveryCode(nextRecoveryCode), env);
  const recovered = await coordinateRecovery(env, match.player_id, oldHash, nextHash);
  const response = json({ state: recovered.state, recoveryCode: nextRecoveryCode });
  return withCookie(response, await gardenCookie(env, match.player_id, recovered.sessionVersion));
};

const rankForPlayer = async (env: GardenEnv, row: GardenPlayerRow, now: number) => {
  if (row.hidden) return null;
  const effectiveGrowthTicks = settleGardenRow(row, now).row.growth_ticks;
  const result = await env.DB.prepare(
    `WITH effective AS (
      SELECT
        player_id,
        ${EFFECTIVE_GROWTH_SQL} AS effective_growth_ticks
      FROM garden_players
      WHERE hidden = 0
    )
    SELECT COUNT(*) + 1 AS rank
      FROM effective
      WHERE
        effective_growth_ticks > ? OR
        (effective_growth_ticks = ? AND player_id < ?)
      `,
  )
    .bind(now, effectiveGrowthTicks, effectiveGrowthTicks, row.player_id)
    .first<{ rank: number }>();
  return Number(result?.rank ?? 1);
};

const leaderboardEntry = (
  row: Pick<GardenPlayerRow, "nickname" | "growth_ticks" | "player_id">,
  rank: number,
) => ({
  rank,
  nickname: row.nickname,
  growthTicks: Number(row.growth_ticks),
  lengthMm: Number(row.growth_ticks) / 8,
  title: titleForGrowth(Number(row.growth_ticks)),
});

const getLeaderboard = async (request: Request, env: GardenEnv) => {
  const url = new URL(request.url);
  const rawLimit = Number(url.searchParams.get("limit") ?? 20);
  if (!Number.isInteger(rawLimit) || rawLimit < 1) {
    throw new GardenError("invalid_limit", 400);
  }
  const limit = Math.min(rawLimit, 20);
  await enforceRateLimit(env.GARDEN_READ_RATE_LIMITER, rateLimitKey(request, "garden-leaderboard"));
  const now = Date.now();
  const result = await env.DB.prepare(
    `WITH effective AS (
      SELECT
        player_id,
        nickname,
        growth_reached_at_ms,
        ${EFFECTIVE_GROWTH_SQL} AS effective_growth_ticks
      FROM garden_players
      WHERE hidden = 0
    )
    SELECT
      player_id,
      nickname,
      effective_growth_ticks AS growth_ticks,
      growth_reached_at_ms
      FROM effective
      ORDER BY effective_growth_ticks DESC, player_id ASC
      LIMIT ?`,
  )
    .bind(now, limit)
    .all<
      Pick<GardenPlayerRow, "player_id" | "nickname" | "growth_ticks" | "growth_reached_at_ms">
    >();
  const entries = result.results.map((row, index) => leaderboardEntry(row, index + 1));

  const credential = await readCredential(request, env);
  let self: ReturnType<typeof leaderboardEntry> | null = null;
  if (credential) {
    const row = await getPlayer(env, credential.playerId);
    if (row && !row.hidden) {
      const rank = await rankForPlayer(env, row, now);
      if (rank !== null) {
        const effectiveRow = settleGardenRow(row, now).row;
        self = leaderboardEntry(effectiveRow, rank);
      }
    }
  }
  return json({ entries, self, generatedAt: iso(now) });
};

const handleActions = async (request: Request, env: GardenEnv, playerId: string) => {
  const command = await parseCommand(request);
  const fingerprint = commandFingerprint(command.actions);
  const commandHash = await sha256(fingerprint);
  const previous = await env.DB.prepare(
    `SELECT command_hash, response_json
      FROM garden_commands WHERE player_id = ? AND command_id = ?`,
  )
    .bind(playerId, command.commandId)
    .first<GardenCommandRow>();
  if (previous) {
    if (previous.command_hash !== commandHash) {
      throw new GardenError("command_id_conflict", 409);
    }
    return json(JSON.parse(previous.response_json));
  }

  const current = await getPlayer(env, playerId);
  if (!current) throw new GardenError("garden_not_found", 404);
  const now = Date.now();
  const { row, result } = executeGardenActions(current, command.actions, now);
  const responseBody = {
    state: makeState(row, now),
    result,
    duplicate: false,
  };
  await env.DB.batch([
    gameplayUpdateStatement(env, row),
    env.DB.prepare(
      `INSERT INTO garden_commands
        (player_id, command_id, command_hash, response_json, created_at_ms)
        VALUES (?, ?, ?, ?, ?)`,
    ).bind(playerId, command.commandId, commandHash, JSON.stringify(responseBody), now),
    env.DB.prepare(
      `DELETE FROM garden_commands
        WHERE player_id = ? AND command_id NOT IN (
          SELECT command_id FROM garden_commands
          WHERE player_id = ?
          ORDER BY created_at_ms DESC, (command_id = ?) DESC, command_id DESC
          LIMIT ?
        )`,
    ).bind(playerId, playerId, command.commandId, MAX_COMMAND_HISTORY),
  ]);
  return json(responseBody);
};

const handleSession = async (env: GardenEnv, playerId: string) => {
  const now = Date.now();
  const row = await settlePlayer(env, playerId, now);
  return json({ state: makeState(row, now) });
};

const renamePlayer = async (request: Request, env: GardenEnv, playerId: string) => {
  const body = await parseJson(request);
  if (!isRecord(body)) throw new GardenError("invalid_profile", 400);
  const nickname = normalizeNickname(body.nickname);
  const now = Date.now();
  await env.DB.prepare(
    `UPDATE garden_players
      SET nickname = ?, revision = revision + 1, updated_at_ms = ?
      WHERE player_id = ?`,
  )
    .bind(nickname, now, playerId)
    .run();
  const row = await getPlayer(env, playerId);
  if (!row) throw new GardenError("garden_not_found", 404);
  return json({ state: makeState(row, now) });
};

const deletePlayer = async (env: GardenEnv, playerId: string) => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM garden_commands WHERE player_id = ?").bind(playerId),
    env.DB.prepare("DELETE FROM garden_players WHERE player_id = ?").bind(playerId),
  ]);
  return new Response(null, { status: 204 });
};

const rotateRecoveryCode = async (env: GardenEnv, playerId: string) => {
  const recoveryCode = randomRecoveryCode();
  const codeHash = await recoveryHash(normalizeRecoveryCode(recoveryCode), env);
  const now = Date.now();
  await env.DB.prepare(
    `UPDATE garden_players
      SET recovery_code_hash = ?, revision = revision + 1, updated_at_ms = ?
      WHERE player_id = ?`,
  )
    .bind(codeHash, now, playerId)
    .run();
  return json({ recoveryCode });
};

const cardSnapshot = async (env: GardenEnv, playerId: string) => {
  const now = Date.now();
  const row = await settlePlayer(env, playerId, now);
  if (row.growth_ticks < CARD_UNLOCK_TICKS) {
    throw new GardenError("card_locked", 403, {
      requiredGrowthTicks: CARD_UNLOCK_TICKS,
    });
  }
  const rank = await rankForPlayer(env, row, now);
  return json({
    snapshot: {
      nickname: row.nickname,
      growthTicks: row.growth_ticks,
      lengthMm: row.growth_ticks / 8,
      rank,
      growingDays: Math.max(1, Math.floor((now - row.created_at_ms) / 86_400_000) + 1),
      passiveTicksPerSecond: passiveTicksPerSecond(row.rain_barrel_level),
      passiveMmPerSecond: passiveTicksPerSecond(row.rain_barrel_level) / 8,
      glovesLevel: row.gloves_level,
      rainBarrelLevel: row.rain_barrel_level,
      title: titleForGrowth(row.growth_ticks),
      unlockedScenes: scenesForGrowth(row.growth_ticks),
      revision: row.revision,
      generatedAt: iso(now),
    },
  });
};

const handlePlayerRequest = async (request: Request, env: GardenEnv, playerId: string) => {
  const url = new URL(request.url);
  if (url.pathname === `${GARDEN_API_ROOT}/session` && request.method === "POST") {
    return handleSession(env, playerId);
  }
  if (url.pathname === `${GARDEN_API_ROOT}/actions` && request.method === "POST") {
    return handleActions(request, env, playerId);
  }
  if (url.pathname === `${GARDEN_API_ROOT}/me` && request.method === "PATCH") {
    return renamePlayer(request, env, playerId);
  }
  if (url.pathname === `${GARDEN_API_ROOT}/me` && request.method === "DELETE") {
    return deletePlayer(env, playerId);
  }
  if (url.pathname === `${GARDEN_API_ROOT}/me/recovery-code/rotate` && request.method === "POST") {
    return rotateRecoveryCode(env, playerId);
  }
  if (url.pathname === `${GARDEN_API_ROOT}/card-snapshot` && request.method === "POST") {
    return cardSnapshot(env, playerId);
  }
  throw new GardenError("not_found", 404);
};

const forwardToCoordinator = async (
  request: Request,
  env: GardenEnv,
  playerId: string,
  sessionVersion: number,
) => {
  if (!env.GARDEN_COORDINATOR) return handlePlayerRequest(request, env, playerId);
  const url = new URL(request.url);
  url.protocol = "https:";
  url.host = INTERNAL_HOST;
  const headers = new Headers(request.headers);
  headers.set("x-garden-player-id", playerId);
  headers.set("x-garden-session-version", String(sessionVersion));
  headers.delete("cookie");
  headers.delete("authorization");
  headers.delete("x-garden-operation");
  headers.delete("content-length");
  const body =
    request.method === "GET" || request.method === "HEAD" || !request.body
      ? undefined
      : await readBoundedBody(request);
  const internalRequest = new Request(url, {
    method: request.method,
    headers,
    body,
  });
  const stub = env.GARDEN_COORDINATOR.getByName(playerId);
  return stub.fetch(internalRequest);
};

const adminAuthorized = (request: Request, env: GardenEnv) =>
  Boolean(env.ADMIN_TOKEN && request.headers.get("authorization") === `Bearer ${env.ADMIN_TOKEN}`);

const adminPlayer = (row: GardenPlayerRow) => ({
  playerId: row.player_id,
  nickname: row.nickname,
  growthTicks: Number(row.growth_ticks),
  lengthMm: Number(row.growth_ticks) / 8,
  glovesLevel: Number(row.gloves_level),
  rainBarrelLevel: Number(row.rain_barrel_level),
  revision: Number(row.revision),
  hidden: Boolean(row.hidden),
  createdAt: iso(Number(row.created_at_ms)),
  updatedAt: iso(Number(row.updated_at_ms)),
});

const handleGardenAdmin = async (request: Request, env: GardenEnv) => {
  if (!adminAuthorized(request, env)) throw new GardenError("unauthorized", 401);
  const url = new URL(request.url);
  if (url.pathname === `${GARDEN_API_ROOT}/admin/players` && request.method === "GET") {
    const rawLimit = Number(url.searchParams.get("limit") ?? 100);
    if (!Number.isInteger(rawLimit) || rawLimit < 1) {
      throw new GardenError("invalid_limit", 400);
    }
    const limit = Math.min(rawLimit, 250);
    const includeHidden = url.searchParams.get("includeHidden") === "true";
    const result = includeHidden
      ? await env.DB.prepare(
          `SELECT * FROM garden_players
            ORDER BY growth_ticks DESC, growth_reached_at_ms ASC, player_id ASC
            LIMIT ?`,
        )
          .bind(limit)
          .all<GardenPlayerRow>()
      : await env.DB.prepare(
          `SELECT * FROM garden_players
            WHERE hidden = 0
            ORDER BY growth_ticks DESC, growth_reached_at_ms ASC, player_id ASC
            LIMIT ?`,
        )
          .bind(limit)
          .all<GardenPlayerRow>();
    return json({ players: result.results.map(adminPlayer), generatedAt: iso(Date.now()) });
  }

  const prefix = `${GARDEN_API_ROOT}/admin/players/`;
  if (url.pathname.startsWith(prefix) && request.method === "PATCH") {
    const playerId = decodeURIComponent(url.pathname.slice(prefix.length));
    if (!PLAYER_ID_PATTERN.test(playerId)) throw new GardenError("invalid_player_id", 400);
    const body = await parseJson(request);
    if (!isRecord(body) || typeof body.hidden !== "boolean") {
      throw new GardenError("invalid_hidden_state", 400);
    }
    const now = Date.now();
    await env.DB.prepare(
      `UPDATE garden_players
        SET hidden = ?, revision = revision + 1, updated_at_ms = ?
        WHERE player_id = ?`,
    )
      .bind(body.hidden ? 1 : 0, now, playerId)
      .run();
    const row = await getPlayer(env, playerId);
    if (!row) throw new GardenError("garden_not_found", 404);
    return json({ player: adminPlayer(row) });
  }
  throw new GardenError("not_found", 404);
};

const gardenErrorResponse = (error: unknown) => {
  if (error instanceof GardenError) {
    return json({ error: error.code, ...error.details }, { status: error.status });
  }
  console.error("garden_api_error", error);
  return json({ error: "internal_error" }, { status: 500 });
};

export const handleGardenRequest = async (request: Request, env: GardenEnv) => {
  try {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204 });
    if (
      url.pathname === `${GARDEN_API_ROOT}/admin/players` ||
      url.pathname.startsWith(`${GARDEN_API_ROOT}/admin/players/`)
    ) {
      requireSameOrigin(request, env);
      return await handleGardenAdmin(request, env);
    }
    if (url.pathname === `${GARDEN_API_ROOT}/players` && request.method === "POST") {
      requireSameOrigin(request, env);
      return await registerPlayer(request, env);
    }
    if (url.pathname === `${GARDEN_API_ROOT}/recover` && request.method === "POST") {
      requireSameOrigin(request, env);
      return await recoverPlayer(request, env);
    }
    if (url.pathname === `${GARDEN_API_ROOT}/leaderboard` && request.method === "GET") {
      return await getLeaderboard(request, env);
    }
    if (url.pathname !== GARDEN_API_ROOT && !url.pathname.startsWith(`${GARDEN_API_ROOT}/`)) {
      throw new GardenError("not_found", 404);
    }

    requireSameOrigin(request, env);
    const credential = await requireCredential(request, env);
    await enforceRateLimit(env.GARDEN_PLAYER_RATE_LIMITER, `garden-player:${credential.playerId}`);
    let response = await forwardToCoordinator(
      request,
      env,
      credential.playerId,
      credential.sessionVersion,
    );
    if (url.pathname === `${GARDEN_API_ROOT}/me` && request.method === "DELETE") {
      if (response.status === 204) response = withCookie(response, clearGardenCookie(env));
    }
    return response;
  } catch (error) {
    return gardenErrorResponse(error);
  }
};

export class GardenCoordinator {
  private readonly state: DurableObjectState;
  private readonly env: GardenEnv;
  private queueTail: Promise<void> = Promise.resolve();

  constructor(state: DurableObjectState, env: GardenEnv) {
    this.state = state;
    this.env = env;
    void this.state;
  }

  private async fetchSerial(request: Request): Promise<Response> {
    try {
      const playerId = request.headers.get("x-garden-player-id");
      if (!playerId || !PLAYER_ID_PATTERN.test(playerId)) {
        throw new GardenError("invalid_internal_request", 403);
      }
      if (request.headers.get("x-garden-operation") === "recover") {
        const body = await parseJson(request);
        if (
          !isRecord(body) ||
          typeof body.oldHash !== "string" ||
          typeof body.nextHash !== "string" ||
          !HMAC_HASH_PATTERN.test(body.oldHash) ||
          !HMAC_HASH_PATTERN.test(body.nextHash)
        ) {
          throw new GardenError("invalid_internal_request", 403);
        }
        return json(await finalizeRecovery(this.env, playerId, body.oldHash, body.nextHash));
      }
      const sessionVersion = Number(request.headers.get("x-garden-session-version"));
      if (!Number.isSafeInteger(sessionVersion) || sessionVersion < 1) {
        throw new GardenError("invalid_internal_request", 403);
      }
      const session = await this.env.DB.prepare(
        "SELECT session_version FROM garden_players WHERE player_id = ?",
      )
        .bind(playerId)
        .first<{ session_version: number }>();
      if (!session || Number(session.session_version) !== sessionVersion) {
        throw new GardenError("unauthorized", 401);
      }
      return await handlePlayerRequest(request, this.env, playerId);
    } catch (error) {
      return gardenErrorResponse(error);
    }
  }

  async fetch(request: Request): Promise<Response> {
    const predecessor = this.queueTail;
    let release = () => {};
    this.queueTail = new Promise<void>((resolve) => {
      release = resolve;
    });
    try {
      await predecessor.catch(() => undefined);
      return await this.fetchSerial(request);
    } finally {
      release();
    }
  }
}

export const GARDEN_TEST_CONSTANTS = {
  CARD_UNLOCK_TICKS,
  INITIAL_GROWTH_TICKS,
  MAX_OFFLINE_MS,
  MAX_CARE_PER_SECOND,
  MAX_SAFE_TICKS,
  TOKEN_CAPACITY_MILLI,
} as const;
