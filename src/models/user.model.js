import mongoose from "mongoose";
import jwt from "jsonwebtoken"
import bcrypt from "bcrypt"

const user_schema = new mongoose.Schema({

    firstName: {
        type: String,
        required: true,
        trim: true
    },

    lastName: {
        type: String,
        required: true,
        trim: true
    },

    email: {
        type: String,
        sparse: true, // Allows multiple null values, users can register with phone only
        unique: true,
        trim: true,
        lowercase: true
    },

    phone: {
        type: String,
        sparse: true, // Allows multiple null values, users can register with email only
        unique: true,
        trim: true
    },

    password: {
        type: String,
        required: true,
        select: false
    },

    isEmailVerified: {
        type: Boolean,
        default: false
    },

    isPhoneVerified: {
        type: Boolean,
        default: false
    },

    role: {
        type: String,
        enum: ["farmer", "trader", "cold-storage"],
        default: "farmer"
    },

    address:{
        type:String,
        required:true,
        village:{
            type:String,
            required:true
        },
        district:{
            type:String,
            required:true
        },
        state:{
            type:String,
            required:true
        },
        pincode:{
            type:String,
            required:true
        }
    },


    refreshToken: {
        type: String,
    }

}, { timestamps: true }); // Adds createdAt and updatedAt fields





// genarate accesstoken

user_schema.methods.genreateAccessToken = async function () {

    return await jwt.sign({ _id: this._id }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "1d" });
}

// genrate refresh token 

user_schema.methods.genrateRefreshToken = async function () {

    return await jwt.sign({ _id: this._id }, process.env.REFRESS_TOKEN_SECRET, { expiresIn: "10m" });
}

// password hashing

user_schema.pre("save", async function () {

    if (!this.isModified("password")) return;
    this.password = await bcrypt.hash(this.password, 8);

})


// compare password 

user_schema.methods.isPasswordMatch = async function (password) {

    return bcrypt.compare(password, this.password)

}


const User = new mongoose.model("User", user_schema);


export { User }







