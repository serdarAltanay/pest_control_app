// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import path from "path";

// 🔐 middleware
import { auth } from "./middleware/auth.js";

// Routes
import authRoutes from "./routes/auth.js";
import seedRoutes from "./routes/seed.js";
import wipeRoutes from "./routes/wipe.js";

import customerRoutes from "./routes/customers.js";
import adminRoutes from "./routes/admin.js";
import profileRouter from "./routes/profile.js";

import uploadRoutes from "./routes/upload.js";
import nonconformitiesRoutes from "./routes/nonconformities.js";
import reportsRoutes from "./routes/reports.js";

import employeeRouter from "./routes/employee.js";
import heartbeatRoutes from "./routes/heartbeat.js";
import onlineRoutes from "./routes/online.js";
import presenceRouter from "./routes/presence.js";

import storesRouter from "./routes/stores.js";
import { stationsRouter,stationsNestedRouter } from "./routes/stations.js";

import biocidesRouter from "./routes/Biocides.js";
import visitsRouter from "./routes/visits.js";
import ek1Router from "./routes/ek1.js";

import activationsRouter from "./routes/activations.js";
import analyticsRouter from "./routes/analytics.js";
import scheduleRouter from "./routes/schedule.js";
import accessRouter from "./routes/access.js";

import feedbackRouter from "./routes/feedback.js";
import notificationsRouter from "./routes/notifications.js";

import contactsRouter from "./routes/contacts.js";

dotenv.config();

const app = express();

/* ------------ Global middleware ------------ */
app.set("trust proxy", 1);
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());

// FE için izinli origin’ler (dev & prod)
const allowedOrigins = new Set([
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  // gerekiyorsa intranet ya da IP:
  // "http://192.168.1.100:5173",
]);

app.use(
  cors({
    origin: (origin, cb) => {
      // Postman / server-to-server gibi Origin gelmeyebilir → izin ver
      if (!origin) return cb(null, true);
      if (allowedOrigins.has(origin)) return cb(null, true);
      return cb(null, false);
    },
    credentials: true, // refresh cookie için şart
  })
);

// Statik dosyalar
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

/* ------------ Aliases / Legacy Endpoints ------------ */
// FE legacy: /api/customer/stores → /api/stores/mine
app.get("/api/customer/stores", auth, (req, res, next) => {
  req.url = "/mine";
  return storesRouter(req, res, next);
});

/* ------------ Primary Route Mounts ------------ */
app.use("/api/auth", authRoutes);

app.use("/api/seed", seedRoutes);
app.use("/api/wipe", wipeRoutes);

app.use("/api/admin", adminRoutes);
app.use("/api/profile", profileRouter);
app.use("/api/employees", employeeRouter);

// EK-1 ve legacy path’leri
app.use("/api/ek1", ek1Router);
app.use("/api/api/ek1", ek1Router);
app.use("/api/admin/ek1", ek1Router);

app.use("/api/customers", customerRoutes);

// ÖNCE stores, sonra nested stations
app.use("/api/stores", storesRouter);
app.use("/api/stores", stationsNestedRouter);

// Global stations
app.use("/api/stations", stationsRouter);

// Aktivasyon & Analitik
app.use("/api/activations", activationsRouter);
app.use("/api/analytics", analyticsRouter);

// Ziyaret
app.use("/api/visit", visitsRouter);
app.use("/api/visits", visitsRouter);

// Biyosidaller
app.use("/api/biocides", biocidesRouter);

// Upload & Raporlar
app.use("/api/upload", uploadRoutes);
app.use("/api/nonconformities", nonconformitiesRoutes);
app.use("/api/reports", reportsRoutes);

// Online/presence
app.use("/api/heartbeat", heartbeatRoutes);
app.use("/api/online", onlineRoutes);
app.use("/api/presence", presenceRouter);

// Erişim yönetimi
app.use("/api/access", accessRouter);

// Takvim
app.use("/api/schedule", scheduleRouter);

app.use("/api/feedback", feedbackRouter);
app.use("/api/notifications", notificationsRouter);

app.use("/api/contacts", contactsRouter);

/* ------------ 404 & Error Handlers ------------ */
app.use((req, res, _next) => {
  res.status(404).json({ message: "Not Found" });
});

app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  const message =
    err.message || (status === 413 ? "Payload çok büyük" : "Sunucu hatası");
  if (process.env.NODE_ENV !== "production") {
    console.error("[ERROR]", err);
  }
  res.status(status).json({ error: message });
});

/* ------------ Boot ------------ */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server ${PORT} portunda açıldı`));
