import express from "express";

import {
  getMaterials,
  getMaterialById,
  uploadMaterial,
} from "../../controllers/materials/materialController.js";
import { authMiddleware } from "../../middleware/authMiddleware.js";
import { uploadSingleFile } from "../../middleware/uploadMiddleware.js";
import { uploadErrorMiddleware } from "../../middleware/uploadErrorMiddleware.js";
import { validatePdfIntegrity } from "../../middleware/fileIntegrityMiddleware.js";
import { idempotencyMiddleware } from "../../middleware/idempotencyMiddleware.js";

const router = express.Router();

router.get("/", authMiddleware, getMaterials);
router.get("/:id", authMiddleware, getMaterialById);
router.post(
  "/",
  authMiddleware,
  idempotencyMiddleware,
  uploadSingleFile,
  validatePdfIntegrity,
  uploadMaterial,
  uploadErrorMiddleware,
);
export default router;
