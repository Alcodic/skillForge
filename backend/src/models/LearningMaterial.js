import mongoose from "mongoose";

const LearningMaterialSchema = mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    title: {
      type: String,
      required: true,
    },
    originalFileName: {
      type: String,
      required: true,
    },
    fileType: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number,
      required: true,
    },
    storageReference: {
      type: String,
      required: true,
    },
    processingStatus: {
      type: String,
      enum: ["UPLOADING", "PROCESSING", "READY", "FAILED"],
      required: true,
    },
  },
  { timestamps: true },
);

const LearningMaterial = mongoose.model(
  "LearningMaterial",
  LearningMaterialSchema,
);

export default LearningMaterial;
