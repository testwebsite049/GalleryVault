import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db/connect";
import { Folder } from "@/lib/db/models/Folder";
import { Image } from "@/lib/db/models/Image";
import { Event } from "@/lib/db/models/Event";

export async function GET() {
  try {
    await dbConnect();

    // 1. Fetch counts
    const totalFolders = await Folder.countDocuments();
    const totalImages = await Image.countDocuments();

    // 2. Fetch sums for views and downloads from folders
    const foldersStats = await Folder.aggregate([
      {
        $group: {
          _id: null,
          views: { $sum: "$totalViews" },
          downloads: { $sum: "$totalDownloads" },
        },
      },
    ]);

    const totalViews = foldersStats[0]?.views || 0;
    const totalDownloads = foldersStats[0]?.downloads || 0;

    // 3. Recent uploads (last 10 images)
    const recentUploads = await Image.find()
      .sort({ uploadedAt: -1 })
      .limit(10)
      .select("originalFilename secureUrl thumbnailUrl uploadedAt folderSlug");

    // 4. Recent visitors/events (last 10 events)
    const recentEvents = await Event.find()
      .sort({ timestamp: -1 })
      .limit(10);

    return NextResponse.json({
      totalFolders,
      totalImages,
      totalViews,
      totalDownloads,
      recentUploads,
      recentEvents,
    });
  } catch (err) {
    console.error("Dashboard API Error:", err);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to load dashboard data.",
          statusCode: 500,
        },
      },
      { status: 500 }
    );
  }
}
