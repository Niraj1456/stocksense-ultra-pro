const express = require("express");
const kiteService = require("../services/kiteService");
const { env } = require("../config/env");

const kiteRouter = express.Router();

// Route to initiate login. Redirects user to Kite Connect authorization portal.
kiteRouter.get("/login", (req, res) => {
  const apiKey = env.kiteApiKey;
  if (!apiKey) {
    return res.status(400).send("Error: KITE_API_KEY is not configured in the environment.");
  }
  const redirectUrl = `https://kite.trade/connect/login?api_key=${apiKey}&v=3`;
  return res.redirect(redirectUrl);
});

// Callback route where Zerodha redirects the browser after successful login.
kiteRouter.get("/callback", async (req, res, next) => {
  try {
    const { status, request_token } = req.query;
    
    if (status !== "success" || !request_token) {
      return res.status(400).json({
        ok: false,
        error: "Login failed or request_token missing.",
        query: req.query
      });
    }

    console.log(`Received request_token: ${request_token}. Initiating session generation...`);
    const session = await kiteService.generateSession(request_token);

    // HTML response to show beautiful success status
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Kite Connect Authorized</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #0d1117;
            color: #c9d1d9;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
          }
          .container {
            background: #161b22;
            border: 1px solid #30363d;
            border-radius: 12px;
            padding: 40px;
            max-width: 500px;
            width: 100%;
            text-align: center;
            box-shadow: 0 8px 24px rgba(0,0,0,0.5);
          }
          h1 {
            color: #2ea44f;
            margin-top: 0;
          }
          p {
            line-height: 1.6;
            font-size: 16px;
          }
          .token-box {
            background: #0d1117;
            border: 1px solid #30363d;
            border-radius: 6px;
            padding: 12px;
            font-family: monospace;
            font-size: 14px;
            word-break: break-all;
            margin: 20px 0;
            color: #58a6ff;
          }
          .btn {
            display: inline-block;
            background: #238636;
            color: white;
            padding: 10px 20px;
            border-radius: 6px;
            text-decoration: none;
            font-weight: 600;
            margin-top: 20px;
            transition: background 0.2s;
          }
          .btn:hover {
            background: #2ea44f;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>✓ Session Authorized</h1>
          <p>Zerodha Kite Connect has been successfully authenticated!</p>
          <p>The access token has been generated and saved directly to your <strong>.env</strong> file.</p>
          <div class="token-box">
            Access Token: ${session.access_token.substring(0, 8)}...${session.access_token.substring(session.access_token.length - 8)}
          </div>
          <p>You can now close this tab. StockSense Ultra Pro is ready to fetch real-time market data.</p>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error("Error exchanging Kite request token:", error);
    res.status(500).json({
      ok: false,
      error: "Failed to generate Kite Connect session.",
      details: error.message
    });
  }
});

// POST /order/place: Places an order and records it in the PostgreSQL database
kiteRouter.post("/order/place", async (req, res, next) => {
  try {
    const { symbol, transactionType, quantity, price, sl, target, mode } = req.body || {};

    if (!symbol || !transactionType || !quantity || !price) {
      return res.status(400).json({
        ok: false,
        error: "symbol, transactionType, quantity, and price are required."
      });
    }

    console.log(`[Order Placement API] Initiating order: ${transactionType} ${quantity} shares of ${symbol} at ₹${price}`);
    
    // 1. Submit order to Kite Connect (or Sandbox fall-back)
    const orderResult = await kiteService.placeOrder({
      symbol,
      transactionType,
      quantity,
      price,
      orderType: "LIMIT"
    });

    if (!orderResult.ok) {
      return res.status(500).json({
        ok: false,
        error: "order_placement_failed",
        details: orderResult.error
      });
    }

    const { orderId, sandbox } = orderResult.data;

    // 2. Persist the trade immediately into the PostgreSQL trades table
    let tradeId = null;
    try {
      const { dbQuery } = require("../lib/db");
      
      const insertQuery = `
        INSERT INTO trades (symbol, entry_ts, entry_price, size, sl, target, json)
        VALUES ($1, NOW(), $2, $3, $4, $5, $6)
        RETURNING id
      `;
      
      const tradeMetadata = {
        orderId,
        sandbox,
        mode: mode || "ST",
        status: "OPEN"
      };

      const dbRes = await dbQuery(insertQuery, [
        symbol.toUpperCase(),
        Number(price),
        Number(quantity),
        sl ? Number(sl) : null,
        target ? Number(target) : null,
        JSON.stringify(tradeMetadata)
      ]);

      if (dbRes && dbRes.rows && dbRes.rows.length > 0) {
        tradeId = dbRes.rows[0].id;
      }
      console.log(`[Order Placement API] Trade persisted in DB: ID ${tradeId} for ${symbol}`);
    } catch (dbErr) {
      console.warn(`[Order Placement API] Database persist skipped/failed (graceful): ${dbErr.message}`);
    }

    return res.json({
      ok: true,
      message: "Order placed successfully",
      data: {
        orderId,
        tradeId,
        sandbox,
        symbol,
        transactionType,
        quantity,
        price,
        sl: sl || null,
        target: target || null
      }
    });
  } catch (error) {
    console.error("[Order Placement API] Fatal exception:", error);
    next(error);
  }
});

module.exports = { kiteRouter };
