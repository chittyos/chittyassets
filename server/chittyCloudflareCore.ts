import { z } from "zod";

/**
 * Configuration schemas for ChittyCloudflare Core services
 */
const ServiceConfigSchema = z.object({
  enabled: z.boolean().default(false),
  domain: z.string().optional(),
  apiKey: z.string().optional(),
  region: z.string().default('auto'),
});

const AIConfigSchema = z.object({
  enabled: z.boolean().default(false),
  vectorize: z.object({
    enabled: z.boolean().default(false),
    indexName: z.string().optional(),
  }).optional(),
  workers: z.object({
    enabled: z.boolean().default(false),
    scriptName: z.string().optional(),
  }).optional(),
});

const CoreConfigSchema = z.object({
  services: z.object({
    schema: ServiceConfigSchema.optional(),
    id: ServiceConfigSchema.optional(),
    assets: ServiceConfigSchema.optional(),
    trust: ServiceConfigSchema.optional(),
    resolution: ServiceConfigSchema.optional(),
    file: ServiceConfigSchema.optional(),
    chain: ServiceConfigSchema.optional(),
  }),
  ai: AIConfigSchema.optional(),
  cloudflare: z.object({
    accountId: z.string().optional(),
    apiToken: z.string().optional(),
    zone: z.string().optional(),
  }).optional(),
});

export type ChittyCloudflareConfig = z.infer<typeof CoreConfigSchema>;

/**
 * Service status types
 */
export type ServiceStatus = 'online' | 'degraded' | 'offline' | 'maintenance';

export interface EcosystemStatus {
  schema: ServiceStatus;
  id: ServiceStatus;
  assets: ServiceStatus;
  trust: ServiceStatus;
  resolution: ServiceStatus;
  file: ServiceStatus;
  chain: ServiceStatus;
}

/**
 * ChittyCloudflare Core - Unified service orchestration for ChittyOS ecosystem
 * Provides high-level abstractions for all ChittyChain services running on Cloudflare
 */
export class ChittyCloudflareCore {
  private config: ChittyCloudflareConfig;
  private initialized: boolean = false;
  private services: Map<string, any> = new Map();

  constructor(config: ChittyCloudflareConfig) {
    // Validate and store configuration
    this.config = CoreConfigSchema.parse(config);
  }

  /**
   * Initialize all enabled services and establish connections
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.warn('ChittyCloudflareCore already initialized');
      return;
    }

    console.log('🚀 Initializing ChittyCloudflare Core...');

    try {
      // Initialize each enabled service
      await this.initializeServices();

      // Initialize AI services if enabled
      if (this.config.ai?.enabled) {
        await this.initializeAI();
      }

      // Perform health checks
      await this.performHealthChecks();

      this.initialized = true;
      console.log('✅ ChittyCloudflare Core initialized successfully');

    } catch (error) {
      console.error('❌ Failed to initialize ChittyCloudflare Core:', error);
      throw new Error(`ChittyCloudflare Core initialization failed: ${error}`);
    }
  }

  /**
   * Get ecosystem-wide service status
   */
  async getEcosystemStatus(): Promise<EcosystemStatus> {
    const status: EcosystemStatus = {
      schema: 'offline',
      id: 'offline',
      assets: 'offline',
      trust: 'offline',
      resolution: 'offline',
      file: 'offline',
      chain: 'offline',
    };

    // Check each service
    for (const [serviceName, serviceConfig] of Object.entries(this.config.services)) {
      if (serviceConfig?.enabled) {
        try {
          const serviceStatus = await this.checkServiceHealth(serviceName, serviceConfig);
          (status as any)[serviceName] = serviceStatus;
        } catch (error) {
          console.warn(`Health check failed for ${serviceName}:`, error);
          (status as any)[serviceName] = 'offline';
        }
      }
    }

    return status;
  }

  /**
   * ChittySchema Service - Schema registry and validation
   */
  async schema() {
    return this.getServiceProxy('schema', {
      // Register a new schema
      register: async (schemaId: string, schema: any) => {
        return this.callService('schema', '/register', {
          method: 'POST',
          body: { schemaId, schema },
        });
      },

      // Validate data against schema
      validate: async (schemaId: string, data: any) => {
        return this.callService('schema', '/validate', {
          method: 'POST',
          body: { schemaId, data },
        });
      },

      // Get schema by ID
      get: async (schemaId: string) => {
        return this.callService('schema', `/schemas/${schemaId}`, {
          method: 'GET',
        });
      },
    });
  }

  /**
   * ChittyID Service - Identity management and verification
   */
  async id() {
    return this.getServiceProxy('id', {
      // Generate new ChittyID
      generate: async (type: 'user' | 'asset' | 'organization' = 'user') => {
        return this.callService('id', '/generate', {
          method: 'POST',
          body: { type, version: 'v7' },
        });
      },

      // Verify ChittyID ownership
      verify: async (chittyId: string, proof: any) => {
        return this.callService('id', '/verify', {
          method: 'POST',
          body: { chittyId, proof },
        });
      },

      // Get ChittyID metadata
      get: async (chittyId: string) => {
        return this.callService('id', `/identities/${chittyId}`, {
          method: 'GET',
        });
      },
    });
  }

  /**
   * ChittyAssets Service - Asset registry and management
   */
  async assets() {
    return this.getServiceProxy('assets', {
      // Register new asset
      register: async (assetData: any) => {
        return this.callService('assets', '/register', {
          method: 'POST',
          body: assetData,
        });
      },

      // Update asset information
      update: async (chittyId: string, updates: any) => {
        return this.callService('assets', `/assets/${chittyId}`, {
          method: 'PATCH',
          body: updates,
        });
      },

      // Get asset by ChittyID
      get: async (chittyId: string) => {
        return this.callService('assets', `/assets/${chittyId}`, {
          method: 'GET',
        });
      },

      // Freeze asset (7-day immutability period)
      freeze: async (chittyId: string) => {
        return this.callService('assets', `/assets/${chittyId}/freeze`, {
          method: 'POST',
        });
      },
    });
  }

  /**
   * ChittyTrust Service - Trust scoring and verification
   */
  async trust() {
    return this.getServiceProxy('trust', {
      // Calculate trust score
      calculate: async (chittyId: string, context?: any) => {
        return this.callService('trust', '/calculate', {
          method: 'POST',
          body: { chittyId, context },
        });
      },

      // Get trust history
      history: async (chittyId: string) => {
        return this.callService('trust', `/trust/${chittyId}/history`, {
          method: 'GET',
        });
      },

      // Submit trust evidence
      evidence: async (chittyId: string, evidence: any) => {
        return this.callService('trust', `/trust/${chittyId}/evidence`, {
          method: 'POST',
          body: evidence,
        });
      },
    });
  }

  /**
   * ChittyResolution Service - Dispute resolution and arbitration
   */
  async resolution() {
    return this.getServiceProxy('resolution', {
      // File a dispute
      dispute: async (chittyId: string, disputeData: any) => {
        return this.callService('resolution', '/disputes', {
          method: 'POST',
          body: { chittyId, ...disputeData },
        });
      },

      // Get dispute status
      getDispute: async (disputeId: string) => {
        return this.callService('resolution', `/disputes/${disputeId}`, {
          method: 'GET',
        });
      },

      // Submit evidence for dispute
      submitEvidence: async (disputeId: string, evidence: any) => {
        return this.callService('resolution', `/disputes/${disputeId}/evidence`, {
          method: 'POST',
          body: evidence,
        });
      },
    });
  }

  /**
   * ChittyFile Service - Decentralized file storage
   */
  async file() {
    return this.getServiceProxy('file', {
      // Upload file
      upload: async (file: Buffer | Uint8Array, metadata: any) => {
        return this.callService('file', '/upload', {
          method: 'POST',
          body: { file: Array.from(file), metadata },
        });
      },

      // Get file
      get: async (fileId: string) => {
        return this.callService('file', `/files/${fileId}`, {
          method: 'GET',
        });
      },

      // Pin file to IPFS
      pin: async (fileId: string) => {
        return this.callService('file', `/files/${fileId}/pin`, {
          method: 'POST',
        });
      },
    });
  }

  /**
   * ChittyChain Service - Blockchain operations
   */
  async chain() {
    return this.getServiceProxy('chain', {
      // Mint asset token
      mint: async (chittyId: string, metadata: any) => {
        return this.callService('chain', '/mint', {
          method: 'POST',
          body: { chittyId, metadata },
        });
      },

      // Transfer token
      transfer: async (tokenId: string, to: string) => {
        return this.callService('chain', '/transfer', {
          method: 'POST',
          body: { tokenId, to },
        });
      },

      // Get transaction status
      getTransaction: async (txHash: string) => {
        return this.callService('chain', `/transactions/${txHash}`, {
          method: 'GET',
        });
      },
    });
  }

  /**
   * AI Services - Vectorize and Workers AI
   */
  async ai() {
    if (!this.config.ai?.enabled) {
      throw new Error('AI services not enabled');
    }

    return {
      // Vectorize operations
      vectorize: this.config.ai.vectorize?.enabled ? {
        upsert: async (vectors: any[]) => {
          return this.callAIService('vectorize', '/upsert', {
            method: 'POST',
            body: { vectors },
          });
        },

        query: async (vector: number[], topK: number = 10) => {
          return this.callAIService('vectorize', '/query', {
            method: 'POST',
            body: { vector, topK },
          });
        },

        delete: async (ids: string[]) => {
          return this.callAIService('vectorize', '/delete', {
            method: 'POST',
            body: { ids },
          });
        },
      } : null,

      // Workers AI operations
      workers: this.config.ai.workers?.enabled ? {
        run: async (model: string, input: any) => {
          return this.callAIService('workers', '/run', {
            method: 'POST',
            body: { model, input },
          });
        },
      } : null,
    };
  }

  // Private implementation methods

  private async initializeServices(): Promise<void> {
    console.log('🔧 Initializing ChittyChain services...');

    for (const [serviceName, serviceConfig] of Object.entries(this.config.services)) {
      if (serviceConfig?.enabled) {
        console.log(`  • ${serviceName}: ${serviceConfig.domain || 'localhost'}`);

        // Store service configuration
        this.services.set(serviceName, {
          config: serviceConfig,
          baseUrl: serviceConfig.domain ? `https://${serviceConfig.domain}` : 'http://localhost:8080',
          apiKey: serviceConfig.apiKey || process.env.CHITTY_CLOUD_API_KEY,
        });
      }
    }
  }

  private async initializeAI(): Promise<void> {
    console.log('🤖 Initializing AI services...');

    if (this.config.ai?.vectorize?.enabled) {
      console.log('  • Vectorize: enabled');
    }

    if (this.config.ai?.workers?.enabled) {
      console.log('  • Workers AI: enabled');
    }
  }

  private async performHealthChecks(): Promise<void> {
    console.log('🏥 Performing health checks...');

    const healthPromises = Array.from(this.services.entries()).map(
      async ([serviceName, serviceInfo]) => {
        try {
          await this.checkServiceHealth(serviceName, serviceInfo.config);
          console.log(`  ✅ ${serviceName}: healthy`);
        } catch (error) {
          console.log(`  ⚠️  ${serviceName}: degraded`);
        }
      }
    );

    await Promise.allSettled(healthPromises);
  }

  private async checkServiceHealth(serviceName: string, config: any): Promise<ServiceStatus> {
    const service = this.services.get(serviceName);
    if (!service) return 'offline';

    try {
      const response = await fetch(`${service.baseUrl}/health`, {
        method: 'GET',
        headers: service.apiKey ? {
          'Authorization': `Bearer ${service.apiKey}`,
        } : {},
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      if (response.ok) {
        const data = await response.json();
        return data.status === 'healthy' ? 'online' : 'degraded';
      }

      return 'degraded';
    } catch (error) {
      return 'offline';
    }
  }

  private getServiceProxy(serviceName: string, methods: any) {
    if (!this.services.has(serviceName)) {
      throw new Error(`Service ${serviceName} not enabled or not found`);
    }

    return methods;
  }

  private async callService(serviceName: string, endpoint: string, options: any) {
    const service = this.services.get(serviceName);
    if (!service) {
      throw new Error(`Service ${serviceName} not available`);
    }

    const url = `${service.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(service.apiKey && { 'Authorization': `Bearer ${service.apiKey}` }),
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
      });

      if (!response.ok) {
        throw new Error(`Service ${serviceName} returned ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Error calling ${serviceName} service:`, error);
      throw error;
    }
  }

  private async callAIService(service: string, endpoint: string, options: any) {
    // Placeholder for AI service calls - would integrate with Cloudflare AI APIs
    throw new Error(`AI service ${service} not yet implemented`);
  }
}

/**
 * Factory function to create and initialize ChittyCloudflare Core
 */
export async function createChittyCore(config: ChittyCloudflareConfig): Promise<ChittyCloudflareCore> {
  const core = new ChittyCloudflareCore(config);
  await core.initialize();
  return core;
}

/**
 * Default configuration for development
 */
export const defaultConfig: ChittyCloudflareConfig = {
  services: {
    schema: { enabled: true, domain: 'schema.chitty.cc' },
    id: { enabled: true, domain: 'id.chitty.cc' },
    assets: { enabled: true, domain: 'assets.chitty.cc' },
    trust: { enabled: true, domain: 'trust.chitty.cc' },
    resolution: { enabled: true, domain: 'resolution.chitty.cc' },
    file: { enabled: true, domain: 'file.chitty.cc' },
    chain: { enabled: true, domain: 'chain.chitty.cc' },
  },
  ai: {
    enabled: true,
    vectorize: { enabled: true, indexName: 'chitty-assets' },
    workers: { enabled: true, scriptName: 'chitty-ai-worker' },
  },
  cloudflare: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    apiToken: process.env.CLOUDFLARE_API_TOKEN,
    zone: process.env.CLOUDFLARE_ZONE_ID,
  },
};