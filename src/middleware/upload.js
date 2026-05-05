import multer from "multer";

const ALLOWED_MIMETYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIMETYPES.has(file.mimetype)) {
      cb(null, true);
      return;
    }

    cb(new Error(`Tipo di file non supportato: ${file.mimetype}`));
  },
});

export function uploadDocumentFile(req, res, next) {
  upload.single("file")(req, res, (error) => {
    if (!error) return next();

    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ error: "File troppo grande. Limite massimo: 10MB." });
      }
      return res.status(400).json({ error: error.message });
    }

    return res.status(400).json({ error: error.message || "Upload non valido." });
  });
}

export default upload;
