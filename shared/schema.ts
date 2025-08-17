import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  decimal,
  integer,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Session storage table (required for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table (required for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Asset categories and types
export const assetTypeEnum = pgEnum('asset_type', [
  'real_estate', 'vehicle', 'artwork', 'jewelry', 'electronics', 
  'documents', 'business_assets', 'intellectual_property', 'other'
]);

export const assetStatusEnum = pgEnum('asset_status', [
  'active', 'disposed', 'lost', 'stolen', 'in_dispute', 'under_review'
]);

export const verificationStatusEnum = pgEnum('verification_status', [
  'pending', 'verified', 'rejected', 'expired'
]);

export const chittyChainStatusEnum = pgEnum('chitty_chain_status', [
  'draft', 'frozen', 'minted', 'settled', 'disputed'
]);

// Assets table - core asset tracking with ChittyChain integration
export const assets = pgTable("assets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  chittyId: varchar("chitty_id").unique(), // ChittyChain UUID v7 identifier
  chittyIdV2: varchar("chitty_id_v2").unique(), // Future Mod-97 Base32 identifier (TTTTTTTTT-NN-VVV-SSSS-CC)
  userId: varchar("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  assetType: assetTypeEnum("asset_type").notNull(),
  status: assetStatusEnum("status").default("active"),
  purchasePrice: decimal("purchase_price", { precision: 12, scale: 2 }),
  currentValue: decimal("current_value", { precision: 12, scale: 2 }),
  purchaseDate: timestamp("purchase_date"),
  location: text("location"),
  serialNumber: varchar("serial_number"),
  model: varchar("model"),
  manufacturer: varchar("manufacturer"),
  condition: varchar("condition"),
  trustScore: decimal("trust_score", { precision: 3, scale: 1 }).default("0.0"),
  
  // ChittyChain blockchain integration
  blockchainHash: varchar("blockchain_hash"),
  blockNumber: varchar("block_number"),
  ipfsHash: varchar("ipfs_hash"), // IPFS CID for off-chain data
  freezeTimestamp: timestamp("freeze_timestamp"), // 7-day freeze period start
  settlementTimestamp: timestamp("settlement_timestamp"), // On-chain settlement completion
  mintingFee: decimal("minting_fee", { precision: 8, scale: 6 }), // Fee paid in CHITTY tokens
  
  verificationStatus: verificationStatusEnum("verification_status").default("pending"),
  chittyChainStatus: chittyChainStatusEnum("chitty_chain_status").default("draft"),
  tags: text("tags").array(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Evidence and documentation
export const evidenceTypeEnum = pgEnum('evidence_type', [
  'receipt', 'contract', 'photo', 'video', 'insurance_document', 
  'warranty', 'maintenance_record', 'legal_filing', 'correspondence', 'other'
]);

export const evidence = pgTable("evidence", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assetId: varchar("asset_id").notNull().references(() => assets.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  evidenceType: evidenceTypeEnum("evidence_type").notNull(),
  filePath: text("file_path"),
  fileSize: integer("file_size"),
  mimeType: varchar("mime_type"),
  extractedData: jsonb("extracted_data"),
  aiAnalysis: jsonb("ai_analysis"),
  blockchainHash: varchar("blockchain_hash"),
  verificationStatus: verificationStatusEnum("verification_status").default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Asset timeline events
export const timelineEventTypeEnum = pgEnum('timeline_event_type', [
  'acquisition', 'modification', 'maintenance', 'insurance_update', 
  'valuation_change', 'location_change', 'status_change', 'evidence_added', 'other'
]);

export const timelineEvents = pgTable("timeline_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assetId: varchar("asset_id").notNull().references(() => assets.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  eventType: timelineEventTypeEnum("event_type").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  eventDate: timestamp("event_date").notNull(),
  relatedEvidenceId: varchar("related_evidence_id").references(() => evidence.id),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Warranties and service contracts
export const warranties = pgTable("warranties", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assetId: varchar("asset_id").notNull().references(() => assets.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  provider: text("provider").notNull(),
  type: varchar("type").notNull(), // extended, manufacturer, service_contract
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  coverage: text("coverage"),
  terms: text("terms"),
  cost: decimal("cost", { precision: 10, scale: 2 }),
  isActive: boolean("is_active").default(true),
  notificationSent: boolean("notification_sent").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Insurance policies
export const insurancePolicies = pgTable("insurance_policies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assetId: varchar("asset_id").notNull().references(() => assets.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  provider: text("provider").notNull(),
  policyNumber: varchar("policy_number").notNull(),
  type: varchar("type").notNull(), // comprehensive, liability, etc.
  coverageAmount: decimal("coverage_amount", { precision: 12, scale: 2 }),
  premium: decimal("premium", { precision: 10, scale: 2 }),
  deductible: decimal("deductible", { precision: 10, scale: 2 }),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Legal cases and disputes
export const legalCaseStatusEnum = pgEnum('legal_case_status', [
  'active', 'settled', 'dismissed', 'pending', 'on_appeal'
]);

export const legalCases = pgTable("legal_cases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  caseNumber: varchar("case_number"),
  title: text("title").notNull(),
  description: text("description"),
  status: legalCaseStatusEnum("status").default("active"),
  court: text("court"),
  judge: text("judge"),
  filingDate: timestamp("filing_date"),
  nextHearing: timestamp("next_hearing"),
  relatedAssets: text("related_assets").array(),
  attorneys: jsonb("attorneys"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// AI analysis results
export const aiAnalysisResults = pgTable("ai_analysis_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  evidenceId: varchar("evidence_id").notNull().references(() => evidence.id),
  analysisType: varchar("analysis_type").notNull(), // ocr, vision, valuation, etc.
  confidence: decimal("confidence", { precision: 3, scale: 2 }),
  results: jsonb("results").notNull(),
  processingTime: integer("processing_time"), // in milliseconds
  modelUsed: varchar("model_used"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  assets: many(assets),
  evidence: many(evidence),
  timelineEvents: many(timelineEvents),
  warranties: many(warranties),
  insurancePolicies: many(insurancePolicies),
  legalCases: many(legalCases),
}));

export const assetsRelations = relations(assets, ({ one, many }) => ({
  user: one(users, {
    fields: [assets.userId],
    references: [users.id],
  }),
  evidence: many(evidence),
  timelineEvents: many(timelineEvents),
  warranties: many(warranties),
  insurancePolicies: many(insurancePolicies),
}));

export const evidenceRelations = relations(evidence, ({ one, many }) => ({
  asset: one(assets, {
    fields: [evidence.assetId],
    references: [assets.id],
  }),
  user: one(users, {
    fields: [evidence.userId],
    references: [users.id],
  }),
  aiAnalysisResults: many(aiAnalysisResults),
  timelineEvents: many(timelineEvents),
}));

export const timelineEventsRelations = relations(timelineEvents, ({ one }) => ({
  asset: one(assets, {
    fields: [timelineEvents.assetId],
    references: [assets.id],
  }),
  user: one(users, {
    fields: [timelineEvents.userId],
    references: [users.id],
  }),
  relatedEvidence: one(evidence, {
    fields: [timelineEvents.relatedEvidenceId],
    references: [evidence.id],
  }),
}));

export const warrantiesRelations = relations(warranties, ({ one }) => ({
  asset: one(assets, {
    fields: [warranties.assetId],
    references: [assets.id],
  }),
  user: one(users, {
    fields: [warranties.userId],
    references: [users.id],
  }),
}));

export const insurancePoliciesRelations = relations(insurancePolicies, ({ one }) => ({
  asset: one(assets, {
    fields: [insurancePolicies.assetId],
    references: [assets.id],
  }),
  user: one(users, {
    fields: [insurancePolicies.userId],
    references: [users.id],
  }),
}));

export const legalCasesRelations = relations(legalCases, ({ one }) => ({
  user: one(users, {
    fields: [legalCases.userId],
    references: [users.id],
  }),
}));

export const aiAnalysisResultsRelations = relations(aiAnalysisResults, ({ one }) => ({
  evidence: one(evidence, {
    fields: [aiAnalysisResults.evidenceId],
    references: [evidence.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAssetSchema = createInsertSchema(assets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEvidenceSchema = createInsertSchema(evidence).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTimelineEventSchema = createInsertSchema(timelineEvents).omit({
  id: true,
  createdAt: true,
});

export const insertWarrantySchema = createInsertSchema(warranties).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertInsurancePolicySchema = createInsertSchema(insurancePolicies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLegalCaseSchema = createInsertSchema(legalCases).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAiAnalysisResultSchema = createInsertSchema(aiAnalysisResults).omit({
  id: true,
  createdAt: true,
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertAsset = z.infer<typeof insertAssetSchema>;
export type Asset = typeof assets.$inferSelect;
export type InsertEvidence = z.infer<typeof insertEvidenceSchema>;
export type Evidence = typeof evidence.$inferSelect;
export type InsertTimelineEvent = z.infer<typeof insertTimelineEventSchema>;
export type TimelineEvent = typeof timelineEvents.$inferSelect;
export type InsertWarranty = z.infer<typeof insertWarrantySchema>;
export type Warranty = typeof warranties.$inferSelect;
export type InsertInsurancePolicy = z.infer<typeof insertInsurancePolicySchema>;
export type InsurancePolicy = typeof insurancePolicies.$inferSelect;
export type InsertLegalCase = z.infer<typeof insertLegalCaseSchema>;
export type LegalCase = typeof legalCases.$inferSelect;
export type InsertAiAnalysisResult = z.infer<typeof insertAiAnalysisResultSchema>;
export type AiAnalysisResult = typeof aiAnalysisResults.$inferSelect;
