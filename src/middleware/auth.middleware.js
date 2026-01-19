import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";

const authMiddleware = asyncHandler(async (req, res, next) => {

    try {

        const incomingToken = req.headers.authorization?.split(" ")[1]

        if (!incomingToken || incomingToken == "undefined") throw new ApiError(401, "Unauthrized: token not provide");

        const decode = await jwt.verify(incomingToken, process.env.ACCESS_TOKEN_SECRET);

        const user = await User.findById({ _id: decode._id });

        if (!user) throw new ApiError(404, "Unauthrized: User not Found ")

        req.user = user;

        next();

    } catch (error) {

        console.log(error?.message || "Something went wrong while creating Token");
        next(error)
    }

});


export { authMiddleware }