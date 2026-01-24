import express from "express";
import { Post } from "../models/post.model.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = express.Router();

// Get all posts
router.get("/", async (req, res) => {
    try {
        const { category, limit = 20, page = 1 } = req.query;
        const query = {};
        
        if (category) query.category = category;
        
        const posts = await Post.find(query)
            .populate("author", "firstName lastName role")
            .populate("comments.user", "firstName lastName")
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));
        
        const total = await Post.countDocuments(query);
        
        res.status(200).json({
            success: true,
            data: {
                posts,
                total,
                page: parseInt(page),
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get single post
router.get("/:id", async (req, res) => {
    try {
        const post = await Post.findById(req.params.id)
            .populate("author", "firstName lastName role")
            .populate("comments.user", "firstName lastName");
        
        if (!post) {
            return res.status(404).json({ success: false, message: "Post not found" });
        }
        
        res.status(200).json({ success: true, data: { post } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Create post (protected)
router.post("/create", authMiddleware, async (req, res) => {
    try {
        const { content, category, images } = req.body;
        
        const post = await Post.create({
            author: req.user._id,
            content,
            category: category || "general",
            images: images || []
        });
        
        const populatedPost = await Post.findById(post._id)
            .populate("author", "firstName lastName role");
        
        res.status(201).json({
            success: true,
            message: "Post created successfully",
            data: { post: populatedPost }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Like/Unlike post (protected)
router.patch("/:id/like", authMiddleware, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        
        if (!post) {
            return res.status(404).json({ success: false, message: "Post not found" });
        }
        
        const userId = req.user._id;
        const isLiked = post.likes.includes(userId);
        
        if (isLiked) {
            post.likes = post.likes.filter(id => id.toString() !== userId.toString());
        } else {
            post.likes.push(userId);
        }
        
        await post.save();
        
        res.status(200).json({
            success: true,
            message: isLiked ? "Post unliked" : "Post liked",
            data: { likesCount: post.likes.length }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Add comment (protected)
router.post("/:id/comment", authMiddleware, async (req, res) => {
    try {
        const { text } = req.body;
        
        const post = await Post.findById(req.params.id);
        
        if (!post) {
            return res.status(404).json({ success: false, message: "Post not found" });
        }
        
        post.comments.push({
            user: req.user._id,
            text
        });
        
        await post.save();
        
        const updatedPost = await Post.findById(post._id)
            .populate("comments.user", "firstName lastName");
        
        res.status(200).json({
            success: true,
            message: "Comment added",
            data: { comments: updatedPost.comments }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Delete post (protected - only author)
router.delete("/:id", authMiddleware, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        
        if (!post) {
            return res.status(404).json({ success: false, message: "Post not found" });
        }
        
        if (post.author.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: "Not authorized" });
        }
        
        await post.deleteOne();
        
        res.status(200).json({ success: true, message: "Post deleted" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;
