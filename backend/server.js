require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Error handler for invalid JSON bodies from express.json()
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }
  next(err);
});

// Kết nối MongoDB với username là MSSV, password là MSSV, dbname là it4409
mongoose
  .connect(
    process.env.MONGODB_URI || "mongodb+srv://20225159:20225159@it4409.w6piduk.mongodb.net/?retryWrites=true&w=majority",
    { dbName: process.env.MONGODB_DBNAME || "IT4409" }
  )
  .then(() => console.log("Connected to IT4409 DB"))
  .catch((err) => console.error("MongoDB Error:", err));

// TODO: Tạo Schema
const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Tên không được để trống'],
    minlength: [2, 'Tên phải có ít nhất 2 ký tự']
  },
  age: {
    type: Number,
    required: [true, 'Tuổi không được để trống'],
    min: [0, 'Tuổi phải >= 0']
  },
  email: {
    type: String,
    required: [true, 'Email không được để trống'],
    match: [/^\S+@\S+\.\S+$/, 'Email không hợp lệ']
  },
  address: {
    type: String
  }
});

const User = mongoose.model("User", UserSchema, "users");

// TODO: Implement API endpoints
app.get("/api/users", async (req, res) => {
  try {
    // Lấy query params
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const search = req.query.search || "";

    // Tạo query filter cho search
    const filter = search
      ? {
          $or: [
            { name: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
            { address: { $regex: search, $options: "i" } },
          ],
        }
      : {};

    // Tính skip
    const skip = (page - 1) * limit;

    // Thực hiện song song: query data và đếm tổng
    const [users, total] = await Promise.all([
      User.find(filter).skip(skip).limit(limit).exec(),
      User.countDocuments(filter).exec(),
    ]);

    const totalPages = Math.ceil(total / limit);

    // Trả về response
    res.json({
      page,
      limit,
      total,
      totalPages,
      data: users,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/users", async (req, res) => {
  try {
    const body = req.body;

    // Nếu body là mảng: bulk insert nhiều users
    if (Array.isArray(body)) {
      // Check duplicate email in DB for each user trước khi insert
      const emails = body.map((u) => u.email).filter(Boolean);
      if (emails.length > 0) {
        const existing = await User.find({ email: { $in: emails } }).select("email");
        if (existing.length > 0) {
          return res.status(400).json({ error: "Email đã tồn tại" });
        }
      }

      const newUsers = await User.insertMany(body, { ordered: false });
      return res.status(201).json({
        message: "Tạo nhiều người dùng thành công",
        count: newUsers.length,
        data: newUsers,
      });
    }

    // Nếu body là 1 object: tạo 1 user
    const { name, age, email, address } = body;

    // Check email đã tồn tại chưa (unique)
    if (email) {
      const existed = await User.findOne({ email });
      if (existed) {
        return res.status(400).json({ error: "Email đã tồn tại" });
      }
    }

    const newUser = await User.create({ name, age, email, address });
    res.status(201).json({
      message: "Tạo người dùng thành công",
      data: newUser,
    });
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({ error: err.message });
    }
    res.status(400).json({ error: err.message });
  }
});

app.put("/api/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, age, email, address } = req.body;
    const updatedUser = await User.findByIdAndUpdate(
      id,
      { name, age, email, address },
      { new: true, runValidators: true } // Quan trọng
    );
    if (!updatedUser) {
      return res.status(404).json({ error: "Không tìm thấy người dùng" });
    }
    res.json({
      message: "Cập nhật người dùng thành công",
      data: updatedUser,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete("/api/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deletedUser = await User.findByIdAndDelete(id);
    if (!deletedUser) {
      return res.status(404).json({ error: "Không tìm thấy người dùng" });
    }
    res.json({ message: "Xóa người dùng thành công" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});