import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { extractPdfText } from "../src/services/pdfExtractionService.js";
import { normalizeExtractionResult } from "../src/services/textNormalizationService.js";

const pdfBuffer = await readFile(
  "/Users/avinashkaushal/Downloads/Documents/4month-plan.pdf",
);

const result = await extractPdfText(pdfBuffer);

const normalizedResult = normalizeExtractionResult(result);

const searchTerm = "Current Foundation";

const rawIndex = result.text.indexOf(searchTerm);
const normalizedIndex = normalizedResult.text.indexOf(searchTerm);

console.log("\n--- RAW EXTRACTION ---");
console.log(
  JSON.stringify(result.text.slice(rawIndex, rawIndex + 250), null, 2),
);

console.log("\n--- NORMALIZED EXTRACTION ---");
console.log(
  JSON.stringify(
    normalizedResult.text.slice(normalizedIndex, normalizedIndex + 250),
    null,
    2,
  ),
);

// Verify page count is preserved.
assert.equal(normalizedResult.pageCount, result.pageCount);

// Verify page numbers and ordering are preserved.
assert.deepEqual(
  normalizedResult.pages.map((page) => page.pageNumber),
  result.pages.map((page) => page.pageNumber),
);

// Verify complete text matches normalized page text.
assert.equal(
  normalizedResult.text,
  normalizedResult.pages.map((page) => page.text).join("\n\n"),
);

console.log("PDF normalization assertions passed.");

console.log(
  "Normalized PDF result:",
  JSON.stringify(normalizedResult, null, 2),
);

console.log("Page count:", normalizedResult.pageCount);
console.log("Pages extracted:", normalizedResult.pages.length);
console.log("Total characters:", normalizedResult.text.length);

console.log("\nFirst normalized page preview:\n");
console.log(normalizedResult.pages[0]?.text.slice(0, 500));

console.log("\nComplete normalized text preview:\n");
console.log(normalizedResult.text.slice(0, 1000));
