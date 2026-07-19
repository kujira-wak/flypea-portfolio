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

  prepare(sql) {
    return new Statement(this, sql);
  }

  async batch(statements) {
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
