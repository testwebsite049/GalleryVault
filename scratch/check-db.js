const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

async function main() {
  const envContent = fs.readFileSync(path.join(__dirname, "../.env.local"), "utf8");
  const mongodbUriLine = envContent.split("\n").find(line => line.trim().startsWith("MONGODB_URI="));
  if (!mongodbUriLine) {
    console.error("MONGODB_URI not found in .env.local");
    process.exit(1);
  }
  const idx = mongodbUriLine.indexOf("=");
  const uri = mongodbUriLine.substring(idx + 1).trim().replace(/['"]/g, "").replace(/\r/g, "");
  console.log("Connecting to URI:", uri);
  
  await mongoose.connect(uri);
  
  const FolderSchema = new mongoose.Schema({}, { strict: false });
  const Folder = mongoose.models.Folder || mongoose.model("Folder", FolderSchema, "folders");
  
  const folders = await Folder.find({});
  console.log("FOLDERS_DUMP:" + JSON.stringify(folders));
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
