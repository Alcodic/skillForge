const getQdrantConfig = (env = process.env) => {
  const { QDRANT_URL, QDRANT_API_KEY } = env;

  if (typeof QDRANT_URL !== "string" || QDRANT_URL.trim().length === 0) {
    throw new Error("QDRANT_URL must be configured.");
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(QDRANT_URL.trim());
  } catch {
    throw new Error("QDRANT_URL must be a valid URL.");
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("QDRANT_URL must use HTTP or HTTPS.");
  }

  if (
    parsedUrl.username ||
    parsedUrl.password ||
    parsedUrl.search ||
    parsedUrl.hash
  ) {
    throw new Error(
      "QDRANT_URL must not contain credentials, query parameters, or a fragment.",
    );
  }

  if (
    QDRANT_API_KEY !== undefined &&
    (typeof QDRANT_API_KEY !== "string" || QDRANT_API_KEY.trim().length === 0)
  ) {
    throw new Error("QDRANT_API_KEY must be a non-empty string when provided.");
  }

  return {
    url: parsedUrl.origin + parsedUrl.pathname.replace(/\/+$/, ""),
    apiKey: QDRANT_API_KEY?.trim() || undefined,
    collectionName: "skillforge_chunks_v1",
    vectorSize: 1024,
    distance: "Cosine",
  };
};

export { getQdrantConfig };
