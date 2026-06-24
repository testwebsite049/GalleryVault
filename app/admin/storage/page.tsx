"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  HardDrive,
  Percent,
  ShieldAlert,
  AlertOctagon,
  Folder,
  Image as ImageIcon,
  CloudLightning,
  Settings,
  Link2,
  Unlink,
  Loader2,
  Save,
  Grid,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";

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
  activeProvider: "cloudinary" | "google-drive" | "both";
  plan: string;
  storage: StorageQuota;
  bandwidth: BandwidthQuota;
  transformations: TransformationsQuota;
  credits: CreditsQuota;
  googleDrive?: StorageQuota | null;
  largestFolders: LargestFolder[];
}

function StorageDashboardContent() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Navigation
  const [activeTab, setActiveTab] = useState<"overview" | "config">("overview");

  // Dashboard Data State
  const [data, setData] = useState<StorageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Configuration Settings State
  const [activeProvider, setActiveProvider] = useState<"cloudinary" | "google-drive" | "both">("cloudinary");
  const [cloudName, setCloudName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [uploadPreset, setUploadPreset] = useState("");

  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [redirectUri, setRedirectUri] = useState("");
  const [parentFolderId, setParentFolderId] = useState("");
  const [isDriveConnected, setIsDriveConnected] = useState(false);

  const [savingSettings, setSavingSettings] = useState(false);
  const [connectingDrive, setConnectingDrive] = useState(false);

  // Fetch Dashboard usage metrics
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

  // Fetch Settings credentials configuration
  const fetchConfig = async () => {
    try {
      const res = await fetch("/api/admin/storage/config");
      if (res.ok) {
        const json = await res.json();
        setActiveProvider(json.activeProvider);
        setCloudName(json.cloudinaryConfig.cloudName || "");
        setApiKey(json.cloudinaryConfig.apiKey || "");
        setApiSecret(json.cloudinaryConfig.apiSecret || "");
        setUploadPreset(json.cloudinaryConfig.uploadPreset || "");

        setClientId(json.googleDriveConfig.clientId || "");
        setClientSecret(json.googleDriveConfig.clientSecret || "");
        setRedirectUri(json.googleDriveConfig.redirectUri || "");
        setParentFolderId(json.googleDriveConfig.parentFolderId || "");
        setIsDriveConnected(json.googleDriveConfig.isConnected || false);
      }
    } catch (err) {
      console.error("Failed to load storage config:", err);
    }
  };

  useEffect(() => {
    fetchStorageData();
    fetchConfig();
  }, []);

  // Autofill Redirect URI on client if empty
  useEffect(() => {
    if (typeof window !== "undefined" && !redirectUri) {
      setRedirectUri(`${window.location.origin}/api/admin/storage/google-oauth-callback`);
    }
  }, [redirectUri]);

  // Handle OAuth callback parameters in URL
  useEffect(() => {
    const success = searchParams.get("success");
    const oauthError = searchParams.get("error");

    if (success === "google_connected") {
      toast.success("Google Drive account connected successfully!");
      // Clean query params
      router.replace("/admin/storage");
      fetchConfig();
      fetchStorageData();
    } else if (oauthError) {
      toast.error(`Google authentication failed: ${oauthError}`);
      router.replace("/admin/storage");
    }
  }, [searchParams, router, toast]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const res = await fetch("/api/admin/storage/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activeProvider,
          cloudinaryConfig: {
            cloudName,
            apiKey,
            apiSecret,
            uploadPreset,
          },
          googleDriveConfig: {
            clientId,
            clientSecret,
            redirectUri,
            parentFolderId: parentFolderId || null,
          },
        }),
      });

      if (!res.ok) throw new Error("Failed to save storage settings");
      toast.success("Storage settings saved successfully!");
      fetchConfig();
      fetchStorageData();
    } catch (err: any) {
      toast.error(err.message || "Failed to save settings");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleConnectDrive = async () => {
    setConnectingDrive(true);
    try {
      // 1. Save keys first
      const saveRes = await fetch("/api/admin/storage/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          googleDriveConfig: {
            clientId,
            clientSecret,
            redirectUri,
          },
        }),
      });
      if (!saveRes.ok) throw new Error("Failed to save credentials before authorization.");

      // 2. Fetch redirect authorization URL
      const res = await fetch("/api/admin/storage/google-auth");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to generate consent URL");

      // Redirect to Google Consent Flow
      window.location.href = json.url;
    } catch (err: any) {
      toast.error(err.message || "Failed to connect Google Drive.");
      setConnectingDrive(false);
    }
  };

  const handleDisconnectDrive = async () => {
    if (!confirm("Are you sure you want to disconnect Google Drive? This will revoke authorization tokens.")) return;
    try {
      const res = await fetch("/api/admin/storage/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          googleDriveConfig: {
            disconnect: true,
          },
        }),
      });
      if (!res.ok) throw new Error("Failed to disconnect Google Drive");
      toast.success("Google Drive account disconnected.");
      fetchConfig();
      fetchStorageData();
    } catch (err: any) {
      toast.error(err.message || "Failed to disconnect Google Drive");
    }
  };

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

  const storageUsagePct = data?.storage.usedPercentage || 0;
  const creditsUsagePct = data?.credits?.usedPercentage || 0;
  const maxUsagePct = Math.max(storageUsagePct, creditsUsagePct);
  const showWarningBanner = maxUsagePct >= 80 && maxUsagePct < 95;
  const showCriticalBanner = maxUsagePct >= 95;

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            Storage Center
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Configure storage providers and monitor file quota volume configurations.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex bg-slate-900/60 p-1.5 rounded-xl border border-slate-850 self-start">
          <button
            onClick={() => setActiveTab("overview")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition duration-150 ${
              activeTab === "overview"
                ? "bg-emerald-500 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Grid className="h-4 w-4" />
            <span>Usage Overview</span>
          </button>
          <button
            onClick={() => setActiveTab("config")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition duration-150 ${
              activeTab === "config"
                ? "bg-emerald-500 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Settings className="h-4 w-4" />
            <span>Storage Providers</span>
          </button>
        </div>
      </div>

      {activeTab === "overview" ? (
        <>
          {/* Warning/Critical Banners */}
          {showWarningBanner && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl flex items-center gap-3">
              <ShieldAlert className="h-5 w-5 shrink-0" />
              <div>
                <h4 className="font-bold text-sm">Warning: Storage Quota Approaching Limit</h4>
                <p className="text-xs mt-0.5 text-amber-500/80">
                  Your Cloudinary storage usage is at {storageUsagePct.toFixed(1)}%. Consider cleaning up folders.
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
                  Your Cloudinary usage is at {storageUsagePct.toFixed(1)}%. Uploads will fail once you exceed 100%.
                </p>
              </div>
            </div>
          )}

          {/* Combined Quota Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Cloudinary Quota Widget */}
            <div className="bg-slate-900/40 border border-slate-800/80 p-6 rounded-xl space-y-4">
              <div className="flex justify-between items-start">
                <h3 className="font-bold text-slate-200 text-sm flex items-center gap-1.5">
                  <CloudLightning className="h-4 w-4 text-emerald-400" />
                  <span>Cloudinary Storage</span>
                </h3>
                <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/5 px-2 py-0.5 rounded-full border border-emerald-500/10">
                  {data?.plan}
                </span>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-400">Used space</span>
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

            {/* Google Drive Quota Widget */}
            <div className="bg-slate-900/40 border border-slate-800/80 p-6 rounded-xl space-y-4">
              <div className="flex justify-between items-start">
                <h3 className="font-bold text-slate-200 text-sm flex items-center gap-1.5">
                  <HardDrive className="h-4 w-4 text-cyan-400" />
                  <span>Google Drive Storage</span>
                </h3>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                  data?.googleDrive
                    ? "text-cyan-400 bg-cyan-500/5 border-cyan-500/10"
                    : "text-slate-550 bg-slate-950 border-slate-800"
                }`}>
                  {data?.googleDrive ? "Connected" : "Disconnected"}
                </span>
              </div>

              {data?.googleDrive ? (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-400">Used space</span>
                    <span className="text-slate-200">
                      {formatBytes(data.googleDrive.usageBytes)} / {formatBytes(data.googleDrive.limitBytes)}
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full bg-slate-950 h-2 border border-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full bg-cyan-400 transition-all`}
                      style={{ width: `${Math.min(data.googleDrive.usedPercentage || 0, 100)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 block text-right font-medium">
                    {data.googleDrive.usedPercentage.toFixed(1)}% consumed
                  </span>
                </div>
              ) : (
                <div className="py-2 text-center text-slate-500 text-xs flex flex-col justify-center h-14">
                  <span>No Google Drive connected.</span>
                  <button
                    onClick={() => setActiveTab("config")}
                    className="text-[10px] text-cyan-400 hover:underline mt-1 font-semibold"
                  >
                    Setup Google Drive
                  </button>
                </div>
              )}
            </div>

            {/* Cloudinary Credits card */}
            <div className="bg-slate-900/40 border border-slate-800/80 p-6 rounded-xl space-y-4">
              <h3 className="font-bold text-slate-200 text-sm flex items-center gap-1.5">
                <Percent className="h-4 w-4 text-amber-400" />
                <span>Monthly Credits (CDN)</span>
              </h3>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-400">Credits used</span>
                  <span className="text-slate-200">
                    {(data?.credits.usage || 0).toFixed(2)} / {data?.credits.limit || 0}
                  </span>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-slate-950 h-2 border border-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      creditsUsagePct >= 95 ? "bg-rose-500" : creditsUsagePct >= 80 ? "bg-amber-400" : "bg-amber-550"
                    }`}
                    style={{ width: `${Math.min(creditsUsagePct, 100)}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-500 block text-right font-medium">
                  {creditsUsagePct.toFixed(1)}% consumed
                </span>
              </div>
            </div>
          </div>

          {/* Largest Folders by Storage */}
          <div className="bg-slate-900/20 border border-slate-900 p-6 rounded-2xl space-y-6">
            <div>
              <h3 className="font-bold text-slate-200 text-lg">Largest Folders by Storage</h3>
              <p className="text-slate-500 text-xs mt-0.5">Top 5 albums consuming the most database space</p>
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
        </>
      ) : (
        /* Configuration Settings Tab */
        <form onSubmit={handleSaveSettings} className="space-y-8 max-w-4xl">
          {/* Active Provider Selector */}
          <div className="bg-slate-900/10 border border-slate-900 p-6 rounded-2xl space-y-4">
            <div>
              <h3 className="font-bold text-slate-200 text-lg">Active Storage Provider</h3>
              <p className="text-slate-500 text-xs mt-0.5">
                Switch or enable simultaneous storage uploads for your photo galleries.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              {[
                {
                  id: "cloudinary",
                  name: "Cloudinary CDN",
                  desc: "Optimized on-the-fly transformations and fast edge delivery.",
                },
                {
                  id: "google-drive",
                  name: "Google Drive",
                  desc: "Direct storage uploads to your connected Google drive account.",
                },
                {
                  id: "both",
                  name: "Cloudinary + Google Drive",
                  desc: "Upload to both simultaneously. Serve from Cloudinary with Google Drive backup.",
                },
              ].map((p) => {
                const isSelected = activeProvider === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setActiveProvider(p.id as any)}
                    className={`p-5 rounded-xl border text-left flex flex-col justify-between h-36 transition duration-200 ${
                      isSelected
                        ? "border-emerald-500 bg-emerald-500/5 text-slate-200"
                        : "border-slate-850 bg-slate-900/10 hover:border-slate-800 text-slate-400"
                    }`}
                  >
                    <div>
                      <span className={`text-sm font-bold block ${isSelected ? "text-emerald-400" : "text-slate-300"}`}>
                        {p.name}
                      </span>
                      <p className="text-slate-500 text-xs leading-normal mt-2">{p.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Cloudinary Configurations Panel */}
            <div className="bg-slate-900/10 border border-slate-900 p-6 rounded-2xl space-y-4">
              <h3 className="font-bold text-slate-200 text-lg border-b border-slate-900 pb-3">Cloudinary Keys</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-slate-400 text-xs font-semibold mb-2">Cloud Name</label>
                  <input
                    type="text"
                    value={cloudName}
                    onChange={(e) => setCloudName(e.target.value)}
                    placeholder="Enter cloud name"
                    className="block w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-emerald-500/50 transition text-sm font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 text-xs font-semibold mb-2">API Key</label>
                  <input
                    type="text"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter Cloudinary API Key"
                    className="block w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-emerald-500/50 transition text-sm font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 text-xs font-semibold mb-2">API Secret</label>
                  <input
                    type="password"
                    value={apiSecret}
                    onChange={(e) => setApiSecret(e.target.value)}
                    placeholder="●●●●●●●●●●●●"
                    className="block w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-emerald-500/50 transition text-sm font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 text-xs font-semibold mb-2">Upload Preset (Unsigned)</label>
                  <input
                    type="text"
                    value={uploadPreset}
                    onChange={(e) => setUploadPreset(e.target.value)}
                    placeholder="e.g. galleryflow"
                    className="block w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-emerald-500/50 transition text-sm font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Google Drive Configurations Panel */}
            <div className="bg-slate-900/10 border border-slate-900 p-6 rounded-2xl space-y-4">
              <div className="flex justify-between items-center border-b border-slate-900 pb-3">
                <h3 className="font-bold text-slate-200 text-lg">Google Drive Auth</h3>
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                  isDriveConnected ? "text-cyan-400 bg-cyan-500/5 border border-cyan-500/10" : "text-slate-500 bg-slate-950 border border-slate-850"
                }`}>
                  {isDriveConnected ? "Connected" : "Not Linked"}
                </span>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-slate-400 text-xs font-semibold mb-2">Client ID</label>
                  <input
                    type="text"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    placeholder="Enter Google API Client ID"
                    className="block w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-emerald-500/50 transition text-sm font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 text-xs font-semibold mb-2">Client Secret</label>
                  <input
                    type="password"
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    placeholder="●●●●●●●●●●●●"
                    className="block w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-emerald-500/50 transition text-sm font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 text-xs font-semibold mb-2">OAuth Redirect URI</label>
                  <input
                    type="text"
                    value={redirectUri}
                    onChange={(e) => setRedirectUri(e.target.value)}
                    placeholder="Callback URL"
                    className="block w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-300 focus:outline-none focus:border-emerald-500/50 transition text-sm font-mono opacity-80"
                  />
                  <p className="text-[10px] text-slate-550 mt-1 leading-normal">
                    Register this Redirect URL in your Google Cloud Console Credentials page.
                  </p>
                </div>

                <div>
                  <label className="block text-slate-400 text-xs font-semibold mb-2">Root Drive Folder ID (Optional)</label>
                  <input
                    type="text"
                    value={parentFolderId}
                    onChange={(e) => setParentFolderId(e.target.value)}
                    placeholder="Auto-created if empty"
                    className="block w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-emerald-500/50 transition text-sm font-mono"
                  />
                </div>

                {/* Google Connection Triggers */}
                <div className="pt-2">
                  {isDriveConnected ? (
                    <button
                      type="button"
                      onClick={handleDisconnectDrive}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-450 hover:text-rose-400 rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      <Unlink className="h-4 w-4" />
                      <span>Disconnect Google Drive</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleConnectDrive}
                      disabled={connectingDrive || !clientId || !clientSecret}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-cyan-500 text-slate-950 hover:bg-cyan-400 disabled:opacity-50 rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      {connectingDrive ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Initiating connection...</span>
                        </>
                      ) : (
                        <>
                          <Link2 className="h-4 w-4" />
                          <span>Connect Google Drive</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-4 pt-4 border-t border-slate-900">
            <button
              type="submit"
              disabled={savingSettings}
              className="flex items-center gap-2 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 disabled:opacity-50 rounded-xl text-xs font-bold transition cursor-pointer shadow-lg"
            >
              {savingSettings ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>Save Storage Configurations</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default function StorageDashboardPage() {
  return (
    <Suspense fallback={
      <div className="space-y-8 animate-pulse">
        <div className="h-8 bg-slate-800 rounded w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse" />
      </div>
    }>
      <StorageDashboardContent />
    </Suspense>
  );
}
