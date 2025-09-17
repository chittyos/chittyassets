import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { storage, Storage } from '../storage';
import { db } from '../db';
import { users, assets, evidence } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Mock the database
vi.mock('../db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockDb = db as any;

describe('Storage Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('User Operations', () => {
    it('should get user by id', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockUser]),
          }),
        }),
      });

      const result = await storage.getUser('user-1');
      expect(result).toEqual(mockUser);
    });

    it('should return undefined for non-existent user', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await storage.getUser('non-existent');
      expect(result).toBeUndefined();
    });

    it('should upsert user', async () => {
      const userToUpsert = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
      };

      const mockUser = {
        ...userToUpsert,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockUser]),
          }),
        }),
      });

      const result = await storage.upsertUser(userToUpsert);
      expect(result).toEqual(mockUser);
    });
  });

  describe('Asset Operations', () => {
    it('should create asset', async () => {
      const assetData = {
        title: 'Test Asset',
        description: 'Test Description',
        userId: 'user-1',
        value: 1000,
        currency: 'USD',
        category: 'electronics',
        status: 'active' as const,
      };

      const mockAsset = {
        id: 'asset-1',
        ...assetData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockAsset]),
        }),
      });

      const result = await storage.createAsset(assetData);
      expect(result).toEqual(mockAsset);
    });

    it('should get asset by id and userId', async () => {
      const mockAsset = {
        id: 'asset-1',
        title: 'Test Asset',
        userId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockAsset]),
          }),
        }),
      });

      const result = await storage.getAsset('asset-1', 'user-1');
      expect(result).toEqual(mockAsset);
    });

    it('should get user assets with filters', async () => {
      const mockAssets = [
        {
          id: 'asset-1',
          title: 'Test Asset 1',
          category: 'electronics',
          status: 'active',
          userId: 'user-1',
        },
        {
          id: 'asset-2',
          title: 'Test Asset 2',
          category: 'furniture',
          status: 'active',
          userId: 'user-1',
        },
      ];

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockAssets),
          }),
        }),
      });

      const result = await storage.getUserAssets('user-1', {
        category: 'electronics',
        status: 'active',
      });

      expect(result).toEqual(mockAssets);
    });

    it('should update asset', async () => {
      const updates = { title: 'Updated Asset' };
      const mockUpdatedAsset = {
        id: 'asset-1',
        title: 'Updated Asset',
        userId: 'user-1',
        updatedAt: new Date(),
      };

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockUpdatedAsset]),
          }),
        }),
      });

      const result = await storage.updateAsset('asset-1', 'user-1', updates);
      expect(result).toEqual(mockUpdatedAsset);
    });

    it('should delete asset', async () => {
      mockDb.delete.mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      await expect(storage.deleteAsset('asset-1', 'user-1')).resolves.not.toThrow();
    });
  });

  describe('Evidence Operations', () => {
    it('should create evidence', async () => {
      const evidenceData = {
        assetId: 'asset-1',
        userId: 'user-1',
        type: 'receipt' as const,
        title: 'Purchase Receipt',
        description: 'Original purchase receipt',
        filePath: '/uploads/receipt.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
      };

      const mockEvidence = {
        id: 'evidence-1',
        ...evidenceData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockEvidence]),
        }),
      });

      const result = await storage.createEvidence(evidenceData);
      expect(result).toEqual(mockEvidence);
    });

    it('should get asset evidence', async () => {
      const mockEvidence = [
        {
          id: 'evidence-1',
          assetId: 'asset-1',
          type: 'receipt',
          title: 'Purchase Receipt',
        },
        {
          id: 'evidence-2',
          assetId: 'asset-1',
          type: 'photo',
          title: 'Product Photo',
        },
      ];

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockEvidence),
          }),
        }),
      });

      const result = await storage.getAssetEvidence('asset-1', 'user-1');
      expect(result).toEqual(mockEvidence);
    });
  });

  describe('Asset Statistics', () => {
    it('should get asset stats', async () => {
      const mockStats = {
        totalAssets: 10,
        totalValue: 25000,
        assetsByCategory: {
          electronics: 5,
          furniture: 3,
          vehicles: 2,
        },
        assetsByStatus: {
          active: 8,
          frozen: 1,
          immutable: 1,
        },
      };

      // Mock the SQL queries for statistics
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 10, totalValue: 25000 }]),
        }),
      });

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            groupBy: vi.fn().mockResolvedValue([
              { category: 'electronics', count: 5 },
              { category: 'furniture', count: 3 },
              { category: 'vehicles', count: 2 },
            ]),
          }),
        }),
      });

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            groupBy: vi.fn().mockResolvedValue([
              { status: 'active', count: 8 },
              { status: 'frozen', count: 1 },
              { status: 'immutable', count: 1 },
            ]),
          }),
        }),
      });

      const result = await storage.getAssetStats('user-1');
      expect(result.totalAssets).toBe(10);
      expect(result.totalValue).toBe(25000);
    });
  });
});