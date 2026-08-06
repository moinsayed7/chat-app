const express = require("express");
const app = express();
const db = require("./db");
const val = require("./lib/registrationValid");
const bcrypt = require("bcrypt");
const User = require("./models/User");
const loginValidation = require("./lib/loginValidation");
const jwt= require('jsonwebtoken');
const authMiddleware= require('./authMiddleware');
const cookieParser= require('cookie-parser')

app.use(express.json());
app.use(cookieParser())

app.post("/messages", authMiddleware, (req, res) => {
  console.log(req.body);
  console.log('Authenticated user:', req.user);
  res.send('received');
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
    return res.status(500).json({ error: "Internal error" });
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

  const token =jwt.sign({id:getUser._id}, process.env.JWT_SECRET,{expiresIn:'1d'})


  res.cookie('token', token, {
    httpOnly:true,
    secure:false,
    sameSite:'none'
  })

  res.status(200).json({message:"Successfully logged in", username:getUser.username})
  



});

app.listen(3000, () => console.log("Server running on port 3000"));
