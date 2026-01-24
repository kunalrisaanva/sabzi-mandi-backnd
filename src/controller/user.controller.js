import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";
import { sendPhoneOTP, sendEmailOTP, verifyOTP, checkRateLimit } from "../services/otp.unified.service.js";

// In-memory registration data store (since Redis may not be available)
const registrationStore = new Map();
const REGISTRATION_EXPIRY = 300000; // 5 minutes


const genrateAccessTokenAndRefresToken = async (user) => {
    const accessToken = await user.genreateAccessToken();
    const refreshToken = await user.genrateRefreshToken();
    return { refreshToken, accessToken }
}

// Clean expired registration data periodically
setInterval(() => {
    const now = Date.now();
    for (const [key, data] of registrationStore.entries()) {
        if (data.expiresAt < now) {
            registrationStore.delete(key);
        }
    }
}, 60000);

// ============================================
// REGISTRATION - Step 1: Send OTP
// ============================================

const userRegister = asyncHandler(async (req, res) => {
    const { firstName, lastName, email, phone, password, address, role } = req.body;

    // Validation - must provide phone number
    if (!phone) {
        throw new ApiError(400, "Phone number is required");
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

    const identifier = phone.trim();
    
    // Check if user already exists
    const existingUser = await User.findOne({ phone: identifier });
    if (existingUser) {
        throw new ApiError(400, "User with this phone number already exists");
    }

    // Check rate limit
    const rateLimit = checkRateLimit(identifier, 'phone');
    if (!rateLimit.allowed) {
        throw new ApiError(429, rateLimit.message);
    }

    // Store registration data in memory
    const registrationData = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email || null,
        phone: identifier,
        password,
        address: address || {},
        role: role || 'farmer',
        expiresAt: Date.now() + REGISTRATION_EXPIRY
    };

    const registrationKey = `registration:phone:${identifier}`;
    registrationStore.set(registrationKey, registrationData);

    // Send OTP
    const otpResult = await sendPhoneOTP(identifier);

    // In dev mode, return OTP for testing
    const responseData = { phone: identifier };
    if (process.env.DEV_MODE === 'true' && otpResult.otp) {
        responseData.otp = otpResult.otp; // Only in dev mode!
    }

    return res.json(
        new ApiResponse(200, responseData, "OTP sent successfully. Valid for 2 minutes.")
    );
});


// ============================================
// REGISTRATION - Step 2: Verify OTP and Create User
// ============================================

const verifyOTPAndRegister = asyncHandler(async (req, res) => {
    const { phone, otp } = req.body;

    // Validation
    if (!phone) {
        throw new ApiError(400, "Phone number is required");
    }

    if (!otp) {
        throw new ApiError(400, "OTP is required");
    }

    const identifier = phone.trim();

    // Verify OTP
    const otpVerification = await verifyOTP(identifier, otp, 'phone');
    if (!otpVerification.success) {
        throw new ApiError(400, otpVerification.message);
    }

    // Get registration data from memory store
    const registrationKey = `registration:phone:${identifier}`;
    const registrationData = registrationStore.get(registrationKey);

    if (!registrationData) {
        throw new ApiError(400, "Registration session expired. Please register again.");
    }

    if (registrationData.expiresAt < Date.now()) {
        registrationStore.delete(registrationKey);
        throw new ApiError(400, "Registration session expired. Please register again.");
    }

    console.log('Registration Data:', registrationData);

    // Create user in MongoDB
    const userData = {
        firstName: registrationData.firstName,
        lastName: registrationData.lastName,
        password: registrationData.password,
        phone: identifier,
        isPhoneVerified: true,
        role: registrationData.role || 'farmer',
        address: registrationData.address || {}
    };

    const createdUser = await User.create(userData);

    // Delete registration data from memory
    registrationStore.delete(registrationKey);

    // Generate tokens
    const { accessToken, refreshToken } = await genrateAccessTokenAndRefresToken(createdUser);
    createdUser.refreshToken = refreshToken;
    await createdUser.save({ validateBeforeSave: false });

    const userResponse = await User.findById(createdUser._id).select("-refreshToken");

    return res.status(201).json(
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

// ============================================
// DEV REGISTRATION (No OTP - for testing)
// ============================================

const devRegister = asyncHandler(async (req, res) => {
    const { firstName, lastName, email, phone, password, role, address } = req.body;

    // Validation
    if (!email && !phone) {
        throw new ApiError(400, "Please provide either email or phone number");
    }

    if (!password || password.length < 6) {
        throw new ApiError(400, "Password must be at least 6 characters long");
    }

    if (!firstName || !lastName) {
        throw new ApiError(400, "First name and last name are required");
    }

    // Check if user already exists
    let existingUser;
    if (email) {
        existingUser = await User.findOne({ email: email.trim() });
    }
    if (phone) {
        existingUser = existingUser || await User.findOne({ phone: phone.trim() });
    }

    if (existingUser) {
        throw new ApiError(400, "User already exists");
    }

    // Create user directly without OTP
    const userData = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        password,
        role: role || "farmer",
        address: address || {
            village: "Default Village",
            district: "Default District",
            state: "Default State",
            pincode: "000000"
        }
    };

    if (email) {
        userData.email = email.trim();
        userData.isEmailVerified = true;
    }
    if (phone) {
        userData.phone = phone.trim();
        userData.isPhoneVerified = true;
    }

    const createdUser = await User.create(userData);

    // Generate tokens
    const { accessToken, refreshToken } = await genrateAccessTokenAndRefresToken(createdUser);
    createdUser.refreshToken = refreshToken;
    await createdUser.save({ validateBeforeSave: false });

    const userResponse = await User.findById(createdUser._id).select("-refreshToken");

    return res.status(201).json(
        new ApiResponse(201, { user: userResponse, accessToken, refreshToken }, "User registered successfully")
    );
});

// ============================================
// GET USER PROFILE
// ============================================

const getUserProfile = asyncHandler(async (req, res) => {
    const { userId } = req.params;

    const user = await User.findById(userId).select("-refreshToken -password");
    
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    return res.json(
        new ApiResponse(200, user, "User profile fetched successfully")
    );
});

// ============================================
// GET ALL USERS (for directory)
// ============================================

const getAllUsers = asyncHandler(async (req, res) => {
    const { role, search } = req.query;
    const currentUserId = req.user._id;

    let query = { _id: { $ne: currentUserId } };

    if (role && ["farmer", "trader", "cold-storage"].includes(role)) {
        query.role = role;
    }

    if (search) {
        query.$or = [
            { firstName: { $regex: search, $options: 'i' } },
            { lastName: { $regex: search, $options: 'i' } },
            { phone: { $regex: search, $options: 'i' } }
        ];
    }

    const users = await User.find(query)
        .select("firstName lastName role phone address")
        .limit(100);

    return res.json(
        new ApiResponse(200, users, "Users fetched successfully")
    );
});

// ============================================
// RESEND OTP
// ============================================

const resendOTP = asyncHandler(async (req, res) => {
    const { phone } = req.body;

    if (!phone) {
        throw new ApiError(400, "Phone number is required");
    }

    const identifier = phone.trim();

    // Check rate limit
    const rateLimit = checkRateLimit(identifier, 'phone');
    if (!rateLimit.allowed) {
        throw new ApiError(429, rateLimit.message);
    }

    // Check if registration data exists
    const registrationKey = `registration:phone:${identifier}`;
    const registrationData = registrationStore.get(registrationKey);

    if (!registrationData) {
        throw new ApiError(400, "No pending registration found. Please register again.");
    }

    // Extend expiry
    registrationData.expiresAt = Date.now() + REGISTRATION_EXPIRY;
    registrationStore.set(registrationKey, registrationData);

    // Send new OTP
    const otpResult = await sendPhoneOTP(identifier);

    const responseData = { phone: identifier };
    if (process.env.DEV_MODE === 'true' && otpResult.otp) {
        responseData.otp = otpResult.otp;
    }

    return res.json(
        new ApiResponse(200, responseData, "OTP resent successfully")
    );
});

// ============================================
// LOGIN WITH OTP - Step 1: Send OTP
// ============================================

const sendLoginOTP = asyncHandler(async (req, res) => {
    const { phone } = req.body;

    if (!phone) {
        throw new ApiError(400, "Phone number is required");
    }

    const identifier = phone.trim();

    // Check if user exists
    const user = await User.findOne({ phone: identifier });
    if (!user) {
        throw new ApiError(404, "User not found. Please register first.");
    }

    // Check rate limit
    const rateLimit = checkRateLimit(identifier, 'phone');
    if (!rateLimit.allowed) {
        throw new ApiError(429, rateLimit.message);
    }

    // Send OTP
    const otpResult = await sendPhoneOTP(identifier, 'login');

    const responseData = { phone: identifier };
    if (process.env.DEV_MODE === 'true' && otpResult.otp) {
        responseData.otp = otpResult.otp;
    }

    return res.json(
        new ApiResponse(200, responseData, "OTP sent successfully")
    );
});

// ============================================
// LOGIN WITH OTP - Step 2: Verify OTP
// ============================================

const verifyLoginOTP = asyncHandler(async (req, res) => {
    const { phone, otp } = req.body;

    if (!phone) {
        throw new ApiError(400, "Phone number is required");
    }

    if (!otp) {
        throw new ApiError(400, "OTP is required");
    }

    const identifier = phone.trim();

    // Verify OTP
    const otpVerification = await verifyOTP(identifier, otp, 'phone');
    if (!otpVerification.success) {
        throw new ApiError(400, otpVerification.message);
    }

    // Find user
    const user = await User.findOne({ phone: identifier });
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    // Generate tokens
    const { accessToken, refreshToken } = await genrateAccessTokenAndRefresToken(user);
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    const userResponse = await User.findById(user._id).select("-refreshToken -password");

    return res.json(
        new ApiResponse(200, { user: userResponse, accessToken, refreshToken }, "Login successful")
    );
});


export { userRegister, verifyOTPAndRegister, userLogin, logout, devRegister, getUserProfile, getAllUsers, resendOTP, sendLoginOTP, verifyLoginOTP }