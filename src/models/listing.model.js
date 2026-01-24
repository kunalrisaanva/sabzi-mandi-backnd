import mongoose from "mongoose";

const listingSchema = new mongoose.Schema({
    seller: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    
    type: {
        type: String,
        enum: ["sell", "buy"],
        required: true
    },
    
    potatoVariety: {
        type: String,
        required: true
    },
    
    quantity: {
        type: Number,
        required: true // in quintals
    },
    
    pricePerQuintal: {
        type: Number,
        required: true
    },
    
    description: {
        type: String
    },
    
    images: [{
        type: String
    }],
    
    location: {
        village: String,
        district: String,
        state: String,
        pincode: String
    },
    
    qualityGrade: {
        type: String,
        enum: ["A", "B", "C"],
        default: "A"
    },
    
    isActive: {
        type: Boolean,
        default: true
    },
    
    expiresAt: {
        type: Date
    }
    
}, { timestamps: true });

export const Listing = mongoose.model("Listing", listingSchema);
