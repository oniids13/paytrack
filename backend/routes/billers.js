import express from "express";
import {
  getBillers,
  getBiller,
  createBiller,
  updateBiller,
  deleteBiller,
  markAsPaid,
  markAsUnpaid,
} from "../controllers/billerController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

// CRUD routes
router.route("/").get(getBillers).post(createBiller);

router.route("/:id").get(getBiller).put(updateBiller).delete(deleteBiller);

// Payment status routes
router.patch("/:id/pay", markAsPaid);
router.patch("/:id/unpay", markAsUnpaid);

export default router;
