import mongoose from "mongoose";

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

const planSchema = new mongoose.Schema(
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
      unique: true,
    },

    roleType: {
      type: String,
      enum: ["client", "lawyer"],
      required: true,
      index: true,
    },

    description: {
      type: String,
      trim: true,
      default: "",
    },

    price: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    durationInDays: {
      type: Number,
      required: true,
      min: 1,
      default: 30,
    },

    currency: {
      type: String,
      trim: true,
      default: "BDT",
      uppercase: true,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    sortOrder: {
      type: Number,
      default: 0,
    },

    features: {
      type: featureSchema,
      default: () => ({}),
    },
  },
  { timestamps: true }
);

planSchema.index({ roleType: 1, isActive: 1, sortOrder: 1 });
planSchema.index({ roleType: 1, slug: 1 }, { unique: true });

const Plan = mongoose.model("Plan", planSchema);

export default Plan;