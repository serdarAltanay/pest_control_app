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
import adminRoutes from "./routes/admin.js";
import profileRouter from "./routes/profile.js";

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
app.use("/api/admin", adminRoutes);
app.use("/api/profile", profileRouter);


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server ${PORT} portunda çalışıyor`));
