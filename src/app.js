import express from "express";
import cors from "cors";



const app = express();

// Enable CORS for all origins (Flutter web app)
app.use(cors());
app.use(express.json())




app.get("/", (req, res) => res.json({ msg: "Api is Running" }));

// routes

import { router as userRouter } from "./routes/user.routes.js";
import { router as coldStorageRouter } from "./routes/coldStorage.routes.js";
import { router as chatRouter } from "./routes/chat.routes.js";
import postRouter from "./routes/post.routes.js";
import listingRouter from "./routes/listing.routes.js";

app.use("/api/v1/user", userRouter);
app.use("/api/v1/cold-storage", coldStorageRouter);
app.use("/api/v1/chat", chatRouter);
app.use("/api/v1/posts", postRouter);
app.use("/api/v1/listings", listingRouter);




// Global error handling middleware
app.use((err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    return res.status(statusCode).json({
        success: false,
        statusCode,
        message,
        errors: err.errors || []
    });
});


export { app }

