import test from "node:test";
import assert from "node:assert/strict";

import { getEmbeddingConfig } from "../src/config/embedding.js";

test("returns valid embedding configuration", () => {
  const config = getEmbeddingConfig({
    EMBEDDING_PROVIDER: "voyage",
    EMBEDDING_MODEL: "test-model",
    EMBEDDING_DIMENSIONS: "1024",
  });

  assert.deepEqual(config, {
    provider: "voyage",
    model: "test-model",
    dimensions: 1024,
  });
});

test("rejects a missing provider", () => {
  assert.throws(
    () =>
      getEmbeddingConfig({
        EMBEDDING_MODEL: "test-model",
        EMBEDDING_DIMENSIONS: "1024",
      }),
    /EMBEDDING_PROVIDER must be configured/,
  );
});

test("rejects a missing model", () => {
  assert.throws(
    () =>
      getEmbeddingConfig({
        EMBEDDING_PROVIDER: "voyage",
        EMBEDDING_DIMENSIONS: "1024",
      }),
    /EMBEDDING_MODEL must be configured/,
  );
});

test("rejects invalid dimensions", () => {
  for (const dimensions of ["abc", "0", "-1", "1.5", ""]) {
    assert.throws(
      () =>
        getEmbeddingConfig({
          EMBEDDING_PROVIDER: "voyage",
          EMBEDDING_MODEL: "test-model",
          EMBEDDING_DIMENSIONS: dimensions,
        }),
      /EMBEDDING_DIMENSIONS must be a positive integer/,
    );
  }
});
