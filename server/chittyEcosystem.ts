/**
 * ChittyOS Complete Ecosystem Integration
 * Evidence Ledger as part of the broader ChittyOS platform
 */

import { ChittyCloudflareCore, type ChittyCloudflareConfig } from './chittyCloudflareCore';
import { z } from 'zod';

/**
 * ChittyOS Ecosystem Service Map
 * Based on the official service domains
 */
export const ChittyOSServices = {
  // Core Platform Services
  ID: 'id.chitty.cc',           // ✅ ChittyID generation (working)
  SCHEMA: 'schema.chitty.cc',   // Schema registry & data models
  CHAIN: 'chain.chitty.cc',     // ChittyChain blockchain for immutability
  LEDGER: 'ledger.chitty.cc',   // Evidence ledger (what we built!)
  TRUST: 'trust.chitty.cc',     // Trust scoring & reputation
  VERIFY: 'verify.chitty.cc',   // Verification & authentication
} as const;

/**
 * Evidence Ledger Schema for ChittyOS
 */
export const EvidenceLedgerSchema = z.object({
  chittyId: z.string().uuid(),
  namespace: z.string().default('evidence-ledger'),
  region: z.number().default(1),
  jurisdiction: z.string().default('USA'),
  trustLevel: z.number().min(1).max(5).default(3),

  // Evidence metadata
  evidenceType: z.enum(['document', 'photo', 'video', 'audio', 'digital', 'physical']),
  retentionDays: z.number().default(2555), // 7 years
  encryption: z.string().default('AES-256-GCM'),

  // Legal framework
  legalFramework: z.string().default('USA_FEDERAL'),
  evidenceStandards: z.string().default('FRE'), // Federal Rules of Evidence
  chainOfCustody: z.enum(['strict', 'standard', 'basic']).default('strict'),
  digitalSignatureRequired: z.boolean().default(true),
});

/**
 * Complete ChittyOS Ecosystem Configuration
 */
export const chittyOSEcosystemConfig: ChittyCloudflareConfig = {
  services: {
    // Core ChittyOS Platform Services
    schema: {
      enabled: true,
      domain: ChittyOSServices.SCHEMA,
      apiKey: process.env.CHITTY_SCHEMA_API_KEY,
    },
    id: {
      enabled: true,
      domain: ChittyOSServices.ID,
      apiKey: process.env.CHITTY_ID_API_KEY,
    },
    chain: {
      enabled: true,
      domain: ChittyOSServices.CHAIN,
      apiKey: process.env.CHITTY_CHAIN_API_KEY,
    },
    trust: {
      enabled: true,
      domain: ChittyOSServices.TRUST,
      apiKey: process.env.CHITTY_TRUST_API_KEY,
    },

    // Evidence Ledger Services (Our Domain)
    assets: {
      enabled: true,
      domain: ChittyOSServices.LEDGER,
      apiKey: process.env.CHITTY_LEDGER_API_KEY,
    },
    file: {
      enabled: true,
      domain: ChittyOSServices.LEDGER,
      apiKey: process.env.CHITTY_LEDGER_API_KEY,
    },

    // Verification & Authentication
    resolution: {
      enabled: true,
      domain: ChittyOSServices.VERIFY,
      apiKey: process.env.CHITTY_VERIFY_API_KEY,
    },
  },

  // AI Services for Evidence Analysis
  ai: {
    enabled: true,
    vectorize: {
      enabled: true,
      indexName: 'chitty-evidence-vectors',
    },
    workers: {
      enabled: true,
      scriptName: 'chitty-evidence-ai',
    },
  },

  // Cloudflare Edge Configuration
  cloudflare: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    apiToken: process.env.CLOUDFLARE_API_TOKEN,
    zone: process.env.CLOUDFLARE_ZONE_ID,
  },
};

/**
 * Evidence Ledger Integration Service
 * Specialized service for evidence management within ChittyOS
 */
export class ChittyEvidenceLedger {
  private core: ChittyCloudflareCore;
  private config: typeof EvidenceLedgerSchema._type;

  constructor(core: ChittyCloudflareCore) {
    this.core = core;
    this.config = {
      namespace: process.env.CHITTY_NAMESPACE || 'evidence-ledger',
      region: parseInt(process.env.CHITTY_REGION || '1'),
      jurisdiction: process.env.CHITTY_JURISDICTION || 'USA',
      trustLevel: parseInt(process.env.CHITTY_TRUST_LEVEL || '3'),
      retentionDays: parseInt(process.env.CHITTY_EVIDENCE_RETENTION_DAYS || '2555'),
      encryption: process.env.CHITTY_EVIDENCE_ENCRYPTION || 'AES-256-GCM',
      legalFramework: process.env.CHITTY_LEGAL_FRAMEWORK || 'USA_FEDERAL',
      evidenceStandards: process.env.CHITTY_EVIDENCE_STANDARDS || 'FRE',
      chainOfCustody: (process.env.CHITTY_CHAIN_OF_CUSTODY as any) || 'strict',
      digitalSignatureRequired: process.env.CHITTY_DIGITAL_SIGNATURE_REQUIRED === 'true',
    } as any;
  }

  /**
   * Submit evidence to the ChittyOS Evidence Ledger
   */
  async submitEvidence(evidence: {
    chittyId?: string;
    evidenceType: string;
    data: any;
    metadata: any;
    submitterId: string;
  }) {
    // Generate ChittyID if not provided
    const services = await this.getServices();
    const chittyId = evidence.chittyId || (await services.id.generate('evidence')).id;

    // Validate evidence schema
    const validatedEvidence = EvidenceLedgerSchema.parse({
      chittyId,
      evidenceType: evidence.evidenceType,
      ...this.config,
    });

    // Submit to schema service for validation
    await services.schema.validate('evidence-v1', {
      ...validatedEvidence,
      data: evidence.data,
      metadata: evidence.metadata,
    });

    // Store in evidence ledger
    const ledgerResult = await services.assets.register({
      chittyId,
      type: 'evidence',
      data: evidence.data,
      metadata: {
        ...evidence.metadata,
        submitterId: evidence.submitterId,
        submissionTimestamp: new Date().toISOString(),
        jurisdiction: this.config.jurisdiction,
        legalFramework: this.config.legalFramework,
      },
    });

    // Calculate trust score
    const trustScore = await services.trust.calculate(chittyId, {
      evidenceType: evidence.evidenceType,
      submitterId: evidence.submitterId,
      metadata: evidence.metadata,
    });

    // Mint to blockchain for immutability
    const chainResult = await services.chain.mint(chittyId, {
      evidenceHash: ledgerResult.hash,
      trustScore: trustScore.score,
      timestamp: new Date().toISOString(),
    });

    return {
      chittyId,
      ledgerResult,
      trustScore,
      chainResult,
      status: 'submitted',
      retentionUntil: new Date(Date.now() + this.config.retentionDays * 24 * 60 * 60 * 1000),
    };
  }

  /**
   * Retrieve evidence by ChittyID
   */
  async getEvidence(chittyId: string) {
    const services = await this.getServices();

    // Get from ledger
    const evidence = await services.assets.get(chittyId);

    // Get trust score
    const trustScore = await services.trust.history(chittyId);

    // Get blockchain verification
    const chainVerification = await services.chain.getTransaction(evidence.transactionHash);

    return {
      evidence,
      trustScore,
      chainVerification,
      jurisdiction: this.config.jurisdiction,
      legalFramework: this.config.legalFramework,
    };
  }

  /**
   * Verify evidence authenticity
   */
  async verifyEvidence(chittyId: string) {
    const services = await this.getServices();

    // Multi-layer verification
    const results = await Promise.all([
      services.verify.verify(chittyId, { method: 'blockchain' }),
      services.trust.calculate(chittyId),
      services.chain.getTransaction(chittyId),
    ]);

    const [blockchainVerif, trustVerif, chainData] = results;

    return {
      isAuthentic: blockchainVerif.verified && trustVerif.trustScore >= this.config.trustLevel,
      blockchainVerification: blockchainVerif,
      trustVerification: trustVerif,
      chainData,
      complianceLevel: this.calculateComplianceLevel(results),
    };
  }

  /**
   * Get ecosystem status for evidence ledger
   */
  async getEcosystemStatus() {
    const status = await this.core.getEcosystemStatus();

    return {
      ...status,
      evidenceLedger: {
        status: status.assets, // Evidence ledger runs on assets service
        namespace: this.config.namespace,
        region: this.config.region,
        jurisdiction: this.config.jurisdiction,
        legalFramework: this.config.legalFramework,
        retentionPolicy: `${this.config.retentionDays} days`,
        encryption: this.config.encryption,
      },
    };
  }

  private async getServices() {
    return {
      schema: await this.core.schema(),
      id: await this.core.id(),
      assets: await this.core.assets(),
      trust: await this.core.trust(),
      chain: await this.core.chain(),
      verify: await this.core.resolution(), // Using resolution service for verification
    };
  }

  private calculateComplianceLevel(verificationResults: any[]): 'full' | 'partial' | 'minimal' {
    const [blockchain, trust, chain] = verificationResults;

    if (blockchain.verified && trust.trustScore >= 4 && chain.confirmed) {
      return 'full';
    } else if (blockchain.verified && trust.trustScore >= 2) {
      return 'partial';
    } else {
      return 'minimal';
    }
  }
}

/**
 * Create Evidence Ledger instance with ChittyOS ecosystem integration
 */
export async function createEvidenceLedger(): Promise<ChittyEvidenceLedger> {
  const core = new ChittyCloudflareCore(chittyOSEcosystemConfig);
  await core.initialize();

  return new ChittyEvidenceLedger(core);
}