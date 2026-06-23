import fs from "fs";
import path from "path";
import { v2 as cloudinary } from "cloudinary";

// Parse .env.local file manually
function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) {
    console.error(".env.local file not found!");
    return;
  }
  const fileContent = fs.readFileSync(envPath, "utf-8");
  fileContent.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const parts = trimmed.split("=");
    const key = parts[0]?.trim();
    let val = parts.slice(1).join("=").trim();
    if (key) {
      // Strip outer quotes if any
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.substring(1, val.length - 1);
      }
      process.env[key] = val;
    }
  });
}

loadEnvLocal();

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

async function testCloudinary() {
  console.log("Testing Cloudinary credentials...");
  console.log("Cloud Name:", process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME);
  console.log("API Key:", process.env.CLOUDINARY_API_KEY);
  
  try {
    const result = await cloudinary.api.ping();
    console.log("Ping successful! Result:", result);
  } catch (err: any) {
    console.error("Ping failed!");
    console.error("Error Message:", err.message);
    console.error("Full Error:", err);
  }

  try {
    console.log("Fetching account usage...");
    const usage = await cloudinary.api.usage();
    console.log("Usage call successful! Storage limit:", usage.storage);
  } catch (err: any) {
    console.error("Usage fetch failed!");
    console.error("Error Message:", err.message);
  }
}

testCloudinary();
