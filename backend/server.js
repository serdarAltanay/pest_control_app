// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcrypt";

// Route'ları import et
import authRoutes from "./routes/auth.js";
import seedRoutes from "./routes/seed.js";
import wipeRoutes from "./routes/wipe.js";
import customerRoutes from "./routes/customers.js";

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/seed", seedRoutes);
app.use("/api/wipe", wipeRoutes);
app.use("/api/customers", customerRoutes);

// Örnek hash kontrol
console.log(bcrypt.hashSync("123456", 10));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server ${PORT} portunda çalışıyor`));
