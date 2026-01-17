import express from "express";
import passport from "passport";
import {
  register,
  login,
  googleCallback,
  linkGoogleInit,
  getMe,
  updateMe,
  changePassword,
} from "../controllers/authController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// Public routes
router.post("/register", register);
router.post("/login", login);

// Google OAuth routes
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);
router.get("/google/callback", googleCallback);

// Protected routes
router.get("/me", protect, getMe);
router.put("/me", protect, updateMe);
router.put("/password", protect, changePassword);

// Google account linking (requires authentication)
router.get("/link/google", protect, linkGoogleInit);

export default router;
