const winston = require("winston");
require("winston-daily-rotate-file");
const { AsyncLocalStorage } = require("async_hooks");

const asyncLocalStorage = new AsyncLocalStorage();

const level = process.env.LOG_LEVEL || "info";

// Custom format to inject correlation ID from AsyncLocalStorage
const addCorrelationId = winston.format((info) => {
  const store = asyncLocalStorage.getStore();
  if (store && store.correlationId) {
    info.correlationId = store.correlationId;
  }
  return info;
});

const logger = winston.createLogger({
  level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    addCorrelationId(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, stack, correlationId, ...meta }) => {
          const cid = correlationId ? ` [CID: ${correlationId}]` : "";
          const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
          return `${timestamp} [${level}]${cid}: ${message}${stack ? `\n${stack}` : ""}${metaStr}`;
        })
      )
    }),
    new winston.transports.DailyRotateFile({
      filename: 'logs/stocksense-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      level: 'info'
    }),
    new winston.transports.DailyRotateFile({
      filename: 'logs/stocksense-error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      level: 'error'
    })
  ]
});

module.exports = { logger, asyncLocalStorage };
