import express from "express";
import {
    createColdStorage,
    getAllColdStorages,
    getColdStorageById,
    getMyColdStorages,
    updateColdStorage,
    deleteColdStorage,
    toggleAvailability
} from "../controller/coldStorage.controller.js";
import { authMiddleware as verify } from "../middleware/auth.middleware.js";

const router = express.Router();

// Public routes
router.route("/").get(getAllColdStorages); // Get all with filters

// Protected routes - MUST come before /:id routes
router.route("/create").post(verify, createColdStorage); // Create
router.route("/my").get(verify, getMyColdStorages); // Get my cold storages

// Dynamic ID routes - MUST come after specific routes
router.route("/:id").get(getColdStorageById); // Get by ID
router.route("/:id").put(verify, updateColdStorage); // Update
router.route("/:id").delete(verify, deleteColdStorage); // Delete
router.route("/:id/toggle").patch(verify, toggleAvailability); // Toggle availability

export { router };
