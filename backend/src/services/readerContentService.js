import mongoose from "mongoose";
import DocumentChunk from "../models/DocumentChunk.js";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

export const createReaderContentService = ({
  documentChunkModel = DocumentChunk,
} = {}) => {
  const getReaderContent = async ({
    materialId,
    userId,
    limit = DEFAULT_PAGE_SIZE,
    afterSequence,
  } = {}) => {
    if (
      typeof materialId !== "string" ||
      !mongoose.isValidObjectId(materialId)
    ) {
      const error = new Error("Invalid material ID.");
      error.statusCode = 400;
      throw error;
    }

    if (typeof userId !== "string" || !mongoose.isValidObjectId(userId)) {
      const error = new Error("Unauthenticated.");
      error.statusCode = 401;
      throw error;
    }

    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
      const error = new Error(
        `Limit must be an integer between 1 and ${MAX_PAGE_SIZE}.`,
      );
      error.statusCode = 400;
      throw error;
    }

    if (
      afterSequence !== undefined &&
      (!Number.isInteger(afterSequence) || afterSequence < 0)
    ) {
      const error = new Error("afterSequence must be a non-negative integer.");
      error.statusCode = 400;
      throw error;
    }

    const filter = {
      materialId,
      userId,
    };

    if (afterSequence !== undefined) {
      filter.sequence = { $gt: afterSequence };
    }

    const fetchedChunks = await documentChunkModel
      .find(filter)
      .select("chunkId text sequence startOffset endOffset source")
      .sort({ sequence: 1 })
      .limit(limit + 1)
      .lean();

    const hasNextPage = fetchedChunks.length > limit;
    const chunks = hasNextPage ? fetchedChunks.slice(0, limit) : fetchedChunks;

    const nextCursor =
      hasNextPage && chunks.length > 0
        ? chunks[chunks.length - 1].sequence
        : null;

    return {
      chunks,
      pagination: {
        limit,
        hasNextPage,
        nextCursor,
      },
    };
  };

  return { getReaderContent };
};

const readerContentService = createReaderContentService();

export default readerContentService;
