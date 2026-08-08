const jwt = require("jsonwebtoken");

async function authMiddleware(req, res, next) {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ error: "No token" });
  }
  let verification;

  try {
    verification = await jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: "Token" });
  };

  req.user= verification;
  next();


}


module.exports = authMiddleware;