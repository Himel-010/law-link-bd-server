import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    roleType: {
      type: String,
      enum: ["client", "lawyer"],
      required: true,
    },

    planName: {
      type: String,
      required: true,
      trim: true,
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
    },

    startDate: {
      type: Date,
      required: true,
      default: Date.now,
    },

    endDate: {
      type: Date,
      required: true,
    },

    status: {
      type: String,
      enum: ["pending", "active", "expired", "cancelled"],
      default: "pending",
    },

    features: {
      casePostLimit: {
        type: Number,
        default: 0,
      },
      proposalLimit: {
        type: Number,
        default: 0,
      },
      shortlistLimit: {
        type: Number,
        default: 0,
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
    },

    paymentStatus: {
      type: String,
      enum: ["unpaid", "paid", "failed", "refunded"],
      default: "unpaid",
    },

    transactionId: {
      type: String,
      trim: true,
      default: null,
    },
  },
  { timestamps: true }
);

const Subscription = mongoose.model("Subscription", subscriptionSchema);

export default Subscription;