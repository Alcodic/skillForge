import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/database.js";
import healthRoutes from "./routes/health/routes.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/health", healthRoutes);

const PORT = process.env.PORT || 5005;

connectDB();

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
