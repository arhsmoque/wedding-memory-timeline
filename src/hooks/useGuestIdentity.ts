import { useEffect } from "react";
import { ensureGuestAuth } from "../lib/firebase";

export function useGuestIdentity() {
  useEffect(() => {
    void ensureGuestAuth().catch((error) => {
      console.warn("Guest auth bootstrap failed", error);
    });
  }, []);
}
