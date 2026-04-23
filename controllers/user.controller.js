import User from "../models/user.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// ================= HELPER: GENERATE JWT TOKEN =================
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      role: user.role,
      email: user.email,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );
};

// ================= REGISTER CLIENT =================
export const registerClient = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email, phone and password are required",
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      name,
      email,
      phone,
      password: hashedPassword,
      role: "client",
    });

    await user.save();

    const token = generateToken(user);

    const userData = {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      subscriptionStatus: user.subscriptionStatus,
      currentSubscription: user.currentSubscription,
    };

    return res.status(201).json({
      success: true,
      message: "Client registered successfully",
      user: userData,
      token,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Failed to register client",
      error: err.message,
    });
  }
};

// ================= REGISTER LAWYER =================
export const registerLawyer = async (req, res) => {
  try {
    const {
      name,
      email,
      nid,
      lawRegNumber,
      phone,
      phoneVerified,
      password,
    } = req.body;

    if (!name || !email || !nid || !lawRegNumber || !phone || !password) {
      return res.status(400).json({
        success: false,
        message:
          "Name, email, nid, lawRegNumber, phone and password are required",
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      name,
      email,
      nid,
      lawRegNumber,
      phone,
      phoneVerified: Boolean(phoneVerified),
      password: hashedPassword,
      role: "lawyer",
    });

    await user.save();

    const token = generateToken(user);

    const userData = {
      id: user._id,
      name: user.name,
      email: user.email,
      nid: user.nid,
      lawRegNumber: user.lawRegNumber,
      phone: user.phone,
      phoneVerified: user.phoneVerified,
      role: user.role,
      subscriptionStatus: user.subscriptionStatus,
      currentSubscription: user.currentSubscription,
    };

    return res.status(201).json({
      success: true,
      message: "Lawyer registered successfully",
      user: userData,
      token,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Failed to register lawyer",
      error: err.message,
    });
  }
};

// ================= REGISTER ADMIN =================
export const registerAdmin = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required",
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      name,
      email,
      password: hashedPassword,
      role: "admin",
    });

    await user.save();

    const token = generateToken(user);

    const userData = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      subscriptionStatus: user.subscriptionStatus,
      currentSubscription: user.currentSubscription,
    };

    return res.status(201).json({
      success: true,
      message: "Admin registered successfully",
      user: userData,
      token,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Failed to register admin",
      error: err.message,
    });
  }
};

// ================= LOGIN USER =================
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    // 1) Check user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // 2) Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // 3) Generate token
    const token = generateToken(user);

    // 4) Safe user data
    const userData = {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone || null,
      role: user.role,
      subscriptionStatus: user.subscriptionStatus,
      currentSubscription: user.currentSubscription,
    };

    return res.status(200).json({
      success: true,
      message: "Login successful ✅",
      user: userData,
      token,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Login failed",
      error: err.message,
    });
  }
};

// ================= ADMIN: GET ALL USERS =================
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password");

    return res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch users",
      error: err.message,
    });
  }
};

// ================= ADMIN: UPDATE USER =================
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    // password update hole hash kore nibo
    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 10);
    }

    const updatedUser = await User.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).select("-password");

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: updatedUser,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Failed to update user",
      error: err.message,
    });
  }
};

// ================= ADMIN: DELETE USER =================
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedUser = await User.findByIdAndDelete(id);

    if (!deletedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete user",
      error: err.message,
    });
  }
};