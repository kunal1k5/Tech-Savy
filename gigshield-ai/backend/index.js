const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

[
  path.resolve(__dirname, ".env"),
  path.resolve(__dirname, "../.env"),
].forEach((envPath) => {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
});

const app = require("./src/app");
const { testConnection } = require("./src/database/connection");
const { connectMongo } = require("./src/database/mongo");
const logger = require("./src/utils/logger");

let bootstrapPromise = null;

async function bootstrapInfrastructure() {
  if (bootstrapPromise) {
    return bootstrapPromise;
  }

  bootstrapPromise = (async () => {
    try {
      await testConnection();
    } catch (error) {
      logger.warn("Database unavailable on Vercel bootstrap. Continuing with fallbacks.");
      logger.warn(`   DB error: ${error.message}`);
    }

    try {
      await connectMongo();
    } catch (error) {
      logger.warn("MongoDB unavailable on Vercel bootstrap. Continuing with in-memory fallback storage.");
      logger.warn(`   Mongo error: ${error.message}`);
    }
  })();

  return bootstrapPromise;
}

void bootstrapInfrastructure();

module.exports = async function handler(req, res) {
  await bootstrapInfrastructure();
  return app(req, res);
};

