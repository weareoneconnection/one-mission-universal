// apps/web/src/lib/server/redis.ts
import "server-only";

let _client: any | null = null;

export async function getRedis() {
  if (_client) return _client;

  // ===== Upstash Redis（REST）=====
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    const { Redis } = await import("@upstash/redis");
    _client = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    return _client;
  }

  // ===== Vercel KV =====
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    const { kv } = await import("@vercel/kv");
    _client = kv;
    return _client;
  }

  // ===== Redis Cloud / TCP via REDIS_URL =====
  if (process.env.REDIS_URL) {
    const { createClient } = await import("redis");
    const client = createClient({ url: process.env.REDIS_URL });

    client.on("error", (err: any) => {
      console.error("Redis Client Error", err);
    });

    await client.connect();

    // 兼容你项目里用到的 API（get/set/del + list + set）
    _client = {
      get: async (k: string) => {
        const v = await client.get(k);
        if (v == null) return null;
        // 自动 JSON 反序列化（你存的是对象时必须）
        try { return JSON.parse(v); } catch { return v; }
      },
      set: async (k: string, v: any) => {
        const s = typeof v === "string" ? v : JSON.stringify(v);
        return client.set(k, s);
      },
      del: (k: string) => client.del(k),

      // queue
      lpush: (k: string, v: string) => client.lPush(k, v),
      rpop: (k: string) => client.rPop(k),
      llen: (k: string) => client.lLen(k),

      // counters
      incrby: (k: string, n: number) => client.incrBy(k, n),

      // set index
      sadd: (k: string, v: string) => client.sAdd(k, v),
      srem: (k: string, v: string) => client.sRem(k, v),
      smembers: (k: string) => client.sMembers(k),
    };

    return _client;
  }

  throw new Error(
    "Redis is not configured. Please set UPSTASH_REDIS_REST_URL/TOKEN or KV_REST_API_URL/TOKEN or REDIS_URL"
  );
}
