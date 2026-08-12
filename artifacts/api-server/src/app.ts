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

// Reception customer validation: keep the API as the final source of truth
// so invalid customer data cannot bypass the UI with Postman/Curl.
app.use((req, res, next) => {
  if (req.method === "POST" && req.path === "/api/orders") {
    const name = typeof req.body?.customerName === "string"
      ? req.body.customerName.trim().replace(/\s+/g, " ")
      : "";
    const mobile = typeof req.body?.customerMobile === "string" ? req.body.customerMobile.trim() : "";
    const namePattern = /^[A-Za-z\u0600-\u06FF]+(?:[ '\-][A-Za-z\u0600-\u06FF]+)+$/;
    const mobilePattern = /^01\d{9}$/;

    // Normalize repeated whitespace so input such as "ah  dew" is treated
    // consistently with the UI as "ah dew" before validation.
    if (typeof req.body?.customerName === "string") {
      req.body.customerName = name;
    }

    if (!name) {
      res.status(400).json({ error: "Name is required." });
      return;
    }

    if (!namePattern.test(name)) {
      res.status(400).json({ error: "Enter a valid Arabic or English name with at least two parts." });
      return;
    }

    if (!mobile) {
      res.status(400).json({ error: "Mobile number is required." });
      return;
    }

    if (!/^\d+$/.test(mobile)) {
      res.status(400).json({ error: "Mobile number must contain numbers only." });
      return;
    }

    if (!mobilePattern.test(mobile)) {
      res.status(400).json({ error: "Mobile number must start with 01 and contain 11 digits." });
      return;
    }
  }

  next();
});

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

// Keep expectedDeliveryTime populated in API responses, including for older
// orders where the database column is still NULL. The delivery rules mirror
// the Reception UI calculation.
function calculateExpectedDeliveryTime(order: {
  services?: Array<{ serviceType?: string }>;
  createdAt?: string | Date;
  expectedDeliveryTime?: string | Date | null;
}) {
  if (order.expectedDeliveryTime) {
    return order.expectedDeliveryTime instanceof Date
      ? order.expectedDeliveryTime.toISOString()
      : order.expectedDeliveryTime;
  }

  if (!order.createdAt || !Array.isArray(order.services)) {
    return null;
  }

  const hasPersonal = order.services.some((s) => s.serviceType === "personal_photos_8pack");
  const hasCard = order.services.some((s) => s.serviceType === "card_photos_1pack");
  const isUrgent = order.services.some((s) => s.serviceType === "urgent_fee");

  let days = 0;
  if (hasPersonal && hasCard) {
    days = isUrgent ? 1 : 2;
  } else if (hasPersonal) {
    days = isUrgent ? 0 : 1;
  } else if (hasCard) {
    days = isUrgent ? 1 : 2;
  }

  const deliveryDate = new Date(order.createdAt);
  deliveryDate.setDate(deliveryDate.getDate() + days);
  return deliveryDate.toISOString();
}

function enrichOrderResponse(body: unknown): unknown {
  if (Array.isArray(body)) {
    return body.map((item) => enrichOrderResponse(item));
  }

  if (
    body &&
    typeof body === "object" &&
    "orderNumber" in body &&
    "services" in body
  ) {
    const order = body as {
      expectedDeliveryTime?: string | Date | null;
      services?: Array<{ serviceType?: string }>;
      createdAt?: string | Date;
    };

    return {
      ...(body as Record<string, unknown>),
      expectedDeliveryTime: calculateExpectedDeliveryTime(order),
    };
  }

  return body;
}

// The order routes return database records directly. Enrich their JSON
// responses here so search, date-range, and order-detail APIs all expose the
// calculated delivery timestamp without requiring a data migration.
app.use((req, res, next) => {
  if (!req.path.startsWith("/api/orders")) {
    next();
    return;
  }

  const originalJson = res.json.bind(res);
  res.json = ((body: unknown) => originalJson(enrichOrderResponse(body))) as typeof res.json;
  next();
});

app.use("/api", router);

export default app;
