const validateConfiguration = ({
  provider,
  model,
  dimensions,
  generateEmbeddings,
}) => {
  if (typeof provider !== "string" || provider.trim().length === 0) {
    throw new TypeError("Provider must be a non-empty string.");
  }

  if (typeof model !== "string" || model.trim().length === 0) {
    throw new TypeError("Model must be a non-empty string.");
  }

  if (!Number.isInteger(dimensions) || dimensions < 1) {
    throw new RangeError("Dimensions must be a positive integer.");
  }

  if (typeof generateEmbeddings !== "function") {
    throw new TypeError("generateEmbeddings must be a function.");
  }
};

const validateTexts = (texts) => {
  if (!Array.isArray(texts)) {
    throw new TypeError("Texts must be an array.");
  }

  for (const text of texts) {
    if (typeof text !== "string" || text.trim().length === 0) {
      throw new TypeError("Every text must be a non-empty string.");
    }
  }
};

const validateEmbeddings = (embeddings, textCount, dimensions) => {
  if (!Array.isArray(embeddings) || embeddings.length !== textCount) {
    throw new Error(
      "The number of embeddings must match the number of input texts.",
    );
  }

  for (const embedding of embeddings) {
    if (!Array.isArray(embedding) || embedding.length !== dimensions) {
      throw new Error(
        `Each embedding must have exactly ${dimensions} dimensions.`,
      );
    }

    if (!embedding.every(Number.isFinite)) {
      throw new Error("Embedding vectors must contain only finite numbers.");
    }
  }
};

const createEmbeddingService = ({
  provider,
  model,
  dimensions,
  generateEmbeddings,
}) => {
  validateConfiguration({
    provider,
    model,
    dimensions,
    generateEmbeddings,
  });

  const modelMetadata = {
    provider,
    name: model,
    dimensions,
  };

  const embedTexts = async (texts) => {
    validateTexts(texts);

    if (texts.length === 0) {
      return {
        embeddings: [],
        model: modelMetadata,
      };
    }

    const embeddings = await generateEmbeddings(texts);

    validateEmbeddings(embeddings, texts.length, dimensions);

    return {
      embeddings,
      model: modelMetadata,
    };
  };

  return embedTexts;
};

export { createEmbeddingService };
