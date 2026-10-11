const normalizeText = (text) => {
  if (typeof text !== "string") {
    throw new TypeError("Text input must be a string.");
  }

  return text
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

const normalizeExtractionResult = (result) => {
  if (
    !result ||
    typeof result.text !== "string" ||
    !Array.isArray(result.pages)
  ) {
    throw new TypeError("Invalid PDF extraction result.");
  }

  const pages = result.pages.map((page) => ({
    ...page,
    text: normalizeText(page.text),
  }));

  const text = pages.map((page) => page.text).join("\n\n");

  return {
    ...result,
    text,
    pages,
  };
};

export { normalizeText, normalizeExtractionResult };
