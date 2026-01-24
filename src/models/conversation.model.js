import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema({
    // Participants in the conversation (2 users)
    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    }],

    // Last message for preview
    lastMessage: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Message"
    },

    // Last message text for quick preview
    lastMessageText: {
        type: String,
        default: ""
    },

    // Last message timestamp
    lastMessageAt: {
        type: Date,
        default: Date.now
    },

    // Unread count per participant
    unreadCount: {
        type: Map,
        of: Number,
        default: {}
    },

    // Conversation type (for future: group chats, deal-specific chats)
    type: {
        type: String,
        enum: ["direct", "deal", "group"],
        default: "direct"
    },

    // If this conversation is related to a deal
    dealId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Deal"
    },

    // Whether conversation is active
    isActive: {
        type: Boolean,
        default: true
    }

}, { timestamps: true });

// Index for fast lookup by participants
conversationSchema.index({ participants: 1 });
conversationSchema.index({ lastMessageAt: -1 });

// Static method to find or create conversation between two users
conversationSchema.statics.findOrCreateConversation = async function(userId1, userId2) {
    let conversation = await this.findOne({
        participants: { $all: [userId1, userId2] },
        type: "direct"
    }).populate('participants', 'firstName lastName role');

    if (!conversation) {
        conversation = await this.create({
            participants: [userId1, userId2],
            unreadCount: new Map([[userId1.toString(), 0], [userId2.toString(), 0]])
        });
        conversation = await conversation.populate('participants', 'firstName lastName role');
    }

    return conversation;
};

export const Conversation = mongoose.model("Conversation", conversationSchema);
