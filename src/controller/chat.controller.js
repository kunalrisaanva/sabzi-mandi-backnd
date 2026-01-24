import { Conversation } from "../models/conversation.model.js";
import { Message } from "../models/message.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Get all conversations for logged in user
export const getConversations = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    const conversations = await Conversation.find({
        participants: userId,
        isActive: true
    })
    .populate('participants', 'firstName lastName role phone')
    .populate('lastMessage')
    .sort({ lastMessageAt: -1 });

    // Format conversations for response
    const formattedConversations = conversations.map(conv => {
        const otherParticipant = conv.participants.find(
            p => p._id.toString() !== userId.toString()
        );
        
        return {
            _id: conv._id,
            otherUser: otherParticipant,
            lastMessage: conv.lastMessageText,
            lastMessageAt: conv.lastMessageAt,
            unreadCount: conv.unreadCount.get(userId.toString()) || 0,
            type: conv.type
        };
    });

    return res.status(200).json(
        new ApiResponse(200, formattedConversations, "Conversations fetched successfully")
    );
});

// Get or create conversation with a specific user
export const getOrCreateConversation = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { otherUserId } = req.params;

    if (!otherUserId) {
        throw new ApiError(400, "Other user ID is required");
    }

    // Check if other user exists
    const otherUser = await User.findById(otherUserId);
    if (!otherUser) {
        throw new ApiError(404, "User not found");
    }

    // Find or create conversation
    const conversation = await Conversation.findOrCreateConversation(userId, otherUserId);

    return res.status(200).json(
        new ApiResponse(200, conversation, "Conversation fetched successfully")
    );
});

// Get messages for a conversation
export const getMessages = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { conversationId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    // Check if user is part of this conversation
    const conversation = await Conversation.findOne({
        _id: conversationId,
        participants: userId
    });

    if (!conversation) {
        throw new ApiError(404, "Conversation not found");
    }

    const messages = await Message.find({ conversationId })
        .populate('sender', 'firstName lastName role')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit));

    // Mark messages as read
    await Message.updateMany(
        { conversationId, receiver: userId, isRead: false },
        { isRead: true, readAt: new Date(), status: "read" }
    );

    // Reset unread count for this user
    conversation.unreadCount.set(userId.toString(), 0);
    await conversation.save();

    return res.status(200).json(
        new ApiResponse(200, messages.reverse(), "Messages fetched successfully")
    );
});

// Send a message
export const sendMessage = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { conversationId } = req.params;
    const { content, messageType = "text", dealDetails } = req.body;

    if (!content) {
        throw new ApiError(400, "Message content is required");
    }

    // Check if user is part of this conversation
    const conversation = await Conversation.findOne({
        _id: conversationId,
        participants: userId
    });

    if (!conversation) {
        throw new ApiError(404, "Conversation not found");
    }

    // Find the other participant
    const receiverId = conversation.participants.find(
        p => p.toString() !== userId.toString()
    );

    // Create message
    const message = await Message.create({
        conversationId,
        sender: userId,
        receiver: receiverId,
        content,
        messageType,
        dealDetails: messageType === "deal_proposal" ? dealDetails : undefined
    });

    // Update conversation with last message
    conversation.lastMessage = message._id;
    conversation.lastMessageText = content;
    conversation.lastMessageAt = new Date();
    
    // Increment unread count for receiver
    const currentUnread = conversation.unreadCount.get(receiverId.toString()) || 0;
    conversation.unreadCount.set(receiverId.toString(), currentUnread + 1);
    
    await conversation.save();

    // Populate sender info
    await message.populate('sender', 'firstName lastName role');

    return res.status(201).json(
        new ApiResponse(201, message, "Message sent successfully")
    );
});

// Get all users that current user can chat with (based on role)
export const getChatableUsers = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const userRole = req.user.role;

    let query = { _id: { $ne: userId } };

    // Role-based filtering:
    // Farmers can chat with: traders, cold-storage owners
    // Traders can chat with: farmers, cold-storage owners
    // Cold-storage owners can chat with: farmers, traders
    if (userRole === "farmer") {
        query.role = { $in: ["trader", "cold-storage"] };
    } else if (userRole === "trader") {
        query.role = { $in: ["farmer", "cold-storage"] };
    } else if (userRole === "cold-storage") {
        query.role = { $in: ["farmer", "trader"] };
    }

    const users = await User.find(query)
        .select('firstName lastName role phone address')
        .limit(50);

    return res.status(200).json(
        new ApiResponse(200, users, "Users fetched successfully")
    );
});

// Search users to start new chat
export const searchUsers = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { query, role } = req.query;

    let searchQuery = { _id: { $ne: userId } };

    if (query) {
        searchQuery.$or = [
            { firstName: { $regex: query, $options: 'i' } },
            { lastName: { $regex: query, $options: 'i' } },
            { phone: { $regex: query, $options: 'i' } }
        ];
    }

    if (role && ["farmer", "trader", "cold-storage"].includes(role)) {
        searchQuery.role = role;
    }

    const users = await User.find(searchQuery)
        .select('firstName lastName role phone address')
        .limit(20);

    return res.status(200).json(
        new ApiResponse(200, users, "Users found")
    );
});

// Mark messages as read
export const markAsRead = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { conversationId } = req.params;

    const conversation = await Conversation.findOne({
        _id: conversationId,
        participants: userId
    });

    if (!conversation) {
        throw new ApiError(404, "Conversation not found");
    }

    // Mark all unread messages as read
    await Message.updateMany(
        { conversationId, receiver: userId, isRead: false },
        { isRead: true, readAt: new Date(), status: "read" }
    );

    // Reset unread count
    conversation.unreadCount.set(userId.toString(), 0);
    await conversation.save();

    return res.status(200).json(
        new ApiResponse(200, null, "Messages marked as read")
    );
});
