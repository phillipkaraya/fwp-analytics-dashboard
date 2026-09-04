import { Suspense } from "react";
import { Vault } from "@/components/vault/vault";

// useSearchParams() inside Vault needs a Suspense boundary for static export.
export default function VaultPage() {
  return (
    <Suspense fallback={null}>
      <Vault />
    </Suspense>
  );
}
