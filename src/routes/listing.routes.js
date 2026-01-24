import express from "express";
import { Listing } from "../models/listing.model.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = express.Router();

// Get all listings with filters
router.get("/", async (req, res) => {
    try {
        const { 
            type, 
            variety, 
            state, 
            district,
            minPrice, 
            maxPrice, 
            qualityGrade,
            limit = 20, 
            page = 1 
        } = req.query;
        
        const query = { isActive: true };
        
        if (type) query.type = type;
        if (variety) query.potatoVariety = { $regex: variety, $options: "i" };
        if (state) query["location.state"] = state;
        if (district) query["location.district"] = district;
        if (qualityGrade) query.qualityGrade = qualityGrade;
        if (minPrice) query.pricePerQuintal = { $gte: parseInt(minPrice) };
        if (maxPrice) query.pricePerQuintal = { ...query.pricePerQuintal, $lte: parseInt(maxPrice) };
        
        const listings = await Listing.find(query)
            .populate("seller", "firstName lastName phone role address")
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));
        
        const total = await Listing.countDocuments(query);
        
        res.status(200).json({
            success: true,
            data: {
                listings,
                total,
                page: parseInt(page),
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get sell listings only
router.get("/sell", async (req, res) => {
    try {
        const { limit = 20, page = 1 } = req.query;
        
        const listings = await Listing.find({ type: "sell", isActive: true })
            .populate("seller", "firstName lastName phone role address")
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));
        
        const total = await Listing.countDocuments({ type: "sell", isActive: true });
        
        res.status(200).json({
            success: true,
            data: { listings, total }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get buy listings only
router.get("/buy", async (req, res) => {
    try {
        const { limit = 20, page = 1 } = req.query;
        
        const listings = await Listing.find({ type: "buy", isActive: true })
            .populate("seller", "firstName lastName phone role address")
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));
        
        const total = await Listing.countDocuments({ type: "buy", isActive: true });
        
        res.status(200).json({
            success: true,
            data: { listings, total }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get single listing
router.get("/:id", async (req, res) => {
    try {
        const listing = await Listing.findById(req.params.id)
            .populate("seller", "firstName lastName phone role address");
        
        if (!listing) {
            return res.status(404).json({ success: false, message: "Listing not found" });
        }
        
        res.status(200).json({ success: true, data: { listing } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get my listings (protected)
router.get("/user/my", authMiddleware, async (req, res) => {
    try {
        const listings = await Listing.find({ seller: req.user._id })
            .sort({ createdAt: -1 });
        
        res.status(200).json({
            success: true,
            data: { listings }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Create listing (protected)
router.post("/create", authMiddleware, async (req, res) => {
    try {
        const { 
            type, 
            potatoVariety, 
            quantity, 
            pricePerQuintal, 
            description, 
            images,
            location,
            qualityGrade 
        } = req.body;
        
        const listing = await Listing.create({
            seller: req.user._id,
            type,
            potatoVariety,
            quantity,
            pricePerQuintal,
            description,
            images: images || [],
            location: location || req.user.address,
            qualityGrade: qualityGrade || "A",
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
        });
        
        const populatedListing = await Listing.findById(listing._id)
            .populate("seller", "firstName lastName phone");
        
        res.status(201).json({
            success: true,
            message: "Listing created successfully",
            data: { listing: populatedListing }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Update listing (protected)
router.put("/:id", authMiddleware, async (req, res) => {
    try {
        const listing = await Listing.findById(req.params.id);
        
        if (!listing) {
            return res.status(404).json({ success: false, message: "Listing not found" });
        }
        
        if (listing.seller.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: "Not authorized" });
        }
        
        const updates = req.body;
        Object.keys(updates).forEach(key => {
            listing[key] = updates[key];
        });
        
        await listing.save();
        
        res.status(200).json({
            success: true,
            message: "Listing updated",
            data: { listing }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Toggle listing active status (protected)
router.patch("/:id/toggle", authMiddleware, async (req, res) => {
    try {
        const listing = await Listing.findById(req.params.id);
        
        if (!listing) {
            return res.status(404).json({ success: false, message: "Listing not found" });
        }
        
        if (listing.seller.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: "Not authorized" });
        }
        
        listing.isActive = !listing.isActive;
        await listing.save();
        
        res.status(200).json({
            success: true,
            message: `Listing ${listing.isActive ? 'activated' : 'deactivated'}`,
            data: { listing }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Delete listing (protected)
router.delete("/:id", authMiddleware, async (req, res) => {
    try {
        const listing = await Listing.findById(req.params.id);
        
        if (!listing) {
            return res.status(404).json({ success: false, message: "Listing not found" });
        }
        
        if (listing.seller.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: "Not authorized" });
        }
        
        await listing.deleteOne();
        
        res.status(200).json({ success: true, message: "Listing deleted" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;
