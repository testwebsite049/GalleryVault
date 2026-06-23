import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db/connect";
import { Event } from "@/lib/db/models/Event";
import { Folder } from "@/lib/db/models/Folder";

export async function GET() {
  try {
    await dbConnect();

    // 1. Calculate past 30 days daily views platform-wide
    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - 30);
    dateLimit.setHours(0, 0, 0, 0);

    const dailyViewsAgg = await Event.aggregate([
      {
        $match: {
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

    // 2. Device breakdown platform-wide
    const devicesAgg = await Event.aggregate([
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

    // 3. Country breakdown platform-wide
    const countriesAgg = await Event.aggregate([
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

    // 4. Referrer breakdown platform-wide
    const referrersAgg = await Event.aggregate([
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

    // 5. Most viewed folders (Top 5)
    const topFolders = await Folder.find()
      .sort({ totalViews: -1 })
      .limit(5)
      .select("name slug coverImageUrl totalImages totalViews totalDownloads");

    return NextResponse.json({
      dailyViews,
      devices,
      countries,
      referrers,
      topFolders,
    });
  } catch (err) {
    console.error("GET Global Analytics Error:", err);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to retrieve global analytics data.",
          statusCode: 500,
        },
      },
      { status: 500 }
    );
  }
}
