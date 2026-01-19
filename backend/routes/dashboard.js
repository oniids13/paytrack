import express from "express";
import {
  getSummary,
  getUpcoming,
  getMonthlyOverview,
  getStatusBreakdown,
  getCreditCycle,
  getPaymentHistory,
  getBillersOverview,
} from "../controllers/dashboardController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

// Dashboard analytics routes
router.get("/summary", getSummary);
router.get("/upcoming", getUpcoming);
router.get("/monthly-overview", getMonthlyOverview);
router.get("/status", getStatusBreakdown);
router.get("/credit-cycle", getCreditCycle);
router.get("/payment-history", getPaymentHistory);
router.get("/overview", getBillersOverview);

export default router;
