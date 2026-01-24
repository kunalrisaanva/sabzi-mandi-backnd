import express from "express";
import { 
    userRegister, 
    verifyOTPAndRegister, 
    userLogin, 
    logout, 
    devRegister, 
    getUserProfile, 
    getAllUsers,
    resendOTP,
    sendLoginOTP,
    verifyLoginOTP
} from "../controller/user.controller.js";
import { authMiddleware as verify } from "../middleware/auth.middleware.js";

const router = express.Router();

// ============================================
// REGISTRATION ROUTES (with OTP)
// ============================================

// Step 1: Register & Send OTP
router.route("/register").post(userRegister);

// Step 2: Verify OTP & Create Account
router.route("/verify-otp").post(verifyOTPAndRegister);

// Resend OTP
router.route("/resend-otp").post(resendOTP);

// ============================================
// LOGIN ROUTES
// ============================================

// Password-based login
router.route("/login").post(userLogin);

// OTP-based login - Step 1: Send OTP
router.route("/login/send-otp").post(sendLoginOTP);

// OTP-based login - Step 2: Verify OTP
router.route("/login/verify-otp").post(verifyLoginOTP);

// ============================================
// DEV ROUTES (for testing)
// ============================================

// Dev Registration (No OTP - for testing only)
router.route("/dev-register").post(devRegister);

// ============================================
// PROTECTED ROUTES
// ============================================

// Get current user
router.route("/me").get(verify, (req, res) => res.json({ user: req.user }));

// Logout
router.route("/logout").post(verify, logout);

// Get user profile by ID
router.route("/profile/:userId").get(verify, getUserProfile);

// Get all users (for directory/contacts)
router.route("/all").get(verify, getAllUsers);

export { router }