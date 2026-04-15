import Subscription from "../models/subscription.model.js";
import User from "../models/user.model.js";

/**
 * =========================
 * HELPERS
 * =========================
 */

const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const PLAN_CONFIG = {
  client: {
    free: {
      price: 0,
      durationInDays: 30,
      features: {
        casePostLimit: 2,
        proposalLimit: 0,
        shortlistLimit: 2,
        proposalCredits: 0,
        priorityAccess: false,
        profileBoost: false,
        unlimitedChat: false,
        paidConsultationEnabled: false,
        shortlistUnlockEnabled: false,
      },
    },
    basic: {
      price: 499,
      durationInDays: 30,
      features: {
        casePostLimit: 10,
        proposalLimit: 0,
        shortlistLimit: 10,
        proposalCredits: 0,
        priorityAccess: false,
        profileBoost: false,
        unlimitedChat: true,
        paidConsultationEnabled: true,
        shortlistUnlockEnabled: true,
      },
    },
    premium: {
      price: 999,
      durationInDays: 30,
      features: {
        casePostLimit: 9999,
        proposalLimit: 0,
        shortlistLimit: 9999,
        proposalCredits: 0,
        priorityAccess: true,
        profileBoost: false,
        unlimitedChat: true,
        paidConsultationEnabled: true,
        shortlistUnlockEnabled: true,
      },
    },
  },

  lawyer: {
    free: {
      price: 0,
      durationInDays: 30,
      features: {
        casePostLimit: 0,
        proposalLimit: 5,
        shortlistLimit: 0,
        proposalCredits: 0,
        priorityAccess: false,
        profileBoost: false,
        unlimitedChat: false,
        paidConsultationEnabled: false,
        shortlistUnlockEnabled: false,
      },
    },
    basic: {
      price: 999,
      durationInDays: 30,
      features: {
        casePostLimit: 0,
        proposalLimit: 30,
        shortlistLimit: 0,
        proposalCredits: 10,
        priorityAccess: false,
        profileBoost: true,
        unlimitedChat: true,
        paidConsultationEnabled: true,
        shortlistUnlockEnabled: false,
      },
    },
    premium: {
      price: 1999,
      durationInDays: 30,
      features: {
        casePostLimit: 0,
        proposalLimit: 9999,
        shortlistLimit: 0,
        proposalCredits: 50,
        priorityAccess: true,
        profileBoost: true,
        unlimitedChat: true,
        paidConsultationEnabled: true,
        shortlistUnlockEnabled: false,
      },
    },
  },
};

const ALLOWED_PAYMENT_METHODS = ["bkash", "nogod"];

const getPlanDetails = (roleType, planName) => {
  const normalizedRole = String(roleType || "").toLowerCase();
  const normalizedPlan = String(planName || "").toLowerCase();

  if (!PLAN_CONFIG[normalizedRole]) return null;
  if (!PLAN_CONFIG[normalizedRole][normalizedPlan]) return null;

  return PLAN_CONFIG[normalizedRole][normalizedPlan];
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

/**
 * =========================
 * USER CONTROLLERS
 * =========================
 */

export const createSubscription = async (req, res) => {
  try {
    const userId = req.user?.id;
    const roleType = req.user?.role;
    const {
      planName,
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

    if (!planName) {
      return res.status(400).json({
        success: false,
        message: "planName is required",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const plan = getPlanDetails(roleType, planName);
    if (!plan) {
      return res.status(400).json({
        success: false,
        message: "Invalid plan for this role",
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
      roleType,
      planName: planName.toLowerCase(),
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
    console.error("createSubscription error:", error);
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

    const subscription = await Subscription.findOne({ user: userId }).sort({
      createdAt: -1,
    });

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
    console.error("getMySubscription error:", error);
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

    const subscription = await getActiveSubscription(userId);

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
    console.error("getMyActiveSubscription error:", error);
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

    const subscriptions = await Subscription.find({ user: userId }).sort({
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,
      count: subscriptions.length,
      data: subscriptions,
    });
  } catch (error) {
    console.error("getMySubscriptionHistory error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch subscription history",
      error: error.message,
    });
  }
};

export const renewSubscription = async (req, res) => {
  try {
    const userId = req.user?.id;
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

    const oldSubscription = await Subscription.findById(subscriptionId);

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

    const paymentValidation = validatePaymentMethod(
      paymentMethod,
      oldSubscription.price
    );
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
    const endDate = addDays(now, oldSubscription.durationInDays);
    const isFreePlan = oldSubscription.price === 0;

    const renewedSubscription = await Subscription.create({
      user: oldSubscription.user,
      roleType: oldSubscription.roleType,
      planName: oldSubscription.planName,
      price: oldSubscription.price,
      durationInDays: oldSubscription.durationInDays,
      startDate: now,
      endDate,
      status: isFreePlan ? "active" : "pending",
      features: oldSubscription.features,
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
    console.error("renewSubscription error:", error);
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
    console.error("cancelSubscription error:", error);
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

    if (limit !== 9999 && currentUsed + numericAmount > limit) {
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
    console.error("consumeSubscriptionFeature error:", error);
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
          subscription.features.casePostLimit === 9999 ||
          subscription.usage.casePostsUsed < subscription.features.casePostLimit;
        result.details = {
          limit: subscription.features.casePostLimit,
          used: subscription.usage.casePostsUsed,
        };
        break;

      case "proposal":
        result.allowed =
          subscription.features.proposalLimit === 9999 ||
          subscription.usage.proposalsUsed < subscription.features.proposalLimit;
        result.details = {
          limit: subscription.features.proposalLimit,
          used: subscription.usage.proposalsUsed,
        };
        break;

      case "shortlist":
        result.allowed =
          subscription.features.shortlistLimit === 9999 ||
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
    console.error("checkSubscriptionFeatureAccess error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to check feature access",
      error: error.message,
    });
  }
};

/**
 * =========================
 * ADMIN CONTROLLERS
 * =========================
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
      roleType,
      planName,
      startDate,
      status,
      paymentStatus,
      transactionId = null,
      paymentMethod = null,
      notes = null,
    } = req.body;

    if (!userId || !roleType || !planName) {
      return res.status(400).json({
        success: false,
        message: "userId, roleType and planName are required",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const plan = getPlanDetails(roleType, planName);
    if (!plan) {
      return res.status(400).json({
        success: false,
        message: "Invalid plan for this role",
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
      roleType,
      planName: planName.toLowerCase(),
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
    console.error("adminCreateSubscription error:", error);
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
    console.error("activateSubscription error:", error);
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
      planName,
      userId,
      page = 1,
      limit = 10,
    } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (roleType) filter.roleType = roleType;
    if (planName) filter.planName = String(planName).toLowerCase();
    if (userId) filter.user = userId;

    const skip = (Number(page) - 1) * Number(limit);

    const [subscriptions, total] = await Promise.all([
      Subscription.find(filter)
        .populate("user", "name email role phone subscriptionStatus")
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
    console.error("getAllSubscriptions error:", error);
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

    const subscription = await Subscription.findById(subscriptionId).populate(
      "user",
      "name email role phone subscriptionStatus currentSubscription"
    );

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
    console.error("getSubscriptionById error:", error);
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
    const {
      planName,
      roleType,
      status,
      startDate,
      endDate,
      notes,
      features,
      usage,
      payment,
    } = req.body;

    const subscription = await Subscription.findById(subscriptionId);

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "Subscription not found",
      });
    }

    if (planName || roleType) {
      const finalRole = roleType || subscription.roleType;
      const finalPlan = planName || subscription.planName;

      const plan = getPlanDetails(finalRole, finalPlan);
      if (!plan) {
        return res.status(400).json({
          success: false,
          message: "Invalid roleType/planName combination",
        });
      }

      subscription.roleType = finalRole;
      subscription.planName = finalPlan.toLowerCase();
      subscription.price = plan.price;
      subscription.durationInDays = plan.durationInDays;
      subscription.features = plan.features;

      const finalStartDate = startDate
        ? new Date(startDate)
        : subscription.startDate || new Date();

      subscription.startDate = finalStartDate;
      subscription.endDate = endDate
        ? new Date(endDate)
        : addDays(finalStartDate, plan.durationInDays);
    } else {
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
    console.error("adminUpdateSubscription error:", error);
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
    console.error("adminDeleteSubscription error:", error);
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
    console.error("checkAndExpireSubscriptions error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to check expired subscriptions",
      error: error.message,
    });
  }
};

export const getSubscriptionPlans = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      paymentMethods: ALLOWED_PAYMENT_METHODS,
      data: PLAN_CONFIG,
    });
  } catch (error) {
    console.error("getSubscriptionPlans error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch plans",
      error: error.message,
    });
  }
};