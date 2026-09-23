import multer from "multer";

const storage = multer.memoryStorage();

const allowedMimeTypes = ["application/pdf"];

const upload = multer({
  storage,

  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
  },

  fileFilter: (req, file, cb) => {
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(
        new Error("Unsupported file type. Only PDF files are allowed."),
      );
    }

    cb(null, true);
  },
});

export const uploadSingleFile = upload.single("file");
