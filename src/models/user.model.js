import mongoose from "mongoose";
import jwt from "jsonwebtoken"
import bcrypt from "bcrypt"

const user_schema = new mongoose.Schema({


    username: {
        type: String,
    },

    email: {
        type: String,
        required: [true, "Email is required"],
        unique: true,
        trim: true
    },

    password: {
        type: String,
        required: true,
        select:false
    },

    refreshToken: {
        type: String,
    }


});





// genarate accesstoken

user_schema.methods.genreateAccessToken = async function(){

    return await jwt.sign({_id:this._id},process.env.ACCESS_TOKEN_SECRET,{expiresIn:"1d"});
}

// genrate refresh token 

user_schema.methods.genrateRefreshToken = async function() {
    
    return await jwt.sign({_id:this._id},process.env.REFRESS_TOKEN_SECRET,{expiresIn:"10m"});
}

// password hashing

user_schema.pre("save",async function () {

    if(!this.isModified("password")) return;
    this.password = await bcrypt.hash(this.password,8);

})


// compare password 

user_schema.methods.isPasswordMatch = async function(password){

    return bcrypt.compare(password,this.password)

} 


const User = new mongoose.model("User", user_schema);


export { User }







