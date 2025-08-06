import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { ObjectPermission } from "./objectAcl";
import { aiAnalysisService } from "./aiAnalysis";
import { insertAssetSchema, insertEvidenceSchema, insertTimelineEventSchema, 
         insertWarrantySchema, insertInsurancePolicySchema, insertLegalCaseSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Asset routes
  app.get('/api/assets', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const filters = {
        assetType: req.query.type as string,
        status: req.query.status as string,
        searchTerm: req.query.search as string,
        minValue: req.query.minValue ? parseFloat(req.query.minValue as string) : undefined,
        maxValue: req.query.maxValue ? parseFloat(req.query.maxValue as string) : undefined,
      };
      
      const assets = await storage.getUserAssets(userId, filters);
      res.json(assets);
    } catch (error) {
      console.error("Error fetching assets:", error);
      res.status(500).json({ message: "Failed to fetch assets" });
    }
  });

  app.get('/api/assets/stats', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const stats = await storage.getAssetStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching asset stats:", error);
      res.status(500).json({ message: "Failed to fetch asset stats" });
    }
  });

  app.get('/api/assets/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const asset = await storage.getAsset(req.params.id, userId);
      if (!asset) {
        return res.status(404).json({ message: "Asset not found" });
      }
      res.json(asset);
    } catch (error) {
      console.error("Error fetching asset:", error);
      res.status(500).json({ message: "Failed to fetch asset" });
    }
  });

  app.post('/api/assets', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const assetData = insertAssetSchema.parse({ ...req.body, userId });
      
      const asset = await storage.createAsset(assetData);
      
      // Create initial timeline event
      await storage.createTimelineEvent({
        assetId: asset.id,
        userId,
        eventType: 'acquisition',
        title: `Asset "${asset.name}" added to portfolio`,
        description: 'Initial asset registration',
        eventDate: new Date(),
      });
      
      res.status(201).json(asset);
    } catch (error) {
      console.error("Error creating asset:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid asset data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create asset" });
    }
  });

  app.put('/api/assets/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const updates = req.body;
      delete updates.id;
      delete updates.userId;
      delete updates.createdAt;
      delete updates.updatedAt;
      
      const asset = await storage.updateAsset(req.params.id, userId, updates);
      res.json(asset);
    } catch (error) {
      console.error("Error updating asset:", error);
      res.status(500).json({ message: "Failed to update asset" });
    }
  });

  app.delete('/api/assets/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.deleteAsset(req.params.id, userId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting asset:", error);
      res.status(500).json({ message: "Failed to delete asset" });
    }
  });

  // Evidence routes
  app.get('/api/assets/:assetId/evidence', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const evidence = await storage.getAssetEvidence(req.params.assetId, userId);
      res.json(evidence);
    } catch (error) {
      console.error("Error fetching evidence:", error);
      res.status(500).json({ message: "Failed to fetch evidence" });
    }
  });

  app.post('/api/assets/:assetId/evidence', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const evidenceData = insertEvidenceSchema.parse({
        ...req.body,
        assetId: req.params.assetId,
        userId
      });
      
      const evidence = await storage.createEvidence(evidenceData);
      
      // Create timeline event
      await storage.createTimelineEvent({
        assetId: req.params.assetId,
        userId,
        eventType: 'evidence_added',
        title: `Evidence "${evidence.name}" added`,
        description: `New ${evidence.evidenceType} evidence uploaded`,
        eventDate: new Date(),
        relatedEvidenceId: evidence.id,
      });
      
      res.status(201).json(evidence);
    } catch (error) {
      console.error("Error creating evidence:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid evidence data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create evidence" });
    }
  });

  // AI Analysis routes
  app.post('/api/evidence/:evidenceId/analyze', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { base64Image, analysisType } = req.body;
      
      if (!base64Image || !analysisType) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const evidenceItem = await storage.getEvidence(req.params.evidenceId, userId);
      if (!evidenceItem) {
        return res.status(404).json({ message: "Evidence not found" });
      }

      let results;
      let confidence = 0;
      const startTime = Date.now();

      switch (analysisType) {
        case 'receipt':
          results = await aiAnalysisService.analyzeReceipt(base64Image);
          confidence = results.confidence;
          break;
        case 'document':
          results = await aiAnalysisService.analyzeDocument(base64Image);
          confidence = results.confidence;
          break;
        case 'asset_valuation':
          const asset = await storage.getAsset(evidenceItem.assetId, userId);
          results = await aiAnalysisService.analyzeAssetPhoto(base64Image, asset?.assetType || 'unknown');
          confidence = results.confidence;
          break;
        default:
          return res.status(400).json({ message: "Invalid analysis type" });
      }

      const processingTime = Date.now() - startTime;

      // Store analysis results
      const analysisResult = await storage.createAiAnalysisResult({
        evidenceId: req.params.evidenceId,
        analysisType,
        confidence,
        results,
        processingTime,
        modelUsed: 'gpt-4o',
      });

      // Update evidence with AI analysis
      await storage.updateEvidence(req.params.evidenceId, userId, {
        aiAnalysis: results,
        verificationStatus: confidence > 0.8 ? 'verified' : 'pending'
      });

      res.json(analysisResult);
    } catch (error) {
      console.error("Error analyzing evidence:", error);
      res.status(500).json({ message: "Failed to analyze evidence" });
    }
  });

  // Timeline routes
  app.get('/api/assets/:assetId/timeline', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const timeline = await storage.getAssetTimeline(req.params.assetId, userId);
      res.json(timeline);
    } catch (error) {
      console.error("Error fetching timeline:", error);
      res.status(500).json({ message: "Failed to fetch timeline" });
    }
  });

  // Warranty routes
  app.get('/api/assets/:assetId/warranties', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const warranties = await storage.getAssetWarranties(req.params.assetId, userId);
      res.json(warranties);
    } catch (error) {
      console.error("Error fetching warranties:", error);
      res.status(500).json({ message: "Failed to fetch warranties" });
    }
  });

  app.get('/api/warranties/expiring', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const daysAhead = parseInt(req.query.days as string) || 30;
      const warranties = await storage.getExpiringWarranties(userId, daysAhead);
      res.json(warranties);
    } catch (error) {
      console.error("Error fetching expiring warranties:", error);
      res.status(500).json({ message: "Failed to fetch expiring warranties" });
    }
  });

  app.post('/api/assets/:assetId/warranties', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const warrantyData = insertWarrantySchema.parse({
        ...req.body,
        assetId: req.params.assetId,
        userId
      });
      
      const warranty = await storage.createWarranty(warrantyData);
      res.status(201).json(warranty);
    } catch (error) {
      console.error("Error creating warranty:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid warranty data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create warranty" });
    }
  });

  // Insurance routes
  app.get('/api/assets/:assetId/insurance', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const insurance = await storage.getAssetInsurance(req.params.assetId, userId);
      res.json(insurance);
    } catch (error) {
      console.error("Error fetching insurance:", error);
      res.status(500).json({ message: "Failed to fetch insurance" });
    }
  });

  app.post('/api/assets/:assetId/insurance', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const insuranceData = insertInsurancePolicySchema.parse({
        ...req.body,
        assetId: req.params.assetId,
        userId
      });
      
      const insurance = await storage.createInsurancePolicy(insuranceData);
      res.status(201).json(insurance);
    } catch (error) {
      console.error("Error creating insurance:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid insurance data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create insurance" });
    }
  });

  // Legal case routes
  app.get('/api/legal-cases', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const cases = await storage.getUserLegalCases(userId);
      res.json(cases);
    } catch (error) {
      console.error("Error fetching legal cases:", error);
      res.status(500).json({ message: "Failed to fetch legal cases" });
    }
  });

  app.post('/api/legal-cases', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const caseData = insertLegalCaseSchema.parse({ ...req.body, userId });
      
      const legalCase = await storage.createLegalCase(caseData);
      res.status(201).json(legalCase);
    } catch (error) {
      console.error("Error creating legal case:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid case data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create legal case" });
    }
  });

  // Legal document generation
  app.post('/api/legal/generate-document', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { templateType, assetId, jurisdiction, includeNotarization, includeBlockchain } = req.body;
      
      if (!templateType || !assetId) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const asset = await storage.getAsset(assetId, userId);
      if (!asset) {
        return res.status(404).json({ message: "Asset not found" });
      }

      const evidence = await storage.getAssetEvidence(assetId, userId);
      const timeline = await storage.getAssetTimeline(assetId, userId);
      
      const documentData = {
        asset,
        evidence: evidence.slice(0, 5), // Include top 5 pieces of evidence
        timeline: timeline.slice(0, 10), // Include recent timeline events
        includeNotarization,
        includeBlockchain,
      };

      const document = await aiAnalysisService.generateLegalDocument(
        templateType,
        documentData,
        jurisdiction || 'New York State'
      );

      res.json({ document, templateType, jurisdiction });
    } catch (error) {
      console.error("Error generating legal document:", error);
      res.status(500).json({ message: "Failed to generate legal document" });
    }
  });

  // Trust score calculation
  app.post('/api/assets/:assetId/calculate-trust-score', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const asset = await storage.getAsset(req.params.assetId, userId);
      if (!asset) {
        return res.status(404).json({ message: "Asset not found" });
      }

      const evidence = await storage.getAssetEvidence(req.params.assetId, userId);
      const trustScore = await aiAnalysisService.calculateTrustScore(asset, evidence);
      
      // Update asset with new trust score
      await storage.updateAsset(req.params.assetId, userId, { trustScore: trustScore.toString() });
      
      res.json({ trustScore });
    } catch (error) {
      console.error("Error calculating trust score:", error);
      res.status(500).json({ message: "Failed to calculate trust score" });
    }
  });

  // Object storage routes for evidence files
  app.get("/objects/:objectPath(*)", isAuthenticated, async (req: any, res) => {
    const userId = req.user?.claims?.sub;
    const objectStorageService = new ObjectStorageService();
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      const canAccess = await objectStorageService.canAccessObjectEntity({
        objectFile,
        userId: userId,
        requestedPermission: ObjectPermission.READ,
      });
      if (!canAccess) {
        return res.sendStatus(401);
      }
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error checking object access:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  app.post("/api/objects/upload", isAuthenticated, async (req: any, res) => {
    const objectStorageService = new ObjectStorageService();
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    res.json({ uploadURL });
  });

  app.put("/api/evidence-files", isAuthenticated, async (req: any, res) => {
    if (!req.body.fileURL) {
      return res.status(400).json({ error: "fileURL is required" });
    }

    const userId = req.user?.claims?.sub;

    try {
      const objectStorageService = new ObjectStorageService();
      const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
        req.body.fileURL,
        {
          owner: userId,
          visibility: "private", // Evidence files should be private
        },
      );

      res.status(200).json({ objectPath });
    } catch (error) {
      console.error("Error setting evidence file:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
