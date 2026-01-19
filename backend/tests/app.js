/**
 * Express app instance for testing (without starting the server)
 */
import express from "express";
import passport from "../config/passport.js";
import authRoutes from "../routes/auth.js";
import billerRoutes from "../routes/billers.js";
import dashboardRoutes from "../routes/dashboard.js";

const app = express();

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize Passport
app.use(passport.initialize());

// Routes
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "PayTrack API is running",
  });
});

// Auth routes
app.use("/api/auth", authRoutes);

// Biller routes
app.use("/api/billers", billerRoutes);

// Dashboard routes
app.use("/api/dashboard", dashboardRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: "Server error",
    error: err.message,
  });
});

export default app;
