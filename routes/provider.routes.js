import { Router } from "express";
import {
  createProvider,
  getProviders,
  getProviderById,
  updateProvider,
  deleteProvider,
} from "../controllers/provider.controller.js";

import { verifyUser, adminOnly } from "../middleware/auth.js";
import upload from "../middleware/upload.js";

const router = Router();

// public read
router.get("/", getProviders);
router.get("/:id", getProviderById);

// admin manage (image upload via Cloudinary)
router.post("/", verifyUser, adminOnly, upload.single("image"), createProvider);
router.put("/:id", verifyUser, adminOnly, upload.single("image"), updateProvider);
router.delete("/:id", verifyUser, adminOnly, deleteProvider);

export default router;
