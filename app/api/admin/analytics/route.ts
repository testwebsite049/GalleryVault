import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db/connect";
import { Event } from "@/lib/db/models/Event";
import { Image } from "@/lib/db/models/Image";
import mongoose from "mongoose";

export async function GET(req: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const folderId = searchParams.get("folderId");

    if (!folderId) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Missing 'folderId' query parameter.",
            statusCode: 400,
          },
        },
        { status: 400 }
      );
    }

    const folderObjectId = new mongoose.Types.ObjectId(folderId);

    // 1. Calculate past 30 days daily views
    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - 30);
    dateLimit.setHours(0, 0, 0, 0);

    const dailyViewsAgg = await Event.aggregate([
      {
        $match: {
          folderId: folderObjectId,
          eventType: "folder_view",
          timestamp: { $gte: dateLimit },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$timestamp" },
          },
          views: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Backfill 30 days timeline
    const dailyViewsMap = new Map<string, number>();
    dailyViewsAgg.forEach((item) => {
      dailyViewsMap.set(item._id, item.views);
    });

    const dailyViews = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateString = d.toISOString().split("T")[0];
      if (dateString) {
        dailyViews.push({
          date: dateString,
          views: dailyViewsMap.get(dateString) || 0,
        });
      }
    }

    // 2. Device breakdown
    const devicesAgg = await Event.aggregate([
      {
        $match: {
          folderId: folderObjectId,
        },
      },
      {
        $group: {
          _id: "$device",
          count: { $sum: 1 },
        },
      },
    ]);

    const devices = ["desktop", "mobile", "tablet", "unknown"].map((devType) => {
      const match = devicesAgg.find((item) => item._id === devType);
      return {
        name: devType,
        value: match ? match.count : 0,
      };
    });

    // 3. Country breakdown
    const countriesAgg = await Event.aggregate([
      {
        $match: {
          folderId: folderObjectId,
        },
      },
      {
        $group: {
          _id: "$country",
          views: { $sum: 1 },
        },
      },
      { $sort: { views: -1 } },
      { $limit: 10 },
    ]);

    const countries = countriesAgg.map((c) => ({
      country: c._id || "unknown",
      views: c.views,
    }));

    // 4. Referrer breakdown
    const referrersAgg = await Event.aggregate([
      {
        $match: {
          folderId: folderObjectId,
        },
      },
      {
        $group: {
          _id: "$referrer",
          views: { $sum: 1 },
        },
      },
      { $sort: { views: -1 } },
      { $limit: 10 },
    ]);

    const referrers = referrersAgg.map((r) => ({
      referrer: r._id || "direct",
      views: r.views,
    }));

    // 5. Top downloaded images (Top 10 from MongoDB images records)
    const topImages = await Image.find({ folderId })
      .sort({ downloadCount: -1 })
      .limit(10)
      .select("originalFilename downloadCount");

    const formattedTopImages = topImages.map((img) => ({
      name: img.originalFilename,
      downloads: img.downloadCount,
    }));

    return NextResponse.json({
      dailyViews,
      devices,
      countries,
      referrers,
      topImages: formattedTopImages,
    });
  } catch (err) {
    console.error("GET Analytics Folder Error:", err);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to retrieve folder analytics data.",
          statusCode: 500,
        },
      },
      { status: 500 }
    );
  }
}
