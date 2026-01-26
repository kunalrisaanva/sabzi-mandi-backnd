import express from "express";
import { TraderRequest } from "../models/traderRequest.model.js";
import { User } from "../models/user.model.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = express.Router();

// Get my requests (for traders) - MUST be before /:id route
router.get("/user/my", authMiddleware, async (req, res) => {
    try {
        const requests = await TraderRequest.find({ trader: req.user._id })
            .populate("responses.farmer", "firstName lastName phone")
            .sort({ createdAt: -1 });
        
        res.status(200).json({
            success: true,
            data: { requests }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get all open requests (for farmers to see)
router.get("/", async (req, res) => {
    try {
        const { limit = 20, page = 1 } = req.query;
        
        const requests = await TraderRequest.find({ 
            status: "open", 
            isActive: true,
            expiresAt: { $gt: new Date() }
        })
            .populate("trader", "firstName lastName phone role address")
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));
        
        const total = await TraderRequest.countDocuments({ 
            status: "open", 
            isActive: true 
        });
        
        res.status(200).json({
            success: true,
            data: { requests, total }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get single request
router.get("/:id", async (req, res) => {
    try {
        const request = await TraderRequest.findById(req.params.id)
            .populate("trader", "firstName lastName phone role address")
            .populate("responses.farmer", "firstName lastName phone");
        
        if (!request) {
            return res.status(404).json({ success: false, message: "Request not found" });
        }
        
        res.status(200).json({ success: true, data: { request } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Create request (traders only)
router.post("/create", authMiddleware, async (req, res) => {
    try {
        // Check if user is a trader
        if (req.user.role !== "trader") {
            return res.status(403).json({ 
                success: false, 
                message: "Only traders can create buy requests" 
            });
        }
        
        const { 
            potatoVariety, 
            potatoType,
            quantity, 
            maxPricePerQuintal, 
            description,
            qualityGrade,
            deliveryLocation,
            requiredByDate,
            targetFarmerId
        } = req.body;
        
        const request = await TraderRequest.create({
            trader: req.user._id,
            targetFarmer: targetFarmerId || null,
            potatoVariety,
            potatoType: potatoType || "Any",
            quantity,
            maxPricePerQuintal,
            description,
            qualityGrade: qualityGrade || "Any",
            deliveryLocation,
            requiredByDate
        });
        
        await request.populate("trader", "firstName lastName phone");
        
        res.status(201).json({
            success: true,
            message: "Buy request created successfully",
            data: { request }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Farmer responds to a request
router.post("/:id/respond", authMiddleware, async (req, res) => {
    try {
        // Check if user is a farmer
        if (req.user.role !== "farmer") {
            return res.status(403).json({ 
                success: false, 
                message: "Only farmers can respond to buy requests" 
            });
        }
        
        const { message, offeredPrice, offeredQuantity } = req.body;
        
        const request = await TraderRequest.findById(req.params.id);
        
        if (!request) {
            return res.status(404).json({ success: false, message: "Request not found" });
        }
        
        if (request.status !== "open") {
            return res.status(400).json({ 
                success: false, 
                message: "This request is no longer open" 
            });
        }
        
        // Check if farmer already responded
        const existingResponse = request.responses.find(
            r => r.farmer.toString() === req.user._id.toString()
        );
        
        if (existingResponse) {
            return res.status(400).json({ 
                success: false, 
                message: "You have already responded to this request" 
            });
        }
        
        request.responses.push({
            farmer: req.user._id,
            message,
            offeredPrice,
            offeredQuantity: offeredQuantity || request.quantity
        });
        
        await request.save();
        await request.populate("responses.farmer", "firstName lastName phone");
        
        res.status(200).json({
            success: true,
            message: "Response submitted successfully",
            data: { request }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Trader accepts/rejects a farmer's response
router.patch("/:id/response/:responseId", authMiddleware, async (req, res) => {
    try {
        const { status } = req.body; // 'accepted' or 'rejected'
        
        const request = await TraderRequest.findById(req.params.id);
        
        if (!request) {
            return res.status(404).json({ success: false, message: "Request not found" });
        }
        
        if (request.trader.toString() !== req.user._id.toString()) {
            return res.status(403).json({ 
                success: false, 
                message: "Only the request creator can accept/reject responses" 
            });
        }
        
        const response = request.responses.id(req.params.responseId);
        
        if (!response) {
            return res.status(404).json({ success: false, message: "Response not found" });
        }
        
        response.status = status;
        
        // If accepted, mark request as fulfilled
        if (status === "accepted") {
            request.status = "fulfilled";
        }
        
        await request.save();
        await request.populate("responses.farmer", "firstName lastName phone");
        
        res.status(200).json({
            success: true,
            message: `Response ${status} successfully`,
            data: { request }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Update request
router.patch("/:id", authMiddleware, async (req, res) => {
    try {
        const request = await TraderRequest.findById(req.params.id);
        
        if (!request) {
            return res.status(404).json({ success: false, message: "Request not found" });
        }
        
        if (request.trader.toString() !== req.user._id.toString()) {
            return res.status(403).json({ 
                success: false, 
                message: "You can only update your own requests" 
            });
        }
        
        const allowedUpdates = [
            "potatoVariety", "potatoType", "quantity", 
            "maxPricePerQuintal", "description", "qualityGrade",
            "deliveryLocation", "requiredByDate", "status", "isActive"
        ];
        
        Object.keys(req.body).forEach(key => {
            if (allowedUpdates.includes(key)) {
                request[key] = req.body[key];
            }
        });
        
        await request.save();
        
        res.status(200).json({
            success: true,
            message: "Request updated successfully",
            data: { request }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Delete/Cancel request
router.delete("/:id", authMiddleware, async (req, res) => {
    try {
        const request = await TraderRequest.findById(req.params.id);
        
        if (!request) {
            return res.status(404).json({ success: false, message: "Request not found" });
        }
        
        if (request.trader.toString() !== req.user._id.toString()) {
            return res.status(403).json({ 
                success: false, 
                message: "You can only delete your own requests" 
            });
        }
        
        request.status = "cancelled";
        request.isActive = false;
        await request.save();
        
        res.status(200).json({
            success: true,
            message: "Request cancelled successfully"
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

export { router };
