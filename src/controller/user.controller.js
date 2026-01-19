import { ApiResponse } from "../utils/ApiResponse.js";

import { ApiError } from "../utils/ApiError.js"

import { asyncHandler } from "../utils/asyncHandler.js"

import { User } from "../models/user.model.js"


const genrateAccessTokenAndRefresToken = async (user) => {

    const accessToken = await user.genreateAccessToken();
    const refreshToken = await user.genrateRefreshToken();

    return { refreshToken, accessToken }

}


const userRegister = asyncHandler(async (req, res) => {


    const { username, email, password } = req.body;

    // validation

    if (!email || !password || !username.trim()) throw new ApiError(400, "Please provide all fields First")

    // check user already exist or not

    const user = await User.findOne({ email });
    console.log("user --->", user)

    if (user) throw new ApiError(400, "user already exist");


    // saving into db


    const createdUser = await User.create({
        username,
        email,
        password

    });

    return res.
        json(new ApiResponse(201, { createdUser }, "user created successfullt"))
});


const userLogin = asyncHandler(async (req, res) => {

    const { email, password } = req.body;

    // validation 

    if (!email || !password) throw new ApiError(400, "Please provide all fields first")

    const userLoggedIn = await User.findOne({ email }).select("+password")


    if (!userLoggedIn) throw new ApiError(404, "User does not exist in db");

    // password match

    const isMatch = await userLoggedIn.isPasswordMatch(password);

    if (!isMatch) throw new ApiError(401, "Password does not match");


    // genrarte access token and refreshtoken 
    const { accessToken, refreshToken } = await genrateAccessTokenAndRefresToken(userLoggedIn);

    // saving refreshtoken into db

    userLoggedIn.refreshToken = refreshToken


    await userLoggedIn.save({ validateBeforeSave: false })

    // Remove password from response
    const newUser = await User.findById({ _id: userLoggedIn._id }).lean().select("-refreshToken");

    return res.json(
        new ApiResponse(200, { user: newUser, accessToken, refreshToken }, "user logged in successfully")
    )

})

const logout = asyncHandler(async (req, res) => {

    // Clear refresh token from database
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: { refreshToken: 1 }
        },
        { new: true }
    );

    return res.json(
        new ApiResponse(200, {}, "User logged out successfully")
    );

});






export { userRegister, userLogin, logout }