const mongoose = require("mongoose");
require("dotenv").config();

async function connectDB() {
    try{
        await mongoose.connect(process.env.MONGODB_URI)
        console.log("Connected")
    }
    catch(err){
        console.log("Connection failed", err)
    }
}

connectDB()
