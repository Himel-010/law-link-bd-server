import mongoose from "mongoose";
import Post from "../models/post.model.js";
import User from "../models/user.model.js";

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const parsePagination = (page = 1, limit = 10) => {
  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.max(Number(limit) || 10, 1);
  const skip = (safePage - 1) * safeLimit;

  return { page: safePage, limit: safeLimit, skip };
};

const buildPostFilter = (query = {}, defaultStatus = null) => {
  const {
    category,
    urgency,
    status,
    division,
    district,
    minBudget,
    maxBudget,
    search,
  } = query;

  const filter = {};

  if (defaultStatus && !status) {
    filter.status = defaultStatus;
  }

  if (status) filter.status = status;
  if (category) filter.category = category;
  if (urgency) filter.urgency = urgency;
  if (division) filter.division = division;
  if (district) filter.district = district;

  if (minBudget) {
    filter.budgetMax = { $gte: Number(minBudget) };
  }

  if (maxBudget) {
    filter.budgetMin = { $lte: Number(maxBudget) };
  }

  if (search) {
    filter.$or = [
      { title: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
    ];
  }

  return filter;
};

const populatePostQuery = (query) => {
  return query
    .populate("client", "name email phone role")
    .populate("selectedLawyer", "name email phone role")
    .populate("bids.lawyer", "name email phone role lawRegNumber");
};

const ensurePostExists = async (id) => {
  return Post.findById(id);
};

const ensureClientOwnerOrAdmin = (req, post) => {
  return (
    req.user?.role === "admin" ||
    post.client?.toString() === req.user?.id?.toString()
  );
};

export const createPost = async (req, res, next) => {
  try {
    const {
      title,
      description,
      category,
      budgetMin,
      budgetMax,
      urgency,
      division,
      district,
      documents,
      isPriority,
      expiresAt,
    } = req.body;

    if (!title || !description) {
      return res.status(400).json({
        success: false,
        message: "Title and description are required",
      });
    }

    const post = await Post.create({
      client: req.user.id,
      title,
      description,
      category,
      budgetMin,
      budgetMax,
      urgency,
      division,
      district,
      documents: Array.isArray(documents) ? documents : [],
      isPriority: isPriority === 1 ? 1 : 0,
      expiresAt: expiresAt || null,
    });

    const result = await populatePostQuery(Post.findById(post._id));

    return res.status(201).json({
      success: true,
      message: "Post created successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getAllPosts = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query.page, req.query.limit);
    const filter = buildPostFilter(req.query, "open");

    const [posts, total] = await Promise.all([
      populatePostQuery(
        Post.find(filter)
          .sort({ isPriority: -1, createdAt: -1 })
          .skip(skip)
          .limit(limit)
      ),
      Post.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      message: "Posts fetched successfully",
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      data: posts,
    });
  } catch (error) {
    next(error);
  }
};

export const getSinglePost = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid post id",
      });
    }

    const post = await populatePostQuery(Post.findById(id));

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Post fetched successfully",
      data: post,
    });
  } catch (error) {
    next(error);
  }
};

export const getMyPosts = async (req, res, next) => {
  try {
    const posts = await populatePostQuery(
      Post.find({ client: req.user.id }).sort({ createdAt: -1 })
    );

    return res.status(200).json({
      success: true,
      message: "My posts fetched successfully",
      data: posts,
    });
  } catch (error) {
    next(error);
  }
};

export const updatePost = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid post id",
      });
    }

    const post = await ensurePostExists(id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    if (!ensureClientOwnerOrAdmin(req, post)) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to update this post",
      });
    }

    if (req.user.role !== "admin" && post.status !== "open") {
      return res.status(400).json({
        success: false,
        message: "Only open posts can be updated",
      });
    }

    const allowedFields = [
      "title",
      "description",
      "category",
      "budgetMin",
      "budgetMax",
      "urgency",
      "division",
      "district",
      "documents",
      "isPriority",
      "expiresAt",
      "status",
      "selectedLawyer",
      "acceptedBid",
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        post[field] = req.body[field];
      }
    });

    await post.save();

    const updatedPost = await populatePostQuery(Post.findById(post._id));

    return res.status(200).json({
      success: true,
      message: "Post updated successfully",
      data: updatedPost,
    });
  } catch (error) {
    next(error);
  }
};

export const deletePost = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid post id",
      });
    }

    const post = await ensurePostExists(id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    if (!ensureClientOwnerOrAdmin(req, post)) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to delete this post",
      });
    }

    await Post.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Post deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const placeBid = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { proposedFee, message, estimatedDays } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid post id",
      });
    }

    if (!proposedFee || !message || !estimatedDays) {
      return res.status(400).json({
        success: false,
        message: "proposedFee, message and estimatedDays are required",
      });
    }

    const lawyer = await User.findById(req.user.id);

    if (!lawyer) {
      return res.status(404).json({
        success: false,
        message: "Lawyer not found",
      });
    }

    const post = await ensurePostExists(id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    if (post.status !== "open") {
      return res.status(400).json({
        success: false,
        message: "Bids can only be placed on open posts",
      });
    }

    if (post.client.toString() === req.user.id.toString()) {
      return res.status(400).json({
        success: false,
        message: "You cannot bid on your own post",
      });
    }

    const alreadyBid = post.bids.find(
      (bid) => bid.lawyer.toString() === req.user.id.toString()
    );

    if (alreadyBid) {
      return res.status(400).json({
        success: false,
        message: "You already placed a bid on this post",
      });
    }

    post.bids.push({
      lawyer: req.user.id,
      proposedFee,
      message,
      estimatedDays,
    });

    await post.save();

    const updatedPost = await populatePostQuery(Post.findById(post._id));

    return res.status(200).json({
      success: true,
      message: "Bid placed successfully",
      data: updatedPost,
    });
  } catch (error) {
    next(error);
  }
};

export const withdrawBid = async (req, res, next) => {
  try {
    const { id, bidId } = req.params;

    if (!isValidObjectId(id) || !isValidObjectId(bidId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid post id or bid id",
      });
    }

    const post = await ensurePostExists(id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    const bid = post.bids.id(bidId);

    if (!bid) {
      return res.status(404).json({
        success: false,
        message: "Bid not found",
      });
    }

    if (bid.lawyer.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to withdraw this bid",
      });
    }

    if (bid.status === "accepted") {
      return res.status(400).json({
        success: false,
        message: "Accepted bid cannot be withdrawn",
      });
    }

    bid.status = "withdrawn";
    await post.save();

    const updatedPost = await populatePostQuery(Post.findById(post._id));

    return res.status(200).json({
      success: true,
      message: "Bid withdrawn successfully",
      data: updatedPost,
    });
  } catch (error) {
    next(error);
  }
};

export const acceptBid = async (req, res, next) => {
  try {
    const { id, bidId } = req.params;

    if (!isValidObjectId(id) || !isValidObjectId(bidId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid post id or bid id",
      });
    }

    const post = await ensurePostExists(id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    if (!ensureClientOwnerOrAdmin(req, post)) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to accept a bid on this post",
      });
    }

    if (post.status !== "open") {
      return res.status(400).json({
        success: false,
        message: "Only open posts can accept bids",
      });
    }

    const bid = post.bids.id(bidId);

    if (!bid) {
      return res.status(404).json({
        success: false,
        message: "Bid not found",
      });
    }

    if (bid.status === "withdrawn") {
      return res.status(400).json({
        success: false,
        message: "Withdrawn bid cannot be accepted",
      });
    }

    post.bids.forEach((item) => {
      if (item._id.toString() === bidId) {
        item.status = "accepted";
      } else if (item.status !== "withdrawn") {
        item.status = "rejected";
      }
    });

    post.selectedLawyer = bid.lawyer;
    post.acceptedBid = bid._id;
    post.status = "in_progress";

    await post.save();

    const updatedPost = await populatePostQuery(Post.findById(post._id));

    return res.status(200).json({
      success: true,
      message: "Bid accepted successfully",
      data: updatedPost,
    });
  } catch (error) {
    next(error);
  }
};

export const closePost = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid post id",
      });
    }

    const post = await ensurePostExists(id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    if (!ensureClientOwnerOrAdmin(req, post)) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to close this post",
      });
    }

    post.status = "closed";
    await post.save();

    return res.status(200).json({
      success: true,
      message: "Post closed successfully",
      data: post,
    });
  } catch (error) {
    next(error);
  }
};

export const cancelPost = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid post id",
      });
    }

    const post = await ensurePostExists(id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    if (!ensureClientOwnerOrAdmin(req, post)) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to cancel this post",
      });
    }

    if (post.status === "closed") {
      return res.status(400).json({
        success: false,
        message: "Closed post cannot be cancelled",
      });
    }

    post.status = "cancelled";
    await post.save();

    return res.status(200).json({
      success: true,
      message: "Post cancelled successfully",
      data: post,
    });
  } catch (error) {
    next(error);
  }
};

/* -------------------------------------------------------------------------- */
/*                               ADMIN CONTROLLERS                            */
/* -------------------------------------------------------------------------- */

export const adminGetAllPosts = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query.page, req.query.limit);
    const filter = buildPostFilter(req.query);

    const [posts, total] = await Promise.all([
      populatePostQuery(
        Post.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit)
      ),
      Post.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      message: "Admin fetched all posts successfully",
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      data: posts,
    });
  } catch (error) {
    next(error);
  }
};

export const adminGetSinglePost = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid post id",
      });
    }

    const post = await populatePostQuery(Post.findById(id));

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Admin fetched single post successfully",
      data: post,
    });
  } catch (error) {
    next(error);
  }
};

export const adminCreatePost = async (req, res, next) => {
  try {
    const {
      client,
      title,
      description,
      category,
      budgetMin,
      budgetMax,
      urgency,
      division,
      district,
      documents,
      isPriority,
      expiresAt,
      status,
      selectedLawyer,
      acceptedBid,
    } = req.body;

    if (!client || !title || !description) {
      return res.status(400).json({
        success: false,
        message: "client, title and description are required",
      });
    }

    if (!isValidObjectId(client)) {
      return res.status(400).json({
        success: false,
        message: "Invalid client id",
      });
    }

    const clientExists = await User.findById(client);

    if (!clientExists) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }

    const post = await Post.create({
      client,
      title,
      description,
      category,
      budgetMin,
      budgetMax,
      urgency,
      division,
      district,
      documents: Array.isArray(documents) ? documents : [],
      isPriority: isPriority === 1 ? 1 : 0,
      expiresAt: expiresAt || null,
      status: status || "open",
      selectedLawyer: selectedLawyer || null,
      acceptedBid: acceptedBid || null,
    });

    const result = await populatePostQuery(Post.findById(post._id));

    return res.status(201).json({
      success: true,
      message: "Admin created post successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const adminUpdatePost = async (req, res, next) => {
  return updatePost(req, res, next);
};

export const adminDeletePost = async (req, res, next) => {
  return deletePost(req, res, next);
};