import mongoose from "mongoose";

import DocumentChunk from "../models/DocumentChunk.js";

const createReaderContentError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

export const createReaderContentService = ({
  documentChunkModel = DocumentChunk,
} = {}) => {
  const getReaderContent = async ({ materialId, userId } = {}) => {
    // 1. Validate the material ID.
    if (
      typeof materialId !== "string" ||
      !mongoose.isValidObjectId(materialId)
    ) {
      throw createReaderContentError("Invalid material ID.", 400);
    }

    // 2. Validate the authenticated user ID.
    if (typeof userId !== "string" || !mongoose.isValidObjectId(userId)) {
      throw createReaderContentError("Unauthenticated.", 401);
    }

    // 3. Retrieve only this user's chunks for this material.
    // 4. Return only fields required by the reader.
    // 5. Maintain the original document order.
    return documentChunkModel
      .find({
        materialId,
        userId,
      })
      .select("chunkId text sequence startOffset endOffset source")
      .sort({ sequence: 1 })
      .lean();
  };

  return { getReaderContent };
};

const readerContentService = createReaderContentService();

export default readerContentService;
