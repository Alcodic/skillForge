import mongoose from "mongoose";
import { performance } from "node:perf_hooks";

import LearningMaterial from "../models/LearningMaterial.js";
import DocumentChunk from "../models/DocumentChunk.js";

import { downloadFile } from "./storageService.js";
import { extractPdfText } from "./pdfExtractionService.js";
import { normalizeExtractionResult } from "./textNormalizationService.js";
import { chunkText } from "./textChunkingService.js";
import { createConfiguredEmbeddingService } from "./createConfiguredEmbeddingService.js";
import { createQdrantService } from "./qdrantService.js";

export const prepareMaterialForProcessing = async ({ materialId, userId }) => {
  if (!mongoose.Types.ObjectId.isValid(materialId)) {
    const error = new Error("Invalid material ID.");
    error.statusCode = 400;
    error.isPreconditionError = true;
    throw error;
  }

  const material = await LearningMaterial.findOne({
    _id: materialId,
    userId,
  });

  if (!material) {
    const error = new Error("Material not found.");
    error.statusCode = 404;
    error.isPreconditionError = true;
    throw error;
  }

  if (material.processingStatus !== "PROCESSING") {
    const error = new Error(
      "Material must be in PROCESSING status before processing.",
    );
    error.statusCode = 409;
    error.isPreconditionError = true;
    throw error;
  }

  if (!material.storageReference || material.storageReference === "PENDING") {
    const error = new Error("Material storage reference is unavailable.");
    error.statusCode = 409;
    error.isPreconditionError = true;
    throw error;
  }

  const fileBuffer = await downloadFile({
    objectKey: material.storageReference,
  });

  return {
    materialId: material._id,
    userId: material.userId,
    storageReference: material.storageReference,
    fileType: material.fileType,
    originalFileName: material.originalFileName,
    fileBuffer,
  };
};

export const cleanupStaleChunkData = async ({
  chunks,
  materialId,
  userId,
  documentChunkModel = DocumentChunk,
  qdrantService,
}) => {
  if (!Array.isArray(chunks)) {
    throw new TypeError("Chunks must be provided as an array.");
  }

  if (!qdrantService?.deletePoints) {
    throw new Error("Qdrant point deletion service is unavailable.");
  }

  const currentChunkIds = chunks.map((chunk) => chunk.chunkId);

  const staleFilter = {
    materialId,
    userId,
    chunkId: { $nin: currentChunkIds },
  };

  const staleChunks = await documentChunkModel
    .find(staleFilter)
    .select("qdrantPointId")
    .lean();

  if (staleChunks.length === 0) {
    return {
      deletedVectorCount: 0,
      deletedMetadataCount: 0,
    };
  }

  const stalePointIds = staleChunks.map((chunk) => chunk.qdrantPointId);

  if (
    !stalePointIds.every(
      (pointId) => typeof pointId === "string" && pointId.trim(),
    )
  ) {
    throw new Error("Stale chunk contains an invalid Qdrant point ID.");
  }

  // Delete vectors first. If this fails, retain MongoDB metadata.
  const deletionResult = await qdrantService.deletePoints(stalePointIds);

  if (deletionResult.deletedCount !== new Set(stalePointIds).size) {
    throw new Error("Stale Qdrant vector cleanup was incomplete.");
  }

  // Delete metadata only after successful Qdrant cleanup.
  const metadataResult = await documentChunkModel.deleteMany(staleFilter);

  return {
    deletedVectorCount: deletionResult.deletedCount,
    deletedMetadataCount: metadataResult.deletedCount,
  };
};

export const persistChunkMetadata = async ({
  chunks,
  pointIds,
  materialId,
  userId,
  documentChunkModel = DocumentChunk,
}) => {
  if (!Array.isArray(chunks)) {
    throw new TypeError("Chunks must be provided as an array.");
  }

  if (!Array.isArray(pointIds)) {
    throw new TypeError("Qdrant point IDs must be provided as an array.");
  }

  if (chunks.length !== pointIds.length) {
    throw new Error(
      "Chunk count does not match the number of Qdrant point IDs.",
    );
  }

  if (chunks.length === 0) {
    return { persistedCount: 0 };
  }

  const operations = chunks.map((chunk, index) => {
    if (!chunk?.chunkId || typeof chunk.chunkId !== "string") {
      throw new TypeError(`Chunk at index ${index} is missing its chunk ID.`);
    }

    const pointId = pointIds[index];

    if (typeof pointId !== "string" || !pointId.trim()) {
      throw new TypeError(`Qdrant point ID at index ${index} is missing.`);
    }

    if (
      !Number.isInteger(chunk.sequence) ||
      !Number.isInteger(chunk.startOffset) ||
      !Number.isInteger(chunk.endOffset)
    ) {
      throw new TypeError("Chunk sequence and offsets must be integers.");
    }

    const document = {
      chunkId: chunk.chunkId,
      materialId,
      userId,
      sequence: chunk.sequence,
      startOffset: chunk.startOffset,
      endOffset: chunk.endOffset,
      text: chunk.text,
      qdrantPointId: pointId,
    };

    if (chunk.source !== undefined) {
      document.source = {
        pageStart: chunk.source.pageStart,
        pageEnd: chunk.source.pageEnd,
      };
    }

    return {
      updateOne: {
        filter: {
          chunkId: chunk.chunkId,
          materialId,
          userId,
        },
        update: { $set: document },
        upsert: true,
      },
    };
  });

  await documentChunkModel.bulkWrite(operations, { ordered: true });

  return { persistedCount: operations.length };
};

const markMaterialReady = async ({ materialId, userId }) => {
  return LearningMaterial.updateOne(
    {
      _id: materialId,
      userId,
      processingStatus: "PROCESSING",
    },
    {
      $set: {
        processingStatus: "READY",
        "processingError.stage": null,
        "processingError.message": null,
        "processingError.failedAt": null,
      },
    },
  );
};

const emitProcessingLog = (logger, level, details) => {
  try {
    if (typeof logger?.[level] !== "function") {
      return;
    }

    logger[level]({
      timestamp: new Date().toISOString(),
      level,
      ...details,
    });
  } catch {
    // Logging must never interrupt document processing.
  }
};

const recordMaterialProcessingFailure = async ({
  materialId,
  userId,
  stage,
}) => {
  const safeFailureMessages = {
    PREPARATION: "Material preparation failed.",
    TEXT_EXTRACTION: "PDF text extraction failed.",
    TEXT_NORMALIZATION: "Extracted text normalization failed.",
    CHUNKING: "Document chunk generation failed.",
    EMBEDDING_GENERATION: "Document embedding generation failed.",
    VECTOR_PERSISTENCE: "Vector database persistence failed.",
    METADATA_PERSISTENCE: "Document chunk metadata persistence failed.",
    STALE_DATA_CLEANUP: "Stale document chunk cleanup failed.",
    READY_TRANSITION: "Material could not transition to READY status.",
  };

  const message = safeFailureMessages[stage] ?? "Document processing failed.";

  return LearningMaterial.updateOne(
    {
      _id: materialId,
      userId,
      processingStatus: "PROCESSING",
    },
    {
      $set: {
        processingStatus: "FAILED",
        "processingError.stage": stage,
        "processingError.message": message,
        "processingError.failedAt": new Date(),
      },
    },
  );
};

/**
 * Runs the document processing pipeline through chunk metadata persistence.
 *
 * Dependencies can be injected in tests to avoid external services.
 */

export const processMaterialDocument = async ({
  materialId,
  userId,
  embedTexts,
  qdrantService,
  documentChunkModel = DocumentChunk,
  prepareMaterial = prepareMaterialForProcessing,
  extractPdfTextFn = extractPdfText,
  normalizeExtractionResultFn = normalizeExtractionResult,
  chunkTextFn = chunkText,
  persistChunkMetadataFn = persistChunkMetadata,
  updateMaterialStatusFn = markMaterialReady,
  recordProcessingFailureFn = recordMaterialProcessingFailure,
  cleanupStaleChunkDataFn = cleanupStaleChunkData,
  logger = console,
}) => {
  let currentStage = "PREPARATION";

  const logDetails = {
    materialId: String(materialId),
  };

  const runStage = async (stage, operation) => {
    currentStage = stage;

    const startedAt = performance.now();

    emitProcessingLog(logger, "info", {
      ...logDetails,
      event: "STAGE_STARTED",
      stage,
    });

    try {
      const result = await operation();

      emitProcessingLog(logger, "info", {
        ...logDetails,
        event: "STAGE_COMPLETED",
        stage,
        durationMs: Number((performance.now() - startedAt).toFixed(2)),
      });

      return result;
    } catch (error) {
      if (error.isPreconditionError !== true) {
        emitProcessingLog(logger, "error", {
          ...logDetails,
          event: "STAGE_FAILED",
          stage,
          durationMs: Number((performance.now() - startedAt).toFixed(2)),
          errorName: typeof error.name === "string" ? error.name : "Error",
        });
      }

      throw error;
    }
  };

  emitProcessingLog(logger, "info", {
    ...logDetails,
    event: "PROCESSING_STARTED",
  });

  try {
    const processingInput = await runStage("PREPARATION", () =>
      prepareMaterial({
        materialId,
        userId,
      }),
    );

    const extraction = await runStage("TEXT_EXTRACTION", () =>
      extractPdfTextFn(processingInput.fileBuffer),
    );

    const normalizedExtraction = await runStage("TEXT_NORMALIZATION", () =>
      normalizeExtractionResultFn(extraction),
    );

    const chunks = await runStage("CHUNKING", () => {
      const generatedChunks = chunkTextFn(normalizedExtraction.text, {
        materialId: String(processingInput.materialId),
        userId: String(processingInput.userId),
        pages: normalizedExtraction.pages,
      });

      if (generatedChunks.length === 0) {
        const error = new Error(
          "Document processing produced no usable chunks.",
        );

        error.statusCode = 422;

        throw error;
      }

      return generatedChunks;
    });

    const embeddedChunks = await runStage("EMBEDDING_GENERATION", async () => {
      const resolvedEmbedTexts =
        embedTexts ?? createConfiguredEmbeddingService();

      const embeddingResult = await resolvedEmbedTexts(
        chunks.map((chunk) => chunk.text),
      );

      const embeddings = embeddingResult?.embeddings;

      if (!Array.isArray(embeddings) || embeddings.length !== chunks.length) {
        throw new Error(
          "Embedding count must match the number of document chunks.",
        );
      }

      return chunks.map((chunk, index) => ({
        ...chunk,
        embedding: embeddings[index],
      }));
    });

    const resolvedQdrantService = qdrantService ?? createQdrantService();

    const qdrantResult = await runStage("VECTOR_PERSISTENCE", async () => {
      const result = await resolvedQdrantService.persistChunks(embeddedChunks);

      if (
        !Array.isArray(result?.pointIds) ||
        result.pointIds.length !== chunks.length
      ) {
        throw new Error(
          "Qdrant point ID count must match the number of document chunks.",
        );
      }

      if (result.persistedCount !== chunks.length) {
        throw new Error(
          "Qdrant persisted count must match the number of document chunks.",
        );
      }

      return result;
    });

    const metadataResult = await runStage("METADATA_PERSISTENCE", async () => {
      const result = await persistChunkMetadataFn({
        chunks,
        pointIds: qdrantResult.pointIds,
        materialId: String(processingInput.materialId),
        userId: String(processingInput.userId),
        documentChunkModel,
      });

      if (result.persistedCount !== chunks.length) {
        throw new Error(
          "Persisted metadata count must match the number of document chunks.",
        );
      }

      return result;
    });

    const cleanupResult = await runStage("STALE_DATA_CLEANUP", () =>
      cleanupStaleChunkDataFn({
        chunks,
        materialId: String(processingInput.materialId),
        userId: String(processingInput.userId),
        documentChunkModel,
        qdrantService: resolvedQdrantService,
      }),
    );

    await runStage("READY_TRANSITION", async () => {
      const readyUpdate = await updateMaterialStatusFn({
        materialId,
        userId,
      });

      if (readyUpdate?.matchedCount !== 1) {
        const error = new Error(
          "Material could not be marked as READY because it is no longer in PROCESSING state.",
        );

        error.statusCode = 409;

        throw error;
      }
    });

    const result = {
      materialId: String(processingInput.materialId),
      processingStatus: "READY",
      chunkCount: chunks.length,
      vectorCount: qdrantResult.persistedCount,
      metadataCount: metadataResult.persistedCount,
      deletedVectorCount: cleanupResult.deletedVectorCount,
      deletedMetadataCount: cleanupResult.deletedMetadataCount,
    };

    emitProcessingLog(logger, "info", {
      ...logDetails,
      event: "PROCESSING_COMPLETED",
      processingStatus: "READY",
      chunkCount: result.chunkCount,
      vectorCount: result.vectorCount,
      metadataCount: result.metadataCount,
    });

    return result;
  } catch (error) {
    // Request and precondition errors must not mark a material as FAILED.
    const isPreconditionError = error.isPreconditionError === true;

    if (!isPreconditionError) {
      try {
        await recordProcessingFailureFn({
          materialId,
          userId,
          stage: currentStage,
        });
      } catch (recordingError) {
        emitProcessingLog(logger, "error", {
          ...logDetails,
          event: "FAILURE_RECORDING_FAILED",
          stage: currentStage,
          errorName:
            typeof recordingError.name === "string"
              ? recordingError.name
              : "Error",
        });
      }
    }

    // Preserve the original processing error for the controller.
    throw error;
  }
};
