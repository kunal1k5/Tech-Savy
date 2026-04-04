const { Router } = require("express");
const multer = require("multer");

const ProofUploadController = require("../controllers/proofUpload.controller");
const { validate } = require("../middleware/validate");
const { uploadProofSchema } = require("../services/proofUpload.service");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 2,
    fileSize: 5 * 1024 * 1024,
  },
});

const router = Router();

router.post(
  "/upload-proof",
  upload.fields([
    { name: "geoImage", maxCount: 1 },
    { name: "workScreenshot", maxCount: 1 },
  ]),
  validate(uploadProofSchema),
  ProofUploadController.upload
);

module.exports = router;
