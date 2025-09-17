import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AIAnalysisService } from '../aiAnalysis';
import OpenAI from 'openai';

// Mock OpenAI
vi.mock('openai', () => ({
  default: vi.fn(() => ({
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  })),
}));

describe('AIAnalysisService', () => {
  let aiService: AIAnalysisService;
  let mockOpenAI: any;

  beforeEach(() => {
    vi.clearAllMocks();
    aiService = new AIAnalysisService();
    mockOpenAI = new OpenAI();
  });

  describe('analyzeReceipt', () => {
    it('should analyze receipt and return structured data', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              merchant: 'Best Buy',
              amount: 299.99,
              currency: 'USD',
              date: '2024-01-15',
              items: [
                {
                  description: 'Wireless Headphones',
                  quantity: 1,
                  price: 299.99,
                },
              ],
              taxAmount: 24.00,
              confidence: 0.95,
              category: 'electronics',
            }),
          },
        }],
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      const result = await aiService.analyzeReceipt('base64-image-data');

      expect(result).toEqual({
        merchant: 'Best Buy',
        amount: 299.99,
        currency: 'USD',
        date: '2024-01-15',
        items: [
          {
            description: 'Wireless Headphones',
            quantity: 1,
            price: 299.99,
          },
        ],
        taxAmount: 24.00,
        confidence: 0.95,
        category: 'electronics',
      });

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-4o',
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'system',
          }),
          expect.objectContaining({
            role: 'user',
            content: expect.arrayContaining([
              expect.objectContaining({
                type: 'text',
              }),
              expect.objectContaining({
                type: 'image_url',
                image_url: {
                  url: 'data:image/jpeg;base64,base64-image-data',
                },
              }),
            ]),
          }),
        ]),
        max_tokens: 1000,
        temperature: 0.1,
      });
    });

    it('should handle invalid JSON response', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'Invalid JSON response',
          },
        }],
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      await expect(aiService.analyzeReceipt('base64-image-data')).rejects.toThrow();
    });

    it('should handle OpenAI API errors', async () => {
      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('API Error'));

      await expect(aiService.analyzeReceipt('base64-image-data')).rejects.toThrow('API Error');
    });
  });

  describe('analyzeDocument', () => {
    it('should analyze document and extract key information', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              documentType: 'warranty',
              keyFields: {
                product: 'MacBook Pro',
                warrantyPeriod: '1 year',
                startDate: '2024-01-15',
                coverageType: 'limited warranty',
              },
              confidence: 0.92,
              summary: 'One-year limited warranty for MacBook Pro starting January 15, 2024',
              extractedText: 'Apple Inc. Limited Warranty MacBook Pro...',
            }),
          },
        }],
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      const result = await aiService.analyzeDocument('base64-image-data');

      expect(result).toEqual({
        documentType: 'warranty',
        keyFields: {
          product: 'MacBook Pro',
          warrantyPeriod: '1 year',
          startDate: '2024-01-15',
          coverageType: 'limited warranty',
        },
        confidence: 0.92,
        summary: 'One-year limited warranty for MacBook Pro starting January 15, 2024',
        extractedText: 'Apple Inc. Limited Warranty MacBook Pro...',
      });
    });
  });

  describe('valuateAsset', () => {
    it('should provide asset valuation with market analysis', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              estimatedValue: 1200,
              currency: 'USD',
              confidence: 0.85,
              factors: [
                'Current market conditions',
                'Product age and condition',
                'Brand reputation',
                'Depreciation rate',
              ],
              marketComparisons: [
                {
                  source: 'eBay',
                  price: 1150,
                  similarity: 0.9,
                },
                {
                  source: 'Amazon',
                  price: 1299,
                  similarity: 0.85,
                },
              ],
            }),
          },
        }],
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      const assetDescription = 'MacBook Pro 14-inch, M1 Pro, 16GB RAM, 512GB SSD, purchased in 2023';
      const result = await aiService.valuateAsset(assetDescription, ['receipt-image', 'product-image']);

      expect(result).toEqual({
        estimatedValue: 1200,
        currency: 'USD',
        confidence: 0.85,
        factors: [
          'Current market conditions',
          'Product age and condition',
          'Brand reputation',
          'Depreciation rate',
        ],
        marketComparisons: [
          {
            source: 'eBay',
            price: 1150,
            similarity: 0.9,
          },
          {
            source: 'Amazon',
            price: 1299,
            similarity: 0.85,
          },
        ],
      });
    });

    it('should handle valuation without images', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              estimatedValue: 800,
              currency: 'USD',
              confidence: 0.6,
              factors: ['Limited information available', 'Generic market pricing'],
            }),
          },
        }],
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      const result = await aiService.valuateAsset('Generic laptop', []);

      expect(result.estimatedValue).toBe(800);
      expect(result.confidence).toBe(0.6);
    });
  });

  describe('generateLegalDocument', () => {
    it('should generate legal document from asset data', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'ASSET OWNERSHIP AFFIDAVIT\n\nI, John Doe, hereby declare under penalty of perjury...',
          },
        }],
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      const assetData = {
        title: 'MacBook Pro',
        value: 2000,
        purchaseDate: '2024-01-15',
        evidence: ['receipt', 'warranty'],
      };

      const result = await aiService.generateLegalDocument('ownership_affidavit', assetData);

      expect(result).toContain('ASSET OWNERSHIP AFFIDAVIT');
      expect(result).toContain('John Doe');
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o',
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'system',
              content: expect.stringContaining('legal document'),
            }),
          ]),
        })
      );
    });
  });

  describe('calculateTrustScore', () => {
    it('should calculate trust score based on evidence', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              trustScore: 85,
              factors: ['High quality documentation', 'Complete evidence set'],
            }),
          },
        }],
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      const assetData = { title: 'Test Asset', value: 1000 };
      const evidenceData = [
        { type: 'receipt', confidence: 0.95 },
        { type: 'photo', confidence: 0.9 },
        { type: 'manual', confidence: 0.85 },
      ];

      const result = await aiService.calculateTrustScore(assetData, evidenceData);

      expect(result).toBe(85);
    });
  });
});