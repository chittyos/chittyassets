import '@testing-library/jest-dom'

// Mock environment variables for tests
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
process.env.SESSION_SECRET = 'test-secret'
process.env.GOOGLE_CLOUD_PROJECT_ID = 'test-project'
process.env.GOOGLE_CLOUD_BUCKET_NAME = 'test-bucket'
process.env.OPENAI_API_KEY = 'test-key'

// Mock Google Cloud Storage
vi.mock('@google-cloud/storage', () => ({
  Storage: vi.fn(() => ({
    bucket: vi.fn(() => ({
      file: vi.fn(() => ({
        save: vi.fn(),
        createWriteStream: vi.fn(),
        download: vi.fn(),
        delete: vi.fn(),
        exists: vi.fn(() => [true]),
        getSignedUrl: vi.fn(() => ['http://test-url.com']),
      })),
    })),
  })),
}))

// Mock OpenAI
vi.mock('openai', () => ({
  default: vi.fn(() => ({
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  })),
}))

// Mock ChittyCloud MCP
vi.mock('@chittyapps/chittycloude-mcp', () => ({
  ChittyCloudMcp: vi.fn(() => ({
    connect: vi.fn(),
    callTool: vi.fn(),
    disconnect: vi.fn(),
  })),
}))