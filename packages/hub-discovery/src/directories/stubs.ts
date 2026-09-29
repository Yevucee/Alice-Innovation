import type { HubDirectoryAdapter } from "../types.js";

function stub(slug: string): HubDirectoryAdapter {
  return {
    slug,
    async discover() {
      return [];
    },
  };
}

/** Registered for future adapters; discovery returns empty until implemented. */
export const directoryStubs: HubDirectoryAdapter[] = [
  stub("startup-uganda"),
  stub("orange-digital-centers"),
  stub("egypt-tiec"),
  stub("global-innovation-gathering"),
  stub("briter"),
  stub("vc4a"),
];
