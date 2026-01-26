import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
    // Who receives the notification
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    // Who triggered the notification
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },

    // Type of notification
    type: {
        type: String,
        enum: [
            "booking_request",      // When farmer requests booking
            "booking_accepted",     // When owner accepts booking
            "booking_rejected",     // When owner rejects booking
            "booking_cancelled",    // When farmer cancels booking
            "booking_updated",      // When farmer updates booking
            "new_message",          // New chat message
            "new_listing",          // New potato listing
            "price_update",         // Mandi price update
            "system"                // System notifications
        ],
        required: true
    },

    // Notification title
    title: {
        type: String,
        required: true
    },

    // Notification message
    message: {
        type: String,
        required: true
    },

    // Reference to related entity
    referenceId: {
        type: mongoose.Schema.Types.ObjectId
    },

    // Type of reference (for navigation)
    referenceType: {
        type: String,
        enum: ["booking", "message", "conversation", "listing", "coldStorage", "post"]
    },

    // Additional data for the notification
    data: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },

    // Whether notification has been read
    isRead: {
        type: Boolean,
        default: false
    },

    // Whether notification has been seen
    isSeen: {
        type: Boolean,
        default: false
    }

}, { timestamps: true });

// Index for faster queries
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

export const Notification = mongoose.model("Notification", notificationSchema);
