import { Router } from "express";
import healthRouter from "./health.js";
import ordersRouter from "./orders.js";
import analyticsRouter from "./analytics.js";
import adminRouter from "./admin.js";
import authRouter from "./auth.js";
import serviceAdminFixRouter from "./service-admin-fix.js";

const router = Router();
router.use(healthRouter);
router.use(ordersRouter);
router.use(analyticsRouter);
router.use(authRouter);
// Must be registered before adminRouter so this focused service-create handler wins.
router.use(serviceAdminFixRouter);
router.use(adminRouter);

export default router;
