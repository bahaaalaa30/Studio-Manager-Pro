import { Router } from "express";
import healthRouter from "./health.js";
import ordersRouter from "./orders.js";
import dynamicOrdersRouter from "./dynamic-orders.js";
import analyticsRouter from "./analytics.js";
import adminRouter from "./admin.js";
import authRouter from "./auth.js";
import serviceAdminFixRouter from "./service-admin-fix.js";
import packageAdminRouter from "./package-admin.js";
import inventoryRouter from "./inventory.js";

const router = Router();
router.use(healthRouter);
router.use(dynamicOrdersRouter);
router.use(ordersRouter);
router.use(analyticsRouter);
router.use(authRouter);
router.use(serviceAdminFixRouter);
router.use(packageAdminRouter);
router.use(inventoryRouter);
router.use(adminRouter);

export default router;
