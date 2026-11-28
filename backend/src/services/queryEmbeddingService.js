import { createConfiguredEmbeddingService } from "./createConfiguredEmbeddingService.js";

export const createQueryEmbeddingService = ({
  embedTexts = createConfiguredEmbeddingService({
    inputType: "query",
  }),
} = {}) => {
  if (typeof embedTexts !== "function") {
    throw new TypeError("embedTexts must be a function.");
  }

  return async (question) => {
    if (typeof question !== "string" || !question.trim()) {
      throw new TypeError("Question must be a non-empty string.");
    }

    const result = await embedTexts([question]);

    if (
      !result ||
      !Array.isArray(result.embeddings) ||
      result.embeddings.length !== 1
    ) {
      throw new Error(
        "Query embedding service must return exactly one embedding.",
      );
    }

    if (!result.model) {
      throw new Error("Query embedding model metadata is missing.");
    }

    return {
      embedding: result.embeddings[0],
      model: result.model,
    };
  };
};
