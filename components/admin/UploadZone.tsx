"use client";

import React, { useState, useRef, useCallback } from "react";
import { Upload, X, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

interface UploadFile {
  id: string;
  file: File;
  name: string;
  size: number;
  progress: number;
  status: "idle" | "uploading" | "success" | "error";
  error?: string;
  controller?: AbortController;
}

interface UploadZoneProps {
  folderId: string;
  folderSlug: string;
  onUploadComplete: () => void;
}

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

export default function UploadZone({ folderId, folderSlug, onUploadComplete }: UploadZoneProps) {
  const toast = useToast();
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const maxUploadSize = (Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB) || 20) * 1024 * 1024; // Default 20MB

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const uploadFileToCloudinary = async (fileObj: UploadFile) => {
    const controller = new AbortController();
    setFiles((prev) =>
      prev.map((f) => (f.id === fileObj.id ? { ...f, status: "uploading", progress: 0, controller } : f))
    );

    try {
      let fileToUpload = fileObj.file;

      // 10MB limit check: automatically compress client-side if file is larger than 10MB
      const COMPRESSION_LIMIT = 10 * 1024 * 1024; // 10MB
      if (fileToUpload.size > COMPRESSION_LIMIT) {
        try {
          console.log(`Auto-compressing image: ${fileObj.name} (${(fileToUpload.size / 1024 / 1024).toFixed(2)} MB)`);
          fileToUpload = await compressImage(fileToUpload, COMPRESSION_LIMIT);
          console.log(`Compressed successfully: ${fileObj.name} (${(fileToUpload.size / 1024 / 1024).toFixed(2)} MB)`);
        } catch (compressErr: any) {
          throw new Error(`Compression failed: ${compressErr.message || "Failed to shrink photo under 10MB."}`);
        }
      }

      // 1. Get signed signature from backend
      const sigRes = await fetch(`/api/admin/upload-signature?folderSlug=${folderSlug}`);
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

      const xhr = new XMLHttpRequest();
      const uploadUrl = `https://api.cloudinary.com/v1_1/${sigData.cloudName}/image/upload`;

      // Wrap XHR in Promise to handle async upload flow nicely with abort controller
      const uploadPromise = new Promise<any>((resolve, reject) => {
        xhr.open("POST", uploadUrl, true);

        // Track progress
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const pct = Math.round((event.loaded / event.total) * 100);
            setFiles((prev) =>
              prev.map((f) => (f.id === fileObj.id ? { ...f, progress: pct } : f))
            );
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            reject(new Error(`Cloudinary upload failed: ${xhr.statusText}`));
          }
        };

        xhr.onerror = () => reject(new Error("Network error during Cloudinary upload"));
        xhr.onabort = () => reject(new Error("Upload cancelled by administrator"));

        controller.signal.addEventListener("abort", () => {
          xhr.abort();
        });

        xhr.send(formData);
      });

      const cloudinaryRes = await uploadPromise;

      // 3. Save metadata to MongoDB
      const saveRes = await fetch("/api/admin/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folderId,
          folderSlug,
          cloudinaryPublicId: cloudinaryRes.public_id,
          secureUrl: cloudinaryRes.secure_url,
          thumbnailUrl: cloudinaryRes.secure_url.replace("/upload/", "/upload/w_400,h_400,c_fill,q_auto,f_auto/"),
          mediumUrl: cloudinaryRes.secure_url.replace("/upload/", "/upload/w_800,q_auto,f_auto/"),
          originalFilename: fileObj.name,
          format: cloudinaryRes.format,
          width: cloudinaryRes.width,
          height: cloudinaryRes.height,
          fileSize: cloudinaryRes.bytes,
        }),
      });

      if (!saveRes.ok) {
        throw new Error("Cloudinary success, but failed to save record in database.");
      }

      setFiles((prev) =>
        prev.map((f) => (f.id === fileObj.id ? { ...f, status: "success", progress: 100 } : f))
      );

      onUploadComplete();
    } catch (err: any) {
      if (controller.signal.aborted) return;
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileObj.id ? { ...f, status: "error", error: err.message || "Failed to upload" } : f
        )
      );
    }
  };

  const handleFiles = (incomingFiles: FileList | null) => {
    if (!incomingFiles) return;

    const newFiles: UploadFile[] = [];
    for (let i = 0; i < incomingFiles.length; i++) {
      const file = incomingFiles[i];
      if (!file) continue;

      // Validate file type
      if (!file.type.startsWith("image/")) {
        toast.warning(`File "${file.name}" is not an image and will be skipped.`);
        continue;
      }

      // Validate size
      if (file.size > maxUploadSize) {
        toast.error(`File "${file.name}" exceeds the ${maxUploadSize / 1024 / 1024}MB size limit.`);
        continue;
      }

      const fileObj: UploadFile = {
        id: Math.random().toString(36).substring(7),
        file,
        name: file.name,
        size: file.size,
        progress: 0,
        status: "idle",
      };

      newFiles.push(fileObj);
    }

    if (newFiles.length > 0) {
      setFiles((prev) => [...prev, ...newFiles]);
      // Trigger uploads for new idle items
      newFiles.forEach((f) => uploadFileToCloudinary(f));
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folderSlug, folderId]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const cancelUpload = (id: string) => {
    const fileObj = files.find((f) => f.id === id);
    if (fileObj?.controller) {
      fileObj.controller.abort();
    }
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const retryUpload = (id: string) => {
    const fileObj = files.find((f) => f.id === id);
    if (fileObj) {
      uploadFileToCloudinary(fileObj);
    }
  };

  const clearQueue = () => {
    // Abort any ongoing
    files.forEach((f) => {
      if (f.status === "uploading" && f.controller) {
        f.controller.abort();
      }
    });
    setFiles([]);
  };

  const activeUploadsCount = files.filter((f) => f.status === "uploading").length;

  return (
    <div className="space-y-6">
      {/* Drag & Drop Area */}
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={triggerFileInput}
        className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center min-h-[220px] ${
          dragActive
            ? "border-emerald-400 bg-emerald-500/5 text-emerald-400"
            : "border-slate-800 bg-slate-900/10 hover:border-slate-700/60 text-slate-400"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
          onChange={handleFileInput}
          className="hidden"
        />
        <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 text-slate-300 mb-4 shadow-lg group-hover:scale-105 transition duration-200">
          <Upload className="h-6 w-6 text-emerald-400" />
        </div>
        <h3 className="font-bold text-slate-200 text-base">Drag & Drop Images Here</h3>
        <p className="text-slate-500 text-xs mt-1 max-w-xs">
          Supports JPEG, PNG, WEBP, GIF, and AVIF up to {maxUploadSize / 1024 / 1024}MB.
        </p>
        <button
          type="button"
          className="mt-4 px-4 py-2 bg-slate-800 border border-slate-700 text-slate-300 hover:text-slate-100 rounded-xl text-xs font-semibold hover:bg-slate-700 transition"
        >
          Select Files
        </button>
      </div>

      {/* Upload Queue */}
      {files.length > 0 && (
        <div className="bg-slate-900/30 border border-slate-900 rounded-xl p-4 space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-slate-900">
            <h4 className="text-sm font-bold text-slate-300">
              Upload Queue ({files.filter((f) => f.status === "success").length}/{files.length} Done)
            </h4>
            {activeUploadsCount === 0 && (
              <button
                onClick={clearQueue}
                className="text-xs text-slate-500 hover:text-slate-300 transition"
              >
                Clear Queue
              </button>
            )}
          </div>

          <div className="max-h-60 overflow-y-auto space-y-3 pr-1">
            {files.map((f) => (
              <div key={f.id} className="flex items-center justify-between gap-4 p-3 bg-slate-950/40 border border-slate-900 rounded-xl">
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between text-xs font-medium text-slate-300 mb-1">
                    <span className="truncate pr-4">{f.name}</span>
                    <span>{f.progress}%</span>
                  </div>
                  {/* Progress Bar */}
                  <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        f.status === "error"
                          ? "bg-rose-500"
                          : f.status === "success"
                          ? "bg-emerald-400"
                          : "bg-emerald-500"
                      }`}
                      style={{ width: `${f.progress}%` }}
                    />
                  </div>
                  {f.error && <p className="text-[10px] text-rose-400 mt-1">{f.error}</p>}
                </div>

                <div className="flex items-center shrink-0 gap-1.5">
                  {f.status === "success" && (
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  )}
                  {f.status === "error" && (
                    <>
                      <button
                        onClick={() => retryUpload(f.id)}
                        className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded transition"
                        title="Retry Upload"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </button>
                      <AlertCircle className="h-5 w-5 text-rose-500" />
                    </>
                  )}
                  {f.status === "uploading" && (
                    <button
                      onClick={() => cancelUpload(f.id)}
                      className="p-1 hover:bg-slate-800 text-slate-500 hover:text-slate-300 rounded transition"
                      title="Cancel Upload"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                  {f.status === "idle" && (
                    <button
                      onClick={() => cancelUpload(f.id)}
                      className="p-1 hover:bg-slate-800 text-slate-500 hover:text-slate-300 rounded transition"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
