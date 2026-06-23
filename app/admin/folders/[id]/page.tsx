"use client";

import React, { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import {
  Settings,
  Image as ImageIcon,
  BarChart3,
  Search,
  Lock,
  Download,
  AlertTriangle,
  ArrowLeft,
  Save,
  Globe,
  Plus,
  Check,
  Copy,
  Upload,
  Loader2,
} from "lucide-react";
import UploadZone from "@/components/admin/UploadZone";
import ImageGrid from "@/components/admin/ImageGrid";
import AnalyticsCharts from "@/components/admin/AnalyticsCharts";
import { useToast } from "@/components/ui/Toast";

// Client-side image compression utility using HTML5 canvas
async function compressImage(file: File, maxSize: number): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = async () => {
        try {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Failed to get canvas context."));
            return;
          }

          // Initial dimensions
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);

          let quality = 0.9;
          let compressedBlob: Blob | null = null;
          let blobSize = Infinity;

          // Loop 1: Reduce quality first (from 90% down to 20%)
          while (blobSize > maxSize && quality >= 0.2) {
            compressedBlob = await new Promise<Blob | null>((res) => {
              canvas.toBlob((b) => res(b), "image/jpeg", quality);
            });
            if (compressedBlob) {
              blobSize = compressedBlob.size;
            }
            quality -= 0.1;
          }

          // Loop 2: If quality reduction is not enough, scale down the image dimensions (by 20% steps)
          let scale = 0.8;
          while (blobSize > maxSize && scale >= 0.2) {
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;
            
            // Clear and redraw image
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            quality = 0.8;
            while (blobSize > maxSize && quality >= 0.2) {
              compressedBlob = await new Promise<Blob | null>((res) => {
                canvas.toBlob((b) => res(b), "image/jpeg", quality);
              });
              if (compressedBlob) {
                blobSize = compressedBlob.size;
              }
              quality -= 0.1;
            }
            scale -= 0.2;
          }

          if (compressedBlob && blobSize <= maxSize) {
            const compressedFile = new File([compressedBlob], file.name, {
              type: "image/jpeg",
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          } else {
            reject(new Error("Failed to compress image below 10MB limit."));
          }
        } catch (err: any) {
          reject(err);
        }
      };
      img.onerror = () => reject(new Error("Failed to load image element."));
    };
    reader.onerror = () => reject(new Error("Failed to read file buffer."));
  });
}

interface FolderDetail {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  coverImageId?: string | null;
  coverImageUrl?: string | null;
  isPublished: boolean;
  passwordProtected: boolean;
  allowDownload: boolean;
  downloadLimit?: number | null;
  allowBulkZip: boolean;
  watermarkEnabled: boolean;
  watermarkText?: string | null;
  watermarkPosition: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center";
  expiresAt?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
}

interface ImageItem {
  _id: string;
  originalFilename: string;
  secureUrl: string;
  thumbnailUrl: string;
  format: string;
  width: number;
  height: number;
  fileSize: number;
  altText?: string | null;
  caption?: string | null;
}

export default function FolderDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const router = useRouter();
  const folderId = params.id;
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<"images" | "settings" | "analytics" | "seo">("images");
  const [folder, setFolder] = useState<FolderDetail | null>(null);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [isSaveSuccessModalOpen, setIsSaveSuccessModalOpen] = useState(false);
  
  // Loading states
  const [loadingFolder, setLoadingFolder] = useState(true);
  const [loadingImages, setLoadingImages] = useState(true);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Form State (Settings & SEO)
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [passwordProtected, setPasswordProtected] = useState(false);
  const [password, setPassword] = useState("");
  const [allowDownload, setAllowDownload] = useState(true);
  const [downloadLimit, setDownloadLimit] = useState<number | "">("");
  const [allowBulkZip, setAllowBulkZip] = useState(true);
  const [watermarkEnabled, setWatermarkEnabled] = useState(false);
  const [watermarkText, setWatermarkText] = useState("");
  const [watermarkPosition, setWatermarkPosition] = useState<any>("bottom-right");
  const [expiresAt, setExpiresAt] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [uploadingCover, setUploadingCover] = useState(false);

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("File is not an image.");
      return;
    }

    setUploadingCover(true);
    try {
      let fileToUpload = file;
      const COMPRESSION_LIMIT = 10 * 1024 * 1024; // 10MB
      if (fileToUpload.size > COMPRESSION_LIMIT) {
        toast.info("Image is larger than 10MB. Compressing client-side...");
        fileToUpload = await compressImage(fileToUpload, COMPRESSION_LIMIT);
      }

      // 1. Get signed signature
      const sigRes = await fetch(`/api/admin/upload-signature?folderSlug=${slug}`);
      if (!sigRes.ok) {
        throw new Error("Failed to fetch secure upload signature.");
      }
      const sigData = await sigRes.json();

      // 2. Upload directly to Cloudinary
      const formData = new FormData();
      formData.append("file", fileToUpload);
      formData.append("api_key", sigData.apiKey);
      formData.append("timestamp", sigData.timestamp.toString());
      formData.append("signature", sigData.signature);
      formData.append("folder", sigData.folder);
      formData.append("upload_preset", sigData.uploadPreset);

      const uploadUrl = `https://api.cloudinary.com/v1_1/${sigData.cloudName}/image/upload`;
      const res = await fetch(uploadUrl, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Failed to upload image to Cloudinary.");
      }

      const cloudinaryRes = await res.json();
      setCoverImageUrl(cloudinaryRes.secure_url);
      toast.success("Cover image uploaded successfully! Save settings to apply.");
    } catch (err: any) {
      toast.error(err.message || "Failed to upload cover image.");
    } finally {
      setUploadingCover(false);
      e.target.value = "";
    }
  };

  const loadFolder = async () => {
    try {
      const res = await fetch(`/api/admin/folders/${folderId}`);
      if (!res.ok) throw new Error("Folder not found.");
      const json = await res.json();
      const folderData = json.folder;
      
      setFolder(folderData);
      setName(folderData.name);
      setSlug(folderData.slug);
      setDescription(folderData.description || "");
      setIsPublished(folderData.isPublished);
      setPasswordProtected(folderData.passwordProtected);
      setAllowDownload(folderData.allowDownload);
      setDownloadLimit(folderData.downloadLimit || "");
      setAllowBulkZip(folderData.allowBulkZip);
      setWatermarkEnabled(folderData.watermarkEnabled);
      setWatermarkText(folderData.watermarkText || "");
      setWatermarkPosition(folderData.watermarkPosition || "bottom-right");
      setCoverImageUrl(folderData.coverImageUrl || "");
      setSeoTitle(folderData.seoTitle || "");
      setSeoDescription(folderData.seoDescription || "");
      
      if (folderData.expiresAt) {
        // Convert to local datetime string format: YYYY-MM-DDTHH:MM
        const expDate = new Date(folderData.expiresAt);
        const offset = expDate.getTimezoneOffset();
        const localDate = new Date(expDate.getTime() - offset * 60 * 1000);
        setExpiresAt(localDate.toISOString().substring(0, 16));
      } else {
        setExpiresAt("");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load folder details.");
    } finally {
      setLoadingFolder(false);
    }
  };

  const loadImages = async () => {
    try {
      const res = await fetch(`/api/admin/images?folderId=${folderId}`);
      if (res.ok) {
        const json = await res.json();
        setImages(json.images || []);
      }
    } catch (err) {
      console.error("Failed to load images:", err);
    } finally {
      setLoadingImages(false);
    }
  };

  const loadAnalytics = async () => {
    setLoadingAnalytics(true);
    try {
      const res = await fetch(`/api/admin/analytics?folderId=${folderId}`);
      if (res.ok) {
        const json = await res.json();
        setAnalytics(json);
      }
    } catch (err) {
      console.error("Failed to load analytics:", err);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  useEffect(() => {
    loadFolder();
    loadImages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folderId]);

  useEffect(() => {
    if (activeTab === "analytics") {
      loadAnalytics();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const handleSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const payload: any = {
        name,
        slug,
        description: description || null,
        isPublished,
        passwordProtected,
        allowDownload,
        downloadLimit: downloadLimit === "" ? null : Number(downloadLimit),
        allowBulkZip,
        watermarkEnabled,
        watermarkText: watermarkText || null,
        watermarkPosition,
        seoTitle: seoTitle || null,
        seoDescription: seoDescription || null,
        coverImageUrl: coverImageUrl || null,
      };

      if (passwordProtected && password) {
        payload.password = password;
      } else if (!passwordProtected) {
        payload.password = null;
      }

      if (expiresAt) {
        payload.expiresAt = new Date(expiresAt).toISOString();
      } else {
        payload.expiresAt = null;
      }

      const res = await fetch(`/api/admin/folders/${folderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to update folder settings.");
      
      setFolder(json.folder);
      setPassword(""); // Clear password field on success
      setIsSaveSuccessModalOpen(true);
      toast.success("Settings saved successfully!");
    } catch (err: any) {
      const errMsg = err.message || "Failed to update settings.";
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setSaving(false);
    }
  };

  if (loadingFolder) {
    return (
      <div className="h-screen w-full flex items-center justify-center text-slate-500 animate-pulse">
        Loading folder profile details...
      </div>
    );
  }

  if (error && !folder) {
    return (
      <div className="p-6 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl flex items-center gap-3">
        <AlertTriangle />
        <span>{error}</span>
      </div>
    );
  }

  const publicUrl = folder ? `${window.location.origin}/${folder.slug}` : "";

  return (
    <div className="space-y-8">
      {/* Top breadcrumb & folder identity */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-900 pb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/admin/folders")}
            className="p-2 border border-slate-800 rounded-xl bg-slate-900/50 hover:bg-slate-800 transition text-slate-400 hover:text-slate-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
              <span>{folder?.name}</span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                folder?.isPublished
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
              }`}>
                {folder?.isPublished ? "Published" : "Draft"}
              </span>
            </h1>
            <p className="text-slate-500 text-xs mt-1 font-mono">{publicUrl}</p>
          </div>
        </div>

        {folder?.isPublished && (
          <a
            href={`/${folder.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 px-4 py-2 border border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-slate-100 rounded-xl transition text-sm self-start sm:self-auto"
          >
            <Globe className="h-4 w-4" />
            <span>Visit Gallery</span>
          </a>
        )}
      </div>

      {/* Tabs list */}
      <div className="flex border-b border-slate-900 gap-1.5 pb-px">
        {[
          { id: "images", label: "Images", icon: ImageIcon },
          { id: "settings", label: "Settings", icon: Settings },
          { id: "analytics", label: "Analytics", icon: BarChart3 },
          { id: "seo", label: "SEO", icon: Globe },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-5 py-3 border-b-2 text-sm font-medium transition ${
                isActive
                  ? "border-emerald-500 text-emerald-400 font-semibold"
                  : "border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-800"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Tab Panels */}
      <div className="pt-2">
        {/* Images Panel */}
        {activeTab === "images" && (
          <div className="space-y-8">
            <UploadZone
              folderId={folderId}
              folderSlug={folder?.slug || ""}
              onUploadComplete={loadImages}
            />

            <div>
              <h3 className="font-bold text-slate-200 text-lg mb-4">Gallery Images</h3>
              {loadingImages ? (
                <div className="h-40 flex items-center justify-center text-slate-500">
                  Loading images list...
                </div>
              ) : (
                <ImageGrid images={images} onRefresh={loadImages} />
              )}
            </div>
          </div>
        )}

        {/* Settings Panel */}
        {activeTab === "settings" && (
          <form onSubmit={handleSettingsSubmit} className="max-w-3xl space-y-6">
            <div className="bg-slate-900/10 border border-slate-900 p-6 rounded-2xl space-y-6">
              <h3 className="font-bold text-slate-200 text-lg border-b border-slate-900 pb-3">Basic Information</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-slate-300 text-xs font-semibold mb-2">Folder Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="block w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-emerald-500/50 transition text-sm"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 text-xs font-semibold mb-2">URL Slug</label>
                  <input
                    type="text"
                    required
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
                    className="block w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-emerald-500/50 transition text-sm font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 text-xs font-semibold mb-2 font-sans">Description (Optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="A short story or intro about this gallery..."
                  className="block w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-emerald-500/50 transition text-sm resize-none"
                />
              </div>

              {/* Cover Image URL / Thumbnail Upload selector */}
              <div>
                <label className="block text-slate-300 text-xs font-semibold mb-2">Cover / Thumbnail Image</label>
                
                {/* Preview and Upload Action */}
                <div className="flex flex-wrap items-center gap-4 mb-4">
                  {coverImageUrl ? (
                    <div className="relative w-28 h-28 rounded-xl overflow-hidden border border-slate-850 bg-slate-950 group">
                      <img src={coverImageUrl} alt="Current Cover" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setCoverImageUrl("")}
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-rose-400 font-semibold text-xs transition duration-200"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="w-28 h-28 rounded-xl border border-dashed border-slate-800 bg-slate-950/40 flex flex-col items-center justify-center text-slate-650">
                      <ImageIcon className="h-8 w-8 mb-1 text-slate-600" />
                      <span className="text-[10px] text-slate-500">No cover set</span>
                    </div>
                  )}

                  <div className="space-y-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleCoverUpload}
                      id="cover-upload-input"
                      className="hidden"
                      disabled={uploadingCover}
                    />
                    <label
                      htmlFor="cover-upload-input"
                      className={`inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-slate-100 rounded-xl text-xs font-semibold cursor-pointer transition ${
                        uploadingCover ? "opacity-50 pointer-events-none" : ""
                      }`}
                    >
                      {uploadingCover ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Uploading...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="h-3.5 w-3.5" />
                          <span>Upload Custom Thumbnail</span>
                        </>
                      )}
                    </label>
                    <p className="text-[10px] text-slate-500 max-w-xs leading-normal">
                      Upload any image to use as the folder thumbnail/cover. Auto-compressed if above 10MB.
                    </p>
                  </div>
                </div>

                {/* Grid of gallery images to pick as cover */}
                {images.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-slate-900/50">
                    <span className="block text-slate-400 text-[11px] font-medium">Or choose from gallery photos:</span>
                    <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 max-h-40 overflow-y-auto p-2 bg-slate-950/20 border border-slate-900 rounded-xl">
                      {images.map((img) => {
                        const isCover = coverImageUrl === img.secureUrl;
                        return (
                          <button
                            key={img._id}
                            type="button"
                            onClick={() => setCoverImageUrl(img.secureUrl)}
                            className={`relative aspect-square rounded-lg overflow-hidden border-2 bg-slate-950 shrink-0 transition ${
                              isCover ? "border-emerald-500 ring-2 ring-emerald-500/20" : "border-slate-800 hover:border-slate-700"
                            }`}
                          >
                            <img src={img.thumbnailUrl} alt="Cover option" className="h-full w-full object-cover" />
                            {isCover && (
                              <span className="absolute bottom-1 right-1 p-0.5 rounded bg-emerald-500 text-slate-950 text-[8px] font-bold">
                                Cover
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-slate-900/10 border border-slate-900 p-6 rounded-2xl space-y-6">
              <h3 className="font-bold text-slate-200 text-lg border-b border-slate-900 pb-3">Security & Publishing</h3>

              <div className="flex items-center justify-between p-4 bg-slate-950/40 border border-slate-900 rounded-xl">
                <div>
                  <h4 className="text-sm font-semibold text-slate-200">Publish Gallery</h4>
                  <p className="text-slate-500 text-xs mt-0.5">Toggle public availability of this folder.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPublished(!isPublished)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    isPublished ? "bg-emerald-500" : "bg-slate-800"
                  }`}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-slate-950 shadow ring-0 transition duration-200 ease-in-out ${
                    isPublished ? "translate-x-5" : "translate-x-0"
                  }`} />
                </button>
              </div>

              {/* Password Protection */}
              <div className="border border-slate-900 p-4 rounded-xl space-y-4 bg-slate-950/20">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-1.5">
                      <Lock className="h-4 w-4 text-cyan-400" />
                      <span>Password Gate</span>
                    </h4>
                    <p className="text-slate-500 text-xs mt-0.5">Force visitors to authenticate before viewing.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPasswordProtected(!passwordProtected)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      passwordProtected ? "bg-emerald-500" : "bg-slate-800"
                    }`}
                  >
                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-slate-950 shadow ring-0 transition duration-200 ease-in-out ${
                      passwordProtected ? "translate-x-5" : "translate-x-0"
                    }`} />
                  </button>
                </div>

                {passwordProtected && (
                  <div className="pt-2">
                    <label className="block text-slate-400 text-xs font-semibold mb-1.5">Set Access Password</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Leave blank to keep existing password"
                      className="block w-full md:max-w-xs px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-emerald-500/50 transition text-sm"
                    />
                  </div>
                )}
              </div>

              {/* Folder Expiry */}
              <div>
                <label className="block text-slate-300 text-xs font-semibold mb-2">Schedule Album Expiry (Optional)</label>
                <input
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="block w-full md:max-w-xs px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-300 focus:outline-none focus:border-emerald-500/50 transition text-sm font-sans"
                />
                <p className="text-slate-500 text-[10px] mt-1.5">Album will automatically unpublish after this time passes.</p>
              </div>
            </div>

            <div className="bg-slate-900/10 border border-slate-900 p-6 rounded-2xl space-y-6">
              <h3 className="font-bold text-slate-200 text-lg border-b border-slate-900 pb-3">Download Capabilities</h3>

              <div className="flex items-center justify-between p-4 bg-slate-950/40 border border-slate-900 rounded-xl">
                <div>
                  <h4 className="text-sm font-semibold text-slate-200">Allow Image Downloads</h4>
                  <p className="text-slate-500 text-xs mt-0.5">Let guests download individual original images.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setAllowDownload(!allowDownload)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    allowDownload ? "bg-emerald-500" : "bg-slate-800"
                  }`}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-slate-950 shadow ring-0 transition duration-200 ease-in-out ${
                    allowDownload ? "translate-x-5" : "translate-x-0"
                  }`} />
                </button>
              </div>

              {allowDownload && (
                <>
                  <div className="flex items-center justify-between p-4 bg-slate-950/40 border border-slate-900 rounded-xl">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-1">
                        <Download className="h-4 w-4 text-purple-400" />
                        <span>Allow Bulk Download (ZIP)</span>
                      </h4>
                      <p className="text-slate-500 text-xs mt-0.5">Enable the &quot;Download All&quot; ZIP button in the gallery header.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAllowBulkZip(!allowBulkZip)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        allowBulkZip ? "bg-emerald-500" : "bg-slate-800"
                      }`}
                    >
                      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-slate-950 shadow ring-0 transition duration-200 ease-in-out ${
                        allowBulkZip ? "translate-x-5" : "translate-x-0"
                      }`} />
                    </button>
                  </div>

                  <div>
                    <label className="block text-slate-300 text-xs font-semibold mb-2">Limit Downloads Per Visitor Session</label>
                    <input
                      type="number"
                      min={1}
                      value={downloadLimit}
                      onChange={(e) => setDownloadLimit(e.target.value === "" ? "" : Number(e.target.value))}
                      placeholder="e.g. 5 (Leave blank for unlimited)"
                      className="block w-full md:max-w-xs px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-emerald-500/50 transition text-sm"
                    />
                  </div>
                </>
              )}
            </div>

            {/* Watermark Section */}
            <div className="bg-slate-900/10 border border-slate-900 p-6 rounded-2xl space-y-6">
              <h3 className="font-bold text-slate-200 text-lg border-b border-slate-900 pb-3">Watermark Overlay</h3>

              <div className="flex items-center justify-between p-4 bg-slate-950/40 border border-slate-900 rounded-xl">
                <div>
                  <h4 className="text-sm font-semibold text-slate-200">Enable Watermark</h4>
                  <p className="text-slate-500 text-xs mt-0.5">Add a visual overlay to images displayed in gallery/downloads.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setWatermarkEnabled(!watermarkEnabled)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    watermarkEnabled ? "bg-emerald-500" : "bg-slate-800"
                  }`}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-slate-950 shadow ring-0 transition duration-200 ease-in-out ${
                    watermarkEnabled ? "translate-x-5" : "translate-x-0"
                  }`} />
                </button>
              </div>

              {watermarkEnabled && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-slate-950/20 border border-slate-900 rounded-xl">
                  <div>
                    <label className="block text-slate-400 text-xs font-semibold mb-2">Watermark Text</label>
                    <input
                      type="text"
                      value={watermarkText}
                      onChange={(e) => setWatermarkText(e.target.value)}
                      placeholder="e.g. © galleryvault.in"
                      className="block w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-emerald-500/50 transition text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 text-xs font-semibold mb-2 font-sans">Position</label>
                    <select
                      value={watermarkPosition}
                      onChange={(e) => setWatermarkPosition(e.target.value as any)}
                      className="block w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none cursor-pointer"
                    >
                      <option value="bottom-right">Bottom Right</option>
                      <option value="bottom-left">Bottom Left</option>
                      <option value="top-right">Top Right</option>
                      <option value="top-left">Top Left</option>
                      <option value="center">Center</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Save Buttons */}
            <div className="flex justify-end gap-4 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl transition duration-200 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                <span>{saving ? "Saving Changes..." : "Save Settings"}</span>
              </button>
            </div>
          </form>
        )}

        {/* Analytics Panel */}
        {activeTab === "analytics" && (
          <div>
            {loadingAnalytics ? (
              <div className="h-64 flex items-center justify-center text-slate-500">
                Aggregating views and download logs...
              </div>
            ) : analytics ? (
              <AnalyticsCharts
                dailyViews={analytics.dailyViews}
                topImages={analytics.topImages}
                devices={analytics.devices}
                countries={analytics.countries}
                referrers={analytics.referrers}
              />
            ) : (
              <div className="py-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl">
                No analytics recorded yet.
              </div>
            )}
          </div>
        )}

        {/* SEO Panel */}
        {activeTab === "seo" && (
          <form onSubmit={handleSettingsSubmit} className="max-w-3xl space-y-8">
            <div className="bg-slate-900/10 border border-slate-900 p-6 rounded-2xl space-y-6">
              <h3 className="font-bold text-slate-200 text-lg border-b border-slate-900 pb-3">Search Engine Optimization</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-slate-300 text-xs font-semibold mb-2">Meta SEO Title</label>
                  <input
                    type="text"
                    value={seoTitle}
                    onChange={(e) => setSeoTitle(e.target.value)}
                    placeholder={name ? `${name} — GalleryVault` : "Leave blank to use default Folder Name"}
                    className="block w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-emerald-500/50 transition text-sm"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 text-xs font-semibold mb-2">Meta Description</label>
                  <textarea
                    value={seoDescription}
                    onChange={(e) => setSeoDescription(e.target.value)}
                    placeholder="Short summary displayed under the search result link..."
                    rows={3}
                    className="block w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-emerald-500/50 transition text-sm resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Previews (Google & Facebook) */}
            <div className="bg-slate-900/10 border border-slate-900 p-6 rounded-2xl space-y-6">
              <h3 className="font-bold text-slate-200 text-lg border-b border-slate-900 pb-3">Preview Cards</h3>

              {/* Google Search Preview */}
              <div className="space-y-2">
                <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">Google Search Result</span>
                <div className="bg-white p-5 rounded-xl border border-slate-200 font-sans text-left text-slate-800">
                  <span className="text-slate-500 text-xs block font-mono">galleryvault.in/{slug || "slug-path"}</span>
                  <span className="text-indigo-800 hover:underline text-lg font-medium cursor-pointer block mt-1">
                    {seoTitle || name || "My Gallery"} — GalleryVault
                  </span>
                  <span className="text-slate-600 text-xs block mt-1 max-w-xl">
                    {seoDescription || description || "View this stunning photo gallery on GalleryVault."}
                  </span>
                </div>
              </div>

              {/* Open Graph Card Preview */}
              <div className="space-y-2">
                <span className="text-slate-500 text-xs font-bold uppercase tracking-wider font-sans">Social Media Card (Open Graph)</span>
                <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden max-w-md text-left">
                  <div className="aspect-[1.91/1] w-full bg-slate-900 border-b border-slate-900 flex items-center justify-center text-slate-600">
                    {coverImageUrl ? (
                      // eslint-disable-next-line @typescript-eslint/no-img-element
                      <img src={coverImageUrl} alt="OG Card Cover" className="h-full w-full object-cover" />
                    ) : (
                      <ImageIcon className="h-8 w-8" />
                    )}
                  </div>
                  <div className="p-4 space-y-1">
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest block font-mono">galleryvault.in</span>
                    <span className="text-sm font-bold text-slate-200 block truncate">{seoTitle || name || "My Gallery"}</span>
                    <span className="text-xs text-slate-400 block truncate">{seoDescription || description || "No description set."}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Save Buttons */}
            <div className="flex justify-end gap-4 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl transition duration-200 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                <span>{saving ? "Saving SEO..." : "Save SEO Settings"}</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Save Success Modal */}
      {isSaveSuccessModalOpen && folder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-2xl space-y-6 text-center animate-scale-up">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Check className="h-6 w-6" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-slate-100">Folder Settings Saved!</h3>
              <p className="text-slate-400 text-xs">
                Your updates to folder <span className="text-emerald-400 font-semibold">&quot;{folder.name}&quot;</span> have been applied successfully.
              </p>
            </div>

            <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800 space-y-3 text-left">
              <div className="flex justify-between items-center text-xs border-b border-slate-900 pb-2">
                <span className="text-slate-500 font-medium">Status</span>
                <span className={`px-2 py-0.5 rounded-full font-semibold text-[10px] ${
                  folder.isPublished
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                }`}>
                  {folder.isPublished ? "Published" : "Draft"}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs border-b border-slate-900 pb-2">
                <span className="text-slate-500 font-medium">Security</span>
                <span className="text-slate-300 font-semibold">
                  {folder.passwordProtected ? "Password Protected" : "Public Access"}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-slate-500 text-xs font-medium block">Public URL</span>
                <div className="flex items-center justify-between gap-2 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg">
                  <span className="text-xs font-mono text-cyan-400 truncate max-w-[240px]">
                    {publicUrl}
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(publicUrl);
                      toast.success("Link copied to clipboard!");
                    }}
                    className="p-1 text-slate-400 hover:text-slate-100 transition rounded hover:bg-slate-800 shrink-0"
                    title="Copy Link"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsSaveSuccessModalOpen(false)}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-350 rounded-xl transition text-sm font-semibold"
              >
                Close
              </button>
              {folder.isPublished && (
                <a
                  href={`/${folder.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 rounded-xl transition text-sm font-bold flex items-center justify-center gap-1.5"
                >
                  <Globe className="h-4 w-4" />
                  <span>View Gallery</span>
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
