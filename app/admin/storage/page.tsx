"use client";

import React, { useEffect, useState } from "react";
import { HardDrive, Percent, ShieldAlert, AlertOctagon, Info, Folder, Image as ImageIcon, CloudLightning } from "lucide-react";

interface StorageQuota {
  usageBytes: number;
  limitBytes: number;
  usedPercentage: number;
}

interface BandwidthQuota {
  usageBytes: number;
  limitBytes: number;
  usedPercentage: number;
}

interface TransformationsQuota {
  usage: number;
  limit: number;
  usedPercentage: number;
}

interface CreditsQuota {
  usage: number;
  limit: number;
  usedPercentage: number;
}

interface LargestFolder {
  id: string;
  name: string;
  slug: string;
  coverImageUrl?: string | null;
  imageCount: number;
  totalBytes: number;
}

interface StorageData {
  plan: string;
  storage: StorageQuota;
  bandwidth: BandwidthQuota;
  transformations: TransformationsQuota;
  credits: CreditsQuota;
  largestFolders: LargestFolder[];
}

export default function StorageDashboardPage() {
  const [data, setData] = useState<StorageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchStorageData = async () => {
    try {
      const res = await fetch("/api/admin/storage");
      if (!res.ok) throw new Error("Failed to load storage dashboard data");
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStorageData();
  }, []);

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  };

  if (loading) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="h-8 bg-slate-800 rounded w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-44 bg-slate-800 rounded-xl" />
          ))}
        </div>
        <div className="h-80 bg-slate-800 rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl">
        {error}
      </div>
    );
  }

  // Quota alerts
  const storageUsagePct = data?.storage.usedPercentage || 0;
  const creditsUsagePct = data?.credits?.usedPercentage || 0;
  const maxUsagePct = Math.max(storageUsagePct, creditsUsagePct);
  const showWarningBanner = maxUsagePct >= 80 && maxUsagePct < 95;
  const showCriticalBanner = maxUsagePct >= 95;

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
          Storage Dashboard
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Monitor your Cloudinary plan limitations, storage volume, and monthly data transfer.
        </p>
      </div>

      {/* Warning/Critical Banners */}
      {showWarningBanner && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl flex items-center gap-3">
          <ShieldAlert className="h-5 w-5 shrink-0" />
          <div>
            <h4 className="font-bold text-sm">Warning: Storage Quota Approaching Limit</h4>
            <p className="text-xs mt-0.5 text-amber-500/80">
              Your storage usage is at {storageUsagePct.toFixed(1)}%. Consider cleaning up unused albums or upgrading.
            </p>
          </div>
        </div>
      )}

      {showCriticalBanner && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl flex items-center gap-3">
          <AlertOctagon className="h-5 w-5 shrink-0" />
          <div>
            <h4 className="font-bold text-sm">Critical: Storage Quota Almost Full</h4>
            <p className="text-xs mt-0.5 text-rose-400/80">
              Your storage usage is at {storageUsagePct.toFixed(1)}%. Uploads will fail once you exceed 100%. Please upgrade your Cloudinary tier immediately.
            </p>
          </div>
        </div>
      )}

      {/* Usage Widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Cloudinary Credits card */}
        <div className="bg-slate-900/40 border border-slate-800/80 p-6 rounded-xl space-y-4">
          <div className="flex justify-between items-start">
            <h3 className="font-bold text-slate-200 text-sm flex items-center gap-1.5">
              <CloudLightning className="h-4 w-4 text-amber-400" />
              <span>Plan Credits</span>
            </h3>
            <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/5 px-2 py-0.5 rounded-full border border-emerald-500/10 animate-pulse">
              {data?.plan}
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-slate-400">Used</span>
              <span className="text-slate-200">
                {(data?.credits.usage || 0).toFixed(2)} / {(data?.credits.limit || 0)}
              </span>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-slate-950 h-2 border border-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  creditsUsagePct >= 95 ? "bg-rose-500" : creditsUsagePct >= 80 ? "bg-amber-400" : "bg-amber-500"
                }`}
                style={{ width: `${Math.min(creditsUsagePct, 100)}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-500 block text-right font-medium">
              {creditsUsagePct.toFixed(1)}% consumed
            </span>
          </div>
        </div>

        {/* Storage card */}
        <div className="bg-slate-900/40 border border-slate-800/80 p-6 rounded-xl space-y-4">
          <h3 className="font-bold text-slate-200 text-sm flex items-center gap-1.5">
            <HardDrive className="h-4 w-4 text-emerald-400" />
            <span>Cloud Storage</span>
          </h3>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-slate-400">Used</span>
              <span className="text-slate-200">
                {formatBytes(data?.storage.usageBytes || 0)} / {formatBytes(data?.storage.limitBytes || 0)}
              </span>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-slate-950 h-2 border border-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  storageUsagePct >= 95 ? "bg-rose-500" : storageUsagePct >= 80 ? "bg-amber-400" : "bg-emerald-400"
                }`}
                style={{ width: `${Math.min(storageUsagePct, 100)}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-500 block text-right font-medium">
              {storageUsagePct.toFixed(1)}% consumed
            </span>
          </div>
        </div>

        {/* Bandwidth card */}
        <div className="bg-slate-900/40 border border-slate-800/80 p-6 rounded-xl space-y-4">
          <h3 className="font-bold text-slate-200 text-sm flex items-center gap-1.5">
            <Percent className="h-4 w-4 text-cyan-400" />
            <span>Monthly Bandwidth</span>
          </h3>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-slate-400">Transfer</span>
              <span className="text-slate-200">
                {formatBytes(data?.bandwidth.usageBytes || 0)} / {formatBytes(data?.bandwidth.limitBytes || 0)}
              </span>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-slate-950 h-2 border border-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-cyan-400 rounded-full transition-all"
                style={{ width: `${Math.min(data?.bandwidth.usedPercentage || 0, 100)}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-500 block text-right font-medium">
              {(data?.bandwidth.usedPercentage || 0).toFixed(1)}% consumed
            </span>
          </div>
        </div>

        {/* Transformations card */}
        <div className="bg-slate-900/40 border border-slate-800/80 p-6 rounded-xl space-y-4">
          <h3 className="font-bold text-slate-200 text-sm flex items-center gap-1.5">
            <ImageIcon className="h-4 w-4 text-purple-400" />
            <span>Transformations</span>
          </h3>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-slate-400">Operations</span>
              <span className="text-slate-200">
                {data?.transformations.usage.toLocaleString()} / {data?.transformations.limit.toLocaleString()}
              </span>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-slate-950 h-2 border border-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-400 rounded-full transition-all"
                style={{ width: `${Math.min(data?.transformations.usedPercentage || 0, 100)}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-500 block text-right font-medium">
              {(data?.transformations.usedPercentage || 0).toFixed(1)}% consumed
            </span>
          </div>
        </div>
      </div>

      {/* Largest Folders by Storage */}
      <div className="bg-slate-900/20 border border-slate-900 p-6 rounded-2xl space-y-6">
        <div>
          <h3 className="font-bold text-slate-200 text-lg">Largest Folders by Storage</h3>
          <p className="text-slate-500 text-xs mt-0.5">Top 5 albums consuming the most CDN space</p>
        </div>

        {data?.largestFolders && data.largestFolders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-900 text-slate-500 text-xs font-semibold tracking-wider">
                  <th className="pb-3">Folder</th>
                  <th className="pb-3 text-center">Images</th>
                  <th className="pb-3 text-right">Estimated Size</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900 text-sm text-slate-300">
                {data.largestFolders.map((folder) => (
                  <tr key={folder.id} className="hover:bg-slate-950/20 transition">
                    <td className="py-3 flex items-center gap-3">
                      <div className="h-10 w-10 rounded bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center shrink-0">
                        {folder.coverImageUrl ? (
                          // eslint-disable-next-line @typescript-eslint/no-img-element
                          <img src={folder.coverImageUrl} alt={folder.name} className="h-full w-full object-cover" />
                        ) : (
                          <Folder className="h-5 w-5 text-slate-600" />
                        )}
                      </div>
                      <div>
                        <span className="font-bold text-slate-200">{folder.name}</span>
                        <span className="text-xs text-slate-500 block font-mono">/{folder.slug}</span>
                      </div>
                    </td>
                    <td className="py-3 text-center font-semibold text-slate-300">
                      {folder.imageCount}
                    </td>
                    <td className="py-3 text-right font-semibold text-slate-200">
                      {formatBytes(folder.totalBytes)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl">
            No folders have been created or size analytics aggregated yet.
          </div>
        )}
      </div>
    </div>
  );
}
