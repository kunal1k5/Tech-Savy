const { Router } = require("express");
const { sendSuccess } = require("../utils/apiResponse");

const router = Router();

router.get("/test-flow", (_req, res) => {
  return sendSuccess(
    res,
    {
      status: "ok",
    },
    "System stable."
  );
});

module.exports = router;
