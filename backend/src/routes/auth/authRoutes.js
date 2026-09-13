import express from "express";
import { registerUser } from "../../controllers/auth/registrationController.js";
import { loginUser } from "../../controllers/auth/loginController.js";
import { authMiddleware } from "../../middleware/authMiddleware.js";
import { profileController } from "../../controllers/auth/profileController.js";

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/profile", authMiddleware, profileController);

export default router;
