import User from "../models/user.model.js";
import bcrypt from "bcryptjs";

// ================= REGISTER CLIENT =================
export const registerClient = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ message: "Email already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      name,
      email,
      phone,
      password: hashedPassword,
      role: "client",
    });

    await user.save();

    res.status(201).json({ message: "Client registered", user });
  } catch (err) {
    res.status(500).json({ error: err.message });
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

    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ message: "Email already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      name,
      email,
      nid,
      lawRegNumber,
      phone,
      phoneVerified,
      password: hashedPassword,
      role: "lawyer",
    });

    await user.save();

    res.status(201).json({ message: "Lawyer registered", user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ================= REGISTER ADMIN =================
export const registerAdmin = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ message: "Email already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      name,
      email,
      password: hashedPassword,
      role: "admin",
    });

    await user.save();

    res.status(201).json({ message: "Admin registered", user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ================= LOGIN USER =================
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. check user exists
    const user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({ message: "Invalid email or password" });

    // 2. compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid email or password" });

    // 3. response (no password)
    const { password: _, ...userData } = user._doc;

    res.status(200).json({
      message: "Login successful ✅",
      user: userData,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ================= ADMIN: GET USERS =================
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ================= UPDATE USER =================
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;

    const updatedUser = await User.findByIdAndUpdate(id, req.body, {
      new: true,
    }).select("-password");

    res.json(updatedUser);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ================= DELETE USER =================
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    await User.findByIdAndDelete(id);

    res.json({ message: "User deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};