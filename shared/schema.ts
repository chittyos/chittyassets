// @canon: chittycanon://gov/governance#core-types — P/L/T/E/A entity types
//
// ChittyAssets canonical Drizzle schema for Neon project steep-cloud-28172078.
// Mirrors drizzle/0001_init.sql, drizzle/0002_entities_registry.sql,
// drizzle/0003_r2_object_acl.sql. Annotations on each table indicate its
// canonical entity type. See docs/migrations/phase3-users-chittyid-migration.md
// for the planned promotion of users.chitty_id to PK.

import { sql, relations } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  numeric,
  integer,
  boolean,
  pgEnum,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// =====================================================================
// Sessions — legacy Replit Auth store, removed at ChittyAuth-only cutover.
// =====================================================================
export const sessions = pgTable(
  'sessions',
  {
    sid: varchar('sid').primaryKey(),
    sess: jsonb('sess').notNull(),
    expire: timestamp('expire').notNull(),
  },
  (table) => [index('IDX_session_expire').on(table.expire)],
);

// =====================================================================
// @canon: chittycanon://gov/governance#core-types — Person (P)
// Users are natural actors with agency. Phase 3 promotes chitty_id to PK.
// =====================================================================
export const users = pgTable('users', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  /** Canonical Person ChittyID. Format VV-G-LLL-SSSS-P-YM-C-X. Nullable during Phase 1; PK in Phase 3. */
  chittyId: varchar('chitty_id').unique(),
  email: varchar('email').unique(),
  firstName: varchar('first_name'),
  lastName: varchar('last_name'),
  profileImageUrl: varchar('profile_image_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  /** GDPR soft-delete; ChittyLedger preserves the audit trail. */
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

// =====================================================================
// Enums
// =====================================================================
export const assetTypeEnum = pgEnum('asset_type', [
  'real_estate', 'vehicle', 'artwork', 'jewelry', 'electronics',
  'documents', 'business_assets', 'intellectual_property', 'other',
]);

export const assetStatusEnum = pgEnum('asset_status', [
  'active', 'disposed', 'lost', 'stolen', 'in_dispute', 'under_review',
]);

export const verificationStatusEnum = pgEnum('verification_status', [
  'pending', 'verified', 'rejected', 'expired',
]);

export const chittyChainStatusEnum = pgEnum('chitty_chain_status', [
  'draft', 'frozen', 'minted', 'settled', 'disputed',
]);

export const evidenceTypeEnum = pgEnum('evidence_type', [
  'receipt', 'contract', 'photo', 'video', 'insurance_document',
  'warranty', 'maintenance_record', 'legal_filing', 'correspondence', 'other',
]);

export const timelineEventTypeEnum = pgEnum('timeline_event_type', [
  'acquisition', 'modification', 'maintenance', 'insurance_update',
  'valuation_change', 'location_change', 'status_change', 'evidence_added', 'other',
]);

export const legalCaseStatusEnum = pgEnum('legal_case_status', [
  'active', 'settled', 'dismissed', 'pending', 'on_appeal',
]);

// =====================================================================
// @canon: chittycanon://gov/governance#core-types — Thing (T)
// Central artifact of ChittyAssets: an object without agency.
// =====================================================================
export const assets = pgTable('assets', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  /** Canonical Thing ChittyID. Format VV-G-LLL-SSSS-T-YM-C-X. */
  chittyId: varchar('chitty_id').unique(),
  chittyIdV2: varchar('chitty_id_v2').unique(),
  userId: varchar('user_id').notNull().references(() => users.id),
  name: text('name').notNull(),
  description: text('description'),
  assetType: assetTypeEnum('asset_type').notNull(),
  status: assetStatusEnum('status').default('active'),
  purchasePrice: numeric('purchase_price', { precision: 12, scale: 2 }),
  currentValue: numeric('current_value', { precision: 12, scale: 2 }),
  purchaseDate: timestamp('purchase_date', { withTimezone: true }),
  location: text('location'),
  serialNumber: varchar('serial_number'),
  model: varchar('model'),
  manufacturer: varchar('manufacturer'),
  condition: varchar('condition'),
  trustScore: numeric('trust_score', { precision: 3, scale: 1 }).default('0.0'),
  blockchainHash: varchar('blockchain_hash'),
  blockNumber: varchar('block_number'),
  ipfsHash: varchar('ipfs_hash'),
  freezeTimestamp: timestamp('freeze_timestamp', { withTimezone: true }),
  settlementTimestamp: timestamp('settlement_timestamp', { withTimezone: true }),
  mintingFee: numeric('minting_fee', { precision: 8, scale: 6 }),
  verificationStatus: verificationStatusEnum('verification_status').default('pending'),
  chittyChainStatus: chittyChainStatusEnum('chitty_chain_status').default('draft'),
  tags: text('tags').array(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

// =====================================================================
// @canon: chittycanon://gov/governance#core-types — Thing (T)
// Evidence is a document/artifact attached to an asset.
// =====================================================================
export const evidence = pgTable('evidence', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  chittyId: varchar('chitty_id').unique(),
  assetId: varchar('asset_id').notNull().references(() => assets.id),
  userId: varchar('user_id').notNull().references(() => users.id),
  name: text('name').notNull(),
  evidenceType: evidenceTypeEnum('evidence_type').notNull(),
  filePath: text('file_path'),
  fileSize: integer('file_size'),
  mimeType: varchar('mime_type'),
  extractedData: jsonb('extracted_data'),
  aiAnalysis: jsonb('ai_analysis'),
  blockchainHash: varchar('blockchain_hash'),
  verificationStatus: verificationStatusEnum('verification_status').default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

// =====================================================================
// @canon: chittycanon://gov/governance#core-types — Event (E)
// Append-only occurrence in time against an asset.
// =====================================================================
export const timelineEvents = pgTable('timeline_events', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  chittyId: varchar('chitty_id').unique(),
  assetId: varchar('asset_id').notNull().references(() => assets.id),
  userId: varchar('user_id').notNull().references(() => users.id),
  eventType: timelineEventTypeEnum('event_type').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  eventDate: timestamp('event_date', { withTimezone: true }).notNull(),
  relatedEvidenceId: varchar('related_evidence_id').references(() => evidence.id),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// =====================================================================
// @canon: chittycanon://gov/governance#core-types — Thing (T)
// Warranty contract as artifact. Coverage events are timeline_events.
// =====================================================================
export const warranties = pgTable('warranties', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  chittyId: varchar('chitty_id').unique(),
  assetId: varchar('asset_id').notNull().references(() => assets.id),
  userId: varchar('user_id').notNull().references(() => users.id),
  provider: text('provider').notNull(),
  type: varchar('type').notNull(),
  startDate: timestamp('start_date', { withTimezone: true }).notNull(),
  endDate: timestamp('end_date', { withTimezone: true }).notNull(),
  coverage: text('coverage'),
  terms: text('terms'),
  cost: numeric('cost', { precision: 10, scale: 2 }),
  isActive: boolean('is_active').default(true),
  notificationSent: boolean('notification_sent').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// =====================================================================
// @canon: chittycanon://gov/governance#core-types — Thing (T)
// Policy document as artifact. Claim events are timeline_events.
// =====================================================================
export const insurancePolicies = pgTable('insurance_policies', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  chittyId: varchar('chitty_id').unique(),
  assetId: varchar('asset_id').notNull().references(() => assets.id),
  userId: varchar('user_id').notNull().references(() => users.id),
  provider: text('provider').notNull(),
  policyNumber: varchar('policy_number').notNull(),
  type: varchar('type').notNull(),
  coverageAmount: numeric('coverage_amount', { precision: 12, scale: 2 }),
  premium: numeric('premium', { precision: 10, scale: 2 }),
  deductible: numeric('deductible', { precision: 10, scale: 2 }),
  startDate: timestamp('start_date', { withTimezone: true }).notNull(),
  endDate: timestamp('end_date', { withTimezone: true }).notNull(),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// =====================================================================
// @canon: chittycanon://gov/governance#core-types — Event (E)
// Legal proceeding with docket/status progression.
// =====================================================================
export const legalCases = pgTable('legal_cases', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  chittyId: varchar('chitty_id').unique(),
  userId: varchar('user_id').notNull().references(() => users.id),
  caseNumber: varchar('case_number'),
  title: text('title').notNull(),
  description: text('description'),
  status: legalCaseStatusEnum('status').default('active'),
  court: text('court'),
  judge: text('judge'),
  filingDate: timestamp('filing_date', { withTimezone: true }),
  nextHearing: timestamp('next_hearing', { withTimezone: true }),
  relatedAssets: text('related_assets').array(),
  attorneys: jsonb('attorneys'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// =====================================================================
// @canon: chittycanon://gov/governance#core-types — Event (E)
// AI analysis run in time against an evidence artifact. Append-only.
// =====================================================================
export const aiAnalysisResults = pgTable('ai_analysis_results', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  chittyId: varchar('chitty_id').unique(),
  evidenceId: varchar('evidence_id').notNull().references(() => evidence.id),
  analysisType: varchar('analysis_type').notNull(),
  confidence: numeric('confidence', { precision: 3, scale: 2 }),
  results: jsonb('results').notNull(),
  processingTime: integer('processing_time'),
  modelUsed: varchar('model_used'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// =====================================================================
// Canonical entity types enum — all five P/L/T/E/A must be present.
// @canon: chittycanon://gov/governance#core-types
// =====================================================================
export const entityTypeEnum = pgEnum('entity_type', ['P', 'L', 'T', 'E', 'A']);

// =====================================================================
// Entities registry — soft-reference index. No FKs from per-service tables.
// =====================================================================
export const entities = pgTable(
  'entities',
  {
    chittyId: varchar('chitty_id').primaryKey(),
    /** @canon: chittycanon://gov/governance#core-types — one of P/L/T/E/A. */
    entityType: entityTypeEnum('entity_type').notNull(),
    sourceTable: varchar('source_table').notNull(),
    sourceId: varchar('source_id').notNull(),
    displayName: text('display_name'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [uniqueIndex('uq_entities_source').on(table.sourceTable, table.sourceId)],
);

// =====================================================================
// R2 object ACL — operational metadata (not a canonical entity).
// principal_chitty_id is a Person (P); evidence_id / asset_id are Things (T).
// =====================================================================
export const r2AclPermissionEnum = pgEnum('r2_acl_permission', ['read', 'write', 'owner']);

export const r2ObjectAcl = pgTable('r2_object_acl', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  bucket: varchar('bucket').notNull(),
  objectKey: text('object_key').notNull(),
  /** Person (P) ChittyID — soft ref to users.chitty_id. */
  principalChittyId: varchar('principal_chitty_id').notNull(),
  permission: r2AclPermissionEnum('permission').notNull(),
  grantedByChittyId: varchar('granted_by_chitty_id'),
  evidenceId: varchar('evidence_id').references(() => evidence.id),
  assetId: varchar('asset_id').references(() => assets.id),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
});

// =====================================================================
// Relations
// =====================================================================
export const usersRelations = relations(users, ({ many }) => ({
  assets: many(assets),
  evidence: many(evidence),
  timelineEvents: many(timelineEvents),
  warranties: many(warranties),
  insurancePolicies: many(insurancePolicies),
  legalCases: many(legalCases),
}));

export const assetsRelations = relations(assets, ({ one, many }) => ({
  user: one(users, { fields: [assets.userId], references: [users.id] }),
  evidence: many(evidence),
  timelineEvents: many(timelineEvents),
  warranties: many(warranties),
  insurancePolicies: many(insurancePolicies),
}));

export const evidenceRelations = relations(evidence, ({ one, many }) => ({
  asset: one(assets, { fields: [evidence.assetId], references: [assets.id] }),
  user: one(users, { fields: [evidence.userId], references: [users.id] }),
  aiAnalysisResults: many(aiAnalysisResults),
  timelineEvents: many(timelineEvents),
}));

export const timelineEventsRelations = relations(timelineEvents, ({ one }) => ({
  asset: one(assets, { fields: [timelineEvents.assetId], references: [assets.id] }),
  user: one(users, { fields: [timelineEvents.userId], references: [users.id] }),
  relatedEvidence: one(evidence, {
    fields: [timelineEvents.relatedEvidenceId],
    references: [evidence.id],
  }),
}));

export const warrantiesRelations = relations(warranties, ({ one }) => ({
  asset: one(assets, { fields: [warranties.assetId], references: [assets.id] }),
  user: one(users, { fields: [warranties.userId], references: [users.id] }),
}));

export const insurancePoliciesRelations = relations(insurancePolicies, ({ one }) => ({
  asset: one(assets, { fields: [insurancePolicies.assetId], references: [assets.id] }),
  user: one(users, { fields: [insurancePolicies.userId], references: [users.id] }),
}));

export const legalCasesRelations = relations(legalCases, ({ one }) => ({
  user: one(users, { fields: [legalCases.userId], references: [users.id] }),
}));

export const aiAnalysisResultsRelations = relations(aiAnalysisResults, ({ one }) => ({
  evidence: one(evidence, { fields: [aiAnalysisResults.evidenceId], references: [evidence.id] }),
}));

// =====================================================================
// Insert schemas
// =====================================================================
export const insertUserSchema = createInsertSchema(users).omit({
  id: true, createdAt: true, updatedAt: true,
});
export const insertAssetSchema = createInsertSchema(assets).omit({
  id: true, createdAt: true, updatedAt: true,
});
export const insertEvidenceSchema = createInsertSchema(evidence).omit({
  id: true, createdAt: true, updatedAt: true,
});
export const insertTimelineEventSchema = createInsertSchema(timelineEvents).omit({
  id: true, createdAt: true,
});
export const insertWarrantySchema = createInsertSchema(warranties).omit({
  id: true, createdAt: true, updatedAt: true,
});
export const insertInsurancePolicySchema = createInsertSchema(insurancePolicies).omit({
  id: true, createdAt: true, updatedAt: true,
});
export const insertLegalCaseSchema = createInsertSchema(legalCases).omit({
  id: true, createdAt: true, updatedAt: true,
});
export const insertAiAnalysisResultSchema = createInsertSchema(aiAnalysisResults).omit({
  id: true, createdAt: true,
});
export const insertEntitySchema = createInsertSchema(entities).omit({
  createdAt: true, updatedAt: true,
});
export const insertR2ObjectAclSchema = createInsertSchema(r2ObjectAcl).omit({
  id: true, createdAt: true,
});

// =====================================================================
// Types
// =====================================================================
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
export type InsertEntity = z.infer<typeof insertEntitySchema>;
export type Entity = typeof entities.$inferSelect;
export type InsertR2ObjectAcl = z.infer<typeof insertR2ObjectAclSchema>;
export type R2ObjectAcl = typeof r2ObjectAcl.$inferSelect;

// Canonical entity-type tuple — all five P/L/T/E/A. Never omit A.
// @canon: chittycanon://gov/governance#core-types
export const CANONICAL_ENTITY_TYPES = ['P', 'L', 'T', 'E', 'A'] as const;
export type CanonicalEntityType = (typeof CANONICAL_ENTITY_TYPES)[number];

// Canonical ChittyID regex — VV-G-LLL-SSSS-T-YM-C-X where T is one of P/L/T/E/A.
export const CHITTY_ID_PATTERN = /^[0-9]{2}-[A-Z]-[0-9]{3}-[0-9]{4}-[PLTEA]-[0-9]{4}-[A-Z]-[0-9]$/;
