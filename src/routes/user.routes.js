import express from "express";
import { userRegister, userLogin, logout } from "../controller/user.controller.js";
import { authMiddleware as verify } from "../middleware/auth.middleware.js";

const router = express.Router();


router.route("/register").post(userRegister);
router.route("/login").post(userLogin)


//protected routes

router.route("/me").get(verify, (req, res) => res.json({ user: req.user }))
router.route("/logout").post(verify, logout)



export { router } 