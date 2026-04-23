import express from "express";
import {
  createPlan,
  getPublicPlans,
  getAllPlansAdmin,
  getPlanById,
  updatePlan,
  deletePlan,
} from "../controllers/plan.controller.js";
import { protect, authorizeRoles } from "../middleware/auth.js";

const router = express.Router();

// public
router.get("/", getPublicPlans);
router.get("/:planId", getPlanById);

// admin
router.post("/", protect, authorizeRoles("admin"), createPlan);
router.get("/admin/all/list", protect, authorizeRoles("admin"), getAllPlansAdmin);
router.patch("/:planId", protect, authorizeRoles("admin"), updatePlan);
router.delete("/:planId", protect, authorizeRoles("admin"), deletePlan);

export default router;