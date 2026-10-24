import "dotenv/config";

import { createQdrantService } from "../services/qdrantService.js";

const initializeQdrant = async () => {
  const qdrantService = createQdrantService();

  const result = await qdrantService.initializeCollection();

  console.log("Qdrant initialized successfully.");
  console.log(JSON.stringify(result, null, 2));
};

initializeQdrant().catch((error) => {
  console.error("Failed to initialize Qdrant:", error.message);
  process.exitCode = 1;
});
