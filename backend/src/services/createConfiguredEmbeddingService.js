import { getEmbeddingConfig } from "../config/embedding.js";
import { createEmbeddingService } from "./embeddingService.js";
import { createVoyageEmbeddingProvider } from "./voyageEmbeddingProvider.js";

const createConfiguredEmbeddingService = ({
  env = process.env,
  fetchImpl = fetch,
} = {}) => {
  // 1. Read and validate the application's embedding configuration.
  const config = getEmbeddingConfig(env);

  // 2. Fail fast if the requested provider is not supported.
  if (config.provider !== "voyage") {
    throw new Error(`Unsupported embedding provider: "${config.provider}".`);
  }

  // 3. Create the provider adapter with the validated settings.
  const generateEmbeddings = createVoyageEmbeddingProvider({
    apiKey: env.VOYAGE_API_KEY,
    model: config.model,
    dimensions: config.dimensions,
    fetchImpl,
  });

  // 4. Inject the provider into the provider-independent service.
  const embedTexts = createEmbeddingService({
    provider: config.provider,
    model: config.model,
    dimensions: config.dimensions,
    generateEmbeddings,
  });

  // 5. Return the configured function used to generate embeddings.
  return embedTexts;
};

export { createConfiguredEmbeddingService };
