import { createHash } from "node:crypto";

const DEFAULT_TARGET_SIZE = 2000;
const DEFAULT_OVERLAP = 300;

// Creates a deterministic SHA-256 hash.
const createHashId = (value) =>
  createHash("sha256").update(value).digest("hex");

// Generates a stable identity for the document being chunked.
const getDocumentIdentity = (text, materialId) => {
  if (materialId !== undefined) {
    if (typeof materialId !== "string" || materialId.trim().length === 0) {
      throw new TypeError("Material ID must be a non-empty string.");
    }

    return `material:${materialId}`;
  }

  // If no material ID is supplied, identify the document by its full content.
  return `content:${createHashId(text)}`;
};

// Builds a chunk and attaches its identity and position.
const createChunk = ({
  text,
  sequence,
  startOffset,
  endOffset,
  documentIdentity,
  materialId,
  userId,
  source,
}) => {
  const chunkId = createHashId(
    JSON.stringify({
      documentIdentity,
      sequence,
      startOffset,
      endOffset,
      text,
    }),
  );

  const chunk = {
    chunkId,
    sequence,
    text,
    startOffset,
    endOffset,
  };

  if (source) {
    chunk.source = source;
  }

  if (materialId !== undefined && userId !== undefined) {
    chunk.materialId = materialId;
    chunk.userId = userId;
  }

  return chunk;
};

const findLastBoundary = (text, minEnd, maxEnd, pattern) => {
  let boundary = null;
  pattern.lastIndex = 0;

  let match;

  while ((match = pattern.exec(text)) !== null) {
    const candidateEnd = match.index + match[0].length;

    if (candidateEnd > maxEnd) {
      break;
    }

    if (candidateEnd >= minEnd) {
      boundary = candidateEnd;
    }
  }

  return boundary;
};

const getPageRanges = (text, pages) => {
  if (!Array.isArray(pages)) {
    throw new TypeError("Pages must be an array.");
  }

  const reconstructedText = pages
    .map((page) => {
      if (
        !page ||
        !Number.isInteger(page.pageNumber) ||
        page.pageNumber < 1 ||
        typeof page.text !== "string"
      ) {
        throw new TypeError(
          "Each page must have a positive page number and text string.",
        );
      }

      return page.text;
    })
    .join("\n\n");

  if (reconstructedText !== text) {
    throw new TypeError(
      "Page text must match the document text being chunked.",
    );
  }

  let offset = 0;

  return pages.map((page, index) => {
    const startOffset = offset;
    const endOffset = startOffset + page.text.length;

    offset = endOffset;

    if (index < pages.length - 1) {
      offset += 2; // Account for the "\n\n" page separator.
    }

    return {
      pageNumber: page.pageNumber,
      startOffset,
      endOffset,
    };
  });
};

const getSourceMetadata = (startOffset, endOffset, pageRanges) => {
  if (!pageRanges) {
    return undefined;
  }

  const overlappingPages = pageRanges.filter(
    (page) => startOffset < page.endOffset && endOffset > page.startOffset,
  );

  if (overlappingPages.length === 0) {
    return undefined;
  }

  return {
    pageStart: overlappingPages[0].pageNumber,
    pageEnd: overlappingPages[overlappingPages.length - 1].pageNumber,
  };
};

const chunkText = (
  text,
  {
    targetSize = DEFAULT_TARGET_SIZE,
    overlap = DEFAULT_OVERLAP,
    materialId,
    userId,
    pages,
  } = {},
) => {
  if (typeof text !== "string") {
    throw new TypeError("Text input must be a string.");
  }

  if (!Number.isInteger(targetSize) || targetSize < 2) {
    throw new RangeError("Target size must be an integer of at least 2.");
  }

  if (!Number.isInteger(overlap) || overlap < 0 || overlap >= targetSize / 2) {
    throw new RangeError(
      "Overlap must be a non-negative integer smaller than half the target size.",
    );
  }

  const hasMaterialId = materialId !== undefined;
  const hasUserId = userId !== undefined;

  if (hasMaterialId !== hasUserId) {
    throw new TypeError("Material ID and user ID must be provided together.");
  }

  if (
    hasMaterialId &&
    (typeof materialId !== "string" || materialId.trim().length === 0)
  ) {
    throw new TypeError("Material ID must be a non-empty string.");
  }

  if (hasUserId && (typeof userId !== "string" || userId.trim().length === 0)) {
    throw new TypeError("User ID must be a non-empty string.");
  }

  const pageRanges =
    pages === undefined ? undefined : getPageRanges(text, pages);

  if (text.length === 0) {
    return [];
  }

  const documentIdentity = getDocumentIdentity(text, materialId);

  if (text.length <= targetSize) {
    return [
      createChunk({
        text,
        sequence: 0,
        startOffset: 0,
        endOffset: text.length,
        documentIdentity,
        materialId,
        userId,
        source: getSourceMetadata(0, text.length, pageRanges),
      }),
    ];
  }

  const chunks = [];
  let startOffset = 0;

  while (startOffset < text.length) {
    const hardEnd = Math.min(startOffset + targetSize, text.length);

    if (hardEnd === text.length) {
      chunks.push(
        createChunk({
          text: text.slice(startOffset, hardEnd),
          sequence: chunks.length,
          startOffset,
          endOffset: hardEnd,
          documentIdentity,
          materialId,
          userId,
          source: getSourceMetadata(startOffset, hardEnd, pageRanges),
        }),
      );

      break;
    }

    // Search the latter half of the target window for a good boundary.
    const minEnd = startOffset + Math.floor(targetSize / 2);

    // Priority 1: paragraph boundary.
    let endOffset = findLastBoundary(text, minEnd, hardEnd, /\n{2,}/g);

    // Priority 2: sentence boundary.
    if (endOffset === null) {
      endOffset = findLastBoundary(
        text,
        minEnd,
        hardEnd,
        /[.!?](?:["')\]]*)?(?=\s|$)/g,
      );
    }

    // Priority 3: hard split at the target limit.
    if (endOffset === null) {
      endOffset = hardEnd;
    }

    chunks.push(
      createChunk({
        text: text.slice(startOffset, endOffset),
        sequence: chunks.length,
        startOffset,
        endOffset,
        documentIdentity,
        materialId,
        userId,
        source: getSourceMetadata(startOffset, endOffset, pageRanges),
      }),
    );

    // Begin the next chunk inside the previous chunk to create overlap.
    startOffset = endOffset - overlap;
  }

  return chunks;
};

export { chunkText };
