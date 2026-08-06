const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema({
  
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  lastMessageId: { type: mongoose.Schema.Types.ObjectId, ref:"Message" },
  lastMessageAt:{type:Date,default:Date.now}
  
});

module.exports = mongoose.model("Conversation", conversationSchema);
