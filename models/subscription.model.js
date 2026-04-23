import mongoose from "mongoose";

const usageSchema = new mongoose.Schema(
  {
    casePostsUsed: {
      type: Number,
      default: 0,
      min: 0,
    },
    proposalsUsed: {
      type: Number,
      default: 0,
      min: 0,
    },
    shortlistsUsed: {
      type: Number,
      default: 0,
      min: 0,
    },
    creditsUsed: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false }
);

const featureSchema = new mongoose.Schema(
  {
    casePostLimit: {
      type: Number,
      default: 0,
      min: 0,
    },
    proposalLimit: {
      type: Number,
      default: 0,
      min: 0,
    },
    shortlistLimit: {
      type: Number,
      default: 0,
      min: 0,
    },
    proposalCredits: {
      type: Number,
      default: 0,
      min: 0,
    },
    priorityAccess: {
      type: Boolean,
      default: false,
    },
    profileBoost: {
      type: Boolean,
      default: false,
    },
    unlimitedChat: {
      type: Boolean,
      default: false,
    },
    paidConsultationEnabled: {
      type: Boolean,
      default: false,
    },
    shortlistUnlockEnabled: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const paymentSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["unpaid", "paid", "failed", "refunded"],
      default: "unpaid",
    },
    transactionId: {
      type: String,
      trim: true,
      default: null,
    },
    method: {
      type: String,
      enum: ["bkash", "nogod", null],
      default: null,
    },
    paidAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const planSnapshotSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    description: {
      type: String,
      default: "",
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    durationInDays: {
      type: Number,
      required: true,
      min: 1,
    },
    currency: {
      type: String,
      default: "BDT",
      uppercase: true,
    },
    features: {
      type: featureSchema,
      required: true,
      default: () => ({}),
    },
  },
  { _id: false }
);

const subscriptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    plan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Plan",
      required: true,
      index: true,
    },

    roleType: {
      type: String,
      enum: ["client", "lawyer"],
      required: true,
      index: true,
    },

    planSnapshot: {
      type: planSnapshotSchema,
      required: true,
    },

    price: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    durationInDays: {
      type: Number,
      required: true,
      default: 30,
      min: 1,
    },

    startDate: {
      type: Date,
      required: true,
      default: Date.now,
    },

    endDate: {
      type: Date,
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: ["pending", "active", "expired", "cancelled"],
      default: "pending",
      index: true,
    },

    features: {
      type: featureSchema,
      default: () => ({}),
    },

    usage: {
      type: usageSchema,
      default: () => ({}),
    },

    payment: {
      type: paymentSchema,
      default: () => ({}),
    },

    notes: {
      type: String,
      trim: true,
      default: null,
    },

    cancelledAt: {
      type: Date,
      default: null,
    },

    expiredAt: {
      type: Date,
      default: null,
    },

    activatedAt: {
      type: Date,
      default: null,
    },

    renewedFrom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subscription",
      default: null,
    },
  },
  { timestamps: true }
);

subscriptionSchema.index({ user: 1, status: 1, endDate: 1 });

const Subscription = mongoose.model("Subscription", subscriptionSchema);

export default Subscription;