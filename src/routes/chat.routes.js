import express from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import {
    getConversations,
    getOrCreateConversation,
    getMessages,
    sendMessage,
    getChatableUsers,
    searchUsers,
    markAsRead
} from "../controller/chat.controller.js";

const router = express.Router();

// All chat routes require authentication
router.use(authMiddleware);

// Get all conversations for logged in user
router.get("/conversations", getConversations);

// Get users that can be chatted with (based on role)
router.get("/users", getChatableUsers);

// Search users to start new chat
router.get("/users/search", searchUsers);

// Get or create conversation with a specific user
router.get("/conversation/:otherUserId", getOrCreateConversation);

// Get messages for a conversation
router.get("/messages/:conversationId", getMessages);

// Send a message
router.post("/messages/:conversationId", sendMessage);

// Mark messages as read
router.patch("/messages/:conversationId/read", markAsRead);

export { router };
