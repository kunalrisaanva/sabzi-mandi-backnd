import { getRedisClient } from '../config/redis.js';
import nodemailer from 'nodemailer';
import twilio from 'twilio';

// OTP Configuration
const OTP_EXPIRY = 120; // 2 minutes in seconds
const OTP_LENGTH = 6;

// Generate random OTP
const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// Store OTP in Redis
export const storeOTP = async (identifier, otp, type = 'email') => {
    try {
        const redisClient = getRedisClient();
        const key = `otp:${type}:${identifier}`;
        await redisClient.setEx(key, OTP_EXPIRY, otp);
        return true;
    } catch (error) {
        console.error('Error storing OTP:', error);
        throw error;
    }
};

// Verify OTP from Redis
export const verifyOTP = async (identifier, otp, type = 'email') => {
    try {
        const redisClient = getRedisClient();
        const key = `otp:${type}:${identifier}`;
        const storedOTP = await redisClient.get(key);

        if (!storedOTP) {
            return { success: false, message: 'OTP expired or not found' };
        }

        if (storedOTP !== otp) {
            return { success: false, message: 'Invalid OTP' };
        }

        // Delete OTP after successful verification
        await redisClient.del(key);
        return { success: true, message: 'OTP verified successfully' };
    } catch (error) {
        console.error('Error verifying OTP:', error);
        throw error;
    }
};

// Send OTP via Email
export const sendEmailOTP = async (email) => {
    try {
        const otp = generateOTP();

        // Create transporter
        const transporter = nodemailer.createTransport({
            service: process.env.EMAIL_SERVICE || 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD
            }
        });

        // Email options
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Your OTP for Verification',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333;">OTP Verification</h2>
                    <p>Your OTP for verification is:</p>
                    <h1 style="color: #4CAF50; font-size: 32px; letter-spacing: 5px;">${otp}</h1>
                    <p>This OTP will expire in 2 minutes.</p>
                    <p style="color: #666; font-size: 12px;">If you didn't request this OTP, please ignore this email.</p>
                </div>
            `
        };

        // Send email
        await transporter.sendMail(mailOptions);

        // Store OTP in Redis
        await storeOTP(email, otp, 'email');

        return { success: true, message: 'OTP sent to email successfully' };
    } catch (error) {
        console.error('Error sending email OTP:', error);
        throw error;
    }
};

// Send OTP via SMS (Twilio)
export const sendPhoneOTP = async (phone) => {
    try {
        const otp = generateOTP();

        // Initialize Twilio client
        const client = twilio(
            process.env.TWILIO_ACCOUNT_SID,
            process.env.TWILIO_AUTH_TOKEN
        );

        // Send SMS
        await client.messages.create({
            body: `Your OTP for verification is: ${otp}. This OTP will expire in 2 minutes.`,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: phone
        });

        // Store OTP in Redis
        await storeOTP(phone, otp, 'phone');

        return { success: true, message: 'OTP sent to phone successfully' };
    } catch (error) {
        console.error('Error sending phone OTP:', error);
        throw error;
    }
};

// Rate limiting for OTP requests
export const checkOTPRateLimit = async (identifier, type = 'email') => {
    try {
        const redisClient = getRedisClient();
        const rateLimitKey = `otp:ratelimit:${type}:${identifier}`;
        const attempts = await redisClient.get(rateLimitKey);

        if (attempts && parseInt(attempts) >= 3) {
            return { allowed: false, message: 'Too many OTP requests. Please try again after 15 minutes.' };
        }

        // Increment attempts
        const newAttempts = attempts ? parseInt(attempts) + 1 : 1;
        await redisClient.setEx(rateLimitKey, 900, newAttempts.toString()); // 15 minutes

        return { allowed: true };
    } catch (error) {
        console.error('Error checking rate limit:', error);
        throw error;
    }
};
