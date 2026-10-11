import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

const extractPdfText = async (pdfBuffer) => {
  if (!Buffer.isBuffer(pdfBuffer)) {
    throw new TypeError("PDF input must be a Node.js Buffer.");
  }

  if (pdfBuffer.length === 0) {
    throw new Error("Cannot extract text from an empty PDF buffer.");
  }

  const pages = [];

  const pdfData = await pdfParse(pdfBuffer, {
    pagerender: async (pageData) => {
      const textContent = await pageData.getTextContent({
        normalizeWhitespace: false,
        disableCombineTextItems: false,
      });

      console.log("\n--- PDF TEXT ITEM DIAGNOSTICS ---");

      for (const item of textContent.items) {
        if (
          typeof item.str === "string" &&
          /JavaScript|React\.js|TypeScript|Node\.js|MongoDB|SkillForge/.test(
            item.str,
          )
        ) {
          console.log({
            text: item.str,
            x: item.transform[4],
            y: item.transform[5],
            width: item.width,
          });
        }
      }

      let previousItem;
      let pageText = "";

      for (const item of textContent.items) {
        if (typeof item.str !== "string" || item.str.length === 0) {
          continue;
        }

        const x = item.transform[4];
        const y = item.transform[5];

        if (previousItem) {
          const previousY = previousItem.transform[5];
          const previousEndX = previousItem.transform[4] + previousItem.width;

          // A meaningful vertical change indicates a new line.
          if (Math.abs(y - previousY) > 2) {
            pageText += "\n";
          } else {
            // Reconstruct a missing word separator from horizontal geometry.
            const horizontalGap = x - previousEndX;

            if (
              horizontalGap > 1.5 &&
              !pageText.endsWith(" ") &&
              !pageText.endsWith("\n") &&
              !item.str.startsWith(" ")
            ) {
              pageText += " ";
            }
          }
        }

        pageText += item.str;

        // Respect explicit line-ending information when available.
        if (item.hasEOL) {
          pageText += "\n";
        }

        previousItem = item;
      }

      pages.push({
        pageNumber: pageData.pageNumber,
        text: pageText,
      });

      return pageText;
    },
  });

  const text = pages.map((page) => page.text).join("\n\n");

  if (!text.trim()) {
    throw new Error("PDF contains no extractable text.");
  }

  return {
    text,
    pageCount: pdfData.numpages,
    pages,
  };
};

export { extractPdfText };
