const { authenticate } = require("../../src/middleware/auth");
const { configureCors } = require("../../src/middleware/cors");
const { validateSymbol } = require("../../src/middleware/inputValidator");
const { rateLimiter } = require("../../src/middleware/rateLimiter");

describe("Middleware Unit Tests", () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    req = {
      headers: {},
      query: {},
      body: {},
      params: {},
      ip: "127.0.0.1",
      method: "GET",
      path: "/api/test"
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn()
    };
    next = jest.fn();
    process.env.NODE_ENV = "test";
    delete process.env.API_KEY;
    delete process.env.API_AUTH_KEYS;
    delete process.env.ALLOWED_ORIGINS;
    delete process.env.ENABLE_DEV_RATE_LIMIT;
  });

  describe("Authentication Middleware", () => {
    it("should allow request if API key matches API_KEY env variable", () => {
      process.env.API_KEY = "test-key";
      req.headers["x-api-key"] = "test-key";

      authenticate(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("should allow request if API key matches one of API_AUTH_KEYS env variables", () => {
      process.env.API_AUTH_KEYS = "key1, key2, key3";
      req.headers["x-api-key"] = "key2";

      authenticate(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it("should deny request with 401 if API key is missing", () => {
      process.env.API_KEY = "test-key";

      authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: "unauthorized_api_key" }));
      expect(next).not.toHaveBeenCalled();
    });

    it("should deny request with 401 if API key does not match", () => {
      process.env.API_KEY = "test-key";
      req.headers["x-api-key"] = "wrong-key";

      authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it("should deny access in production mode if API keys are not configured", () => {
      process.env.NODE_ENV = "production";

      authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: "unauthorized_security_configuration_missing" }));
    });

    it("should fallback to developer key in non-production mode if API keys are not configured", () => {
      process.env.NODE_ENV = "development";
      req.headers["x-api-key"] = "stocksense-secret-api-key";

      authenticate(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe("CORS Whitelist Middleware", () => {
    it("should configure CORS with origin whitelist", () => {
      process.env.ALLOWED_ORIGINS = "https://stocksense.com,https://app.stocksense.com";
      const corsMiddleware = configureCors();
      expect(typeof corsMiddleware).toBe("function");
    });
  });

  describe("Input Validation Middleware", () => {
    it("should allow valid symbols through", () => {
      req.query.symbol = "RELIANCE";
      validateSymbol(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it("should allow lowercase symbols with dots, dashes, and underscores", () => {
      req.body.symbol = "infy.ns-tech_co";
      validateSymbol(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.body.symbol).toBe("infy.ns-tech_co");
    });

    it("should return 400 for symbols exceeding 20 characters", () => {
      req.query.symbol = "RELIANCEINDUSTRIESTICKERMAXLIMITEXCEEDED";
      validateSymbol(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: "invalid_symbol_length" }));
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 400 for symbols with invalid characters", () => {
      req.params.symbol = "RELIANCE;";
      validateSymbol(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: "invalid_symbol_characters" }));
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("Rate Limiting Middleware", () => {
    it("should bypass rate limiter in non-production environments by default", () => {
      rateLimiter(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it("should enforce rate limiter if ENABLE_DEV_RATE_LIMIT is set to true", () => {
      process.env.ENABLE_DEV_RATE_LIMIT = "true";
      process.env.RATE_LIMIT_MAX_REQUESTS = "2";

      // Request 1
      rateLimiter(req, res, next);
      expect(next).toHaveBeenCalled();

      // Request 2
      rateLimiter(req, res, next);
      expect(next).toHaveBeenCalledTimes(2);

      // Request 3 (exceeded)
      rateLimiter(req, res, next);
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: "too_many_requests" }));
    });
  });
});
