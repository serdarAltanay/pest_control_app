// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

// Route'lar�� import et
import authRoutes from "./routes/auth.js";
import seedRoutes from "./routes/seed.js";
import wipeRoutes from "./routes/wipe.js";
import customerRoutes from "./routes/customers.js";
import adminRoutes from "./routes/admin.js";
import profileRouter from "./routes/profile.js";
import uploadRoutes from "./routes/upload.js";
import cookieParser from "cookie-parser";
import employeeRouter from "./routes/employee.js";

import heartbeatRoutes from "./routes/heartbeat.js";
import onlineRoutes from "./routes/online.js";
import presenceRouter from "./routes/presence.js";

import storesRouter from "./routes/stores.js";
import { stationsRouter,stationsNestedRouter } from "./routes/stations.js";

import biocidesRouter from "./routes/Biocides.js";

import visitsRouter from "./routes/visits.js";
import ek1Router from "./routes/ek1.js";


dotenv.config();

const app = express();

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: "http://localhost:3000",
  credentials: true,
}));


// Routes
app.use("/api/auth", authRoutes);

app.use("/api/seed", seedRoutes);
app.use("/api/wipe", wipeRoutes);

app.use("/api/customers", customerRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/profile", profileRouter);
app.use("/api/employees", employeeRouter);

app.use("/uploads", express.static("uploads"));
app.use("/api/upload", uploadRoutes);

app.use("/api/heartbeat", heartbeatRoutes);
app.use("/api/online", onlineRoutes);
app.use("/api/presence", presenceRouter);

app.use("/api/stores", storesRouter);

app.use("/api/stations", stationsRouter);
app.use("/api", stationsNestedRouter);

app.use("/api/biocides", biocidesRouter);

app.use("/api/visits", visitsRouter);
app.use("/api/ek1", ek1Router);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server ${PORT} portunda açıldı`));
