import assert from "node:assert/strict";
import test from "node:test";
import {
  executeGardenActions,
  GARDEN_TEST_CONSTANTS,
  GardenCoordinator,
  settleGardenRow,
  upgradeCostTicks,
} from "../worker/src/garden.ts";
import worker from "../worker/src/index.ts";

const PLAYER_ID = "018f9253-d91c-74f0-aec9-0be7196adab1";

const makeRow = (overrides = {}) => ({
  player_id: PLAYER_ID,
  nickname: "FLYPEA",
  growth_ticks: 80,
  care_ticks: 0,
  gloves_level: 0,
  rain_barrel_level: 0,
  last_settled_at_ms: 0,
  passive_remainder_milliticks: 0,
  action_tokens_milli: 2_000,
  action_refill_at_ms: 0,
  certified_actions: 0,
  revision: 1,
  hidden: 0,
  session_version: 1,
  recovery_code_hash: "recovery-hash",
  growth_reached_at_ms: 0,
  created_at_ms: 0,
  updated_at_ms: 0,
  ...overrides,
});

class GardenStatement {
  constructor(database, sql) {
    this.database = database;
    this.sql = sql.replace(/\s+/g, " ").trim();
    this.args = [];
  }

  bind(...args) {
    this.args = args;
    return this;
  }

  async first() {
    const sql = this.sql;
    if (sql.startsWith("WITH effective AS") && sql.includes("COUNT(*) + 1 AS rank")) {
      const [now, growth, , playerId] = this.args;
      const effective = (row) => {
        const elapsed = Math.min(
          Math.max(now - row.last_settled_at_ms, 0),
          GARDEN_TEST_CONSTANTS.MAX_OFFLINE_MS,
        );
        return (
          row.growth_ticks +
          Math.floor(
            (elapsed * (4 + row.rain_barrel_level * 8) + row.passive_remainder_milliticks) / 1_000,
          )
        );
      };
      const ahead = [...this.database.players.values()].filter(
        (row) =>
          !row.hidden &&
          (effective(row) > growth || (effective(row) === growth && row.player_id < playerId)),
      );
      return { rank: ahead.length + 1 };
    }
    if (sql.startsWith("SELECT player_id, session_version FROM garden_players")) {
      const row = this.database.players.get(this.args[0]);
      return row ? { player_id: row.player_id, session_version: row.session_version } : null;
    }
    if (sql === "SELECT session_version FROM garden_players WHERE player_id = ?") {
      const row = this.database.players.get(this.args[0]);
      return row ? { session_version: row.session_version } : null;
    }
    if (sql === "SELECT * FROM garden_players WHERE player_id = ?") {
      return structuredClone(this.database.players.get(this.args[0]) ?? null);
    }
    if (sql.startsWith("SELECT command_hash, response_json FROM garden_commands")) {
      const row = this.database.commands.get(`${this.args[0]}:${this.args[1]}`);
      return row ? structuredClone(row) : null;
    }
    if (sql.startsWith("SELECT player_id FROM garden_players WHERE recovery_code_hash")) {
      const row = [...this.database.players.values()].find(
        (player) => player.recovery_code_hash === this.args[0],
      );
      return row ? { player_id: row.player_id } : null;
    }
    if (sql.startsWith("SELECT COUNT(*) + 1 AS rank")) {
      const [growth, , reached, , , playerId] = this.args;
      const ahead = [...this.database.players.values()].filter(
        (row) =>
          !row.hidden &&
          (row.growth_ticks > growth ||
            (row.growth_ticks === growth && row.growth_reached_at_ms < reached) ||
            (row.growth_ticks === growth &&
              row.growth_reached_at_ms === reached &&
              row.player_id < playerId)),
      );
      return { rank: ahead.length + 1 };
    }
    throw new Error(`Unhandled first(): ${sql}`);
  }

  async all() {
    const sql = this.sql;
    if (sql.startsWith("WITH effective AS")) {
      const [now, limit] = this.args;
      const results = [...this.database.players.values()]
        .filter((row) => !row.hidden)
        .map((row) => {
          const elapsed = Math.min(
            Math.max(now - row.last_settled_at_ms, 0),
            GARDEN_TEST_CONSTANTS.MAX_OFFLINE_MS,
          );
          return {
            ...row,
            growth_ticks:
              row.growth_ticks +
              Math.floor(
                (elapsed * (4 + row.rain_barrel_level * 8) + row.passive_remainder_milliticks) /
                  1_000,
              ),
          };
        })
        .sort(
          (left, right) =>
            right.growth_ticks - left.growth_ticks || left.player_id.localeCompare(right.player_id),
        )
        .slice(0, limit)
        .map(({ player_id, nickname, growth_ticks, growth_reached_at_ms }) => ({
          player_id,
          nickname,
          growth_ticks,
          growth_reached_at_ms,
        }));
      return { results, success: true };
    }
    if (sql.startsWith("SELECT player_id, nickname, growth_ticks, growth_reached_at_ms")) {
      const limit = this.args[0];
      const results = [...this.database.players.values()]
        .filter((row) => !row.hidden)
        .sort(
          (left, right) =>
            right.growth_ticks - left.growth_ticks ||
            left.growth_reached_at_ms - right.growth_reached_at_ms ||
            left.player_id.localeCompare(right.player_id),
        )
        .slice(0, limit)
        .map(({ player_id, nickname, growth_ticks, growth_reached_at_ms }) => ({
          player_id,
          nickname,
          growth_ticks,
          growth_reached_at_ms,
        }));
      return { results, success: true };
    }
    if (sql.startsWith("SELECT * FROM garden_players")) {
      const limit = this.args[0];
      const includeHidden = !sql.includes("WHERE hidden = 0");
      const results = [...this.database.players.values()]
        .filter((row) => includeHidden || !row.hidden)
        .sort((left, right) => right.growth_ticks - left.growth_ticks)
        .slice(0, limit)
        .map(structuredClone);
      return { results, success: true };
    }
    throw new Error(`Unhandled all(): ${sql}`);
  }

  async run() {
    const sql = this.sql;
    if (sql.startsWith("INSERT INTO garden_players")) {
      const [
        player_id,
        nickname,
        growth_ticks,
        care_ticks,
        gloves_level,
        rain_barrel_level,
        last_settled_at_ms,
        passive_remainder_milliticks,
        action_tokens_milli,
        action_refill_at_ms,
        certified_actions,
        revision,
        hidden,
        session_version,
        recovery_code_hash,
        growth_reached_at_ms,
        created_at_ms,
        updated_at_ms,
      ] = this.args;
      this.database.players.set(player_id, {
        player_id,
        nickname,
        growth_ticks,
        care_ticks,
        gloves_level,
        rain_barrel_level,
        last_settled_at_ms,
        passive_remainder_milliticks,
        action_tokens_milli,
        action_refill_at_ms,
        certified_actions,
        revision,
        hidden,
        session_version,
        recovery_code_hash,
        growth_reached_at_ms,
        created_at_ms,
        updated_at_ms,
      });
      return { success: true, meta: { changes: 1 } };
    }
    if (
      sql.startsWith("UPDATE garden_players SET growth_ticks = ?") &&
      sql.includes("session_version = ?")
    ) {
      if (this.database.failRecoveryUpdate) {
        throw new Error("simulated_recovery_update_failure");
      }
      const [
        growth_ticks,
        care_ticks,
        gloves_level,
        rain_barrel_level,
        last_settled_at_ms,
        passive_remainder_milliticks,
        action_tokens_milli,
        action_refill_at_ms,
        certified_actions,
        revision,
        growth_reached_at_ms,
        updated_at_ms,
        session_version,
        recovery_code_hash,
        playerId,
        oldHash,
        oldSessionVersion,
      ] = this.args;
      const row = this.database.players.get(playerId);
      if (!row || row.recovery_code_hash !== oldHash || row.session_version !== oldSessionVersion) {
        return { success: true, meta: { changes: 0 } };
      }
      Object.assign(row, {
        growth_ticks,
        care_ticks,
        gloves_level,
        rain_barrel_level,
        last_settled_at_ms,
        passive_remainder_milliticks,
        action_tokens_milli,
        action_refill_at_ms,
        certified_actions,
        revision,
        growth_reached_at_ms,
        updated_at_ms,
        session_version,
        recovery_code_hash,
      });
      return { success: true, meta: { changes: 1 } };
    }
    if (sql.startsWith("UPDATE garden_players SET growth_ticks = ?")) {
      const [
        growth_ticks,
        care_ticks,
        gloves_level,
        rain_barrel_level,
        last_settled_at_ms,
        passive_remainder_milliticks,
        action_tokens_milli,
        action_refill_at_ms,
        certified_actions,
        revision,
        growth_reached_at_ms,
        updated_at_ms,
        playerId,
      ] = this.args;
      Object.assign(this.database.players.get(playerId), {
        growth_ticks,
        care_ticks,
        gloves_level,
        rain_barrel_level,
        last_settled_at_ms,
        passive_remainder_milliticks,
        action_tokens_milli,
        action_refill_at_ms,
        certified_actions,
        revision,
        growth_reached_at_ms,
        updated_at_ms,
      });
      return { success: true, meta: { changes: 1 } };
    }
    if (sql.startsWith("INSERT INTO garden_commands")) {
      const [playerId, commandId, command_hash, response_json, created_at_ms] = this.args;
      this.database.commands.set(`${playerId}:${commandId}`, {
        command_hash,
        response_json,
        created_at_ms,
      });
      return { success: true, meta: { changes: 1 } };
    }
    if (sql.startsWith("DELETE FROM garden_commands WHERE player_id = ? AND command_id NOT IN")) {
      const [playerId, , currentCommandId, limit] = this.args;
      const commands = [...this.database.commands.entries()]
        .filter(([key]) => key.startsWith(`${playerId}:`))
        .sort(
          ([leftKey, left], [rightKey, right]) =>
            right.created_at_ms - left.created_at_ms || rightKey.localeCompare(leftKey),
        );
      const currentKey = `${playerId}:${currentCommandId}`;
      const currentIndex = commands.findIndex(([key]) => key === currentKey);
      if (currentIndex > 0) {
        const [current] = commands.splice(currentIndex, 1);
        commands.unshift(current);
      }
      for (const [key] of commands.slice(limit)) this.database.commands.delete(key);
      return { success: true, meta: { changes: Math.max(0, commands.length - limit) } };
    }
    if (sql.startsWith("UPDATE garden_players SET session_version = session_version + 1")) {
      const [nextHash, updatedAt, playerId, oldHash] = this.args;
      const row = this.database.players.get(playerId);
      if (!row || row.recovery_code_hash !== oldHash) {
        return { success: true, meta: { changes: 0 } };
      }
      Object.assign(row, {
        session_version: row.session_version + 1,
        recovery_code_hash: nextHash,
        revision: row.revision + 1,
        updated_at_ms: updatedAt,
      });
      return { success: true, meta: { changes: 1 } };
    }
    if (sql.startsWith("UPDATE garden_players SET recovery_code_hash = ?")) {
      const [hash, updatedAt, playerId] = this.args;
      const row = this.database.players.get(playerId);
      Object.assign(row, {
        recovery_code_hash: hash,
        revision: row.revision + 1,
        updated_at_ms: updatedAt,
      });
      return { success: true, meta: { changes: row ? 1 : 0 } };
    }
    if (sql.startsWith("UPDATE garden_players SET nickname = ?")) {
      const [nickname, updatedAt, playerId] = this.args;
      const row = this.database.players.get(playerId);
      if (row) {
        row.nickname = nickname;
        row.revision += 1;
        row.updated_at_ms = updatedAt;
      }
      return { success: true, meta: { changes: row ? 1 : 0 } };
    }
    if (sql.startsWith("UPDATE garden_players SET hidden = ?")) {
      const [hidden, updatedAt, playerId] = this.args;
      const row = this.database.players.get(playerId);
      if (row) {
        row.hidden = hidden;
        row.revision += 1;
        row.updated_at_ms = updatedAt;
      }
      return { success: true, meta: { changes: row ? 1 : 0 } };
    }
    if (sql === "DELETE FROM garden_commands WHERE player_id = ?") {
      for (const key of this.database.commands.keys()) {
        if (key.startsWith(`${this.args[0]}:`)) this.database.commands.delete(key);
      }
      return { success: true, meta: { changes: 1 } };
    }
    if (sql === "DELETE FROM garden_players WHERE player_id = ?") {
      return {
        success: true,
        meta: { changes: this.database.players.delete(this.args[0]) ? 1 : 0 },
      };
    }
    throw new Error(`Unhandled run(): ${sql}`);
  }
}

class MemoryGardenD1 {
  players = new Map();
  commands = new Map();
  batchCount = 0;
  failRecoveryUpdate = false;

  prepare(sql) {
    return new GardenStatement(this, sql);
  }

  async batch(statements) {
    this.batchCount += 1;
    const results = [];
    for (const statement of statements) results.push(await statement.run());
    return results;
  }
}

const makeEnv = () => ({
  DB: new MemoryGardenD1(),
  COOKIE_SECRET: "garden-test-secret-with-at-least-thirty-two-bytes",
  ADMIN_TOKEN: "garden-admin-token",
  SITE_ORIGIN: "https://flypea.tech",
});

const api = (path, { method = "GET", cookie, body, headers = {} } = {}) =>
  new Request(`https://flypea.tech/api/garden${path}`, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

const register = async (env, nickname = "FLYPEA") => {
  const response = await worker.fetch(api("/players", { method: "POST", body: { nickname } }), env);
  const body = await response.json();
  const cookie = response.headers.get("set-cookie")?.split(";", 1)[0];
  return { response, body, cookie };
};

const attachCoordinator = (env) => {
  const coordinator = new GardenCoordinator({}, env);
  env.GARDEN_COORDINATOR = {
    getByName() {
      return {
        fetch(request) {
          return coordinator.fetch(request);
        },
      };
    },
  };
  return coordinator;
};

test("upgrade costs use repeated exact ceil(1.6x) integer arithmetic", () => {
  assert.deepEqual(
    [0, 1, 2, 3, 4].map((level) => upgradeCostTicks("gloves", level)),
    [160, 256, 410, 656, 1050],
  );
  assert.deepEqual(
    [0, 1, 2, 3].map((level) => upgradeCostTicks("rainBarrel", level)),
    [240, 384, 615, 984],
  );
  assert.ok(upgradeCostTicks("gloves", 1_000) > GARDEN_TEST_CONSTANTS.MAX_SAFE_TICKS);
});

test("passive settlement preserves fractions, rejects clock reversal, and caps at 24 hours", () => {
  const first = settleGardenRow(makeRow(), 125);
  assert.equal(first.earnedTicks, 0);
  assert.equal(first.row.passive_remainder_milliticks, 500);

  const second = settleGardenRow(first.row, 250);
  assert.equal(second.earnedTicks, 1);
  assert.equal(second.row.growth_ticks, 81);
  assert.equal(second.row.care_ticks, 1);
  assert.equal(second.row.passive_remainder_milliticks, 0);

  const reversed = settleGardenRow(second.row, 249);
  assert.equal(reversed.changed, false);
  assert.deepEqual(reversed.row, second.row);

  const offline = settleGardenRow(makeRow(), GARDEN_TEST_CONSTANTS.MAX_OFFLINE_MS + 86_400_000);
  assert.equal(offline.earnedTicks, 4 * 86_400);
  assert.equal(offline.row.growth_ticks, 80 + 4 * 86_400);
});

test("server token bucket accepts at most twenty-five care actions per second", () => {
  const source = makeRow({ action_tokens_milli: 0 });
  const firstWindow = executeGardenActions(source, [{ type: "care", count: 25 }], 400);
  assert.equal(firstWindow.result.acceptedCare, 10);
  assert.equal(firstWindow.row.certified_actions, 10);
  assert.equal(firstWindow.row.action_tokens_milli, 0);

  const sameMoment = executeGardenActions(firstWindow.row, [{ type: "care", count: 25 }], 400);
  assert.equal(sameMoment.result.acceptedCare, 0);

  const endOfSecond = executeGardenActions(sameMoment.row, [{ type: "care", count: 25 }], 1_000);
  assert.equal(endOfSecond.result.acceptedCare, 15);
  assert.equal(endOfSecond.row.certified_actions, 25);

  const fullBucket = executeGardenActions(makeRow(), [{ type: "care", count: 25 }], 0);
  assert.equal(fullBucket.result.acceptedCare, 25);
  assert.equal(fullBucket.row.action_tokens_milli, 0);
});

test("actions API accepts a 25-CARE batch and rejects larger batches", async () => {
  const env = makeEnv();
  const { cookie } = await register(env);
  attachCoordinator(env);

  const acceptedResponse = await worker.fetch(
    api("/actions", {
      method: "POST",
      cookie,
      body: {
        commandId: "garden-25-cps-accepted",
        actions: [{ type: "care", count: 25 }],
      },
    }),
    env,
  );
  assert.equal(acceptedResponse.status, 200);
  assert.equal((await acceptedResponse.json()).result.acceptedCare, 25);

  const rejectedResponse = await worker.fetch(
    api("/actions", {
      method: "POST",
      cookie,
      body: {
        commandId: "garden-26-cps-rejected",
        actions: [{ type: "care", count: 26 }],
      },
    }),
    env,
  );
  assert.equal(rejectedResponse.status, 400);
  assert.deepEqual(await rejectedResponse.json(), { error: "invalid_care_count" });
});

test("purchases spend only CARE and numeric overflow is rejected", () => {
  const purchase = executeGardenActions(
    makeRow({ care_ticks: 160 }),
    [{ type: "buy", upgrade: "gloves" }],
    0,
  );
  assert.equal(purchase.row.growth_ticks, 80);
  assert.equal(purchase.row.care_ticks, 0);
  assert.equal(purchase.row.gloves_level, 1);
  assert.deepEqual(purchase.result.purchases, [{ upgrade: "gloves", level: 1, costTicks: 160 }]);

  assert.throws(
    () =>
      executeGardenActions(
        makeRow({ growth_ticks: GARDEN_TEST_CONSTANTS.MAX_SAFE_TICKS }),
        [{ type: "care", count: 1 }],
        0,
      ),
    (error) => error.code === "numeric_limit",
  );
});

test("purchase endpoint explicitly rejects insufficient CARE without recording a command", async () => {
  const env = makeEnv();
  const registered = await register(env);
  const player = [...env.DB.players.values()][0];
  player.last_settled_at_ms = Date.now() + 1_000;
  attachCoordinator(env);

  const response = await worker.fetch(
    api("/actions", {
      method: "POST",
      cookie: registered.cookie,
      body: {
        commandId: "garden-insufficient-0001",
        actions: [{ type: "buy", upgrade: "gloves" }],
      },
    }),
    env,
  );
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), {
    error: "insufficient_care",
    upgrade: "gloves",
    requiredCareTicks: 160,
    availableCareTicks: 0,
  });
  assert.equal(player.care_ticks, 0);
  assert.equal(player.gloves_level, 0);
  assert.equal(env.DB.commands.size, 0);
  assert.equal(env.DB.batchCount, 0);
});

test("registration issues only an HttpOnly credential and returns a one-time recovery code", async () => {
  const env = makeEnv();
  const { response, body, cookie } = await register(env, "  豆の庭  ");
  assert.equal(response.status, 201);
  assert.equal(body.state.nickname, "豆の庭");
  assert.equal(body.state.growthTicks, 80);
  assert.match(body.recoveryCode, /^(?:[0-9A-F]{4}-){7}[0-9A-F]{4}$/);
  assert.ok(cookie);
  assert.match(response.headers.get("set-cookie"), /HttpOnly/);
  assert.match(response.headers.get("set-cookie"), /SameSite=Strict/);
  assert.equal("playerId" in body.state, false);
  assert.equal("recoveryCode" in body.state, false);
});

test("actions are atomic and replay the exact stored response for the same command", async () => {
  const env = makeEnv();
  const { cookie } = await register(env);
  const command = {
    commandId: "garden-command-00000001",
    actions: [{ type: "care", count: 2 }],
  };
  const firstResponse = await worker.fetch(
    api("/actions", { method: "POST", cookie, body: command }),
    env,
  );
  const first = await firstResponse.json();
  assert.equal(firstResponse.status, 200);
  assert.equal(first.result.acceptedCare, 2);

  const replayResponse = await worker.fetch(
    api("/actions", { method: "POST", cookie, body: command }),
    env,
  );
  assert.deepEqual(await replayResponse.json(), first);
  assert.equal(env.DB.commands.size, 1);

  const conflict = await worker.fetch(
    api("/actions", {
      method: "POST",
      cookie,
      body: {
        commandId: command.commandId,
        actions: [{ type: "care", count: 1 }],
      },
    }),
    env,
  );
  assert.equal(conflict.status, 409);
  assert.deepEqual(await conflict.json(), { error: "command_id_conflict" });

  for (let index = 2; index <= 65; index += 1) {
    const response = await worker.fetch(
      api("/actions", {
        method: "POST",
        cookie,
        body: {
          commandId: `garden-command-${String(index).padStart(8, "0")}`,
          actions: [{ type: "care", count: 1 }],
        },
      }),
      env,
    );
    assert.equal(response.status, 200);
  }
  assert.equal(env.DB.commands.size, 64);
});

test("a recreated Durable Object replays D1 idempotency state without updating twice", async () => {
  const env = makeEnv();
  const registered = await register(env);
  attachCoordinator(env);
  const command = {
    commandId: "garden-restart-replay-001",
    actions: [{ type: "care", count: 1 }],
  };
  const first = await worker.fetch(
    api("/actions", {
      method: "POST",
      cookie: registered.cookie,
      body: command,
    }),
    env,
  );
  const firstBody = await first.json();
  const batchesAfterFirst = env.DB.batchCount;
  const certifiedAfterFirst = [...env.DB.players.values()][0].certified_actions;

  attachCoordinator(env);
  const replay = await worker.fetch(
    api("/actions", {
      method: "POST",
      cookie: registered.cookie,
      body: command,
    }),
    env,
  );
  assert.equal(replay.status, 200);
  assert.deepEqual(await replay.json(), firstBody);
  assert.equal(env.DB.batchCount, batchesAfterFirst);
  assert.equal([...env.DB.players.values()][0].certified_actions, certifiedAfterFirst);
});

test("Durable Object serializes simultaneous replay and command-id conflicts", async () => {
  const replayEnv = makeEnv();
  const replayRegistration = await register(replayEnv);
  attachCoordinator(replayEnv);
  const replayCommand = {
    commandId: "garden-concurrent-000001",
    actions: [{ type: "care", count: 1 }],
  };
  const batchCountBeforeReplay = replayEnv.DB.batchCount;
  const replayResponses = await Promise.all([
    worker.fetch(
      api("/actions", {
        method: "POST",
        cookie: replayRegistration.cookie,
        body: replayCommand,
      }),
      replayEnv,
    ),
    worker.fetch(
      api("/actions", {
        method: "POST",
        cookie: replayRegistration.cookie,
        body: replayCommand,
      }),
      replayEnv,
    ),
  ]);
  assert.deepEqual(
    replayResponses.map(({ status }) => status),
    [200, 200],
  );
  assert.deepEqual(await replayResponses[1].json(), await replayResponses[0].json());
  assert.equal(replayEnv.DB.batchCount - batchCountBeforeReplay, 1);

  const conflictEnv = makeEnv();
  const conflictRegistration = await register(conflictEnv);
  attachCoordinator(conflictEnv);
  const conflictId = "garden-concurrent-000002";
  const conflictResponses = await Promise.all([
    worker.fetch(
      api("/actions", {
        method: "POST",
        cookie: conflictRegistration.cookie,
        body: {
          commandId: conflictId,
          actions: [{ type: "care", count: 1 }],
        },
      }),
      conflictEnv,
    ),
    worker.fetch(
      api("/actions", {
        method: "POST",
        cookie: conflictRegistration.cookie,
        body: {
          commandId: conflictId,
          actions: [{ type: "care", count: 2 }],
        },
      }),
      conflictEnv,
    ),
  ]);
  assert.deepEqual(conflictResponses.map(({ status }) => status).sort(), [200, 409]);
  assert.equal(conflictEnv.DB.batchCount, 1);
});

test("Durable Object serializes competing purchases for the same CARE balance", async () => {
  const env = makeEnv();
  const registered = await register(env);
  const player = [...env.DB.players.values()][0];
  player.care_ticks = 160;
  player.last_settled_at_ms = Date.now();
  attachCoordinator(env);

  const responses = await Promise.all([
    worker.fetch(
      api("/actions", {
        method: "POST",
        cookie: registered.cookie,
        body: {
          commandId: "garden-purchase-0000001",
          actions: [{ type: "buy", upgrade: "gloves" }],
        },
      }),
      env,
    ),
    worker.fetch(
      api("/actions", {
        method: "POST",
        cookie: registered.cookie,
        body: {
          commandId: "garden-purchase-0000002",
          actions: [{ type: "buy", upgrade: "gloves" }],
        },
      }),
      env,
    ),
  ]);
  assert.deepEqual(responses.map(({ status }) => status).sort(), [200, 409]);
  assert.equal(player.gloves_level, 1);
  assert.equal(player.care_ticks, 0);
  assert.equal(env.DB.batchCount, 1);
});

test("Durable Object revalidates queued session versions and releases the queue after rejection", async () => {
  const env = makeEnv();
  const row = makeRow({ session_version: 2, last_settled_at_ms: Date.now() });
  env.DB.players.set(row.player_id, row);
  const coordinator = attachCoordinator(env);
  const internalRequest = (sessionVersion) =>
    new Request("https://garden.internal/api/garden/session", {
      method: "POST",
      headers: {
        "x-garden-player-id": row.player_id,
        "x-garden-session-version": String(sessionVersion),
      },
    });

  const stale = await coordinator.fetch(internalRequest(1));
  assert.equal(stale.status, 401);
  const current = await coordinator.fetch(internalRequest(2));
  assert.equal(current.status, 200);
});

test("recovery is serialized before an already-authenticated action in the same Durable Object", async () => {
  const env = makeEnv();
  await register(env);
  const player = [...env.DB.players.values()][0];
  const coordinator = attachCoordinator(env);
  const nextHash = "A".repeat(43);
  const recoveryRequest = new Request("https://garden.internal/api/garden/recover", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-garden-operation": "recover",
      "x-garden-player-id": player.player_id,
    },
    body: JSON.stringify({
      oldHash: player.recovery_code_hash,
      nextHash,
    }),
  });
  const staleActionRequest = new Request("https://garden.internal/api/garden/actions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-garden-player-id": player.player_id,
      "x-garden-session-version": "1",
    },
    body: JSON.stringify({
      commandId: "garden-after-recovery-001",
      actions: [{ type: "care", count: 1 }],
    }),
  });

  const [recovery, staleAction] = await Promise.all([
    coordinator.fetch(recoveryRequest),
    coordinator.fetch(staleActionRequest),
  ]);
  assert.equal(recovery.status, 200);
  assert.equal(staleAction.status, 401);
  assert.equal(player.session_version, 2);
  assert.equal(player.recovery_code_hash, nextHash);
  assert.equal(player.certified_actions, 0);
  assert.equal(env.DB.commands.size, 0);
});

test("recovery settles passive GROWTH and CARE in the same credential update", async () => {
  const env = makeEnv();
  const registered = await register(env);
  const player = [...env.DB.players.values()][0];
  const initialGrowth = player.growth_ticks;
  player.rain_barrel_level = 1;
  player.last_settled_at_ms = Date.now() - 1_000;
  attachCoordinator(env);

  const response = await worker.fetch(
    api("/recover", {
      method: "POST",
      body: { recoveryCode: registered.body.recoveryCode },
    }),
    env,
  );
  const body = await response.json();
  const earnedTicks = body.state.growthTicks - initialGrowth;
  assert.equal(response.status, 200);
  assert.ok(earnedTicks >= 12);
  assert.equal(body.state.careTicks, earnedTicks);
  assert.equal(player.growth_ticks, body.state.growthTicks);
  assert.equal(player.care_ticks, body.state.careTicks);
  assert.equal(player.session_version, 2);
  assert.equal(player.revision, body.state.revision);
});

test("failed atomic recovery leaves the old hash, session, and settlement untouched", async () => {
  const env = makeEnv();
  const registered = await register(env);
  const player = [...env.DB.players.values()][0];
  player.rain_barrel_level = 1;
  player.last_settled_at_ms = Date.now() - 1_000;
  const before = structuredClone(player);
  env.DB.failRecoveryUpdate = true;
  attachCoordinator(env);

  const failed = await worker.fetch(
    api("/recover", {
      method: "POST",
      body: { recoveryCode: registered.body.recoveryCode },
    }),
    env,
  );
  assert.equal(failed.status, 500);
  assert.deepEqual(player, before);

  env.DB.failRecoveryUpdate = false;
  const retry = await worker.fetch(
    api("/recover", {
      method: "POST",
      body: { recoveryCode: registered.body.recoveryCode },
    }),
    env,
  );
  assert.equal(retry.status, 200);
});

test("recovery rotates the code and invalidates the old signed session", async () => {
  const env = makeEnv();
  const registered = await register(env);
  attachCoordinator(env);
  const recovery = await worker.fetch(
    api("/recover", {
      method: "POST",
      body: { recoveryCode: registered.body.recoveryCode },
    }),
    env,
  );
  const recovered = await recovery.json();
  const nextCookie = recovery.headers.get("set-cookie")?.split(";", 1)[0];
  assert.equal(recovery.status, 200);
  assert.notEqual(recovered.recoveryCode, registered.body.recoveryCode);
  assert.ok(nextCookie);

  const oldSession = await worker.fetch(
    api("/session", { method: "POST", cookie: registered.cookie }),
    env,
  );
  assert.equal(oldSession.status, 401);
  const nextSession = await worker.fetch(
    api("/session", { method: "POST", cookie: nextCookie }),
    env,
  );
  assert.equal(nextSession.status, 200);

  const reused = await worker.fetch(
    api("/recover", {
      method: "POST",
      body: { recoveryCode: registered.body.recoveryCode },
    }),
    env,
  );
  assert.equal(reused.status, 401);
});

test("rotating a recovery code rejects the old code and the new code recovers the garden", async () => {
  const env = makeEnv();
  const registered = await register(env);
  attachCoordinator(env);
  const rotate = await worker.fetch(
    api("/me/recovery-code/rotate", {
      method: "POST",
      cookie: registered.cookie,
    }),
    env,
  );
  const rotated = await rotate.json();
  assert.equal(rotate.status, 200);
  assert.match(rotated.recoveryCode, /^(?:[0-9A-F]{4}-){7}[0-9A-F]{4}$/);
  assert.notEqual(rotated.recoveryCode, registered.body.recoveryCode);

  const oldCode = await worker.fetch(
    api("/recover", {
      method: "POST",
      body: { recoveryCode: registered.body.recoveryCode },
    }),
    env,
  );
  assert.equal(oldCode.status, 401);
  const newCode = await worker.fetch(
    api("/recover", {
      method: "POST",
      body: { recoveryCode: rotated.recoveryCode },
    }),
    env,
  );
  assert.equal(newCode.status, 200);
  assert.ok(newCode.headers.get("set-cookie"));
});

test("recovery rate limiting returns 429 without changing the garden", async () => {
  const env = makeEnv();
  const registered = await register(env);
  const player = [...env.DB.players.values()][0];
  const before = {
    revision: player.revision,
    sessionVersion: player.session_version,
    recoveryHash: player.recovery_code_hash,
    updatedAt: player.updated_at_ms,
  };
  let limiterCalls = 0;
  env.GARDEN_RATE_LIMITER = {
    async limit() {
      limiterCalls += 1;
      return { success: false };
    },
  };
  const blocked = await worker.fetch(
    api("/recover", {
      method: "POST",
      body: { recoveryCode: registered.body.recoveryCode },
    }),
    env,
  );
  assert.equal(blocked.status, 429);
  assert.deepEqual(await blocked.json(), { error: "rate_limited" });
  assert.equal(limiterCalls, 1);
  assert.deepEqual(
    {
      revision: player.revision,
      sessionVersion: player.session_version,
      recoveryHash: player.recovery_code_hash,
      updatedAt: player.updated_at_ms,
    },
    before,
  );
});

test("registration is limited before player allocation", async () => {
  const env = makeEnv();
  const keys = [];
  env.GARDEN_RATE_LIMITER = {
    async limit({ key }) {
      keys.push(key);
      return { success: false };
    },
  };
  const response = await worker.fetch(
    api("/players", {
      method: "POST",
      body: { nickname: "BLOCKED" },
      headers: { "cf-connecting-ip": "203.0.113.20" },
    }),
    env,
  );

  assert.equal(response.status, 429);
  assert.deepEqual(keys, ["garden-register:203.0.113.20"]);
  assert.equal(env.DB.players.size, 0);
});

test("actual JSON bytes are capped even without Content-Length", async () => {
  const env = makeEnv();
  const payload = JSON.stringify({ nickname: "A".repeat(9_000) });
  const request = new Request("https://flypea.tech/api/garden/players", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: payload,
  });
  assert.equal(request.headers.get("content-length"), null);

  const response = await worker.fetch(request, env);

  assert.equal(response.status, 413);
  assert.deepEqual(await response.json(), { error: "payload_too_large" });
  assert.equal(env.DB.players.size, 0);
});

test("public reads and authenticated player requests have independent request budgets", async () => {
  const env = makeEnv();
  const registered = await register(env);
  let readCalls = 0;
  let playerCalls = 0;
  env.GARDEN_READ_RATE_LIMITER = {
    async limit({ key }) {
      readCalls += 1;
      assert.equal(key, "garden-leaderboard:203.0.113.21");
      return { success: false };
    },
  };
  env.GARDEN_PLAYER_RATE_LIMITER = {
    async limit({ key }) {
      playerCalls += 1;
      assert.match(key, /^garden-player:[0-9a-f-]{36}$/);
      return { success: false };
    },
  };

  const leaderboard = await worker.fetch(
    api("/leaderboard", { headers: { "cf-connecting-ip": "203.0.113.21" } }),
    env,
  );
  const session = await worker.fetch(
    api("/session", { method: "POST", cookie: registered.cookie }),
    env,
  );

  assert.equal(leaderboard.status, 429);
  assert.equal(session.status, 429);
  assert.equal(readCalls, 1);
  assert.equal(playerCalls, 1);
});

test("rename updates the server profile and delete clears both garden and credential", async () => {
  const env = makeEnv();
  const registered = await register(env);
  attachCoordinator(env);
  const rename = await worker.fetch(
    api("/me", {
      method: "PATCH",
      cookie: registered.cookie,
      body: { nickname: "NEW GARDEN" },
    }),
    env,
  );
  assert.equal(rename.status, 200);
  assert.equal((await rename.json()).state.nickname, "NEW GARDEN");
  assert.equal([...env.DB.players.values()][0].nickname, "NEW GARDEN");

  const remove = await worker.fetch(
    api("/me", {
      method: "DELETE",
      cookie: registered.cookie,
    }),
    env,
  );
  assert.equal(remove.status, 204);
  assert.match(remove.headers.get("set-cookie"), /flypea_garden=;/);
  assert.match(remove.headers.get("set-cookie"), /Max-Age=0/);
  assert.equal(env.DB.players.size, 0);
  assert.equal(env.DB.commands.size, 0);

  const removedSession = await worker.fetch(
    api("/session", {
      method: "POST",
      cookie: registered.cookie,
    }),
    env,
  );
  assert.equal(removedSession.status, 401);
});

test("archive snapshot stays locked before 6m and can be regenerated after unlock", async () => {
  const env = makeEnv();
  const registered = await register(env);
  const player = [...env.DB.players.values()][0];
  player.growth_ticks = GARDEN_TEST_CONSTANTS.CARD_UNLOCK_TICKS - 100;
  player.last_settled_at_ms = Date.now();
  const locked = await worker.fetch(
    api("/card-snapshot", { method: "POST", cookie: registered.cookie }),
    env,
  );
  assert.equal(locked.status, 403);
  assert.deepEqual(await locked.json(), {
    error: "card_locked",
    requiredGrowthTicks: 48_000,
  });

  player.growth_ticks = GARDEN_TEST_CONSTANTS.CARD_UNLOCK_TICKS;
  player.last_settled_at_ms = Date.now();
  const first = await worker.fetch(
    api("/card-snapshot", { method: "POST", cookie: registered.cookie }),
    env,
  );
  const second = await worker.fetch(
    api("/card-snapshot", { method: "POST", cookie: registered.cookie }),
    env,
  );
  const firstBody = await first.json();
  const secondBody = await second.json();
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(firstBody.snapshot.lengthMm, 6_000);
  assert.ok(firstBody.snapshot.unlockedScenes.includes("street"));
  assert.equal("playerId" in firstBody.snapshot, false);
  assert.equal("recoveryCode" in firstBody.snapshot, false);
  assert.equal(secondBody.snapshot.nickname, firstBody.snapshot.nickname);
});

test("leaderboard excludes hidden gardens and admin hide is authenticated", async () => {
  const env = makeEnv();
  const registered = await register(env);
  const player = [...env.DB.players.values()][0];
  const denied = await worker.fetch(
    api(`/admin/players/${player.player_id}`, {
      method: "PATCH",
      body: { hidden: true },
    }),
    env,
  );
  assert.equal(denied.status, 401);

  const hidden = await worker.fetch(
    api(`/admin/players/${player.player_id}`, {
      method: "PATCH",
      body: { hidden: true },
      headers: { authorization: "Bearer garden-admin-token" },
    }),
    env,
  );
  assert.equal(hidden.status, 200);
  const leaderboard = await worker.fetch(api("/leaderboard", { cookie: registered.cookie }), env);
  assert.deepEqual((await leaderboard.json()).entries, []);
});

test("leaderboard ranks every garden with server-time passive growth before settlement", async () => {
  const env = makeEnv();
  await register(env, "RETURNING");
  await register(env, "RECENT");
  const [returning, recent] = [...env.DB.players.values()];
  const now = Date.now();
  Object.assign(returning, {
    growth_ticks: 100,
    rain_barrel_level: 10,
    last_settled_at_ms: now - 10_000,
  });
  Object.assign(recent, {
    growth_ticks: 500,
    rain_barrel_level: 0,
    last_settled_at_ms: now,
  });

  const response = await worker.fetch(api("/leaderboard"), env);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(
    body.entries.map(({ nickname }) => nickname),
    ["RETURNING", "RECENT"],
  );
  assert.ok(body.entries[0].growthTicks > body.entries[1].growthTicks);
});

test("public leaderboard caps requested limits at twenty entries", async () => {
  const env = makeEnv();
  for (let index = 0; index < 25; index += 1) {
    await register(env, `GARDEN ${index}`);
  }
  const response = await worker.fetch(api("/leaderboard?limit=100"), env);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.entries.length, 20);
});

test("effective-growth ties use only stable player ID order", async () => {
  const env = makeEnv();
  const now = Date.now();
  const firstId = "00000000-0000-4000-8000-000000000001";
  const secondId = "00000000-0000-4000-8000-000000000002";
  env.DB.players.set(
    firstId,
    makeRow({
      player_id: firstId,
      nickname: "SETTLED NOW",
      growth_ticks: 1_000,
      growth_reached_at_ms: now,
      last_settled_at_ms: now,
    }),
  );
  env.DB.players.set(
    secondId,
    makeRow({
      player_id: secondId,
      nickname: "OLDER MARK",
      growth_ticks: 1_000,
      growth_reached_at_ms: 0,
      last_settled_at_ms: now,
    }),
  );

  const response = await worker.fetch(api("/leaderboard"), env);
  const body = await response.json();
  assert.deepEqual(
    body.entries.map(({ nickname, rank }) => ({ nickname, rank })),
    [
      { nickname: "SETTLED NOW", rank: 1 },
      { nickname: "OLDER MARK", rank: 2 },
    ],
  );
});
