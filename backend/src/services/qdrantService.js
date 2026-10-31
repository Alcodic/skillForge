import { QdrantClient } from "@qdrant/js-client-rest";
import { createHash } from "node:crypto";

import { getQdrantConfig } from "../config/qdrant.js";

const REQUIRED_PAYLOAD_INDEXES = ["userId", "materialId"];

const UUID_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

const createDeterministicUuid = (value) => {
  const namespaceBytes = Buffer.from(UUID_NAMESPACE.replaceAll("-", ""), "hex");

  const valueBytes = Buffer.from(value, "utf8");

  const hash = createHash("sha1")
    .update(namespaceBytes)
    .update(valueBytes)
    .digest();

  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;

  const hex = hash.subarray(0, 16).toString("hex");

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
};

const createQdrantService = ({ client, config } = {}) => {
  const resolvedConfig = config ?? getQdrantConfig();

  const resolvedClient =
    client ??
    new QdrantClient({
      url: resolvedConfig.url,
      apiKey: resolvedConfig.apiKey,
    });

  const initializeCollection = async () => {
    const { collections } = await resolvedClient.getCollections();

    const collectionExists = collections.some(
      (collection) => collection.name === resolvedConfig.collectionName,
    );

    if (!collectionExists) {
      await resolvedClient.createCollection(resolvedConfig.collectionName, {
        vectors: {
          size: resolvedConfig.vectorSize,
          distance: resolvedConfig.distance,
        },
      });
    }

    const collection = await resolvedClient.getCollection(
      resolvedConfig.collectionName,
    );

    const vectors = collection.config?.params?.vectors;

    if (
      !vectors ||
      typeof vectors.size !== "number" ||
      typeof vectors.distance !== "string"
    ) {
      throw new Error(
        `Qdrant collection "${resolvedConfig.collectionName}" ` +
          "does not have the expected unnamed vector configuration.",
      );
    }

    if (
      vectors.size !== resolvedConfig.vectorSize ||
      vectors.distance.toLowerCase() !== resolvedConfig.distance.toLowerCase()
    ) {
      throw new Error(
        `Qdrant collection "${resolvedConfig.collectionName}" has an ` +
          `incompatible vector configuration. Expected size ` +
          `${resolvedConfig.vectorSize} and distance ` +
          `${resolvedConfig.distance}; received size ${vectors.size} ` +
          `and distance ${vectors.distance}.`,
      );
    }

    for (const fieldName of REQUIRED_PAYLOAD_INDEXES) {
      const existingIndex = collection.payload_schema?.[fieldName];

      if (existingIndex) {
        const existingType = existingIndex.data_type ?? existingIndex.type;

        if (existingType && existingType.toLowerCase() !== "keyword") {
          throw new Error(
            `Qdrant payload index "${fieldName}" must use ` +
              `the keyword type; found "${existingType}".`,
          );
        }

        continue;
      }

      await resolvedClient.createPayloadIndex(resolvedConfig.collectionName, {
        field_name: fieldName,
        field_schema: "keyword",
      });
    }

    return {
      collectionName: resolvedConfig.collectionName,
      vectorSize: resolvedConfig.vectorSize,
      distance: resolvedConfig.distance,
      payloadIndexes: [...REQUIRED_PAYLOAD_INDEXES],
    };
  };

  const persistChunks = async (chunks) => {
    if (!Array.isArray(chunks)) {
      throw new TypeError("Chunks must be provided as an array.");
    }

    if (chunks.length === 0) {
      return { persistedCount: 0 };
    }

    const points = chunks.map((chunk) => {
      if (!chunk || typeof chunk !== "object") {
        throw new TypeError("Each chunk must be an object.");
      }

      const requiredStringFields = ["chunkId", "text", "materialId", "userId"];

      for (const field of requiredStringFields) {
        if (typeof chunk[field] !== "string" || !chunk[field].trim()) {
          throw new TypeError(
            `Chunk field "${field}" must be a non-empty string.`,
          );
        }
      }

      if (!Number.isInteger(chunk.sequence) || chunk.sequence < 0) {
        throw new TypeError("Chunk sequence must be a non-negative integer.");
      }

      if (
        !Number.isInteger(chunk.startOffset) ||
        !Number.isInteger(chunk.endOffset) ||
        chunk.startOffset < 0 ||
        chunk.endOffset < chunk.startOffset
      ) {
        throw new TypeError(
          "Chunk offsets must be valid non-negative integers.",
        );
      }

      if (!Array.isArray(chunk.embedding)) {
        throw new TypeError("Chunk embedding must be an array.");
      }

      if (chunk.embedding.length !== resolvedConfig.vectorSize) {
        throw new Error(
          `Chunk embedding must contain ${resolvedConfig.vectorSize} dimensions.`,
        );
      }

      if (
        !chunk.embedding.every(
          (value) => typeof value === "number" && Number.isFinite(value),
        )
      ) {
        throw new TypeError(
          "Chunk embedding must contain only finite numbers.",
        );
      }

      const payload = {
        chunkId: chunk.chunkId,
        sequence: chunk.sequence,
        text: chunk.text,
        startOffset: chunk.startOffset,
        endOffset: chunk.endOffset,
        materialId: chunk.materialId,
        userId: chunk.userId,
      };

      if (chunk.source !== undefined) {
        payload.source = chunk.source;
      }

      return {
        id: createDeterministicUuid(chunk.chunkId),
        vector: chunk.embedding,
        payload,
      };
    });

    const result = await resolvedClient.upsert(resolvedConfig.collectionName, {
      wait: true,
      points,
    });

    return {
      persistedCount: points.length,
      result,
    };
  };

  return { initializeCollection, persistChunks };
};

export { createQdrantService };
