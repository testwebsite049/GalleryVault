"use client";

import React from "react";
import { useRouter } from "next/navigation";
import PasswordGate from "@/components/gallery/PasswordGate";

interface PasswordGateWrapperProps {
  slug: string;
  folderName: string;
}

export default function PasswordGateWrapper({ slug, folderName }: PasswordGateWrapperProps) {
  const router = useRouter();

  const handleSuccess = () => {
    // Force Next.js Router to refetch the server component with the newly set cookie
    router.refresh();
  };

  return (
    <PasswordGate slug={slug} folderName={folderName} onSuccess={handleSuccess} />
  );
}
