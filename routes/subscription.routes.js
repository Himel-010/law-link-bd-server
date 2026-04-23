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

import { protect, authorizeRoles } from "../middleware/auth.js";

const router = express.Router();

/**
 * PUBLIC / SHARED
 */
router.get("/plans", getSubscriptionPlans);

/**
 * USER ROUTES
 */
router.post("/create", protect, createSubscription);
router.get("/my-subscription", protect, getMySubscription);
router.get("/my-active-subscription", protect, getMyActiveSubscription);
router.get("/history", protect, getMySubscriptionHistory);
router.post("/renew", protect, renewSubscription);
router.patch("/cancel/:subscriptionId", protect, cancelSubscription);
router.post("/consume-feature", protect, consumeSubscriptionFeature);
router.get("/feature-access/:feature", protect, checkSubscriptionFeatureAccess);

/**
 * ADMIN ROUTES
 */
router.post("/admin/create", protect, authorizeRoles("admin"), adminCreateSubscription);
router.patch("/admin/activate", protect, authorizeRoles("admin"), activateSubscription);
router.patch("/admin/expire/check", protect, authorizeRoles("admin"), checkAndExpireSubscriptions);
router.get("/admin/all", protect, authorizeRoles("admin"), getAllSubscriptions);
router.get("/admin/:subscriptionId", protect, authorizeRoles("admin"), getSubscriptionById);
router.patch("/admin/:subscriptionId", protect, authorizeRoles("admin"), adminUpdateSubscription);
router.delete("/admin/:subscriptionId", protect, authorizeRoles("admin"), adminDeleteSubscription);

export default router;