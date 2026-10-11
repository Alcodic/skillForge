import {
  normalizeText,
  normalizeExtractionResult,
} from "../src/services/textNormalizationService.js";

const sample = "  Hello   SkillForge!  \r\n\r\n\r\n Next line.  ";

console.log("Original:", JSON.stringify(sample));
console.log("Normalized:", JSON.stringify(normalizeText(sample)));

const result = normalizeExtractionResult({
  text: "Original document text",
  pageCount: 2,
  pages: [
    { pageNumber: 1, text: "  First   page.  " },
    { pageNumber: 2, text: " Second\r\npage. " },
  ],
});

console.log("Normalized result:", JSON.stringify(result, null, 2));
