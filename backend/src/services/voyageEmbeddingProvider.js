const VOYAGE_EMBEDDINGS_URL = "https://api.voyageai.com/v1/embeddings";

const createVoyageEmbeddingProvider = ({
  apiKey = process.env.VOYAGE_API_KEY,
  model,
  dimensions,
  fetchImpl = fetch,
  timeoutMs = 15_000,
  batchSize = 100,
} = {}) => {
  if (typeof apiKey !== "string" || !apiKey.trim()) {
    throw new Error("VOYAGE_API_KEY must be configured.");
  }

  if (typeof model !== "string" || !model.trim()) {
    throw new TypeError("Model must be a non-empty string.");
  }

  if (!Number.isSafeInteger(dimensions) || dimensions < 1) {
    throw new RangeError("Dimensions must be a positive integer.");
  }

  if (typeof fetchImpl !== "function") {
    throw new TypeError("fetchImpl must be a function.");
  }

  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1) {
    throw new RangeError("timeoutMs must be a positive integer.");
  }

  if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 1000) {
    throw new RangeError("batchSize must be an integer between 1 and 1000.");
  }

  const generateEmbeddings = async (texts) => {
    const embeddings = [];

    for (let start = 0; start < texts.length; start += batchSize) {
      const batch = texts.slice(start, start + batchSize);
      const controller = new AbortController();

      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetchImpl(VOYAGE_EMBEDDINGS_URL, {  
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            input: batch,
            model,
            input_type: "document",
            output_dimension: dimensions,
            output_dtype: "float",
            truncation: false,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(
            `Voyage API request failed with HTTP ${response.status}.`,
          );
        }

        const result = await response.json();

        if (
          !Array.isArray(result?.data) ||
          result.data.length !== batch.length
        ) {
          throw new Error(
            "Voyage API returned an invalid number of embeddings.",
          );
        }

        const orderedBatch = new Array(batch.length);

        for (const item of result.data) {
          const { index, embedding } = item ?? {};

          if (
            !Number.isSafeInteger(index) ||
            index < 0 ||
            index >= batch.length ||
            orderedBatch[index] !== undefined
          ) {
            throw new Error("Voyage API returned invalid embedding indices.");
          }

          if (
            !Array.isArray(embedding) ||
            embedding.length !== dimensions ||
            !embedding.every(Number.isFinite)
          ) {
            throw new Error("Voyage API returned an invalid embedding vector.");
          }

          orderedBatch[index] = embedding;
        }

        if (orderedBatch.some((embedding) => embedding === undefined)) {
          throw new Error("Voyage API response is missing an embedding.");
        }

        embeddings.push(...orderedBatch);
      } catch (error) {
        if (controller.signal.aborted) {
          throw new Error("Voyage API request timed out.", {
            cause: error,
          });
        }

        throw error;
      } finally {
        clearTimeout(timeout);
      }
    }

    return embeddings;
  };

  return generateEmbeddings;
};

export { createVoyageEmbeddingProvider };
