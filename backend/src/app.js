import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/database.js";
import authRoutes from "./routes/auth/authRoutes.js";
import dashboardRoutes from "./routes/dashboard/dashboardRoutes.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);

const PORT = process.env.PORT || 5005;

connectDB();

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
