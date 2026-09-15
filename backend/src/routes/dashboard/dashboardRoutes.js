import express from "express";
import { authMiddleware } from "../../middleware/authMiddleware.js";
import { dashboardController } from "../../controllers/dashboard/dashboardController.js";

const router = express.Router();

router.get("/", authMiddleware, dashboardController);

export default router;
