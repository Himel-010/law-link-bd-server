import Plan from "../models/plan.model.js";

const normalizeSlug = (value = "") =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-");

export const createPlan = async (req, res) => {
  try {
    const {
      name,
      slug,
      roleType,
      description = "",
      price,
      durationInDays,
      currency = "BDT",
      isActive = true,
      sortOrder = 0,
      features = {},
    } = req.body;

    if (!name || !roleType || price === undefined || !durationInDays) {
      return res.status(400).json({
        success: false,
        message: "name, roleType, price and durationInDays are required",
      });
    }

    const finalSlug = normalizeSlug(slug || name);

    if (!finalSlug) {
      return res.status(400).json({
        success: false,
        message: "Valid slug could not be generated",
      });
    }

    const existing = await Plan.findOne({ slug: finalSlug, roleType });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Plan with this slug already exists for this role",
      });
    }

    const plan = await Plan.create({
      name,
      slug: finalSlug,
      roleType,
      description,
      price,
      durationInDays,
      currency,
      isActive,
      sortOrder,
      features,
    });

    return res.status(201).json({
      success: true,
      message: "Plan created successfully",
      data: plan,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to create plan",
      error: error.message,
    });
  }
};

export const getPublicPlans = async (req, res) => {
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
      count: plans.length,
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

export const getAllPlansAdmin = async (req, res) => {
  try {
    const { roleType, isActive } = req.query;

    const filter = {};
    if (roleType) filter.roleType = roleType;
    if (isActive !== undefined) filter.isActive = isActive === "true";

    const plans = await Plan.find(filter).sort({
      roleType: 1,
      sortOrder: 1,
      price: 1,
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,
      count: plans.length,
      data: plans,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch all plans",
      error: error.message,
    });
  }
};

export const getPlanById = async (req, res) => {
  try {
    const { planId } = req.params;

    const plan = await Plan.findById(planId);

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Plan not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: plan,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch plan",
      error: error.message,
    });
  }
};

export const updatePlan = async (req, res) => {
  try {
    const { planId } = req.params;
    const updateData = { ...req.body };

    if (updateData.slug || updateData.name) {
      updateData.slug = normalizeSlug(updateData.slug || updateData.name);
    }

    const existingPlan = await Plan.findById(planId);
    if (!existingPlan) {
      return res.status(404).json({
        success: false,
        message: "Plan not found",
      });
    }

    if (updateData.slug) {
      const duplicate = await Plan.findOne({
        _id: { $ne: planId },
        slug: updateData.slug,
        roleType: updateData.roleType || existingPlan.roleType,
      });

      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: "Another plan with this slug already exists for this role",
        });
      }
    }

    const updatedPlan = await Plan.findByIdAndUpdate(planId, updateData, {
      new: true,
      runValidators: true,
    });

    return res.status(200).json({
      success: true,
      message: "Plan updated successfully",
      data: updatedPlan,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update plan",
      error: error.message,
    });
  }
};

export const deletePlan = async (req, res) => {
  try {
    const { planId } = req.params;

    const plan = await Plan.findById(planId);
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Plan not found",
      });
    }

    await Plan.findByIdAndDelete(planId);

    return res.status(200).json({
      success: true,
      message: "Plan deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete plan",
      error: error.message,
    });
  }
};