import express from "express";
import { userRegister, verifyOTPAndRegister, userLogin, logout } from "../controller/user.controller.js";
import { authMiddleware as verify } from "../middleware/auth.middleware.js";

const router = express.Router();

// Registration - Step 1: Send OTP (stores data in Redis for 2 minutes)
router.route("/register").post(userRegister);

// Registration - Step 2: Verify OTP and Create User
router.route("/verify-otp").post(verifyOTPAndRegister);

// Login (Email or Phone with password)
router.route("/login").post(userLogin);

// Protected routes
router.route("/me").get(verify, (req, res) => res.json({ user: req.user }));
router.route("/logout").post(verify, logout);

export { router }