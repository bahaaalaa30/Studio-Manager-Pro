import express from "express";
import cors from "cors";
import pinoHttpModule from "pino-http";
const pinoHttp =
  pinoHttpModule as unknown as typeof import("pino-http").default;
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";
import { ensureDatabaseSchema } from "@workspace/db";

const app = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req: { id: any; method: any; url: string }) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res: { statusCode: number }) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure a fresh Vercel Postgres database has the prototype schema before
// any API route attempts to query it.
app.use(async (_req, res, next) => {
  try {
    await ensureDatabaseSchema();
    next();
  } catch (error) {
    logger.error({ err: error }, "Database schema initialization failed");
    res.status(500).json({ error: "Database initialization failed" });
  }
});

app.use("/api", router);

export default app;
