import { EbayIntegration } from "./ebay";
import { PlatformId, PlatformIntegration } from "./types";

class PlatformManager {
  private platforms: Map<PlatformId, PlatformIntegration>;

  constructor() {
    this.platforms = new Map();
    this.registerPlatforms();
  }

  private registerPlatforms() {
    // Register all platform integrations here
    this.platforms.set("ebay", new EbayIntegration());
    // Add other platforms as they are implemented
    // this.platforms.set("grailed", new GrailedIntegration());
    // this.platforms.set("depop", new DepopIntegration());
    // this.platforms.set("offerup", new OfferUpIntegration());
  }

  getPlatform(platformId: PlatformId): PlatformIntegration {
    const platform = this.platforms.get(platformId);
    if (!platform) {
      throw new Error(`Platform ${platformId} not supported`);
    }
    return platform;
  }

  getSupportedPlatforms(): PlatformId[] {
    return Array.from(this.platforms.keys());
  }

  isPlatformSupported(platformId: PlatformId): boolean {
    return this.platforms.has(platformId);
  }
}

// Export a singleton instance
export const platformManager = new PlatformManager(); 