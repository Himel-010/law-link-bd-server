import express from "express";

import {
  registerClient,
  registerLawyer,
  registerAdmin,
  loginUser,
  getAllUsers,
  updateUser,
  deleteUser,
} from "../controllers/user.controller.js";

import { protect, adminOnly } from "../middleware/auth.js";

const router = express.Router();

// =========================
// PUBLIC ROUTES
// =========================

// REGISTER
router.post("/register/client", registerClient);
router.post("/register/lawyer", registerLawyer);
router.post("/register/admin", registerAdmin);

// LOGIN
router.post("/login", loginUser);

// =========================
// ADMIN PROTECTED ROUTES
// =========================

// Get all users
router.get("/", protect, adminOnly, getAllUsers);

// Update user
router.put("/:id", protect, adminOnly, updateUser);

// Delete user
router.delete("/:id", protect, adminOnly, deleteUser);

export default router;