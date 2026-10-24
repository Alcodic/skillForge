import { createConfiguredEmbeddingService } from "../services/createConfiguredEmbeddingService.js";

const runLiveEmbeddingSmokeTest = async () => {
  console.log("Starting live Voyage AI embedding smoke test...\n");

  const embedTexts = createConfiguredEmbeddingService();

  const input = [
    "SkillForge transforms learning materials into personalized learning experiences.",
  ];

  const result = await embedTexts(input);
  const { embeddings, model } = result;

  if (embeddings.length !== input.length) {
    throw new Error(
      `Expected ${input.length} embedding, received ${embeddings.length}.`,
    );
  }

  const vector = embeddings[0];

  if (vector.length !== model.dimensions) {
    throw new Error(
      `Expected ${model.dimensions} dimensions, received ${vector.length}.`,
    );
  }

  if (!vector.every(Number.isFinite)) {
    throw new Error("The embedding contains invalid numeric values.");
  }

  console.log("LIVE VOYAGE EMBEDDING TEST: PASSED");
  console.log({
    provider: model.provider,
    model: model.name,
    embeddingCount: embeddings.length,
    expectedDimensions: model.dimensions,
    actualDimensions: vector.length,
    allValuesFinite: true,
  });
};

try {
  await runLiveEmbeddingSmokeTest();
} catch (error) {
  console.error("\nLIVE VOYAGE EMBEDDING TEST: FAILED");
  console.error(error.message);
  process.exitCode = 1;
}
