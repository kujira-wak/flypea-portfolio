import assert from "node:assert/strict";
import test from "node:test";
import worker from "../worker/src/index.ts";

class Statement {
  constructor(database, sql) {
    this.database = database;
    this.sql = sql;
    this.args = [];
  }

  bind(...args) {
    this.args = args;
    return this;
  }

  async run() {
    const [articleId, voterId] = this.args;
    const key = `${articleId}:${voterId}`;
    if (this.sql.startsWith("INSERT")) this.database.reactions.add(key);
    if (this.sql.startsWith("DELETE")) this.database.reactions.delete(key);
    return { success: true };
  }
}

class MemoryD1 {
  reactions = new Set();
  batchCalls = 0;

  prepare(sql) {
    return new Statement(this, sql);
  }

  async batch(statements) {
    this.batchCalls += 1;
    const countIds = statements[0].args;
    const [voterId, ...reactedIds] = statements[1].args;
    const counts = countIds
      .map((articleId) => ({
        article_id: articleId,
        count: [...this.reactions].filter((key) => key.startsWith(`${articleId}:`)).length,
      }))
      .filter(({ count }) => count > 0);
    const reacted = reactedIds
      .filter((articleId) => this.reactions.has(`${articleId}:${voterId}`))
      .map((articleId) => ({ article_id: articleId }));
    return [{ results: counts }, { results: reacted }];
  }
}

const makeEnv = () => ({
  DB: new MemoryD1(),
  COOKIE_SECRET: "test-cookie-secret-with-enough-entropy",
  ADMIN_TOKEN: "test-admin-token",
  SITE_ORIGIN: "https://flypea.tech",
});

test("batch, PUT, idempotency, and DELETE keep the reaction contract", async () => {
  const env = makeEnv();
  const batchResponse = await worker.fetch(
    new Request("https://flypea.tech/api/reactions/batch?ids=domain-and-deploy"),
    env,
  );
  assert.equal(batchResponse.status, 200);
  assert.deepEqual(await batchResponse.json(), {
    reactions: { "domain-and-deploy": { count: 0, reacted: false } },
  });

  const cookie = batchResponse.headers.get("set-cookie")?.split(";", 1)[0];
  assert.ok(cookie);
  const request = (method) =>
    new Request("https://flypea.tech/api/reactions/domain-and-deploy", {
      method,
      headers: { cookie, origin: "https://flypea.tech" },
    });

  const firstPut = await worker.fetch(request("PUT"), env);
  assert.equal(firstPut.status, 200);
  assert.deepEqual(await firstPut.json(), { reaction: { count: 1, reacted: true } });

  const secondPut = await worker.fetch(request("PUT"), env);
  assert.deepEqual(await secondPut.json(), { reaction: { count: 1, reacted: true } });

  const remove = await worker.fetch(request("DELETE"), env);
  assert.equal(remove.status, 200);
  assert.deepEqual(await remove.json(), { reaction: { count: 0, reacted: false } });
});

test("invalid IDs, foreign origins, and unauthorized admin requests are rejected", async () => {
  const env = makeEnv();
  const invalid = await worker.fetch(
    new Request("https://flypea.tech/api/reactions/batch?ids=INVALID"),
    env,
  );
  assert.equal(invalid.status, 400);

  const foreignOrigin = await worker.fetch(
    new Request("https://flypea.tech/api/reactions/domain-and-deploy", {
      method: "PUT",
      headers: { origin: "https://example.com" },
    }),
    env,
  );
  assert.equal(foreignOrigin.status, 403);

  const admin = await worker.fetch(
    new Request("https://flypea.tech/api/reactions/admin/stats"),
    env,
  );
  assert.equal(admin.status, 401);
});

test("reaction mutation throttling uses a stable edge identity when cookies are discarded", async () => {
  const env = makeEnv();
  const keys = [];
  env.REACTION_RATE_LIMITER = {
    async limit({ key }) {
      keys.push(key);
      return { success: keys.length === 1 };
    },
  };
  const request = () =>
    new Request("https://flypea.tech/api/reactions/domain-and-deploy", {
      method: "PUT",
      headers: {
        origin: "https://flypea.tech",
        "cf-connecting-ip": "203.0.113.10",
      },
    });

  const accepted = await worker.fetch(request(), env);
  const blocked = await worker.fetch(request(), env);

  assert.equal(accepted.status, 200);
  assert.equal(blocked.status, 429);
  assert.deepEqual(keys, ["reaction-write:203.0.113.10", "reaction-write:203.0.113.10"]);
  assert.equal(env.DB.reactions.size, 1);
});

test("reaction batch reads are rejected before voter crypto and D1 work when limited", async () => {
  const env = makeEnv();
  env.REACTION_READ_RATE_LIMITER = {
    async limit({ key }) {
      assert.equal(key, "reaction-read:203.0.113.11");
      return { success: false };
    },
  };
  const response = await worker.fetch(
    new Request("https://flypea.tech/api/reactions/batch?ids=domain-and-deploy", {
      headers: { "cf-connecting-ip": "203.0.113.11" },
    }),
    env,
  );

  assert.equal(response.status, 429);
  assert.equal(response.headers.get("set-cookie"), null);
  assert.equal(env.DB.batchCalls, 0);
});
