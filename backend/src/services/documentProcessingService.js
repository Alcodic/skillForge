import mongoose from "mongoose";
import LearningMaterial from "../models/LearningMaterial.js";
import { downloadFile } from "./storageService.js";

export const prepareMaterialForProcessing = async ({ materialId, userId }) => {
  if (!mongoose.Types.ObjectId.isValid(materialId)) {
    const error = new Error("Invalid material ID.");
    error.statusCode = 400;
    throw error;
  }

  const material = await LearningMaterial.findOne({
    _id: materialId,
    userId,
  });

  if (!material) {
    const error = new Error("Material not found.");
    error.statusCode = 404;
    throw error;
  }

  const fileBuffer = await downloadFile({
    objectKey: material.storageReference,
  });

  if (material.processingStatus !== "PROCESSING") {
    const error = new Error(
      `Material cannot be processed from ${material.processingStatus} state.`,
    );
    error.statusCode = 409;
    throw error;
  }

  if (!material.storageReference) {
    const error = new Error("Material storage reference is missing.");
    error.statusCode = 409;
    throw error;
  }

  return {
    materialId: material._id,
    userId: material.userId,
    storageReference: material.storageReference,
    fileType: material.fileType,
    originalFileName: material.originalFileName,
    fileBuffer,
  };
};
