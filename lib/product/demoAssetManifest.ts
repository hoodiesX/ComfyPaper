import manifest from "./demoAssetManifest.generated.json";
import type { ResolvedDemoAssetManifest } from "./demoAssetConfig";

export function getDemoAssetManifest(): ResolvedDemoAssetManifest {
  return manifest as ResolvedDemoAssetManifest;
}
