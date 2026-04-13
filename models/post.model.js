import mongoose from "mongoose";

const bidSchema = new mongoose.Schema(
  {
    lawyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    proposedFee: {
      type: Number,
      required: true,
      min: 0,
    },

    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },

    estimatedDays: {
      type: Number,
      required: true,
      min: 1,
    },

    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "withdrawn"],
      default: "pending",
    },
  },
  { timestamps: true }
);

const postSchema = new mongoose.Schema(
  {
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },

    category: {
      type: String,
      trim: true,
      enum: [
        "family",
        "criminal",
        "property",
        "corporate",
        "civil",
        "tax",
        "labour",
        "cyber",
        "immigration",
        "other",
      ],
      default: "other",
    },

    budgetMin: {
      type: Number,
      min: 0,
      default: 0,
    },

    budgetMax: {
      type: Number,
      min: 0,
      default: 0,
      validate: {
        validator: function (value) {
          return value >= this.budgetMin;
        },
        message: "budgetMax must be greater than or equal to budgetMin",
      },
    },

    urgency: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },

    division: {
      type: String,
      trim: true,
      default: "",
    },

    district: {
      type: String,
      trim: true,
      default: "",
    },

    documents: [
      {
        type: String,
        trim: true,
      },
    ],

    status: {
      type: String,
      enum: ["open", "in_progress", "closed", "cancelled"],
      default: "open",
    },

    bids: [bidSchema],

    selectedLawyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    acceptedBid: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    isPriority: {
      type: Number,
      enum: [0, 1],
      default: 0,
    },

    expiresAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

postSchema.index({ client: 1, status: 1 });
postSchema.index({ category: 1, status: 1 });
postSchema.index({ createdAt: -1 });
postSchema.index({ "bids.lawyer": 1 });

postSchema.pre("save", function (next) {
  const lawyerIds = this.bids.map((bid) => bid.lawyer.toString());
  const uniqueLawyerIds = new Set(lawyerIds);

  if (lawyerIds.length !== uniqueLawyerIds.size) {
    return next(new Error("A lawyer can bid only once on a post"));
  }

  next();
});

const Post = mongoose.model("Post", postSchema);

export default Post;