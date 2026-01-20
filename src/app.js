import express from "express";



const app = express();


app.use(express.json())




app.get("/", (req, res) => res.json({ msg: "Api is Running" }));

// routes

import { router as userRouter } from "./routes/user.routes.js";
import { router as coldStorageRouter } from "./routes/coldStorage.routes.js";

app.use("/api/v1/user", userRouter);
app.use("/api/v1/cold-storage", coldStorageRouter);




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

