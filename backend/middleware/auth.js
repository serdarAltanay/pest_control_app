// middleware/auth.js
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

// JWT doğrulama
export function auth(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Token yok" });

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ message: "Token geçersiz" });
    req.user = decoded; // { id, role }
    next();
  });
}

// Role bazlı kontrol
export function roleCheck(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: "Yetkisiz erişim" });
    if (!allowedRoles.includes(req.user.role))
      return res.status(403).json({ message: "Yetkisiz erişim" });
    next();
  };
}
