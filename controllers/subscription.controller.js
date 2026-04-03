import Subscription from "../models/subscription.model.js";
import User from "../models/user.model.js";

/**
 * Helper: add days to a date
 */
const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

/**
 * Helper: role-wise plan config
 * You can later move this into DB (Plan model) if needed
 */
const getPlanDetails = (role, planName) => {
  const plans = {
    client: {
      free: {
        price: 0,
        durationInDays: 30,
        features: {
          casePostLimit: 2,
          proposalLimit: 0,
          shortlistLimit: 2,
          priorityAccess: false,
          profileBoost: false,
          unlimitedChat: false,
        },
      },
      basic: {
        price: 499,
        durationInDays: 30,
        features: {
          casePostLimit: 10,
          proposalLimit: 0,
          shortlistLimit: 10,
          priorityAccess: false,
          profileBoost: false,
          unlimitedChat: true,
        },
      },
      premium: {
        price: 999,
        durationInDays: 30,
        features: {
          casePostLimit: 9999,
          proposalLimit: 0,
          shortlistLimit: 9999,
          priorityAccess: true,
          profileBoost: false,
          unlimitedChat: true,
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
          priorityAccess: false,
          profileBoost: false,
          unlimitedChat: false,
        },
      },
      basic: {
        price: 999,
        durationInDays: 30,
        features: {
          casePostLimit: 0,
          proposalLimit: 30,
          shortlistLimit: 0,
          priorityAccess: false,
          profileBoost: true,
          unlimitedChat: true,
        },
      },
      premium: {
        price: 1999,
        durationInDays: 30,
        features: {
          casePostLimit: 0,
          proposalLimit: 9999,
          shortlistLimit: 0,
          priorityAccess: true,
          profileBoost: true,
          unlimitedChat: true,
        },
      },
    },
  };

  if (!plans[role] || !plans[role][planName]) {
    return null;
  }

  return plans[role][planName];
};

/**
 * Helper: sync user current subscription info
 */
const syncUserSubscriptionStatus = async (userId) => {
  const latestActiveSubscription = await Subscription.findOne({
    user: userId,
    status: "active",
    endDate: { $gt: new Date() },
  }).sort({ endDate: -1 });

  if (latestActiveSubscription) {
    await User.findByIdAndUpdate(userId, {
      currentSubscription: latestActiveSubscription._id,
      subscriptionStatus: "active",
    });
  } else {
    const latestSubscription = await Subscription.findOne({
      user: userId,
    }).sort({ createdAt: -1 });

    await User.findByIdAndUpdate(userId, {
      currentSubscription: null,
      subscriptionStatus: latestSubscription?.status || "none",
    });
  }
};

/**
 * =========================
 * USER FUNCTIONS
 * =========================
 */

/**
 * Create subscription
 * req.user.id assumed from auth middleware
 * req.user.role assumed from auth middleware
 */
export const createSubscription = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { planName, transactionId } = req.body;

    if (!["client", "lawyer"].includes(userRole)) {
      return res.status(400).json({
        success: false,
        message: "Only client or lawyer can subscribe",
      });
    }

    if (!planName) {
      return res.status(400).json({
        success: false,
        message: "Plan name is required",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const normalizedPlanName = planName.toLowerCase();
    const plan = getPlanDetails(userRole, normalizedPlanName);

    if (!plan) {
      return res.status(400).json({
        success: false,
        message: "Invalid subscription plan",
      });
    }

    const existingActiveSubscription = await Subscription.findOne({
      user: userId,
      status: "active",
      endDate: { $gt: new Date() },
    });

    if (existingActiveSubscription) {
      return res.status(400).json({
        success: false,
        message: "User already has an active subscription",
      });
    }

    const startDate = new Date();
    const endDate = addDays(startDate, plan.durationInDays);

    const subscription = await Subscription.create({
      user: userId,
      roleType: userRole,
      planName: normalizedPlanName,
      price: plan.price,
      durationInDays: plan.durationInDays,
      startDate,
      endDate,
      status: plan.price === 0 ? "active" : "pending",
      features: plan.features,
      paymentStatus: plan.price === 0 ? "paid" : "unpaid",
      transactionId: transactionId || null,
    });

    user.currentSubscription = subscription.status === "active" ? subscription._id : null;
    user.subscriptionStatus = subscription.status;
    await user.save();

    return res.status(201).json({
      success: true,
      message:
        plan.price === 0
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

/**
 * Confirm payment and activate subscription
 * Only admin should call this
 */
export const activateSubscription = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admin can activate subscription",
      });
    }

    const { subscriptionId, transactionId } = req.body;

    if (!subscriptionId) {
      return res.status(400).json({
        success: false,
        message: "Subscription ID is required",
      });
    }

    const subscription = await Subscription.findById(subscriptionId);

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "Subscription not found",
      });
    }

    subscription.status = "active";
    subscription.paymentStatus = "paid";
    if (transactionId) subscription.transactionId = transactionId;

    if (!subscription.startDate) {
      subscription.startDate = new Date();
    }

    if (!subscription.endDate) {
      subscription.endDate = addDays(subscription.startDate, subscription.durationInDays || 30);
    }

    await subscription.save();

    await User.findByIdAndUpdate(subscription.user, {
      subscriptionStatus: "active",
      currentSubscription: subscription._id,
    });

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

/**
 * Get my current/latest subscription
 */
export const getMySubscription = async (req, res) => {
  try {
    const userId = req.user.id;

    const subscription = await Subscription.findOne({
      user: userId,
    }).sort({ createdAt: -1 });

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

/**
 * Get subscription history of logged in user
 */
export const getMySubscriptionHistory = async (req, res) => {
  try {
    const userId = req.user.id;

    const subscriptions = await Subscription.find({
      user: userId,
    }).sort({ createdAt: -1 });

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

/**
 * Renew subscription
 */
export const renewSubscription = async (req, res) => {
  try {
    const userId = req.user.id;
    const { subscriptionId, transactionId } = req.body;

    if (!subscriptionId) {
      return res.status(400).json({
        success: false,
        message: "Subscription ID is required",
      });
    }

    const oldSubscription = await Subscription.findById(subscriptionId);

    if (!oldSubscription) {
      return res.status(404).json({
        success: false,
        message: "Subscription not found",
      });
    }

    if (oldSubscription.user.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized access",
      });
    }

    const activeSubscription = await Subscription.findOne({
      user: userId,
      status: "active",
      endDate: { $gt: new Date() },
    });

    if (activeSubscription) {
      return res.status(400).json({
        success: false,
        message: "You already have an active subscription",
      });
    }

    const startDate = new Date();
    const endDate = addDays(startDate, oldSubscription.durationInDays);

    const renewedSubscription = await Subscription.create({
      user: oldSubscription.user,
      roleType: oldSubscription.roleType,
      planName: oldSubscription.planName,
      price: oldSubscription.price,
      durationInDays: oldSubscription.durationInDays,
      startDate,
      endDate,
      status: oldSubscription.price === 0 ? "active" : "pending",
      features: oldSubscription.features,
      paymentStatus: oldSubscription.price === 0 ? "paid" : "unpaid",
      transactionId: transactionId || null,
    });

    await User.findByIdAndUpdate(userId, {
      currentSubscription:
        renewedSubscription.status === "active" ? renewedSubscription._id : null,
      subscriptionStatus: renewedSubscription.status,
    });

    return res.status(201).json({
      success: true,
      message:
        oldSubscription.price === 0
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

/**
 * Cancel subscription by user
 */
export const cancelSubscription = async (req, res) => {
  try {
    const userId = req.user.id;
    const { subscriptionId } = req.params;

    const subscription = await Subscription.findById(subscriptionId);

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "Subscription not found",
      });
    }

    if (subscription.user.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized access",
      });
    }

    subscription.status = "cancelled";
    await subscription.save();

    await syncUserSubscriptionStatus(userId);

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

/**
 * Expire outdated subscriptions
 * Run this from cron job / admin route
 */
export const checkAndExpireSubscriptions = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
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

/**
 * =========================
 * ADMIN CRUD FUNCTIONS
 * =========================
 */

/**
 * Admin create subscription for any user
 */
export const adminCreateSubscription = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admin can create subscription for users",
      });
    }

    const {
      userId,
      planName,
      roleType,
      transactionId = null,
      status,
      paymentStatus,
      startDate,
    } = req.body;

    if (!userId || !planName || !roleType) {
      return res.status(400).json({
        success: false,
        message: "userId, roleType and planName are required",
      });
    }

    if (!["client", "lawyer"].includes(roleType)) {
      return res.status(400).json({
        success: false,
        message: "roleType must be client or lawyer",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const normalizedPlanName = planName.toLowerCase();
    const plan = getPlanDetails(roleType, normalizedPlanName);

    if (!plan) {
      return res.status(400).json({
        success: false,
        message: "Invalid subscription plan",
      });
    }

    const existingActiveSubscription = await Subscription.findOne({
      user: userId,
      status: "active",
      endDate: { $gt: new Date() },
    });

    if (existingActiveSubscription) {
      return res.status(400).json({
        success: false,
        message: "User already has an active subscription",
      });
    }

    const subscriptionStartDate = startDate ? new Date(startDate) : new Date();
    const subscriptionEndDate = addDays(
      subscriptionStartDate,
      plan.durationInDays
    );

    const finalStatus =
      status || (plan.price === 0 ? "active" : "pending");
    const finalPaymentStatus =
      paymentStatus || (plan.price === 0 ? "paid" : "unpaid");

    const subscription = await Subscription.create({
      user: userId,
      roleType,
      planName: normalizedPlanName,
      price: plan.price,
      durationInDays: plan.durationInDays,
      startDate: subscriptionStartDate,
      endDate: subscriptionEndDate,
      status: finalStatus,
      features: plan.features,
      paymentStatus: finalPaymentStatus,
      transactionId,
    });

    await syncUserSubscriptionStatus(userId);

    return res.status(201).json({
      success: true,
      message: "Subscription created by admin successfully",
      data: subscription,
    });
  } catch (error) {
    console.error("adminCreateSubscription error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create subscription by admin",
      error: error.message,
    });
  }
};

/**
 * Admin get all subscriptions
 */
export const getAllSubscriptions = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admin can view all subscriptions",
      });
    }

    const { status, roleType, userId, page = 1, limit = 10 } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (roleType) filter.roleType = roleType;
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
      message: "Failed to fetch all subscriptions",
      error: error.message,
    });
  }
};

/**
 * Admin get single subscription by id
 */
export const getSubscriptionById = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
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

/**
 * Admin update subscription
 */
export const adminUpdateSubscription = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
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
      paymentStatus,
      transactionId,
      startDate,
      endDate,
      features,
    } = req.body;

    const subscription = await Subscription.findById(subscriptionId);

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "Subscription not found",
      });
    }

    if (planName) {
      const finalRoleType = roleType || subscription.roleType;
      const plan = getPlanDetails(finalRoleType, planName.toLowerCase());

      if (!plan) {
        return res.status(400).json({
          success: false,
          message: "Invalid plan for selected role type",
        });
      }

      subscription.planName = planName.toLowerCase();
      subscription.roleType = finalRoleType;
      subscription.price = plan.price;
      subscription.durationInDays = plan.durationInDays;
      subscription.features = plan.features;

      const newStartDate = startDate
        ? new Date(startDate)
        : subscription.startDate || new Date();

      subscription.startDate = newStartDate;
      subscription.endDate = endDate
        ? new Date(endDate)
        : addDays(newStartDate, plan.durationInDays);
    } else {
      if (roleType) subscription.roleType = roleType;
      if (startDate) subscription.startDate = new Date(startDate);
      if (endDate) subscription.endDate = new Date(endDate);
      if (features) {
        subscription.features = {
          ...subscription.features,
          ...features,
        };
      }
    }

    if (status) subscription.status = status;
    if (paymentStatus) subscription.paymentStatus = paymentStatus;
    if (transactionId !== undefined) subscription.transactionId = transactionId;

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

/**
 * Admin delete subscription permanently
 */
export const adminDeleteSubscription = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
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