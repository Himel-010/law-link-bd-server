import express from "express";
import {
  // user
  createSubscription,
  activateSubscription,
  getMySubscription,
  getMySubscriptionHistory,
  renewSubscription,
  cancelSubscription,
  checkAndExpireSubscriptions,

  // admin
  adminCreateSubscription,
  getAllSubscriptions,
  getSubscriptionById,
  adminUpdateSubscription,
  adminDeleteSubscription,
} from "../controllers/subscription.controller.js";

const router = express.Router();

/**
 * Assumption:
 * You already have auth middleware that sets:
 * req.user = { id: userId, role: userRole }
 *
 * Example:
 * router.use(protect);
 */

/**
 * =========================
 * USER ROUTES
 * =========================
 */
router.post("/create", createSubscription);
router.get("/my-subscription", getMySubscription);
router.get("/history", getMySubscriptionHistory);
router.post("/renew", renewSubscription);
router.patch("/cancel/:subscriptionId", cancelSubscription);

/**
 * =========================
 * ADMIN ROUTES
 * =========================
 */
router.post("/admin/create", adminCreateSubscription);
router.get("/admin/all", getAllSubscriptions);
router.get("/admin/:subscriptionId", getSubscriptionById);
router.patch("/admin/:subscriptionId", adminUpdateSubscription);
router.delete("/admin/:subscriptionId", adminDeleteSubscription);

/**
 * admin / payment webhook / cron routes
 */
router.patch("/admin/activate", activateSubscription);
router.patch("/admin/expire/check", checkAndExpireSubscriptions);

export default router;