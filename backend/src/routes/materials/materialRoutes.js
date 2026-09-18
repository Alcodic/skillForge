import express from "express";

import { getMaterials, getMaterialById } from "../../controllers/materials/materialController.js";
import { authMiddleware } from "../../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", authMiddleware, getMaterials);
router.get("/:id", authMiddleware, getMaterialById);

export default router;
