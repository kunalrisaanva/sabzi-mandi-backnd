import mongoose from "mongoose";



const coldStorageSchema = new mongoose.Schema({

    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },

    name: {
        type: String,
        required: true
    },

    address: {
        type: String,
        required: true
    },

    city: {
        type: String,
        required: true
    },

    state: {
        type: String,
        required: true
    },

    pincode: {
        type: String,
        required: true
    },

    phone: {
        type: String,
        required: true
    },

    email: {
        type: String,
        required: true
    },

    capacity: {
        type: Number,
        required: true
    },

    availableCapacity: {
        type: Number,
        required: true
    },

    pricePerTon: {
        type: Number,
        required: true
    },

    isAvailable: {
        type: Boolean,
        default: true
    }

}, { timestamps: true });


export const ColdStorage = new mongoose.model("ColdStorage", coldStorageSchema);
