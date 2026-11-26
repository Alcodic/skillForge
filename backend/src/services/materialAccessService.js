import mongoose from "mongoose";

import LearningMaterial from "../models/LearningMaterial.js";

const createAccessError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

export const createMaterialAccessService = ({
  learningMaterialModel = LearningMaterial,
} = {}) => {
  const getReadyMaterial = async ({ materialId, userId }) => {
    // 1. Validate the material ID.
    if (
      typeof materialId !== "string" ||
      !mongoose.isValidObjectId(materialId)
    ) {
      throw createAccessError("Invalid material ID.", 400);
    }

    // 2. Validate the authenticated user ID.
    if (typeof userId !== "string" || !mongoose.isValidObjectId(userId)) {
      throw createAccessError("Unauthenticated.", 401);
    }

    // 3. Find the material within the authenticated user's ownership scope.
    const material = await learningMaterialModel.findOne({
      _id: materialId,
      userId,
    });

    // 4. Do not reveal whether another user's material exists.
    if (!material) {
      throw createAccessError("Material not found.", 404);
    }

    // 5. Only processed materials can be opened for learning or AI use.
    if (material.processingStatus !== "READY") {
      throw createAccessError("Material is not ready for learning.", 409);
    }

    return material;
  };

  return { getReadyMaterial };
};

const materialAccessService = createMaterialAccessService();

export default materialAccessService;
