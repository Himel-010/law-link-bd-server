import express from "express";
import {
  createSubscription,
  getMySubscription,
  getMyActiveSubscription,
  getMySubscriptionHistory,
  renewSubscription,
  cancelSubscription,
  consumeSubscriptionFeature,
  checkSubscriptionFeatureAccess,
  getSubscriptionPlans,
  adminCreateSubscription,
  activateSubscription,
  getAllSubscriptions,
  getSubscriptionById,
  adminUpdateSubscription,
  adminDeleteSubscription,
  checkAndExpireSubscriptions,
} from "../controllers/subscription.controller.js";

// import { protect, authorize } from "../middlewares/auth.middleware.js";

const router = express.Router();

/**
 * Example:
 * router.use(protect);
 */

/**
 * PUBLIC / SHARED
 */
router.get("/plans", getSubscriptionPlans);

/**
 * USER ROUTES
 */
router.post("/create", createSubscription);
router.get("/my-subscription", getMySubscription);
router.get("/my-active-subscription", getMyActiveSubscription);
router.get("/history", getMySubscriptionHistory);
router.post("/renew", renewSubscription);
router.patch("/cancel/:subscriptionId", cancelSubscription);
router.post("/consume-feature", consumeSubscriptionFeature);
router.get("/feature-access/:feature", checkSubscriptionFeatureAccess);

/**
 * ADMIN ROUTES
 */
router.post("/admin/create", adminCreateSubscription);
router.patch("/admin/activate", activateSubscription);
router.patch("/admin/expire/check", checkAndExpireSubscriptions);
router.get("/admin/all", getAllSubscriptions);
router.get("/admin/:subscriptionId", getSubscriptionById);
router.patch("/admin/:subscriptionId", adminUpdateSubscription);
router.delete("/admin/:subscriptionId", adminDeleteSubscription);

export default router;