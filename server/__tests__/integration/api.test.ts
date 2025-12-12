import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { listToolResources } from '../../toolRegistry';

// Simple integration test to verify API concepts
describe('API Integration Tests', () => {
  it('should verify environment variables are accessible', () => {
    // These should be set in our test setup
    expect(process.env.NODE_ENV).toBe('test');
    expect(process.env.DATABASE_URL).toBeDefined();
    expect(process.env.SESSION_SECRET).toBeDefined();
  });

  it('should verify mock fetch works', async () => {
    // Mock a simple API response
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'success', data: 'test' }),
    });

    const response = await fetch('/api/test');
    const data = await response.json();

    expect(response.ok).toBe(true);
    expect(data.status).toBe('success');
    expect(data.data).toBe('test');
  });

  it('should verify error handling patterns', async () => {
    // Mock an API error
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    try {
      await fetch('/api/error');
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect(error.message).toBe('Network error');
    }
  });

  it('should verify async/await patterns work correctly', async () => {
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const start = Date.now();
    await delay(10);
    const end = Date.now();

    expect(end - start).toBeGreaterThanOrEqual(9); // Allow for some timing variance
  });

  it('should verify JSON serialization/deserialization', () => {
    const testData = {
      id: 'test-123',
      name: 'Test Asset',
      value: 1000.50,
      active: true,
      tags: ['electronics', 'valuable'],
      metadata: {
        source: 'test',
        verified: false,
      },
    };

    const serialized = JSON.stringify(testData);
    const deserialized = JSON.parse(serialized);

    expect(deserialized).toEqual(testData);
    expect(typeof deserialized.value).toBe('number');
    expect(Array.isArray(deserialized.tags)).toBe(true);
  });

  it('should surface all connectors as callable tool resources', () => {
    const resources = listToolResources();
    const callableIds = resources.filter(resource => resource.callable).map(resource => resource.id);

    const requiredConnectors = [
      'cloudflare.workers.assets',
      'notion.search',
      'google.drive.search',
      'outlook.mail.search',
      'neon.metadata.search',
    ];

    requiredConnectors.forEach(connector => {
      expect(callableIds).toContain(connector);
    });
  });
});

  describe('listToolResources function', () => {
    it('should return an array of tool resources', () => {
      const resources = listToolResources();
      expect(Array.isArray(resources)).toBe(true);
      expect(resources.length).toBeGreaterThan(0);
    });

    it('should return exactly 5 tool resources', () => {
      const resources = listToolResources();
      expect(resources).toHaveLength(5);
    });

    it('should return resources with all required properties', () => {
      const resources = listToolResources();
      resources.forEach(resource => {
        expect(resource).toHaveProperty('id');
        expect(resource).toHaveProperty('name');
        expect(resource).toHaveProperty('provider');
        expect(resource).toHaveProperty('description');
        expect(resource).toHaveProperty('category');
        expect(resource).toHaveProperty('callable');
        expect(resource).toHaveProperty('capabilities');
      });
    });

    it('should have all resources marked as callable', () => {
      const resources = listToolResources();
      resources.forEach(resource => {
        expect(resource.callable).toBe(true);
      });
    });

    it('should return resources with non-empty string properties', () => {
      const resources = listToolResources();
      resources.forEach(resource => {
        expect(resource.id).toBeTruthy();
        expect(typeof resource.id).toBe('string');
        expect(resource.id.length).toBeGreaterThan(0);
        
        expect(resource.name).toBeTruthy();
        expect(typeof resource.name).toBe('string');
        expect(resource.name.length).toBeGreaterThan(0);
        
        expect(resource.provider).toBeTruthy();
        expect(typeof resource.provider).toBe('string');
        expect(resource.provider.length).toBeGreaterThan(0);
        
        expect(resource.description).toBeTruthy();
        expect(typeof resource.description).toBe('string');
        expect(resource.description.length).toBeGreaterThan(0);
      });
    });

    it('should return resources with valid category types', () => {
      const resources = listToolResources();
      const validCategories = ['cloudflare', 'content', 'communications', 'database'];
      
      resources.forEach(resource => {
        expect(validCategories).toContain(resource.category);
      });
    });

    it('should return resources with non-empty capabilities arrays', () => {
      const resources = listToolResources();
      resources.forEach(resource => {
        expect(Array.isArray(resource.capabilities)).toBe(true);
        expect(resource.capabilities.length).toBeGreaterThan(0);
        resource.capabilities.forEach(capability => {
          expect(typeof capability).toBe('string');
          expect(capability.length).toBeGreaterThan(0);
        });
      });
    });

    it('should have unique resource IDs', () => {
      const resources = listToolResources();
      const ids = resources.map(r => r.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(resources.length);
    });

    it('should return the same array on multiple calls', () => {
      const resources1 = listToolResources();
      const resources2 = listToolResources();
      expect(resources1).toEqual(resources2);
    });
  });

  describe('Tool Resource Categories', () => {
    it('should have exactly one cloudflare resource', () => {
      const resources = listToolResources();
      const cloudflareResources = resources.filter(r => r.category === 'cloudflare');
      expect(cloudflareResources).toHaveLength(1);
    });

    it('should have content category resources', () => {
      const resources = listToolResources();
      const contentResources = resources.filter(r => r.category === 'content');
      expect(contentResources.length).toBeGreaterThan(0);
    });

    it('should have communications category resources', () => {
      const resources = listToolResources();
      const commResources = resources.filter(r => r.category === 'communications');
      expect(commResources.length).toBeGreaterThan(0);
    });

    it('should have database category resources', () => {
      const resources = listToolResources();
      const dbResources = resources.filter(r => r.category === 'database');
      expect(dbResources.length).toBeGreaterThan(0);
    });

    it('should cover all expected categories', () => {
      const resources = listToolResources();
      const categories = new Set(resources.map(r => r.category));
      expect(categories.has('cloudflare')).toBe(true);
      expect(categories.has('content')).toBe(true);
      expect(categories.has('communications')).toBe(true);
      expect(categories.has('database')).toBe(true);
    });
  });

  describe('Specific Tool Resources', () => {
    it('should have Cloudflare Workers resource with correct properties', () => {
      const resources = listToolResources();
      const cfResource = resources.find(r => r.id === 'cloudflare.workers.assets');
      
      expect(cfResource).toBeDefined();
      expect(cfResource?.name).toBe('Cloudflare Workers Evidence Tools');
      expect(cfResource?.provider).toBe('Cloudflare');
      expect(cfResource?.category).toBe('cloudflare');
      expect(cfResource?.callable).toBe(true);
      expect(cfResource?.capabilities).toContain('freeze');
      expect(cfResource?.capabilities).toContain('mint');
      expect(cfResource?.capabilities).toContain('status');
    });

    it('should have Notion Search resource with correct properties', () => {
      const resources = listToolResources();
      const notionResource = resources.find(r => r.id === 'notion.search');
      
      expect(notionResource).toBeDefined();
      expect(notionResource?.name).toBe('Notion Workspace Search');
      expect(notionResource?.provider).toBe('Notion');
      expect(notionResource?.category).toBe('content');
      expect(notionResource?.callable).toBe(true);
      expect(notionResource?.capabilities).toContain('search');
      expect(notionResource?.capabilities).toContain('filter');
      expect(notionResource?.capabilities).toContain('page-context');
    });

    it('should have Google Drive resource with correct properties', () => {
      const resources = listToolResources();
      const driveResource = resources.find(r => r.id === 'google.drive.search');
      
      expect(driveResource).toBeDefined();
      expect(driveResource?.name).toBe('Google Drive Discovery');
      expect(driveResource?.provider).toBe('Google Drive');
      expect(driveResource?.category).toBe('content');
      expect(driveResource?.callable).toBe(true);
      expect(driveResource?.capabilities).toContain('search');
      expect(driveResource?.capabilities).toContain('metadata');
      expect(driveResource?.capabilities).toContain('shared-drives');
    });

    it('should have Outlook resource with correct properties', () => {
      const resources = listToolResources();
      const outlookResource = resources.find(r => r.id === 'outlook.mail.search');
      
      expect(outlookResource).toBeDefined();
      expect(outlookResource?.name).toBe('Outlook / SharePoint Email + Files');
      expect(outlookResource?.provider).toBe('Microsoft 365');
      expect(outlookResource?.category).toBe('communications');
      expect(outlookResource?.callable).toBe(true);
      expect(outlookResource?.capabilities).toContain('search');
      expect(outlookResource?.capabilities).toContain('attachments');
      expect(outlookResource?.capabilities).toContain('sharepoint-sites');
    });

    it('should have Neon DB resource with correct properties', () => {
      const resources = listToolResources();
      const neonResource = resources.find(r => r.id === 'neon.metadata.search');
      
      expect(neonResource).toBeDefined();
      expect(neonResource?.name).toBe('Neon DB Metadata');
      expect(neonResource?.provider).toBe('Neon');
      expect(neonResource?.category).toBe('database');
      expect(neonResource?.callable).toBe(true);
      expect(neonResource?.capabilities).toContain('tables');
      expect(neonResource?.capabilities).toContain('columns');
      expect(neonResource?.capabilities).toContain('lineage');
    });
  });

  describe('API endpoint simulation - /api/tools/resources', () => {
    it('should simulate API response structure for tools endpoint', () => {
      const resources = listToolResources();
      const apiResponse = {
        resources,
        callableResources: resources.filter(r => r.callable).map(r => r.id),
      };

      expect(apiResponse).toHaveProperty('resources');
      expect(apiResponse).toHaveProperty('callableResources');
      expect(Array.isArray(apiResponse.resources)).toBe(true);
      expect(Array.isArray(apiResponse.callableResources)).toBe(true);
      expect(apiResponse.callableResources.length).toBe(5);
    });

    it('should verify API response has all expected callable resource IDs', () => {
      const resources = listToolResources();
      const callableIds = resources.filter(r => r.callable).map(r => r.id);
      
      expect(callableIds).toEqual([
        'cloudflare.workers.assets',
        'notion.search',
        'google.drive.search',
        'outlook.mail.search',
        'neon.metadata.search',
      ]);
    });

    it('should simulate successful API call with mock fetch', async () => {
      const resources = listToolResources();
      const mockResponse = {
        resources,
        callableResources: resources.filter(r => r.callable).map(r => r.id),
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });

      const response = await fetch('/api/tools/resources');
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.resources).toHaveLength(5);
      expect(data.callableResources).toHaveLength(5);
    });

    it('should handle API error scenarios gracefully', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ message: 'Internal server error' }),
      });

      const response = await fetch('/api/tools/resources');
      expect(response.ok).toBe(false);
      expect(response.status).toBe(500);
    });
  });

  describe('Resource Provider Distribution', () => {
    it('should have diverse providers', () => {
      const resources = listToolResources();
      const providers = new Set(resources.map(r => r.provider));
      
      expect(providers.size).toBeGreaterThan(1);
      expect(providers.has('Cloudflare')).toBe(true);
      expect(providers.has('Notion')).toBe(true);
      expect(providers.has('Google Drive')).toBe(true);
      expect(providers.has('Microsoft 365')).toBe(true);
      expect(providers.has('Neon')).toBe(true);
    });

    it('should have exactly 5 unique providers', () => {
      const resources = listToolResources();
      const providers = new Set(resources.map(r => r.provider));
      expect(providers.size).toBe(5);
    });
  });

  describe('Resource Capability Validation', () => {
    it('should verify all resources have search-related capabilities where applicable', () => {
      const resources = listToolResources();
      const searchableResources = resources.filter(r => 
        r.category === 'content' || 
        r.category === 'communications' || 
        r.category === 'database'
      );

      searchableResources.forEach(resource => {
        expect(resource.capabilities).toContain('search');
      });
    });

    it('should verify Cloudflare resource has blockchain-related capabilities', () => {
      const resources = listToolResources();
      const cfResource = resources.find(r => r.category === 'cloudflare');
      
      expect(cfResource?.capabilities).toContain('freeze');
      expect(cfResource?.capabilities).toContain('mint');
    });

    it('should ensure all capabilities are lowercase strings', () => {
      const resources = listToolResources();
      resources.forEach(resource => {
        resource.capabilities.forEach(capability => {
          expect(capability).toBe(capability.toLowerCase());
          expect(capability).not.toContain(' ');
        });
      });
    });
  });

  describe('Data Integrity and Immutability', () => {
    it('should not allow modification of returned resource array', () => {
      const resources = listToolResources();
      const originalLength = resources.length;
      
      // Attempt to modify - this should not affect subsequent calls
      resources.push({
        id: 'test.invalid',
        name: 'Test Invalid',
        provider: 'Test',
        description: 'Invalid',
        category: 'content',
        callable: false,
        capabilities: ['test'],
      });

      const resources2 = listToolResources();
      expect(resources2.length).toBe(originalLength);
    });

    it('should return consistent data structure across multiple calls', () => {
      const call1 = listToolResources();
      const call2 = listToolResources();
      const call3 = listToolResources();

      expect(call1).toEqual(call2);
      expect(call2).toEqual(call3);
      expect(JSON.stringify(call1)).toBe(JSON.stringify(call2));
    });
  });

  describe('Resource ID Format Validation', () => {
    it('should have resource IDs in correct namespace format', () => {
      const resources = listToolResources();
      resources.forEach(resource => {
        expect(resource.id).toMatch(/^[a-z]+\.[a-z]+\.[a-z]+$/);
      });
    });

    it('should have resource IDs with exactly 2 dots (namespace.service.action)', () => {
      const resources = listToolResources();
      resources.forEach(resource => {
        const dotCount = (resource.id.match(/\./g) || []).length;
        expect(dotCount).toBe(2);
      });
    });

    it('should have no duplicate resource IDs', () => {
      const resources = listToolResources();
      const ids = resources.map(r => r.id);
      const uniqueIds = [...new Set(ids)];
      
      expect(ids.length).toBe(uniqueIds.length);
    });
  });

  describe('Error Resilience', () => {
    it('should handle JSON serialization correctly', () => {
      const resources = listToolResources();
      const serialized = JSON.stringify(resources);
      const deserialized = JSON.parse(serialized);
      
      expect(deserialized).toEqual(resources);
      expect(Array.isArray(deserialized)).toBe(true);
      expect(deserialized.length).toBe(5);
    });

    it('should handle filtering operations without errors', () => {
      const resources = listToolResources();
      
      expect(() => {
        resources.filter(r => r.callable);
      }).not.toThrow();

      expect(() => {
        resources.filter(r => r.category === 'content');
      }).not.toThrow();

      expect(() => {
        resources.map(r => r.id);
      }).not.toThrow();
    });

    it('should handle edge case searches gracefully', () => {
      const resources = listToolResources();
      
      const nonExistent = resources.find(r => r.id === 'non.existent.resource');
      expect(nonExistent).toBeUndefined();

      const emptyFilter = resources.filter(r => r.category === 'nonexistent');
      expect(emptyFilter).toHaveLength(0);
    });
  });

  describe('Performance and Efficiency', () => {
    it('should return results quickly', () => {
      const start = performance.now();
      listToolResources();
      const end = performance.now();
      
      expect(end - start).toBeLessThan(10); // Should be very fast (< 10ms)
    });

    it('should handle multiple rapid calls efficiently', () => {
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        listToolResources();
      }
      const end = performance.now();
      
      expect(end - start).toBeLessThan(100); // 100 calls in < 100ms
    });
  });

  describe('Integration with API Response Format', () => {
    it('should match the expected API response structure from routes.ts', () => {
      const resources = listToolResources();
      const apiResponse = {
        resources,
        callableResources: resources.filter(r => r.callable).map(r => r.id),
      };

      // Verify this matches the structure in routes.ts line 119-122
      expect(apiResponse).toMatchObject({
        resources: expect.any(Array),
        callableResources: expect.any(Array),
      });

      expect(apiResponse.callableResources).toEqual([
        'cloudflare.workers.assets',
        'notion.search',
        'google.drive.search',
        'outlook.mail.search',
        'neon.metadata.search',
      ]);
    });

    it('should provide resources suitable for agent layer consumption', () => {
      const resources = listToolResources();
      
      resources.forEach(resource => {
        // Each resource should provide enough information for an agent to use it
        expect(resource.description.length).toBeGreaterThan(20);
        expect(resource.capabilities.length).toBeGreaterThan(0);
        expect(resource.callable).toBe(true);
      });
    });
  });

  describe('Documentation and Metadata Quality', () => {
    it('should have meaningful descriptions for all resources', () => {
      const resources = listToolResources();
      resources.forEach(resource => {
        expect(resource.description.length).toBeGreaterThan(30);
        expect(resource.description).not.toMatch(/^test/i);
        expect(resource.description).not.toMatch(/^placeholder/i);
      });
    });

    it('should have descriptive names for all resources', () => {
      const resources = listToolResources();
      resources.forEach(resource => {
        expect(resource.name.length).toBeGreaterThan(5);
        expect(resource.name).not.toBe(resource.id);
      });
    });

    it('should have all capabilities with meaningful names', () => {
      const resources = listToolResources();
      resources.forEach(resource => {
        resource.capabilities.forEach(capability => {
          expect(capability.length).toBeGreaterThan(2);
        });
      });
    });
  });
});
