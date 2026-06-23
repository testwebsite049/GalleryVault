import { NextResponse } from "next/server";
import { cloudinary } from "@/lib/cloudinary/client";
import { Image } from "@/lib/db/models/Image";
import { Folder } from "@/lib/db/models/Folder";
import { dbConnect } from "@/lib/db/connect";

export async function GET() {
  try {
    await dbConnect();

    let usageData;
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    const credentialsConfigured =
      cloudName && cloudName !== "demo" && apiKey && apiSecret;

    if (credentialsConfigured) {
      try {
        // Query the Cloudinary Admin API
        usageData = await cloudinary.api.usage();
      } catch (cloudinaryErr) {
        console.warn("Cloudinary API call failed, using mock data:", cloudinaryErr);
      }
    }

    // Default mock data if Cloudinary is not configured or fails
    if (!usageData) {
      usageData = {
        plan: "Developer Free (Mock)",
        storage: {
          usage: 120 * 1024 * 1024, // 120MB
          limit: 10 * 1024 * 1024 * 1024, // 10GB
          used_percent: 1.2,
        },
        bandwidth: {
          usage: 1.5 * 1024 * 1024 * 1024, // 1.5GB
          limit: 20 * 1024 * 1024 * 1024, // 20GB
          used_percent: 7.5,
        },
        transformations: {
          usage: 850,
          limit: 20000,
          used_percent: 4.25,
        },
        objects: {
          usage: 342,
          limit: 20000,
          used_percent: 1.71,
        },
      };
    }

    // Aggregate largest folders by storage space in MongoDB
    const folderStorageAgg = await Image.aggregate([
      {
        $group: {
          _id: "$folderId",
          totalBytes: { $sum: "$fileSize" },
          imageCount: { $sum: 1 },
        },
      },
      { $sort: { totalBytes: -1 } },
      { $limit: 5 },
    ]);

    // Populate folder names
    const largestFolders = [];
    for (const item of folderStorageAgg) {
      const folder = await Folder.findById(item._id).select("name slug coverImageUrl");
      if (folder) {
        largestFolders.push({
          id: folder._id,
          name: folder.name,
          slug: folder.slug,
          coverImageUrl: folder.coverImageUrl,
          imageCount: item.imageCount,
          totalBytes: item.totalBytes,
        });
      }
    }

    // Cloudinary Free tier resource limit fallbacks
    const fallbackStorageLimit = 10 * 1024 * 1024 * 1024; // 10 GB
    const fallbackBandwidthLimit = 20 * 1024 * 1024 * 1024; // 20 GB
    const fallbackTransformationsLimit = 20000;
    const fallbackCreditsLimit = 25;

    const storageUsage = usageData.storage?.usage || 0;
    const storageLimit = usageData.storage?.limit || fallbackStorageLimit;
    const storagePercent = typeof usageData.storage?.used_percent === "number"
      ? usageData.storage.used_percent
      : (storageLimit > 0 ? (storageUsage / storageLimit) * 100 : 0);

    const bandwidthUsage = usageData.bandwidth?.usage || 0;
    const bandwidthLimit = usageData.bandwidth?.limit || fallbackBandwidthLimit;
    const bandwidthPercent = typeof usageData.bandwidth?.used_percent === "number"
      ? usageData.bandwidth.used_percent
      : (bandwidthLimit > 0 ? (bandwidthUsage / bandwidthLimit) * 100 : 0);

    const transformationsUsage = usageData.transformations?.usage || 0;
    const transformationsLimit = usageData.transformations?.limit || fallbackTransformationsLimit;
    const transformationsPercent = typeof usageData.transformations?.used_percent === "number"
      ? usageData.transformations.used_percent
      : (transformationsLimit > 0 ? (transformationsUsage / transformationsLimit) * 100 : 0);

    const creditsUsage = usageData.credits?.usage || 0;
    const creditsLimit = usageData.credits?.limit || fallbackCreditsLimit;
    const creditsPercent = typeof usageData.credits?.used_percent === "number"
      ? usageData.credits.used_percent
      : (creditsLimit > 0 ? (creditsUsage / creditsLimit) * 100 : 0);

    return NextResponse.json({
      plan: usageData.plan || "Free",
      storage: {
        usageBytes: storageUsage,
        limitBytes: storageLimit,
        usedPercentage: storagePercent,
      },
      bandwidth: {
        usageBytes: bandwidthUsage,
        limitBytes: bandwidthLimit,
        usedPercentage: bandwidthPercent,
      },
      transformations: {
        usage: transformationsUsage,
        limit: transformationsLimit,
        usedPercentage: transformationsPercent,
      },
      credits: {
        usage: creditsUsage,
        limit: creditsLimit,
        usedPercentage: creditsPercent,
      },
      largestFolders,
    });
  } catch (err) {
    console.error("Storage API Error:", err);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to retrieve storage statistics.",
          statusCode: 500,
        },
      },
      { status: 500 }
    );
  }
}
