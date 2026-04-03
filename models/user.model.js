import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    nid: {
      type: String,
      required: function () {
        return this.role === "lawyer";
      },
      trim: true,
    },

    lawRegNumber: {
      type: String,
      required: function () {
        return this.role === "lawyer";
      },
      trim: true,
    },

    phone: {
      type: String,
      required: function () {
        return this.role !== "admin";
      },
      trim: true,
    },

    phoneVerified: {
      type: Number,
      enum: [0, 1],
      default: 0,
    },

    password: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: ["client", "lawyer", "admin"],
      default: "client",
    },

    subscriptionStatus: {
      type: String,
      enum: ["none", "pending", "active", "expired", "cancelled"],
      default: "none",
    },

    currentSubscription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subscription",
      default: null,
    },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

export default User;