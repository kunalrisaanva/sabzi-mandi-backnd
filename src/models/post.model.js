import mongoose from "mongoose";

const postSchema = new mongoose.Schema({
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    
    content: {
        type: String,
        required: true
    },
    
    images: [{
        type: String
    }],
    
    likes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }],
    
    comments: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },
        text: {
            type: String
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    
    category: {
        type: String,
        enum: ["general", "tip", "question", "news", "price-update"],
        default: "general"
    }
    
}, { timestamps: true });

export const Post = mongoose.model("Post", postSchema);
