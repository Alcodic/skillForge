
import test from "node:test";
import assert from "node:assert/strict";

import { createVoyageEmbeddingProvider } from "../src/services/voyageEmbeddingProvider.js";

const API_KEY = "test-voyage-api-key";
const MODEL = "voyage-4-lite";
const DIMENSIONS = 3;

const createTestProvider = (overrides = {}) =>
  createVoyageEmbeddingProvider({
    apiKey: API_KEY,
    model: MODEL,
    dimensions: DIMENSIONS,
    ...overrides,
  });

const createResponse = (data, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => ({ data }),
});

const createEmbedding = (index, embedding) => ({
  index,
  embedding,
});

test("sends the expected request and returns embeddings", async () => {
  let capturedRequest;

  const generateEmbeddings = createTestProvider({
    fetchImpl: async (url, options) => {
      capturedRequest = { url, options };

      return createResponse([
        createEmbedding(0, [0.1, 0.2, 0.3]),
        createEmbedding(1, [0.4, 0.5, 0.6]),
      ]);
    },
  });

  const result = await generateEmbeddings(["First text", "Second text"]);

  assert.deepEqual(result, [
    [0.1, 0.2, 0.3],
    [0.4, 0.5, 0.6],
  ]);

  assert.equal(
    capturedRequest.url,
    "https://api.voyageai.com/v1/embeddings",
  );

  assert.equal(capturedRequest.options.method, "POST");

  assert.equal(
    capturedRequest.options.headers.Authorization,
    `Bearer ${API_KEY}`,
  );

  assert.deepEqual(JSON.parse(capturedRequest.options.body), {
    input: ["First text", "Second text"],
    model: MODEL,
    input_type: "document",
    output_dimension: DIMENSIONS,
    output_dtype: "float",
    truncation: false,
  });
});

test("preserves input order when API results arrive out of order", async () => {
  const generateEmbeddings = createTestProvider({
    fetchImpl: async () =>
      createResponse([
        createEmbedding(1, [0.4, 0.5, 0.6]),
        createEmbedding(0, [0.1, 0.2, 0.3]),
      ]),
  });

  const result = await generateEmbeddings(["First", "Second"]);

  assert.deepEqual(result, [
    [0.1, 0.2, 0.3],
    [0.4, 0.5, 0.6],
  ]);
});

test("returns an empty array without making an API request", async () => {
  let fetchCalled = false;

  const generateEmbeddings = createTestProvider({
    fetchImpl: async () => {
      fetchCalled = true;
      throw new Error("Fetch should not be called");
    },
  });

  const result = await generateEmbeddings([]);

  assert.deepEqual(result, []);
  assert.equal(fetchCalled, false);
});

test("rejects missing API credentials", () => {
  assert.throws(
    () => createTestProvider({ apiKey: "" }),
    /VOYAGE_API_KEY/,
  );
});

test("rejects invalid model configuration", () => {
  assert.throws(
    () => createTestProvider({ model: "" }),
    /Model must be a non-empty string/,
  );

  assert.throws(
    () => createTestProvider({ dimensions: 0 }),
    /Dimensions must be a positive integer/,
  );

  assert.throws(
    () => createTestProvider({ dimensions: 3.5 }),
    /Dimensions must be a positive integer/,
  );

  assert.throws(
    () => createTestProvider({ fetchImpl: null }),
    /fetchImpl must be a function/,
  );
});

test("rejects API responses with the wrong embedding count", async () => {
  const generateEmbeddings = createTestProvider({
    fetchImpl: async () =>
      createResponse([createEmbedding(0, [0.1, 0.2, 0.3])]),
  });

  await assert.rejects(
    generateEmbeddings(["First", "Second"]),
    /number of embeddings/i,
  );
});

test("rejects invalid embedding indices", async () => {
  const generateEmbeddings = createTestProvider({
    fetchImpl: async () =>
      createResponse([
        createEmbedding(0, [0.1, 0.2, 0.3]),
        createEmbedding(0, [0.4, 0.5, 0.6]),
      ]),
  });

  await assert.rejects(
    generateEmbeddings(["First", "Second"]),
    /invalid embedding indices/i,
  );
});

test("rejects embedding vectors with incorrect dimensions", async () => {
  const generateEmbeddings = createTestProvider({
    fetchImpl: async () =>
      createResponse([createEmbedding(0, [0.1, 0.2])]),
  });

  await assert.rejects(
    generateEmbeddings(["Some text"]),
    /invalid embedding vector/i,
  );
});

test("rejects non-finite embedding values", async () => {
  const generateEmbeddings = createTestProvider({
    fetchImpl: async () =>
      createResponse([createEmbedding(0, [0.1, NaN, 0.3])]),
  });

  await assert.rejects(
    generateEmbeddings(["Some text"]),
    /invalid embedding vector/i,
  );
});

test("rejects unsuccessful API responses", async () => {
  const generateEmbeddings = createTestProvider({
    fetchImpl: async () => createResponse([], 429),
  });

  await assert.rejects(
    generateEmbeddings(["Some text"]),
    /HTTP 429/,
  );
});

test("splits large input into batches and preserves overall order", async () => {
  const receivedBatches = [];

  const generateEmbeddings = createTestProvider({
    batchSize: 2,
    fetchImpl: async (_url, options) => {
      const body = JSON.parse(options.body);
      receivedBatches.push(body.input);

      return createResponse(
        body.input.map((text, index) => {
          const globalIndex = Number(text.replace("Text ", ""));

          return createEmbedding(index, [
            globalIndex,
            globalIndex + 0.1,
            globalIndex + 0.2,
          ]);
        }),
      );
    },
  });

  const texts = ["Text 0", "Text 1", "Text 2"];
  const result = await generateEmbeddings(texts);

  assert.deepEqual(receivedBatches, [
    ["Text 0", "Text 1"],
    ["Text 2"],
  ]);

  assert.deepEqual(result, [
    [0, 0.1, 0.2],
    [1, 1.1, 1.2],
    [2, 2.1, 2.2],
  ]);
});

test("rejects requests that time out", async () => {
  const generateEmbeddings = createTestProvider({
    timeoutMs: 10,
    fetchImpl: async (_url, { signal }) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener(
          "abort",
          () => reject(new Error("Request aborted")),
          { once: true },
        );
      }),
  });

  await assert.rejects(
    generateEmbeddings(["Some text"]),
    /timed out/i,
  );
});
