const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

let isLoaded = false;
let loadedFilePath = null;

function loadEnv() {
  if (isLoaded) {
    return { loaded: true, path: loadedFilePath };
  }

  const candidatePaths = [
    path.resolve(__dirname, ".env"),
    path.resolve(__dirname, "..", ".env"),
    path.resolve(__dirname, "..", "..", ".env"),
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "backend", ".env"),
    path.resolve(process.cwd(), "college-enquiry-chatbot", "backend", ".env"),
    path.resolve(process.cwd(), "college-enquiry-chatbot", ".env")
  ];

  // Remove duplicates
  const uniqueCandidates = [...new Set(candidatePaths)];

  for (const envPath of uniqueCandidates) {
    try {
      if (fs.existsSync(envPath) && fs.statSync(envPath).isFile()) {
        const result = dotenv.config({ path: envPath });
        if (!result.error) {
          loadedFilePath = envPath;
          isLoaded = true;
          break;
        }
      }
    } catch (_err) {
      // Ignore filesystem check errors and try next
    }
  }

  // Fallback to default dotenv behavior if not loaded yet
  if (!isLoaded) {
    const fallback = dotenv.config();
    if (!fallback.error) {
      isLoaded = true;
      loadedFilePath = path.resolve(process.cwd(), ".env");
    }
  }

  return {
    loaded: isLoaded || Boolean(process.env.SUPABASE_URL),
    path: loadedFilePath
  };
}

// Automatically load on require
loadEnv();

module.exports = { loadEnv };
