import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    subscription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subscription",
      required: true,
      index: true,
    },

    roleType: {
      type: String,
      enum: ["client", "lawyer"],
      required: true,
      index: true,
    },

    planName: {
      type: String,
      enum: ["free", "basic", "premium"],
      required: true,
      lowercase: true,
      trim: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    method: {
      type: String,
      enum: ["bkash", "nogod"],
      required: true,
      lowercase: true,
      trim: true,
    },

    transactionId: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },

    senderNumber: {
      type: String,
      trim: true,
      default: null,
    },

    paymentStatus: {
      type: String,
      enum: ["pending", "verified", "rejected", "refunded"],
      default: "pending",
      index: true,
    },

    paymentDate: {
      type: Date,
      default: Date.now,
    },

    verifiedAt: {
      type: Date,
      default: null,
    },

    rejectedAt: {
      type: Date,
      default: null,
    },

    refundedAt: {
      type: Date,
      default: null,
    },

    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    rejectionReason: {
      type: String,
      trim: true,
      default: null,
    },

    refundReason: {
      type: String,
      trim: true,
      default: null,
    },

    note: {
      type: String,
      trim: true,
      default: null,
    },
  },
  { timestamps: true }
);

paymentSchema.index({ user: 1, paymentStatus: 1, createdAt: -1 });
paymentSchema.index({ subscription: 1, paymentStatus: 1 });
paymentSchema.index({ method: 1, paymentStatus: 1 });

const Payment = mongoose.model("Payment", paymentSchema);

export default Payment;