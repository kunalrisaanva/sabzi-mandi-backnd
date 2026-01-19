import dotenv from "dotenv";
dotenv.config({
    path: "./.env"
})
import { app } from "./app.js"

import { dbConnection } from "./db/dbConnection.js";
import { connectRedis } from "./config/redis.js";

const Port = process.env.PORT || 8888;




dbConnection()
    .then(async () => {
        // Initialize Redis
        await connectRedis();

        app.listen(Port, () => console.log(`Server is Running on Port ${Port} with ${process.pid}`));

    })




