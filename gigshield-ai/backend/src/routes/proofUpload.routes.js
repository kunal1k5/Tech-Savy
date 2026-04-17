const { Router } = require("express");
const multer = require("multer");

const ProofUploadController = require("../controllers/proofUpload.controller");
const { validate } = require("../middleware/validate");
const { uploadProofSchema } = require("../services/proofUpload.service");
const { workProfileVerifySchema } = require("../services/workProfileFraud.service");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 6,
    fileSize: 5 * 1024 * 1024,
  },
});

const router = Router();

router.post(
  "/work-profile-verify",
  upload.single("file"),
  validate(workProfileVerifySchema),
  ProofUploadController.verifyWorkProfile
);

router.post(
  "/upload-proof",
  upload.fields([
    { name: "file", maxCount: 1 },
    { name: "parcelScreenshot", maxCount: 1 },
    { name: "liveSelfie", maxCount: 1 },
    { name: "workScreen", maxCount: 1 },
    { name: "geoImage", maxCount: 1 },
    { name: "workScreenshot", maxCount: 1 },
  ]),
  validate(uploadProofSchema),
  ProofUploadController.upload
);

module.exports = router;
