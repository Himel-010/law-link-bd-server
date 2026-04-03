import Provider from "../models/provider.model.js";
import uploadCloudinary from "../utils/cloudinary.js";

/* ================= CREATE ================= */
// POST /api/providers  (multipart/form-data, image file field name: "image")
export const createProvider = async (req, res) => {
  try {
    const { name, type, specialist, location } = req.body;

    if (!name || !type || !specialist || !location) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // ✅ normalize + validate type
    const normalizedType = String(type).toLowerCase().trim();
    if (!["doctor", "counselor"].includes(normalizedType)) {
      return res.status(400).json({
        message: "Invalid type. Type must be 'doctor' or 'counselor'.",
      });
    }

    if (!req.file) {
      return res.status(400).json({ message: "Profile image is required" });
    }

    // Upload image to Cloudinary
    const imageUrl = await uploadCloudinary(req.file.buffer);
    if (!imageUrl) {
      return res.status(500).json({ message: "Image upload failed" });
    }

    const provider = await Provider.create({
      imageUrl,
      name,
      type: normalizedType, // ✅ always correct
      specialist,
      location,
    });

    return res.status(201).json({ message: "Provider created", provider });
  } catch (err) {
    return res
      .status(500)
      .json({ message: "Create failed", error: err.message });
  }
};

/* ================= READ ALL ================= */
// GET /api/providers?type=doctor&location=dhaka&specialist=cardio&search=rahim
export const getProviders = async (req, res) => {
  try {
    const { type, location, specialist, search } = req.query;

    const query = {};

    // ✅ normalize type query
    if (type) query.type = String(type).toLowerCase().trim();
    if (location) query.location = { $regex: location, $options: "i" };
    if (specialist) query.specialist = { $regex: specialist, $options: "i" };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { specialist: { $regex: search, $options: "i" } },
        { location: { $regex: search, $options: "i" } },
      ];
    }

    const providers = await Provider.find(query).sort({ createdAt: -1 });
    return res.json({ providers });
  } catch (err) {
    return res
      .status(500)
      .json({ message: "Fetch failed", error: err.message });
  }
};

/* ================= READ ONE ================= */
// GET /api/providers/:id
export const getProviderById = async (req, res) => {
  try {
    const provider = await Provider.findById(req.params.id);
    if (!provider) {
      return res.status(404).json({ message: "Provider not found" });
    }

    return res.json({ provider });
  } catch (err) {
    return res
      .status(500)
      .json({ message: "Fetch failed", error: err.message });
  }
};

/* ================= UPDATE ================= */
// PUT /api/providers/:id  (multipart/form-data, image optional)
export const updateProvider = async (req, res) => {
  try {
    const { name, type, specialist, location } = req.body;

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (specialist !== undefined) updateData.specialist = specialist;
    if (location !== undefined) updateData.location = location;

    // ✅ normalize + validate type (if provided)
    if (type !== undefined) {
      const normalizedType = String(type).toLowerCase().trim();
      if (!["doctor", "counselor"].includes(normalizedType)) {
        return res.status(400).json({
          message: "Invalid type. Type must be 'doctor' or 'counselor'.",
        });
      }
      updateData.type = normalizedType;
    }

    // If new image is uploaded, replace imageUrl
    if (req.file) {
      const imageUrl = await uploadCloudinary(req.file.buffer);
      if (!imageUrl) {
        return res.status(500).json({ message: "Image upload failed" });
      }
      updateData.imageUrl = imageUrl;
    }

    const provider = await Provider.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!provider) {
      return res.status(404).json({ message: "Provider not found" });
    }

    return res.json({ message: "Provider updated", provider });
  } catch (err) {
    return res
      .status(500)
      .json({ message: "Update failed", error: err.message });
  }
};

/* ================= DELETE ================= */
// DELETE /api/providers/:id
export const deleteProvider = async (req, res) => {
  try {
    const provider = await Provider.findByIdAndDelete(req.params.id);
    if (!provider) {
      return res.status(404).json({ message: "Provider not found" });
    }

    return res.json({ message: "Provider deleted" });
  } catch (err) {
    return res
      .status(500)
      .json({ message: "Delete failed", error: err.message });
  }
};
