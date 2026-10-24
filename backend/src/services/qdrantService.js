import { QdrantClient } from "@qdrant/js-client-rest";

import { getQdrantConfig } from "../config/qdrant.js";

const REQUIRED_PAYLOAD_INDEXES = ["userId", "materialId"];

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

  return { initializeCollection };
};

export { createQdrantService };
