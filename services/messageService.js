const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const User = require("../models/User");

async function createMessage(senderId, receiverId, text) {
  const getReceiverUser = await User.findOne({ _id: receiverId });

  if (!getReceiverUser) {
    throw new Error("Receiver user not found");
  }

  let conversation = await Conversation.findOne({
    participants: { $all: [senderId, receiverId] },
  });

  if (!conversation) {
    conversation = await Conversation.create({
      participants: [senderId, receiverId],
    });
  }

  const msg = await Message.create({
    roomId: conversation._id,
    senderId: senderId,
    text: text,
  });

  await Conversation.updateOne(
    { _id: conversation._id },
    {
      $set: {
        lastMessageId: msg._id,
        lastMessageAt: Date.now(),
      },
    }
  );

  return msg;
}

module.exports = createMessage;