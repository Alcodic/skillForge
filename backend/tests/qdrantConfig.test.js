import test from "node:test";
import assert from "node:assert/strict";

import { getQdrantConfig } from "../src/config/qdrant.js";

test("returns the SkillForge Qdrant configuration", () => {
  const config = getQdrantConfig({
    QDRANT_URL: "http://localhost:6333",
  });

  assert.equal(config.url, "http://localhost:6333");
  assert.equal(config.collectionName, "skillforge_chunks_v1");
  assert.equal(config.vectorSize, 1024);
  assert.equal(config.distance, "Cosine");
  assert.equal(config.apiKey, undefined);
});

test("accepts a configured API key", () => {
  const config = getQdrantConfig({
    QDRANT_URL: "https://qdrant.example.com",
    QDRANT_API_KEY: " test-key ",
  });

  assert.equal(config.apiKey, "test-key");
});

test("rejects a missing URL", () => {
  assert.throws(() => getQdrantConfig({}), /QDRANT_URL must be configured/);
});

test("rejects an invalid URL", () => {
  assert.throws(
    () => getQdrantConfig({ QDRANT_URL: "not-a-url" }),
    /valid URL/,
  );
});

test("rejects an unsupported URL protocol", () => {
  assert.throws(
    () => getQdrantConfig({ QDRANT_URL: "ftp://localhost:6333" }),
    /HTTP or HTTPS/,
  );
});

test("rejects a blank API key when supplied", () => {
  assert.throws(
    () =>
      getQdrantConfig({
        QDRANT_URL: "http://localhost:6333",
        QDRANT_API_KEY: " ",
      }),
    /non-empty string/,
  );
});
