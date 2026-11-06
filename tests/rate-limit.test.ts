import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { checkRateLimit, resetRateLimit } from "@/lib/rate-limit";

const KEY = "test-rate-limit-key";

describe("checkRateLimit (fallback em memória)", () => {
  beforeEach(async () => {
    process.env.UPSTASH_REDIS_REST_URL = "";
    process.env.UPSTASH_REDIS_REST_TOKEN = "";
    await resetRateLimit(KEY);
  });

  afterEach(async () => {
    await resetRateLimit(KEY);
  });

  it("permite requisições até o limite e bloqueia a próxima", async () => {
    const first = await checkRateLimit({ key: KEY, limit: 2, windowMs: 60000 });
    const second = await checkRateLimit({ key: KEY, limit: 2, windowMs: 60000 });
    const third = await checkRateLimit({ key: KEY, limit: 2, windowMs: 60000 });

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);
    expect(third.remaining).toBe(0);
    expect(third.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("reinicia o contador ao chamar resetRateLimit", async () => {
    await checkRateLimit({ key: KEY, limit: 1, windowMs: 60000 });
    const blocked = await checkRateLimit({
      key: KEY,
      limit: 1,
      windowMs: 60000,
    });
    expect(blocked.allowed).toBe(false);

    await resetRateLimit(KEY);

    const afterReset = await checkRateLimit({
      key: KEY,
      limit: 1,
      windowMs: 60000,
    });
    expect(afterReset.allowed).toBe(true);
  });
});
