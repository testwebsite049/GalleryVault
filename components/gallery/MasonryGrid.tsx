"use client";

import React from "react";
import { Download, Eye, ZoomIn } from "lucide-react";

interface ImageItem {
  _id: string;
  originalFilename: string;
  secureUrl: string;
  thumbnailUrl: string;
  mediumUrl: string;
  format: string;
  width: number;
  height: number;
  fileSize: number;
  altText?: string | null;
  caption?: string | null;
}

interface MasonryGridProps {
  images: ImageItem[];
  allowDownload: boolean;
  onImageClick: (index: number) => void;
  onDownloadClick: (e: React.MouseEvent, img: ImageItem) => void;
  watermarkEnabled: boolean;
  watermarkText?: string | null;
  watermarkPosition?: string | null;
}

export default function MasonryGrid({
  images,
  allowDownload,
  onImageClick,
  onDownloadClick,
  watermarkEnabled,
  watermarkText,
  watermarkPosition,
}: MasonryGridProps) {
  
  // Custom Cloudinary URL helper to inject watermark overlay at runtime
  const getDisplayUrl = (img: ImageItem) => {
    if (!watermarkEnabled || !watermarkText) {
      return img.mediumUrl;
    }

    const text = encodeURIComponent(watermarkText);
    
    // Determine positioning overlay for Cloudinary
    let gravity = "south_east";
    if (watermarkPosition === "bottom-left") gravity = "south_west";
    else if (watermarkPosition === "top-right") gravity = "north_east";
    else if (watermarkPosition === "top-left") gravity = "north_west";
    else if (watermarkPosition === "center") gravity = "center";

    // Inject watermark parameters into Cloudinary URL:
    // e.g. l_text:Arial_20_bold:Text,g_south_east,x_15,y_15,o_60
    const transformation = `l_text:Arial_18_bold:${text},g_${gravity},x_12,y_12,o_50`;
    
    // Insert transformation after /upload/
    if (img.mediumUrl.includes("/upload/")) {
      return img.mediumUrl.replace("/upload/", `/upload/${transformation}/`);
    }
    return img.mediumUrl;
  };

  return (
    <div className="columns-2 sm:columns-3 lg:columns-4 xl:columns-5 gap-6 [column-fill:_balance] w-full">
      {images.map((img, index) => {
        const displayUrl = getDisplayUrl(img);
        const ratio = img.height / img.width;

        return (
          <div
            key={img._id}
            onClick={() => onImageClick(index)}
            className="break-inside-avoid mb-6 relative group rounded-2xl overflow-hidden bg-slate-900 border border-slate-900 cursor-pointer shadow-lg hover:shadow-emerald-500/5 hover:border-slate-800 transition duration-300"
            style={{ contentVisibility: "auto" }}
          >
            {/* Aspect ratio placeholder using padding */}
            <div
              className="w-full relative overflow-hidden"
              style={{ paddingBottom: `${ratio * 100}%` }}
            >
              {/* eslint-disable-next-line @typescript-eslint/no-img-element */}
              <img
                src={displayUrl}
                alt={img.altText || img.originalFilename}
                loading={index < 8 ? "eager" : "lazy"}
                className="absolute inset-0 h-full w-full object-cover group-hover:scale-[1.03] transition duration-500"
              />
            </div>

            {/* Hover details overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
              <div className="flex justify-between items-end gap-4">
                <div className="min-w-0 text-left">
                  <p className="text-sm font-bold text-slate-100 truncate">
                    {img.caption || img.originalFilename}
                  </p>
                  {img.altText && (
                    <p className="text-[10px] text-slate-400 truncate mt-0.5">{img.altText}</p>
                  )}
                </div>

                <div className="flex gap-2 shrink-0">
                  <div className="p-2 bg-slate-900/90 border border-slate-800 text-slate-300 hover:text-emerald-400 rounded-xl transition duration-200">
                    <ZoomIn className="h-4 w-4" />
                  </div>
                  {allowDownload && (
                    <button
                      type="button"
                      onClick={(e) => onDownloadClick(e, img)}
                      className="p-2 bg-slate-900/90 border border-slate-800 text-slate-300 hover:text-emerald-400 rounded-xl transition duration-200"
                      title="Download Image"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
