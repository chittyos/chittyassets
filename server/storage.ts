import {
  users,
  assets,
  evidence,
  timelineEvents,
  warranties,
  insurancePolicies,
  legalCases,
  aiAnalysisResults,
  type User,
  type UpsertUser,
  type Asset,
  type InsertAsset,
  type Evidence,
  type InsertEvidence,
  type TimelineEvent,
  type InsertTimelineEvent,
  type Warranty,
  type InsertWarranty,
  type InsurancePolicy,
  type InsertInsurancePolicy,
  type LegalCase,
  type InsertLegalCase,
  type AiAnalysisResult,
  type InsertAiAnalysisResult,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, lte, ilike, sql } from "drizzle-orm";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Asset operations
  createAsset(asset: InsertAsset): Promise<Asset>;
  getAsset(id: string, userId: string): Promise<Asset | undefined>;
  getUserAssets(userId: string, filters?: AssetFilters): Promise<Asset[]>;
  updateAsset(id: string, userId: string, updates: Partial<InsertAsset>): Promise<Asset>;
  deleteAsset(id: string, userId: string): Promise<void>;
  getAssetStats(userId: string): Promise<AssetStats>;
  
  // Evidence operations
  createEvidence(evidence: InsertEvidence): Promise<Evidence>;
  getEvidence(id: string, userId: string): Promise<Evidence | undefined>;
  getAssetEvidence(assetId: string, userId: string): Promise<Evidence[]>;
  updateEvidence(id: string, userId: string, updates: Partial<InsertEvidence>): Promise<Evidence>;
  deleteEvidence(id: string, userId: string): Promise<void>;
  
  // Timeline operations
  createTimelineEvent(event: InsertTimelineEvent): Promise<TimelineEvent>;
  getAssetTimeline(assetId: string, userId: string): Promise<TimelineEvent[]>;
  
  // Warranty operations
  createWarranty(warranty: InsertWarranty): Promise<Warranty>;
  getAssetWarranties(assetId: string, userId: string): Promise<Warranty[]>;
  getExpiringWarranties(userId: string, daysAhead: number): Promise<Warranty[]>;
  updateWarranty(id: string, userId: string, updates: Partial<InsertWarranty>): Promise<Warranty>;
  
  // Insurance operations
  createInsurancePolicy(policy: InsertInsurancePolicy): Promise<InsurancePolicy>;
  getAssetInsurance(assetId: string, userId: string): Promise<InsurancePolicy[]>;
  getActiveInsurance(userId: string): Promise<InsurancePolicy[]>;
  
  // Legal case operations
  createLegalCase(legalCase: InsertLegalCase): Promise<LegalCase>;
  getUserLegalCases(userId: string): Promise<LegalCase[]>;
  updateLegalCase(id: string, userId: string, updates: Partial<InsertLegalCase>): Promise<LegalCase>;
  
  // AI analysis operations
  createAiAnalysisResult(result: InsertAiAnalysisResult): Promise<AiAnalysisResult>;
  getEvidenceAnalysis(evidenceId: string): Promise<AiAnalysisResult[]>;
}

export interface AssetFilters {
  assetType?: string;
  status?: string;
  searchTerm?: string;
  minValue?: number;
  maxValue?: number;
  createdAfter?: Date;
  createdBefore?: Date;
}

export interface AssetStats {
  totalAssets: number;
  totalValue: number;
  verifiedAssets: number;
  averageTrustScore: number;
  assetsByType: Record<string, number>;
  assetsByStatus: Record<string, number>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Asset operations
  async createAsset(asset: InsertAsset): Promise<Asset> {
    const [newAsset] = await db.insert(assets).values(asset).returning();
    return newAsset;
  }

  async getAsset(id: string, userId: string): Promise<Asset | undefined> {
    const [asset] = await db
      .select()
      .from(assets)
      .where(and(eq(assets.id, id), eq(assets.userId, userId)));
    return asset;
  }

  async getUserAssets(userId: string, filters?: AssetFilters): Promise<Asset[]> {
    let query = db.select().from(assets).where(eq(assets.userId, userId));
    
    if (filters) {
      const conditions = [eq(assets.userId, userId)];
      
      if (filters.assetType) {
        conditions.push(eq(assets.assetType, filters.assetType as any));
      }
      
      if (filters.status) {
        conditions.push(eq(assets.status, filters.status as any));
      }
      
      if (filters.searchTerm) {
        conditions.push(
          sql`${assets.name} ILIKE ${`%${filters.searchTerm}%`} OR ${assets.description} ILIKE ${`%${filters.searchTerm}%`}`
        );
      }
      
      if (filters.minValue) {
        conditions.push(gte(assets.currentValue, filters.minValue.toString()));
      }
      
      if (filters.maxValue) {
        conditions.push(lte(assets.currentValue, filters.maxValue.toString()));
      }
      
      if (filters.createdAfter) {
        conditions.push(gte(assets.createdAt, filters.createdAfter));
      }
      
      if (filters.createdBefore) {
        conditions.push(lte(assets.createdAt, filters.createdBefore));
      }
      
      query = db.select().from(assets).where(and(...conditions));
    }
    
    return query.orderBy(desc(assets.createdAt));
  }

  async updateAsset(id: string, userId: string, updates: Partial<InsertAsset>): Promise<Asset> {
    const [updatedAsset] = await db
      .update(assets)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(assets.id, id), eq(assets.userId, userId)))
      .returning();
    return updatedAsset;
  }

  async deleteAsset(id: string, userId: string): Promise<void> {
    await db.delete(assets).where(and(eq(assets.id, id), eq(assets.userId, userId)));
  }

  async getAssetStats(userId: string): Promise<AssetStats> {
    const userAssets = await db.select().from(assets).where(eq(assets.userId, userId));
    
    const totalAssets = userAssets.length;
    const totalValue = userAssets.reduce((sum, asset) => 
      sum + (asset.currentValue ? parseFloat(asset.currentValue) : 0), 0
    );
    const verifiedAssets = userAssets.filter(asset => asset.verificationStatus === 'verified').length;
    const averageTrustScore = userAssets.reduce((sum, asset) => 
      sum + (asset.trustScore ? parseFloat(asset.trustScore) : 0), 0
    ) / (totalAssets || 1);
    
    const assetsByType: Record<string, number> = {};
    const assetsByStatus: Record<string, number> = {};
    
    userAssets.forEach(asset => {
      assetsByType[asset.assetType] = (assetsByType[asset.assetType] || 0) + 1;
      assetsByStatus[asset.status || 'unknown'] = (assetsByStatus[asset.status || 'unknown'] || 0) + 1;
    });
    
    return {
      totalAssets,
      totalValue,
      verifiedAssets,
      averageTrustScore,
      assetsByType,
      assetsByStatus,
    };
  }

  // Evidence operations
  async createEvidence(evidenceData: InsertEvidence): Promise<Evidence> {
    const [newEvidence] = await db.insert(evidence).values(evidenceData).returning();
    return newEvidence;
  }

  async getEvidence(id: string, userId: string): Promise<Evidence | undefined> {
    const [evidenceItem] = await db
      .select()
      .from(evidence)
      .where(and(eq(evidence.id, id), eq(evidence.userId, userId)));
    return evidenceItem;
  }

  async getAssetEvidence(assetId: string, userId: string): Promise<Evidence[]> {
    return db
      .select()
      .from(evidence)
      .where(and(eq(evidence.assetId, assetId), eq(evidence.userId, userId)))
      .orderBy(desc(evidence.createdAt));
  }

  async updateEvidence(id: string, userId: string, updates: Partial<InsertEvidence>): Promise<Evidence> {
    const [updatedEvidence] = await db
      .update(evidence)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(evidence.id, id), eq(evidence.userId, userId)))
      .returning();
    return updatedEvidence;
  }

  async deleteEvidence(id: string, userId: string): Promise<void> {
    await db.delete(evidence).where(and(eq(evidence.id, id), eq(evidence.userId, userId)));
  }

  // Timeline operations
  async createTimelineEvent(event: InsertTimelineEvent): Promise<TimelineEvent> {
    const [newEvent] = await db.insert(timelineEvents).values(event).returning();
    return newEvent;
  }

  async getAssetTimeline(assetId: string, userId: string): Promise<TimelineEvent[]> {
    return db
      .select()
      .from(timelineEvents)
      .where(and(eq(timelineEvents.assetId, assetId), eq(timelineEvents.userId, userId)))
      .orderBy(desc(timelineEvents.eventDate));
  }

  // Warranty operations
  async createWarranty(warranty: InsertWarranty): Promise<Warranty> {
    const [newWarranty] = await db.insert(warranties).values(warranty).returning();
    return newWarranty;
  }

  async getAssetWarranties(assetId: string, userId: string): Promise<Warranty[]> {
    return db
      .select()
      .from(warranties)
      .where(and(eq(warranties.assetId, assetId), eq(warranties.userId, userId)))
      .orderBy(desc(warranties.endDate));
  }

  async getExpiringWarranties(userId: string, daysAhead: number): Promise<Warranty[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);
    
    return db
      .select()
      .from(warranties)
      .where(
        and(
          eq(warranties.userId, userId),
          eq(warranties.isActive, true),
          lte(warranties.endDate, futureDate),
          gte(warranties.endDate, new Date())
        )
      )
      .orderBy(warranties.endDate);
  }

  async updateWarranty(id: string, userId: string, updates: Partial<InsertWarranty>): Promise<Warranty> {
    const [updatedWarranty] = await db
      .update(warranties)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(warranties.id, id), eq(warranties.userId, userId)))
      .returning();
    return updatedWarranty;
  }

  // Insurance operations
  async createInsurancePolicy(policy: InsertInsurancePolicy): Promise<InsurancePolicy> {
    const [newPolicy] = await db.insert(insurancePolicies).values(policy).returning();
    return newPolicy;
  }

  async getAssetInsurance(assetId: string, userId: string): Promise<InsurancePolicy[]> {
    return db
      .select()
      .from(insurancePolicies)
      .where(and(eq(insurancePolicies.assetId, assetId), eq(insurancePolicies.userId, userId)))
      .orderBy(desc(insurancePolicies.endDate));
  }

  async getActiveInsurance(userId: string): Promise<InsurancePolicy[]> {
    return db
      .select()
      .from(insurancePolicies)
      .where(
        and(
          eq(insurancePolicies.userId, userId),
          eq(insurancePolicies.isActive, true),
          gte(insurancePolicies.endDate, new Date())
        )
      )
      .orderBy(insurancePolicies.endDate);
  }

  // Legal case operations
  async createLegalCase(legalCase: InsertLegalCase): Promise<LegalCase> {
    const [newCase] = await db.insert(legalCases).values(legalCase).returning();
    return newCase;
  }

  async getUserLegalCases(userId: string): Promise<LegalCase[]> {
    return db
      .select()
      .from(legalCases)
      .where(eq(legalCases.userId, userId))
      .orderBy(desc(legalCases.createdAt));
  }

  async updateLegalCase(id: string, userId: string, updates: Partial<InsertLegalCase>): Promise<LegalCase> {
    const [updatedCase] = await db
      .update(legalCases)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(legalCases.id, id), eq(legalCases.userId, userId)))
      .returning();
    return updatedCase;
  }

  // AI analysis operations
  async createAiAnalysisResult(result: InsertAiAnalysisResult): Promise<AiAnalysisResult> {
    const [newResult] = await db.insert(aiAnalysisResults).values(result).returning();
    return newResult;
  }

  async getEvidenceAnalysis(evidenceId: string): Promise<AiAnalysisResult[]> {
    return db
      .select()
      .from(aiAnalysisResults)
      .where(eq(aiAnalysisResults.evidenceId, evidenceId))
      .orderBy(desc(aiAnalysisResults.createdAt));
  }
}

export const storage = new DatabaseStorage();
