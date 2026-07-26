import { normalizeCardSnapshot, normalizeGardenState, titleForGrowth } from "./garden-format";
import type {
  CardSnapshot,
  GardenActionResponse,
  GardenApiErrorBody,
  GardenPurchase,
  GardenPurchaseResult,
  GardenState,
  LeaderboardData,
  LeaderboardEntry,
} from "./garden-types";

const API_ROOT = "/api/garden";
const REQUEST_TIMEOUT = 8_000;

export class GardenApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, body: GardenApiErrorBody = {}) {
    super(body.message || body.error || `Garden API: ${status}`);
    this.name = "GardenApiError";
    this.status = status;
    this.code = body.error ?? "request_failed";
  }
}

const request = async <T>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> => {
  const headers = new Headers(init.headers);
  if (init.json !== undefined) headers.set("content-type", "application/json");
  const response = await fetch(`${API_ROOT}${path}`, {
    ...init,
    headers,
    body: init.json === undefined ? init.body : JSON.stringify(init.json),
    credentials: "same-origin",
    cache: "no-store",
    signal: init.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT),
  });
  if (!response.ok) {
    let body: GardenApiErrorBody = {};
    try {
      body = (await response.json()) as GardenApiErrorBody;
    } catch {
      // A status and a stable generic code are enough when an upstream response is not JSON.
    }
    throw new GardenApiError(response.status, body);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
};

const normalizeLeaderboardEntry = (value: unknown, isMe = false): LeaderboardEntry | null => {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const growthTicks = Math.max(0, Math.trunc(Number(row.growthTicks ?? row.growth_ticks ?? 0)));
  const rank = Math.max(0, Math.trunc(Number(row.rank ?? 0)));
  if (!rank) return null;
  return {
    rank,
    nickname: String(row.nickname ?? ""),
    growthTicks,
    title: String(row.title ?? titleForGrowth(growthTicks)),
    isMe: Boolean(row.isMe ?? row.is_me ?? isMe),
  };
};

const normalizeActionResult = (value: unknown): GardenActionResponse["result"] => {
  const result = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const acceptedCare = Math.max(0, Math.trunc(Number(result.acceptedCare ?? 0)));
  const purchases = Array.isArray(result.purchases)
    ? result.purchases.flatMap((purchase): GardenPurchaseResult[] => {
        if (!purchase || typeof purchase !== "object") return [];
        const row = purchase as Record<string, unknown>;
        if (row.upgrade !== "gloves" && row.upgrade !== "rainBarrel") return [];
        return [
          {
            upgrade: row.upgrade,
            level: Math.max(0, Math.trunc(Number(row.level ?? 0))),
            costTicks: Math.max(0, Math.trunc(Number(row.costTicks ?? 0))),
          },
        ];
      })
    : [];
  return { acceptedCare, purchases };
};

export const gardenApi = {
  async register(nickname: string): Promise<{ state: GardenState; recoveryCode: string }> {
    const body = await request<Record<string, unknown>>("/players", {
      method: "POST",
      json: { nickname },
    });
    return {
      state: normalizeGardenState(body),
      recoveryCode: String(body.recoveryCode ?? body.recovery_code ?? ""),
    };
  },

  async session(): Promise<GardenState> {
    return normalizeGardenState(await request<unknown>("/session", { method: "POST" }));
  },

  async actions(
    commandId: string,
    actions: Array<{ type: "care"; count: number } | { type: "buy"; upgrade: GardenPurchase }>,
  ): Promise<GardenActionResponse> {
    const body = await request<Record<string, unknown>>("/actions", {
      method: "POST",
      json: { commandId, actions },
    });
    return {
      state: normalizeGardenState(body),
      result: normalizeActionResult(body.result),
    };
  },

  async rename(nickname: string): Promise<GardenState> {
    return normalizeGardenState(
      await request<unknown>("/me", {
        method: "PATCH",
        json: { nickname },
      }),
    );
  },

  async remove(): Promise<void> {
    await request<void>("/me", { method: "DELETE" });
  },

  async leaderboard(limit = 20): Promise<LeaderboardData> {
    const body = await request<Record<string, unknown>>(
      `/leaderboard?limit=${encodeURIComponent(String(limit))}`,
    );
    const entries = Array.isArray(body.entries)
      ? body.entries
          .map((entry) => normalizeLeaderboardEntry(entry))
          .filter((entry): entry is LeaderboardEntry => entry !== null)
      : [];
    const me = normalizeLeaderboardEntry(body.self ?? body.me, true);
    if (me) {
      const matching = entries.find(
        (entry) => entry.rank === me.rank && entry.nickname === me.nickname,
      );
      if (matching) matching.isMe = true;
    }
    return { entries, me };
  },

  async cardSnapshot(): Promise<CardSnapshot> {
    return normalizeCardSnapshot(
      await request<unknown>("/card-snapshot", {
        method: "POST",
      }),
    );
  },

  async recover(recoveryCode: string): Promise<{ state: GardenState; recoveryCode: string }> {
    const body = await request<Record<string, unknown>>("/recover", {
      method: "POST",
      json: { recoveryCode },
    });
    return {
      state: normalizeGardenState(body),
      recoveryCode: String(body.recoveryCode ?? body.recovery_code ?? ""),
    };
  },

  async rotateRecoveryCode(): Promise<string> {
    const body = await request<Record<string, unknown>>("/me/recovery-code/rotate", {
      method: "POST",
    });
    return String(body.recoveryCode ?? body.recovery_code ?? "");
  },
};
