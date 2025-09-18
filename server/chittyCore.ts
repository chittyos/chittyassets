import { ChittyCloudflareCore, createChittyCore, type ChittyCloudflareConfig } from './chittyCloudflareCore';
import { chittyOSEcosystemConfig, ChittyEvidenceLedger, createEvidenceLedger } from './chittyEcosystem';

/**
 * ChittyOS Cloudflare Core configuration for ChittyAssets
 * This provides the interface you requested:
 *
 * import { ChittyCloudflareCore } from '@chittyos/cloudflare-core';
 * const chitty = new ChittyCloudflareCore({ ... });
 * await chitty.initialize();
 */

// Use the complete ChittyOS ecosystem configuration
const chittyConfig = chittyOSEcosystemConfig;

// Global ChittyCore instance
let chittyInstance: ChittyCloudflareCore | null = null;

/**
 * Initialize ChittyCloudflare Core singleton
 */
export async function initializeChittyCore(): Promise<ChittyCloudflareCore> {
  if (chittyInstance) {
    return chittyInstance;
  }

  console.log('🚀 Initializing ChittyOS Cloudflare Core...');

  try {
    // Create and initialize the core instance
    chittyInstance = new ChittyCloudflareCore(chittyConfig);
    await chittyInstance.initialize();

    console.log('✅ ChittyOS Cloudflare Core ready');
    return chittyInstance;

  } catch (error) {
    console.error('❌ Failed to initialize ChittyOS Cloudflare Core:', error);

    // Fall back to basic functionality if Cloudflare services are unavailable
    console.log('🔄 Falling back to local-only mode...');
    chittyInstance = new ChittyCloudflareCore({
      services: {
        // Disable all remote services for fallback
        schema: { enabled: false },
        id: { enabled: false },
        assets: { enabled: false },
        trust: { enabled: false },
        resolution: { enabled: false },
        file: { enabled: false },
        chain: { enabled: false },
      },
      ai: { enabled: false },
    });

    // Don't call initialize() for fallback mode
    console.log('⚠️  Running in local-only mode - some features may be limited');
    return chittyInstance;
  }
}

/**
 * Get the ChittyCore instance (must be initialized first)
 */
export function getChittyCore(): ChittyCloudflareCore {
  if (!chittyInstance) {
    throw new Error('ChittyCore not initialized. Call initializeChittyCore() first.');
  }
  return chittyInstance;
}

/**
 * Convenient service accessors
 */
export async function getChittyServices() {
  const core = getChittyCore();

  return {
    schema: await core.schema(),
    id: await core.id(),
    assets: await core.assets(),
    trust: await core.trust(),
    resolution: await core.resolution(),
    file: await core.file(),
    chain: await core.chain(),
    ai: await core.ai(),

    // Evidence Ledger (Our specialized service)
    evidenceLedger: new ChittyEvidenceLedger(core),

    // Utility methods
    getEcosystemStatus: () => core.getEcosystemStatus(),
  };
}

/**
 * Get Evidence Ledger instance
 */
export async function getEvidenceLedger(): Promise<ChittyEvidenceLedger> {
  const services = await getChittyServices();
  return services.evidenceLedger;
}

/**
 * Export the main class for the interface you requested
 * This allows: import { ChittyCloudflareCore } from '@chittyos/cloudflare-core';
 */
export { ChittyCloudflareCore } from './chittyCloudflareCore';