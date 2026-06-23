import { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { dbConnect } from "@/lib/db/connect";
import { Folder } from "@/lib/db/models/Folder";
import { Image } from "@/lib/db/models/Image";
import { verifyJWT } from "@/lib/auth/jwt";
import PasswordGateWrapper from "./PasswordGateWrapper";
import GalleryClient from "./GalleryClient";

interface Props {
  params: Promise<{ slug: string }>;
}

async function getFolderBySlug(slug: string) {
  await dbConnect();
  return Folder.findOne({ slug });
}

// Generate dynamic metadata for SEO
export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params;
  const folder = await getFolderBySlug(params.slug);

  if (!folder || !folder.isPublished) {
    return {
      title: "Not Found — ImgWeb",
    };
  }

  // Check if password protected
  if (folder.passwordProtected) {
    return {
      title: "Password Protected Gallery — ImgWeb",
      description: "This gallery is protected by a password gate.",
    };
  }

  const title = folder.seoTitle || `${folder.name} — ImgWeb`;
  const description = folder.seoDescription || folder.description || `Browse the ${folder.name} photo gallery.`;
  const coverUrl = folder.coverImageUrl || "";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: coverUrl ? [{ url: coverUrl, width: 1200, height: 630 }] : [],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: coverUrl ? [coverUrl] : [],
    },
  };
}

export default async function PublicGalleryPage(props: Props) {
  const params = await props.params;
  const { slug } = params;
  
  await dbConnect();
  const folder = await getFolderBySlug(slug);

  // 1. 404 if folder doesn't exist or is draft (unpublished)
  if (!folder || !folder.isPublished) {
    notFound();
  }

  // 2. 404/expired if expired
  if (folder.expiresAt && new Date(folder.expiresAt) < new Date()) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="text-center max-w-sm space-y-4">
          <h2 className="text-2xl font-bold text-slate-300">Gallery Expired</h2>
          <p className="text-slate-500 text-sm">
            This photo gallery has reached its scheduled expiration date and is no longer available.
          </p>
        </div>
      </div>
    );
  }

  // 3. Password Verification in Server Component
  if (folder.passwordProtected) {
    const cookieStore = await cookies();
    const token = cookieStore.get(`gallery_session_${slug}`)?.value;
    const secret = process.env.JWT_SECRET || "";

    let authorized = false;
    if (token) {
      const payload = await verifyJWT(token, secret);
      if (payload && payload.slug === slug && payload.authorized === true) {
        authorized = true;
      }
    }

    if (!authorized) {
      // Return client password gate component wrapper
      return <PasswordGateWrapper slug={slug} folderName={folder.name} />;
    }
  }

  // 4. Fetch initial images for fast LCP server render (first 20 images)
  const initialImagesData = await Image.find({ folderId: folder._id })
    .sort({ uploadedAt: -1 })
    .limit(20);

  // Convert Mongoose documents to plain objects for safe props passing
  const serializedFolder = {
    _id: folder._id.toString(),
    name: folder.name,
    slug: folder.slug,
    description: folder.description || "",
    coverImageUrl: folder.coverImageUrl || "",
    allowDownload: folder.allowDownload,
    allowBulkZip: folder.allowBulkZip,
    watermarkEnabled: folder.watermarkEnabled,
    watermarkText: folder.watermarkText || "",
    watermarkPosition: folder.watermarkPosition,
    totalImages: folder.totalImages,
  };

  const serializedImages = initialImagesData.map((img) => ({
    _id: img._id.toString(),
    originalFilename: img.originalFilename,
    secureUrl: img.secureUrl,
    thumbnailUrl: img.thumbnailUrl,
    mediumUrl: img.mediumUrl,
    format: img.format,
    width: img.width,
    height: img.height,
    fileSize: img.fileSize,
    altText: img.altText || null,
    caption: img.caption || null,
  }));

  return (
    <GalleryClient
      folder={serializedFolder}
      initialImages={serializedImages}
    />
  );
}
