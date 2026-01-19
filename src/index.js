import dotenv from "dotenv";
dotenv.config({
    path:"./.env"
})
import {app} from "./app.js"

import { dbConnection } from "./db/dbConnection.js";

const Port = process.env.PORT || 8888;




dbConnection()
.then(() => {
    
    app.listen(Port,()=> console.log(`Server is Running on Port ${Port} with ${process.pid}`));
    
})




