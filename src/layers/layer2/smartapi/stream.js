const EventEmitter = require("events");
const { WebSocketV2 } = require("smartapi-javascript");
const { env } = require("../../../config/env");
const { createSmartApiSession } = require("./session");
const { getRedis } = require("../../../lib/cacheRedis");
const { logger } = require("../../../lib/logger");

class SmartApiStream extends EventEmitter {
  constructor() {
    super();
    this.ws = null;
    this.connected = false;
  }

  async connect() {
    const sess = await createSmartApiSession();
    if (!sess.ok) {
      this.emit("status", sess);
      return sess;
    }

    const { jwtToken, feedToken } = sess.data;

    this.ws = new WebSocketV2({
      jwttoken: jwtToken,
      apikey: env.angelApiKey,
      clientcode: env.angelClientId,
      feedtype: feedToken
    });

    await this.ws.connect();
    this.connected = true;

    this.ws.on("tick", async (tick) => {
      this.emit("tick", tick);
      const r = getRedis();
      if (r) {
        try {
          await r.xadd("smartapi:ticks", "*", "json", JSON.stringify(tick));
          await r.expire("smartapi:ticks", 60);
        } catch (e) {
          logger.warn("smartapi_redis_stream_failed", { message: e?.message });
        }
      }
    });

    const out = { ok: true, meta: { fetchedAt: new Date().toISOString(), source: "smartapi:websocketv2" } };
    this.emit("status", out);
    return out;
  }

  subscribeDepthNseCm(tokens) {
    if (!this.ws) throw new Error("smartapi_ws_not_connected");
    const jsonReq = {
      correlationID: "depth",
      action: 1,
      mode: 4,
      exchangeType: 1,
      tokens
    };
    this.ws.fetchData(jsonReq);
  }

  subscribeQuote(exchangeType, tokens) {
    if (!this.ws) throw new Error("smartapi_ws_not_connected");
    const jsonReq = {
      correlationID: "quote",
      action: 1,
      mode: 2,
      exchangeType,
      tokens
    };
    this.ws.fetchData(jsonReq);
  }

  close() {
    try {
      this.connected = false;
      this.ws?.close?.();
    } catch {
      // ignore
    }
  }
}

module.exports = { SmartApiStream };

