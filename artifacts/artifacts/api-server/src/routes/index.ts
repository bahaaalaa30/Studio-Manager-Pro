import { Router, type IRouter } from "express";
import healthRouter from "./health";
import ordersRouter from "./orders";
import analyticsRouter from "./analytics";

const router: IRouter = Router();

router.use(healthRouter);
router.use(ordersRouter);
router.use(analyticsRouter);

export default router;
