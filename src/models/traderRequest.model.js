import mongoose from "mongoose";

const traderRequestSchema = new mongoose.Schema({
    trader: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    
    targetFarmer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null // null means broadcast to all farmers
    },
    
    // What the trader wants
    potatoVariety: {
        type: String,
        required: true
    },
    
    potatoType: {
        type: String,
        enum: ["Table", "Seed", "Processing", "Any"],
        default: "Any"
    },
    
    quantity: {
        type: Number,
        required: true // in quintals
    },
    
    maxPricePerQuintal: {
        type: Number,
        required: true
    },
    
    qualityGrade: {
        type: String,
        enum: ["A", "B", "C", "Any"],
        default: "Any"
    },
    
    deliveryLocation: {
        village: String,
        district: String,
        state: String,
        pincode: String
    },
    
    requiredByDate: {
        type: Date
    },
    
    description: {
        type: String
    },
    
    status: {
        type: String,
        enum: ["open", "fulfilled", "cancelled", "expired"],
        default: "open"
    },
    
    responses: [{
        farmer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },
        message: String,
        offeredPrice: Number,
        offeredQuantity: Number,
        respondedAt: {
            type: Date,
            default: Date.now
        },
        status: {
            type: String,
            enum: ["pending", "accepted", "rejected"],
            default: "pending"
        }
    }],
    
    isActive: {
        type: Boolean,
        default: true
    },
    
    expiresAt: {
        type: Date,
        default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
    }
    
}, { timestamps: true });

// Index for queries
traderRequestSchema.index({ status: 1, isActive: 1 });
traderRequestSchema.index({ trader: 1 });
traderRequestSchema.index({ targetFarmer: 1 });

export const TraderRequest = mongoose.model("TraderRequest", traderRequestSchema);
