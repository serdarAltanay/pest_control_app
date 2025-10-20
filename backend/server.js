// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import authRoutes from "./routes/auth.js";
import seedRoutes from "./routes/seed.js";
import wipeRoutes from "./routes/wipe.js";
import customerRoutes from "./routes/customers.js";
import adminRoutes from "./routes/admin.js";
import profileRouter from "./routes/profile.js";

import uploadRoutes from "./routes/upload.js";
import nonconformitiesRoutes from "./routes/nonconformities.js";

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

import  activationsRouter  from "./routes/activations.js";
import  analyticsRouter  from "./routes/analytics.js";

import reportsRoutes from "./routes/reports.js";

import scheduleRouter from "./routes/schedule.js";

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

/* ---- EK1 ROUTER MOUNTS (genişletildi) ---- */
app.use("/api/ek1", ek1Router);
// FE'nin zaman zaman /api/api/ek1 ve /api/admin/ek1 denemelerini de karşılayalım:
app.use("/api/api/ek1", ek1Router);
app.use("/api/admin/ek1", ek1Router);
/* ------------------------------------------ */

app.use("/api/admin", adminRoutes);
app.use("/api/profile", profileRouter);
app.use("/api/employees", employeeRouter);

app.use("/uploads", express.static("uploads"));
app.use("/api/upload", uploadRoutes);
app.use("/api/nonconformities", nonconformitiesRoutes);
app.use("/api/reports", reportsRoutes);

app.use("/api/heartbeat", heartbeatRoutes);
app.use("/api/online", onlineRoutes);
app.use("/api/presence", presenceRouter);

app.use("/api/stores", storesRouter);

app.use("/api/activations", activationsRouter);
app.use("/api/analytics", analyticsRouter);

app.use("/api/stations", stationsRouter);
app.use("/api/stores", stationsNestedRouter);

app.use("/api/biocides", biocidesRouter);

app.use("/api/visit", visitsRouter);
app.use("/api/visits", visitsRouter);

app.use("/api/schedule", scheduleRouter);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server ${PORT} portunda açıldı`));
