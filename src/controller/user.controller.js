import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";
import { sendEmailOTP, sendPhoneOTP, verifyOTP, checkOTPRateLimit } from "../services/otp.service.js";
import { getRedisClient } from "../config/redis.js";


const genrateAccessTokenAndRefresToken = async (user) => {
    const accessToken = await user.genreateAccessToken();
    const refreshToken = await user.genrateRefreshToken();
    return { refreshToken, accessToken }
}

// ============================================
// REGISTRATION - Step 1: Send OTP (Store data in Redis)
// ============================================

const userRegister = asyncHandler(async (req, res) => {
    const { firstName, lastName, email, phone, password } = req.body;

    // Validation - must provide either email or phone
    if (!email && !phone) {
        throw new ApiError(400, "Please provide either email or phone number");
    }

    if (!password) {
        throw new ApiError(400, "Password is required");
    }

    if (password.length < 6) {
        throw new ApiError(400, "Password must be at least 6 characters long");
    }

    if (!firstName || !lastName) {
        throw new ApiError(400, "First name and last name are required");
    }

    let identifier, type, existingUser;

    // Determine if email or phone
    if (email) {
        identifier = email.trim();
        type = 'email';
        existingUser = await User.findOne({ email: identifier });
    } else {
        identifier = phone.trim();
        type = 'phone';
        existingUser = await User.findOne({ phone: identifier });
    }

    // Check if user already exists in MongoDB
    if (existingUser) {
        throw new ApiError(400, `User with this ${type} already exists`);
    }

    // Check rate limit
    const rateLimit = await checkOTPRateLimit(identifier, type);
    if (!rateLimit.allowed) {
        throw new ApiError(429, rateLimit.message);
    }

    // Store registration data temporarily in Redis (2 minutes)
    const redisClient = getRedisClient();
    const registrationData = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email || null,
        phone: phone || null,
        password,
        type
    };

    const redisKey = `registration:${type}:${identifier}`;

    // Store in Redis (works with both Upstash and local Redis)
    if (redisClient.set && typeof redisClient.set === 'function') {
        // Upstash Redis
        await redisClient.set(redisKey, JSON.stringify(registrationData), { ex: 120 });
    } else {
        // Local Redis
        await redisClient.setEx(redisKey, 120, JSON.stringify(registrationData));
    }

    // Send OTP
    if (type === 'email') {
        await sendEmailOTP(identifier);
    } else {
        await sendPhoneOTP(identifier);
    }

    return res.json(
        new ApiResponse(200, { [type]: identifier }, `OTP sent to ${type} successfully. Valid for 2 minutes.`)
    );
});


// ============================================
// REGISTRATION - Step 2: Verify OTP and Create User
// ============================================

const verifyOTPAndRegister = asyncHandler(async (req, res) => {
    const { email, phone, otp } = req.body;

    // Validation
    if (!email && !phone) {
        throw new ApiError(400, "Please provide either email or phone number");
    }

    if (!otp) {
        throw new ApiError(400, "OTP is required");
    }

    let identifier, type;

    // Determine if email or phone
    if (email) {
        identifier = email.trim();
        type = 'email';
    } else {
        identifier = phone.trim();
        type = 'phone';
    }

    // Verify OTP
    const otpVerification = await verifyOTP(identifier, otp, type);
    if (!otpVerification.success) {
        throw new ApiError(400, otpVerification.message);
    }

    // Get registration data from Redis
    const redisClient = getRedisClient();
    const redisKey = `registration:${type}:${identifier}`;
    const registrationDataStr = await redisClient.get(redisKey);

    if (!registrationDataStr) {
        throw new ApiError(400, "Registration session expired. Please register again.");
    }

    // Upstash Redis auto-parses JSON, local Redis returns string
    const registrationData = typeof registrationDataStr === 'string'
        ? JSON.parse(registrationDataStr)
        : registrationDataStr;

    console.log('📦 Registration Data:', registrationData);

    // Create user in MongoDB
    const userData = {
        firstName: registrationData.firstName,
        lastName: registrationData.lastName,
        password: registrationData.password
    };

    if (email) {
        userData.email = identifier;
        userData.isEmailVerified = true;
    } else {
        userData.phone = identifier;
        userData.isPhoneVerified = true;
    }

    const createdUser = await User.create(userData);

    // Delete registration data from Redis
    await redisClient.del(redisKey);

    // Generate tokens
    const { accessToken, refreshToken } = await genrateAccessTokenAndRefresToken(createdUser);
    createdUser.refreshToken = refreshToken;
    await createdUser.save({ validateBeforeSave: false });

    const userResponse = await User.findById(createdUser._id).select("-refreshToken");

    return res.json(
        new ApiResponse(201, { user: userResponse, accessToken, refreshToken }, "User registered successfully")
    );
});


// ============================================
// LOGIN (Password-based with Email or Phone)
// ============================================

const userLogin = asyncHandler(async (req, res) => {
    const { email, phone, password } = req.body;

    // Validation
    if (!password) {
        throw new ApiError(400, "Password is required");
    }

    if (!email && !phone) {
        throw new ApiError(400, "Please provide either email or phone number");
    }

    let identifier = email || phone;

    // Find user by email or phone
    const userLoggedIn = await User.findOne({
        $or: [{ email: identifier }, { phone: identifier }]
    }).select("+password");

    if (!userLoggedIn) {
        throw new ApiError(404, "User does not exist");
    }

    // Password match
    const isMatch = await userLoggedIn.isPasswordMatch(password);
    if (!isMatch) {
        throw new ApiError(401, "Invalid credentials");
    }

    // Generate tokens
    const { accessToken, refreshToken } = await genrateAccessTokenAndRefresToken(userLoggedIn);

    // Save refresh token
    userLoggedIn.refreshToken = refreshToken;
    await userLoggedIn.save({ validateBeforeSave: false });

    // Remove password from response
    const newUser = await User.findById(userLoggedIn._id).select("-refreshToken");

    return res.json(
        new ApiResponse(200, { user: newUser, accessToken, refreshToken }, "User logged in successfully")
    );
});


const logout = asyncHandler(async (req, res) => {
    // Clear refresh token from database
    await User.findByIdAndUpdate(
        req.user._id,
        { $unset: { refreshToken: 1 } },
        { new: true }
    );

    return res.json(
        new ApiResponse(200, {}, "User logged out successfully")
    );
});


export { userRegister, verifyOTPAndRegister, userLogin, logout }