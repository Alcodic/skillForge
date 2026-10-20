const getEmbeddingConfig = (env = process.env) => {
  const { EMBEDDING_PROVIDER, EMBEDDING_MODEL, EMBEDDING_DIMENSIONS } = env;

  if (
    typeof EMBEDDING_PROVIDER !== "string" ||
    EMBEDDING_PROVIDER.trim().length === 0
  ) {
    throw new Error("EMBEDDING_PROVIDER must be configured.");
  }

  if (
    typeof EMBEDDING_MODEL !== "string" ||
    EMBEDDING_MODEL.trim().length === 0
  ) {
    throw new Error("EMBEDDING_MODEL must be configured.");
  }

  if (
    typeof EMBEDDING_DIMENSIONS !== "string" ||
    !/^\d+$/.test(EMBEDDING_DIMENSIONS.trim())
  ) {
    throw new Error("EMBEDDING_DIMENSIONS must be a positive integer.");
  }

  const dimensions = Number(EMBEDDING_DIMENSIONS);

  if (!Number.isSafeInteger(dimensions) || dimensions < 1) {
    throw new Error("EMBEDDING_DIMENSIONS must be a positive integer.");
  }

  return {
    provider: EMBEDDING_PROVIDER.trim(),
    model: EMBEDDING_MODEL.trim(),
    dimensions,
  };
};

export { getEmbeddingConfig };
