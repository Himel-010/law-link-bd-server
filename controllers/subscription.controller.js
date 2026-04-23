import Subscription from "../models/subscription.model.js";
import User from "../models/user.model.js";
import Plan from "../models/plan.model.js";

const ALLOWED_PAYMENT_METHODS = ["bkash", "nogod"];

const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const getDefaultUsage = () => ({
  casePostsUsed: 0,
  proposalsUsed: 0,
  shortlistsUsed: 0,
  creditsUsed: 0,
});

const getActiveSubscription = async (userId) => {
  return Subscription.findOne({
    user: userId,
    status: "active",
    endDate: { $gt: new Date() },
  }).sort({ endDate: -1 });
};

const syncUserSubscriptionStatus = async (userId) => {
  const activeSub = await getActiveSubscription(userId);

  if (activeSub) {
    await User.findByIdAndUpdate(userId, {
      currentSubscription: activeSub._id,
      subscriptionStatus: "active",
    });
    return;
  }

  const latestSub = await Subscription.findOne({ user: userId }).sort({
    createdAt: -1,
  });

  await User.findByIdAndUpdate(userId, {
    currentSubscription: null,
    subscriptionStatus: latestSub?.status || "none",
  });
};

const isAdmin = (req) => req.user?.role === "admin";

const ensureOwnerOrAdmin = (req, ownerId) => {
  return isAdmin(req) || String(req.user?.id) === String(ownerId);
};

const normalizePaymentMethod = (method) => {
  if (method === null || method === undefined || method === "") return null;
  return String(method).toLowerCase().trim();
};

const validatePaymentMethod = (method, price) => {
  const normalizedMethod = normalizePaymentMethod(method);

  if (price === 0) return { valid: true, method: null };

  if (!normalizedMethod) {
    return {
      valid: false,
      message: "paymentMethod is required for paid subscription",
    };
  }

  if (!ALLOWED_PAYMENT_METHODS.includes(normalizedMethod)) {
    return {
      valid: false,
      message: "paymentMethod must be either bkash or nogod",
    };
  }

  return { valid: true, method: normalizedMethod };
};

const makePlanSnapshot = (plan) => ({
  name: plan.name,
  slug: plan.slug,
  description: plan.description || "",
  price: plan.price,
  durationInDays: plan.durationInDays,
  currency: plan.currency || "BDT",
  features: plan.features || {},
});

/**
 * USER CONTROLLERS
 */

export const createSubscription = async (req, res) => {
  try {
    const userId = req.user?.id;
    const roleType = req.user?.role;
    const {
      planId,
      transactionId = null,
      paymentMethod = null,
      notes = null,
    } = req.body;

    if (!userId || !roleType) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized user",
      });
    }

    if (!["client", "lawyer"].includes(roleType)) {
      return res.status(400).json({
        success: false,
        message: "Only client or lawyer can create subscription",
      });
    }

    if (!planId) {
      return res.status(400).json({
        success: false,
        message: "planId is required",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const plan = await Plan.findById(planId);
    if (!plan || !plan.isActive) {
      return res.status(404).json({
        success: false,
        message: "Active plan not found",
      });
    }

    if (plan.roleType !== roleType) {
      return res.status(400).json({
        success: false,
        message: "This plan is not valid for your role",
      });
    }

    const paymentValidation = validatePaymentMethod(paymentMethod, plan.price);
    if (!paymentValidation.valid) {
      return res.status(400).json({
        success: false,
        message: paymentValidation.message,
      });
    }

    const existingActive = await getActiveSubscription(userId);
    if (existingActive) {
      return res.status(400).json({
        success: false,
        message: "You already have an active subscription",
      });
    }

    const now = new Date();
    const endDate = addDays(now, plan.durationInDays);
    const isFreePlan = plan.price === 0;

    const subscription = await Subscription.create({
      user: userId,
      plan: plan._id,
      roleType,
      planSnapshot: makePlanSnapshot(plan),
      price: plan.price,
      durationInDays: plan.durationInDays,
      startDate: now,
      endDate,
      status: isFreePlan ? "active" : "pending",
      features: plan.features,
      usage: getDefaultUsage(),
      payment: {
        status: isFreePlan ? "paid" : "unpaid",
        transactionId,
        method: paymentValidation.method,
        paidAt: isFreePlan ? now : null,
      },
      activatedAt: isFreePlan ? now : null,
      notes,
    });

    await syncUserSubscriptionStatus(userId);

    return res.status(201).json({
      success: true,
      message: isFreePlan
        ? "Free subscription activated successfully"
        : "Subscription created successfully. Waiting for payment confirmation",
      data: subscription,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to create subscription",
      error: error.message,
    });
  }
};

export const getMySubscription = async (req, res) => {
  try {
    const userId = req.user?.id;

    const subscription = await Subscription.findOne({ user: userId })
      .populate("plan")
      .sort({ createdAt: -1 });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "No subscription found",
      });
    }

    return res.status(200).json({
      success: true,
      data: subscription,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch subscription",
      error: error.message,
    });
  }
};

export const getMyActiveSubscription = async (req, res) => {
  try {
    const userId = req.user?.id;

    const subscription = await Subscription.findOne({
      user: userId,
      status: "active",
      endDate: { $gt: new Date() },
    }).populate("plan");

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "No active subscription found",
      });
    }

    return res.status(200).json({
      success: true,
      data: subscription,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch active subscription",
      error: error.message,
    });
  }
};

export const getMySubscriptionHistory = async (req, res) => {
  try {
    const userId = req.user?.id;

    const subscriptions = await Subscription.find({ user: userId })
      .populate("plan")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: subscriptions.length,
      data: subscriptions,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch subscription history",
      error: error.message,
    });
  }
};

export const renewSubscription = async (req, res) => {
  try {
    const {
      subscriptionId,
      transactionId = null,
      paymentMethod = null,
      notes = null,
    } = req.body;

    if (!subscriptionId) {
      return res.status(400).json({
        success: false,
        message: "subscriptionId is required",
      });
    }

    const oldSubscription = await Subscription.findById(subscriptionId).populate("plan");

    if (!oldSubscription) {
      return res.status(404).json({
        success: false,
        message: "Subscription not found",
      });
    }

    if (!ensureOwnerOrAdmin(req, oldSubscription.user)) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized access",
      });
    }

    const plan = await Plan.findById(oldSubscription.plan);
    if (!plan || !plan.isActive) {
      return res.status(400).json({
        success: false,
        message: "Associated plan is not available anymore",
      });
    }

    const paymentValidation = validatePaymentMethod(paymentMethod, plan.price);
    if (!paymentValidation.valid) {
      return res.status(400).json({
        success: false,
        message: paymentValidation.message,
      });
    }

    const existingActive = await getActiveSubscription(oldSubscription.user);
    if (existingActive) {
      return res.status(400).json({
        success: false,
        message: "User already has an active subscription",
      });
    }

    const now = new Date();
    const endDate = addDays(now, plan.durationInDays);
    const isFreePlan = plan.price === 0;

    const renewedSubscription = await Subscription.create({
      user: oldSubscription.user,
      plan: plan._id,
      roleType: plan.roleType,
      planSnapshot: makePlanSnapshot(plan),
      price: plan.price,
      durationInDays: plan.durationInDays,
      startDate: now,
      endDate,
      status: isFreePlan ? "active" : "pending",
      features: plan.features,
      usage: getDefaultUsage(),
      payment: {
        status: isFreePlan ? "paid" : "unpaid",
        transactionId,
        method: paymentValidation.method,
        paidAt: isFreePlan ? now : null,
      },
      activatedAt: isFreePlan ? now : null,
      renewedFrom: oldSubscription._id,
      notes,
    });

    await syncUserSubscriptionStatus(oldSubscription.user);

    return res.status(201).json({
      success: true,
      message: isFreePlan
        ? "Free subscription renewed successfully"
        : "Subscription renewed successfully. Waiting for payment confirmation",
      data: renewedSubscription,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to renew subscription",
      error: error.message,
    });
  }
};

export const cancelSubscription = async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const subscription = await Subscription.findById(subscriptionId);

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "Subscription not found",
      });
    }

    if (!ensureOwnerOrAdmin(req, subscription.user)) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized access",
      });
    }

    if (subscription.status === "cancelled") {
      return res.status(400).json({
        success: false,
        message: "Subscription already cancelled",
      });
    }

    subscription.status = "cancelled";
    subscription.cancelledAt = new Date();
    await subscription.save();

    await syncUserSubscriptionStatus(subscription.user);

    return res.status(200).json({
      success: true,
      message: "Subscription cancelled successfully",
      data: subscription,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to cancel subscription",
      error: error.message,
    });
  }
};

export const consumeSubscriptionFeature = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { featureKey, amount = 1 } = req.body;

    const allowedFeatureKeys = [
      "casePostsUsed",
      "proposalsUsed",
      "shortlistsUsed",
      "creditsUsed",
    ];

    if (!allowedFeatureKeys.includes(featureKey)) {
      return res.status(400).json({
        success: false,
        message: "Invalid featureKey",
      });
    }

    const subscription = await getActiveSubscription(userId);

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "No active subscription found",
      });
    }

    const numericAmount = Number(amount);
    if (Number.isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "amount must be a positive number",
      });
    }

    const usageMap = {
      casePostsUsed: "casePostLimit",
      proposalsUsed: "proposalLimit",
      shortlistsUsed: "shortlistLimit",
      creditsUsed: "proposalCredits",
    };

    const limitField = usageMap[featureKey];
    const limit = subscription.features?.[limitField] ?? 0;
    const currentUsed = subscription.usage?.[featureKey] ?? 0;

    if (limit !== 999999 && currentUsed + numericAmount > limit) {
      return res.status(400).json({
        success: false,
        message: `${limitField} exceeded`,
      });
    }

    subscription.usage[featureKey] = currentUsed + numericAmount;
    await subscription.save();

    return res.status(200).json({
      success: true,
      message: "Subscription usage updated successfully",
      data: subscription,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update usage",
      error: error.message,
    });
  }
};

export const checkSubscriptionFeatureAccess = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { feature } = req.params;

    const subscription = await getActiveSubscription(userId);

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "No active subscription found",
      });
    }

    let result = {
      allowed: false,
      feature,
      details: null,
    };

    switch (feature) {
      case "case-post":
        result.allowed =
          subscription.features.casePostLimit === 999999 ||
          subscription.usage.casePostsUsed < subscription.features.casePostLimit;
        result.details = {
          limit: subscription.features.casePostLimit,
          used: subscription.usage.casePostsUsed,
        };
        break;

      case "proposal":
        result.allowed =
          subscription.features.proposalLimit === 999999 ||
          subscription.usage.proposalsUsed < subscription.features.proposalLimit;
        result.details = {
          limit: subscription.features.proposalLimit,
          used: subscription.usage.proposalsUsed,
        };
        break;

      case "shortlist":
        result.allowed =
          subscription.features.shortlistLimit === 999999 ||
          subscription.usage.shortlistsUsed < subscription.features.shortlistLimit;
        result.details = {
          limit: subscription.features.shortlistLimit,
          used: subscription.usage.shortlistsUsed,
        };
        break;

      case "priority-access":
        result.allowed = subscription.features.priorityAccess;
        break;

      case "profile-boost":
        result.allowed = subscription.features.profileBoost;
        break;

      case "unlimited-chat":
        result.allowed = subscription.features.unlimitedChat;
        break;

      case "paid-consultation":
        result.allowed = subscription.features.paidConsultationEnabled;
        break;

      case "shortlist-unlock":
        result.allowed = subscription.features.shortlistUnlockEnabled;
        break;

      default:
        return res.status(400).json({
          success: false,
          message: "Invalid feature requested",
        });
    }

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to check feature access",
      error: error.message,
    });
  }
};

/**
 * ADMIN CONTROLLERS
 */

export const adminCreateSubscription = async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({
        success: false,
        message: "Only admin can create subscription",
      });
    }

    const {
      userId,
      planId,
      startDate,
      status,
      paymentStatus,
      transactionId = null,
      paymentMethod = null,
      notes = null,
    } = req.body;

    if (!userId || !planId) {
      return res.status(400).json({
        success: false,
        message: "userId and planId are required",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const plan = await Plan.findById(planId);
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Plan not found",
      });
    }

    if (plan.roleType !== user.role) {
      return res.status(400).json({
        success: false,
        message: "Selected plan does not match user role",
      });
    }

    const paymentValidation = validatePaymentMethod(paymentMethod, plan.price);
    if (!paymentValidation.valid) {
      return res.status(400).json({
        success: false,
        message: paymentValidation.message,
      });
    }

    const existingActive = await getActiveSubscription(userId);
    if (existingActive) {
      return res.status(400).json({
        success: false,
        message: "User already has an active subscription",
      });
    }

    const finalStartDate = startDate ? new Date(startDate) : new Date();
    const finalEndDate = addDays(finalStartDate, plan.durationInDays);
    const finalStatus = status || (plan.price === 0 ? "active" : "pending");
    const finalPaymentStatus =
      paymentStatus || (plan.price === 0 ? "paid" : "unpaid");

    const subscription = await Subscription.create({
      user: userId,
      plan: plan._id,
      roleType: user.role,
      planSnapshot: makePlanSnapshot(plan),
      price: plan.price,
      durationInDays: plan.durationInDays,
      startDate: finalStartDate,
      endDate: finalEndDate,
      status: finalStatus,
      features: plan.features,
      usage: getDefaultUsage(),
      payment: {
        status: finalPaymentStatus,
        transactionId,
        method: paymentValidation.method,
        paidAt: finalPaymentStatus === "paid" ? new Date() : null,
      },
      activatedAt: finalStatus === "active" ? new Date() : null,
      notes,
    });

    await syncUserSubscriptionStatus(userId);

    return res.status(201).json({
      success: true,
      message: "Subscription created successfully by admin",
      data: subscription,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to create subscription",
      error: error.message,
    });
  }
};

export const activateSubscription = async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({
        success: false,
        message: "Only admin can activate subscription",
      });
    }

    const {
      subscriptionId,
      transactionId = null,
      paymentMethod = null,
    } = req.body;

    if (!subscriptionId) {
      return res.status(400).json({
        success: false,
        message: "subscriptionId is required",
      });
    }

    const subscription = await Subscription.findById(subscriptionId);

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "Subscription not found",
      });
    }

    const normalizedMethod = normalizePaymentMethod(paymentMethod);

    if (normalizedMethod && !ALLOWED_PAYMENT_METHODS.includes(normalizedMethod)) {
      return res.status(400).json({
        success: false,
        message: "paymentMethod must be either bkash or nogod",
      });
    }

    subscription.status = "active";
    subscription.activatedAt = new Date();
    subscription.payment.status = "paid";
    subscription.payment.paidAt = new Date();

    if (transactionId) subscription.payment.transactionId = transactionId;
    if (normalizedMethod) subscription.payment.method = normalizedMethod;

    if (!subscription.startDate) subscription.startDate = new Date();
    if (!subscription.endDate) {
      subscription.endDate = addDays(
        subscription.startDate,
        subscription.durationInDays || 30
      );
    }

    await subscription.save();
    await syncUserSubscriptionStatus(subscription.user);

    return res.status(200).json({
      success: true,
      message: "Subscription activated successfully",
      data: subscription,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to activate subscription",
      error: error.message,
    });
  }
};

export const getAllSubscriptions = async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({
        success: false,
        message: "Only admin can view all subscriptions",
      });
    }

    const {
      status,
      roleType,
      planId,
      userId,
      page = 1,
      limit = 10,
    } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (roleType) filter.roleType = roleType;
    if (planId) filter.plan = planId;
    if (userId) filter.user = userId;

    const skip = (Number(page) - 1) * Number(limit);

    const [subscriptions, total] = await Promise.all([
      Subscription.find(filter)
        .populate("user", "name email role phone subscriptionStatus")
        .populate("plan", "name slug roleType price durationInDays isActive")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Subscription.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      total,
      page: Number(page),
      limit: Number(limit),
      data: subscriptions,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch subscriptions",
      error: error.message,
    });
  }
};

export const getSubscriptionById = async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({
        success: false,
        message: "Only admin can view subscription details",
      });
    }

    const { subscriptionId } = req.params;

    const subscription = await Subscription.findById(subscriptionId)
      .populate("user", "name email role phone subscriptionStatus currentSubscription")
      .populate("plan", "name slug roleType price durationInDays isActive features");

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "Subscription not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: subscription,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch subscription details",
      error: error.message,
    });
  }
};

export const adminUpdateSubscription = async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({
        success: false,
        message: "Only admin can update subscription",
      });
    }

    const { subscriptionId } = req.params;
    const { status, startDate, endDate, notes, features, usage, payment } = req.body;

    const subscription = await Subscription.findById(subscriptionId);

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "Subscription not found",
      });
    }

    if (startDate) subscription.startDate = new Date(startDate);
    if (endDate) subscription.endDate = new Date(endDate);

    if (features) {
      subscription.features = {
        ...subscription.features.toObject(),
        ...features,
      };
    }

    if (usage) {
      subscription.usage = {
        ...subscription.usage.toObject(),
        ...usage,
      };
    }

    if (status) {
      subscription.status = status;

      if (status === "active" && !subscription.activatedAt) {
        subscription.activatedAt = new Date();
      }

      if (status === "cancelled") {
        subscription.cancelledAt = new Date();
      }

      if (status === "expired") {
        subscription.expiredAt = new Date();
      }
    }

    if (notes !== undefined) subscription.notes = notes;

    if (payment) {
      const updatedPayment = { ...payment };

      if (updatedPayment.method !== undefined) {
        const normalizedMethod = normalizePaymentMethod(updatedPayment.method);

        if (
          normalizedMethod !== null &&
          !ALLOWED_PAYMENT_METHODS.includes(normalizedMethod)
        ) {
          return res.status(400).json({
            success: false,
            message: "payment.method must be either bkash or nogod",
          });
        }

        updatedPayment.method = normalizedMethod;
      }

      subscription.payment = {
        ...subscription.payment.toObject(),
        ...updatedPayment,
      };

      if (updatedPayment.status === "paid" && !subscription.payment.paidAt) {
        subscription.payment.paidAt = new Date();
      }
    }

    await subscription.save();
    await syncUserSubscriptionStatus(subscription.user);

    return res.status(200).json({
      success: true,
      message: "Subscription updated successfully",
      data: subscription,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update subscription",
      error: error.message,
    });
  }
};

export const adminDeleteSubscription = async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({
        success: false,
        message: "Only admin can delete subscription",
      });
    }

    const { subscriptionId } = req.params;

    const subscription = await Subscription.findById(subscriptionId);

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "Subscription not found",
      });
    }

    const userId = subscription.user;

    await Subscription.findByIdAndDelete(subscriptionId);
    await syncUserSubscriptionStatus(userId);

    return res.status(200).json({
      success: true,
      message: "Subscription deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete subscription",
      error: error.message,
    });
  }
};

export const checkAndExpireSubscriptions = async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({
        success: false,
        message: "Only admin can run expire check",
      });
    }

    const expiredSubscriptions = await Subscription.find({
      status: "active",
      endDate: { $lt: new Date() },
    });

    for (const sub of expiredSubscriptions) {
      sub.status = "expired";
      sub.expiredAt = new Date();
      await sub.save();
      await syncUserSubscriptionStatus(sub.user);
    }

    return res.status(200).json({
      success: true,
      message: "Expired subscriptions updated successfully",
      updatedCount: expiredSubscriptions.length,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to check expired subscriptions",
      error: error.message,
    });
  }
};

export const getSubscriptionPlans = async (req, res) => {
  try {
    const { roleType } = req.query;

    const filter = { isActive: true };
    if (roleType) filter.roleType = roleType;

    const plans = await Plan.find(filter).sort({
      roleType: 1,
      sortOrder: 1,
      price: 1,
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,
      paymentMethods: ALLOWED_PAYMENT_METHODS,
      data: plans,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch plans",
      error: error.message,
    });
  }
};