const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

async function main() {
  const envContent = fs.readFileSync(path.join(__dirname, "../.env.local"), "utf8");
  const getEnv = (key) => {
    const line = envContent.split("\n").find(l => l.trim().startsWith(`${key}=`));
    return line ? line.substring(line.indexOf("=") + 1).trim().replace(/['"]/g, "").replace(/\r/g, "") : null;
  };

  const uri = getEnv("MONGODB_URI");
  if (!uri) {
    console.error("MONGODB_URI not found");
    process.exit(1);
  }

  await mongoose.connect(uri);

  // Get Google Drive config to authenticate
  const StorageConfigSchema = new mongoose.Schema({}, { strict: false });
  const StorageConfig = mongoose.models.StorageConfig || mongoose.model("StorageConfig", StorageConfigSchema, "storageconfigs");
  const config = await StorageConfig.findOne();

  if (!config) {
    console.error("StorageConfig not found");
    process.exit(1);
  }

  const driveConfig = config.toObject().googleDriveConfig;
  const { clientId, clientSecret, refreshToken } = driveConfig;

  if (!refreshToken) {
    console.error("Google Drive is not connected");
    process.exit(1);
  }

  // Refresh access token
  console.log("Refreshing access token...");
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    console.error("Failed to refresh token:", errText);
    process.exit(1);
  }

  const tokens = await tokenRes.json();
  const accessToken = tokens.access_token;

  // Find Google Drive folder ID for "test"
  console.log("Searching for folder 'test' on Google Drive...");
  const q = encodeURIComponent("mimeType='application/vnd.google-apps.folder' and name='test' and trashed=false");
  const filesRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!filesRes.ok) {
    const errText = await filesRes.text();
    console.error("Failed to query Google Drive files:", errText);
    process.exit(1);
  }

  const { files } = await filesRes.json();
  if (files.length === 0) {
    console.error("Folder 'test' not found on Google Drive");
    process.exit(1);
  }

  const driveFolderId = files[0].id;
  console.log(`Found 'test' folder ID: ${driveFolderId}`);

  // Update folder record in MongoDB
  const FolderSchema = new mongoose.Schema({}, { strict: false });
  const Folder = mongoose.models.Folder || mongoose.model("Folder", FolderSchema, "folders");

  const updateRes = await Folder.updateOne(
    { slug: "test" },
    {
      $set: {
        storageProvider: "google-drive",
        googleDriveFolderId: driveFolderId
      }
    }
  );

  console.log("Update result in MongoDB:", updateRes);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
