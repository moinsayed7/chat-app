const express = require("express");
require("dotenv").config();
const app = express();
const db = require("./db");
const val = require("./lib/registrationValid");
const bcrypt = require("bcrypt");
const User = require("./models/User");
const loginValidation = require("./lib/loginValidation");
const jwt = require("jsonwebtoken");
const authMiddleware = require("./authMiddleware");
const cookieParser = require("cookie-parser");
const Conversation = require("./models/Conversation");
const Message = require("./models/Message");
const infoValidator = require("./lib/infoValidation");
const createMessage = require("./services/messageService");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: `${process.env.FRONTEND_URL}`,
    credentials: true,
  },
});

app.use(express.json());
app.use(cookieParser());

app.use(
  cors({
    origin: `${process.env.FRONTEND_URL}`,
    credentials: true,
  }),
);

app.get("/message/:conversationId", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const convoId = req.params.conversationId;

    const convo = await Conversation.findOne({
      _id: convoId,
      participants: userId,
    });

    if (!convo) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const messages = await Message.find({ roomId: convo._id }).sort({
      createdAt: 1,
    });

    res.status(200).json({ data: messages });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/conversation/with/:receiverId", authMiddleware, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const receiverId = req.params.receiverId;

    const isReceiverId = await User.findOne({ _id: receiverId });

    if (!isReceiverId) {
      res.status(404).json({ error: "No User found with receiver Id" });
      return;
    }

    const findConvo = await Conversation.findOne({
      participants: { $all: [currentUserId, receiverId] },
    })
      .populate("participants", "-password")
      .populate("lastMessageId");

    res.status(200).json({ convoExist: !!findConvo, data: findConvo });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/conversations", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const conversations = await Conversation.find({ participants: req.user.id })
      .populate("participants", "-password")
      .populate("lastMessageId");

    res.status(200).json({ data: conversations });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/messages", authMiddleware, async (req, res) => {
  try {
    const senderId = req.user.id;
    const parsed = infoValidator.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid data format" });
    }

    const msg = await createMessage(
      senderId,
      parsed.data.receiverId,
      parsed.data.text,
    );

    res.status(201).json({ message: "Message created", roomId: msg.roomId });
  } catch (err) {
    if (err.message === "Receiver user not found")
      return res.status(404).json({ error: "Receiver user not found" });

    res.status(500).json({ error: err.message });
  }
});

app.get("/conversation/:conversationId", authMiddleware, async (req, res) => {
  const currentUserId = req.user.id;
  const convoId = req.params.conversationId;

  let convo;

  try {
    convo = await Conversation.findOne({
      _id: convoId,
      participants: currentUserId,
    })
      .populate("participants", "-password")
      .populate("lastMessageId");
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }

  res.status(200).json({ data: convo });
});

app.get("/users", authMiddleware, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const search = req.query.search;

    if (!search) {
      res.status(200).json({ success: false });
      return;
    }

    const query = { _id: { $ne: currentUserId } };

    query.username = { $regex: search, $options: "i" };

    const users = await User.find(query).select("-password");

    res.status(200).json({ success: true, data: users });
  } catch {
    res.status(500).json({ error: "Something went wrong " });
  }
});

app.post("/auth/register", async (req, res) => {
  const data = req.body;

  const parsed = val.safeParse(data);

  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid data" });
  }

  let existingUser;
  try {
    existingUser = await User.findOne({ email: parsed.data.email });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }

  if (existingUser) {
    return res.status(409).json({ error: "Data already exist" });
  }

  let hashedPass;

  try {
    hashedPass = await bcrypt.hash(parsed.data.password, 10);
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }

  try {
    const newUser = await User.create({
      email: parsed.data.email,
      password: hashedPass,
      username: parsed.data.username,
    });

    res
      .status(201)
      .json({ message: "Data created", username: newUser.username });
  } catch (err) {
    res.status(500).json({ error: "Something went wrong " });
  }
});

app.post("/auth/login", async (req, res) => {
  const data = req.body;

  const parsed = loginValidation.safeParse(data);

  if (!parsed.success) {
    return res.status(400).json({ error: "Wrong data format" });
  }

  let getUser;

  try {
    getUser = await User.findOne({ email: parsed.data.email });
  } catch {
    return res.status(500).json({ error: "Internal error" });
  }

  if (!getUser) {
    return res.status(400).json({ error: "Wrong email or password" });
  }

  let isPass;

  try {
    isPass = await bcrypt.compare(parsed.data.password, getUser.password);
  } catch {
    return res.status(500).json({ error: "Internal error" });
  }

  if (!isPass) {
    return res.status(400).json({ error: "Wrong email or password" });
  }

  const token = jwt.sign({ id: getUser._id }, process.env.JWT_SECRET, {
    expiresIn: "1d",
  });

  res.cookie("token", token, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
  });

  res
    .status(200)
    .json({ message: "Successfully logged in", username: getUser.username });
});

const onlineUsers = {};

io.on("connection", (socket) => {
  if(!onlineUsers[socket.user.id]){
    onlineUsers[socket.user.id]=[]
  }
  onlineUsers[socket.user.id].push(socket.id);

  socket.on("sendMessage", async (data) => {
    let receiverSocketId;
    try {
      const userId = socket.user.id;
      const parsed = infoValidator.safeParse(data);

      if (!parsed.success) {
        return socket.emit("messageError", "Wrong data format");
      }

      receiverSocketId = onlineUsers[parsed.data.receiverId];

      const createdMsg = await createMessage(
        userId,
        parsed.data.receiverId,
        parsed.data.text,
      );

      if (receiverSocketId) {
        receiverSocketId.forEach((ele) => {
          io.to(ele).emit("newMessage", createdMsg);
        });
      }

      socket.emit("messageSent", createdMsg);
    } catch (err) {
      socket.emit("messageError", err.message);
    }
  });

  socket.on("disconnect", async () => {
    const newArr = onlineUsers[socket.user.id].filter(
      (ele) => ele !== socket.id,
    );
    onlineUsers[socket.user.id] = newArr;
  });
});

io.use((socket, next) => {
  const cookies = require("cookie").parseCookie(
    socket.handshake.headers.cookie || "",
  );
  const token = cookies.token;

  if (!token) {
    return next(new Error("No token"));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded;
    next();
  } catch {
    next(new Error("Invalid token"));
  }
});

const PORT= process.env.PORT || 3000

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// test id

// email:
// rahul@test.com

// pass:
// rahul@test.com

// {
//   "username": "sarahtest",
//   "email": "sarah@test.com",
//   "password": "testpassword123"
// }

// {
//   "email": "moin@test.com",
//   "password": "testpassword123"
// }


// email:
// raj@test.com
// pass:
//  raj@test.com