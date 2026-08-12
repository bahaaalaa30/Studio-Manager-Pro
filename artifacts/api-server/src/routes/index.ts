import { Router } from "express";
import healthRouter from "./health.js";
import ordersRouter from "./orders.js";
import analyticsRouter from "./analytics.js";
import adminRouter from "./admin.js";

const router = Router();
router.use(healthRouter);
router.use(ordersRouter);
router.use(analyticsRouter);
router.use(adminRouter);

export default router;
