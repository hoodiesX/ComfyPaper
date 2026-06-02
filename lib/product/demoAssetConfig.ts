export type DemoDevice = "academic" | "kindle" | "ipad";

export type ResolvedDemoAsset = {
  src: string | null;
  source: string | null;
};

export type ResolvedDemoAssetManifest = {
  original: ResolvedDemoAsset;
  optimized: Record<DemoDevice, ResolvedDemoAsset>;
};

export const ORIGINAL_DEMO_ASSETS = ["/demo/demo-original.png"];

export const OPTIMIZED_DEMO_ASSETS: Record<DemoDevice, string[]> = {
  academic: ["/demo/demo-optimized-academic.png", "/demo/demo-optimized-ipad.png"],
  kindle: ["/demo/demo-optimized-kindle.png", "/demo/demo-optimized-ipad.png", "/demo/demo-optimized-academic.png"],
  ipad: ["/demo/demo-optimized-ipad.png", "/demo/demo-optimized-academic.png"]
};

export const EMPTY_DEMO_ASSET_MANIFEST: ResolvedDemoAssetManifest = {
  original: { src: null, source: null },
  optimized: {
    academic: { src: null, source: null },
    kindle: { src: null, source: null },
    ipad: { src: null, source: null }
  }
};
