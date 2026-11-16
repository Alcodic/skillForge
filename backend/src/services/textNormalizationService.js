export function normalizeText(text) {
  if (typeof text !== "string") {
    throw new TypeError("Text to normalize must be a string.");
  }

  return text
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(/\0/g, "")
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function normalizeExtractionResult(result) {
  if (
    !result ||
    typeof result.text !== "string" ||
    !Array.isArray(result.pages)
  ) {
    throw new TypeError("Invalid PDF extraction result.");
  }

  const pages = result.pages.map((page) => {
    if (!page || typeof page !== "object" || typeof page.text !== "string") {
      throw new TypeError("Invalid PDF extraction page.");
    }

    return {
      ...page,
      text: normalizeText(page.text),
    };
  });

  const text = pages.map((page) => page.text).join("\n\n");

  if (!text) {
    throw new Error("Normalized PDF content is empty.");
  }

  return {
    ...result,
    text,
    pages,
  };
}
