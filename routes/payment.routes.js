import express from "express";
import {
  createPayment,
  getMyPayments,
  getMyPaymentById,
  verifyPayment,
  rejectPayment,
  refundPayment,
  getAllPayments,
  getPaymentById,
} from "../controllers/payment.controller.js";

// import { protect, authorize } from "../middlewares/auth.middleware.js";

const router = express.Router();

/**
 * Example:
 * router.use(protect);
 */

/**
 * USER ROUTES
 */
router.post("/create", createPayment);
router.get("/my-payments", getMyPayments);
router.get("/my-payments/:paymentId", getMyPaymentById);

/**
 * ADMIN ROUTES
 */
router.patch("/admin/verify/:paymentId", verifyPayment);
router.patch("/admin/reject/:paymentId", rejectPayment);
router.patch("/admin/refund/:paymentId", refundPayment);
router.get("/admin/all", getAllPayments);
router.get("/admin/:paymentId", getPaymentById);

export default router;