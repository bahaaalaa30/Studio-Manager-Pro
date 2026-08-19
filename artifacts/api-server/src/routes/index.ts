import { Router } from "express";
import healthRouter from "./health.js";
import ordersRouter from "./orders.js";
import dynamicOrdersRouter from "./dynamic-orders.js";
import analyticsRouter from "./analytics.js";
import adminRouter from "./admin.js";
import authRouter from "./auth.js";
import serviceAdminFixRouter from "./service-admin-fix.js";

const router = Router();
router.use(healthRouter);
// Dynamic order creation must be registered before the legacy orders router.
router.use(dynamicOrdersRouter);
router.use(ordersRouter);
router.use(analyticsRouter);
router.use(authRouter);
router.use(serviceAdminFixRouter);
router.use(adminRouter);

export default router;
