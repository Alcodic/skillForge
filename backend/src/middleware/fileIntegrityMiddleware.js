export const validatePdfIntegrity = (req, res, next) => {
  if (!req.file) {
    return next();
  }

  const fileHeader = req.file.buffer
    .subarray(0, 5)
    .toString("utf8");

  if (fileHeader !== "%PDF-") {
    return res.status(400).json({
      success: false,
      message: "Invalid PDF file.",
    });
  }

  next();
};