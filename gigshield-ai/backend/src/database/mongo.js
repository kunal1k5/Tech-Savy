const { MongoClient } = require("mongodb");
const logger = require("../utils/logger");

const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";
const mongoDbName = process.env.MONGODB_DB_NAME || "GigPredict-AI";
const connectionTimeoutMs = Number(process.env.MONGODB_CONNECT_TIMEOUT_MS || 5000);

let clientPromise = null;
let dbInstance = null;
let lastConnectionError = null;

function sanitizeMongoUri(uri) {
  return String(uri || "").replace(/\/\/([^/@]+)@/, "//***:***@");
}

async function connectMongo() {
  if (dbInstance) {
    return dbInstance;
  }

  if (!clientPromise) {
    const client = new MongoClient(mongoUri, {
      serverSelectionTimeoutMS: connectionTimeoutMs,
      connectTimeoutMS: connectionTimeoutMs,
    });

    clientPromise = client.connect();
  }

  try {
    const client = await clientPromise;
    dbInstance = client.db(mongoDbName);
    lastConnectionError = null;
    logger.info(
      `MongoDB connected on ${sanitizeMongoUri(mongoUri)} using database '${mongoDbName}'.`
    );
    return dbInstance;
  } catch (error) {
    clientPromise = null;
    dbInstance = null;
    lastConnectionError = error;
    throw error;
  }
}

function getMongoDb() {
  return dbInstance;
}

function getMongoStatus() {
  return {
    connected: Boolean(dbInstance),
    dbName: mongoDbName,
    uri: sanitizeMongoUri(mongoUri),
    error: lastConnectionError ? lastConnectionError.message : null,
  };
}

async function closeMongo() {
  if (!clientPromise) {
    return;
  }

  try {
    const client = await clientPromise;
    await client.close();
  } finally {
    clientPromise = null;
    dbInstance = null;
  }
}

module.exports = {
  closeMongo,
  connectMongo,
  getMongoDb,
  getMongoStatus,
};
