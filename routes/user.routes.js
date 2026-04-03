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

const router = express.Router();

// REGISTER
router.post("/register/client", registerClient);
router.post("/register/lawyer", registerLawyer);
router.post("/register/admin", registerAdmin);

// LOGIN
router.post("/login", loginUser);

// ADMIN CRUD
router.get("/", getAllUsers);
router.put("/:id", updateUser);
router.delete("/:id", deleteUser);

export default router;