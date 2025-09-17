import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ObjectStorageService, ObjectNotFoundError } from '../objectStorage';
import { Storage } from '@google-cloud/storage';

// Mock Google Cloud Storage
vi.mock('@google-cloud/storage', () => ({
  Storage: vi.fn(() => ({
    bucket: vi.fn(() => ({
      file: vi.fn(() => ({
        save: vi.fn(),
        createWriteStream: vi.fn(),
        download: vi.fn(),
        delete: vi.fn(),
        exists: vi.fn(),
        getSignedUrl: vi.fn(),
        makePublic: vi.fn(),
        makePrivate: vi.fn(),
      })),
      upload: vi.fn(),
    })),
  })),
}));

describe('ObjectStorageService', () => {
  let storageService: ObjectStorageService;
  let mockStorage: any;
  let mockBucket: any;
  let mockFile: any;

  beforeEach(() => {
    vi.clearAllMocks();
    storageService = new ObjectStorageService();
    mockStorage = new Storage();
    mockBucket = mockStorage.bucket();
    mockFile = mockBucket.file();
  });

  describe('uploadFile', () => {
    it('should upload file successfully', async () => {
      const fileBuffer = Buffer.from('test file content');
      const fileName = 'test-file.pdf';
      const contentType = 'application/pdf';

      mockFile.save.mockResolvedValue(undefined);
      mockFile.makePublic.mockResolvedValue(undefined);
      mockFile.getSignedUrl.mockResolvedValue(['http://signed-url.com']);

      const result = await storageService.uploadFile(fileBuffer, fileName, contentType);

      expect(mockFile.save).toHaveBeenCalledWith(fileBuffer, {
        metadata: {
          contentType,
        },
        public: false,
        validation: 'md5',
      });

      expect(result).toEqual({
        fileName,
        url: 'http://signed-url.com',
        size: fileBuffer.length,
        contentType,
      });
    });

    it('should handle upload errors', async () => {
      const fileBuffer = Buffer.from('test content');
      const fileName = 'test-file.pdf';

      mockFile.save.mockRejectedValue(new Error('Upload failed'));

      await expect(
        storageService.uploadFile(fileBuffer, fileName, 'application/pdf')
      ).rejects.toThrow('Upload failed');
    });
  });

  describe('downloadFile', () => {
    it('should download file successfully', async () => {
      const fileName = 'test-file.pdf';
      const fileContent = Buffer.from('file content');

      mockFile.exists.mockResolvedValue([true]);
      mockFile.download.mockResolvedValue([fileContent]);

      const result = await storageService.downloadFile(fileName);

      expect(result).toEqual(fileContent);
      expect(mockFile.download).toHaveBeenCalled();
    });

    it('should throw ObjectNotFoundError for non-existent file', async () => {
      const fileName = 'non-existent.pdf';

      mockFile.exists.mockResolvedValue([false]);

      await expect(storageService.downloadFile(fileName)).rejects.toThrow(ObjectNotFoundError);
    });
  });

  describe('deleteFile', () => {
    it('should delete file successfully', async () => {
      const fileName = 'test-file.pdf';

      mockFile.exists.mockResolvedValue([true]);
      mockFile.delete.mockResolvedValue(undefined);

      await storageService.deleteFile(fileName);

      expect(mockFile.delete).toHaveBeenCalled();
    });

    it('should throw ObjectNotFoundError when deleting non-existent file', async () => {
      const fileName = 'non-existent.pdf';

      mockFile.exists.mockResolvedValue([false]);

      await expect(storageService.deleteFile(fileName)).rejects.toThrow(ObjectNotFoundError);
    });
  });

  describe('getSignedUrl', () => {
    it('should generate signed URL for file access', async () => {
      const fileName = 'test-file.pdf';
      const signedUrl = 'http://signed-url.com';

      mockFile.exists.mockResolvedValue([true]);
      mockFile.getSignedUrl.mockResolvedValue([signedUrl]);

      const result = await storageService.getSignedUrl(fileName, 'read', 3600);

      expect(result).toBe(signedUrl);
      expect(mockFile.getSignedUrl).toHaveBeenCalledWith({
        action: 'read',
        expires: expect.any(Date),
      });
    });

    it('should generate signed URL for file upload', async () => {
      const fileName = 'new-file.pdf';
      const signedUrl = 'http://upload-url.com';

      mockFile.getSignedUrl.mockResolvedValue([signedUrl]);

      const result = await storageService.getSignedUrl(fileName, 'write', 3600);

      expect(result).toBe(signedUrl);
      expect(mockFile.getSignedUrl).toHaveBeenCalledWith({
        action: 'write',
        expires: expect.any(Date),
        contentType: 'application/octet-stream',
      });
    });
  });

  describe('listFiles', () => {
    it('should list files with prefix', async () => {
      const prefix = 'assets/user-1/';
      const mockFiles = [
        { name: 'assets/user-1/file1.pdf', metadata: { size: 1024, timeCreated: '2024-01-01' } },
        { name: 'assets/user-1/file2.jpg', metadata: { size: 2048, timeCreated: '2024-01-02' } },
      ];

      mockBucket.getFiles.mockResolvedValue([mockFiles]);

      const result = await storageService.listFiles(prefix);

      expect(result).toEqual([
        {
          name: 'assets/user-1/file1.pdf',
          size: 1024,
          created: '2024-01-01',
        },
        {
          name: 'assets/user-1/file2.jpg',
          size: 2048,
          created: '2024-01-02',
        },
      ]);

      expect(mockBucket.getFiles).toHaveBeenCalledWith({
        prefix,
        autoPaginate: true,
      });
    });

    it('should handle empty file list', async () => {
      const prefix = 'empty/';

      mockBucket.getFiles.mockResolvedValue([[]]);

      const result = await storageService.listFiles(prefix);

      expect(result).toEqual([]);
    });
  });

  describe('getFileMetadata', () => {
    it('should get file metadata', async () => {
      const fileName = 'test-file.pdf';
      const mockMetadata = {
        size: '1024',
        contentType: 'application/pdf',
        timeCreated: '2024-01-01T00:00:00Z',
        updated: '2024-01-01T00:00:00Z',
        md5Hash: 'abc123',
      };

      mockFile.exists.mockResolvedValue([true]);
      mockFile.getMetadata.mockResolvedValue([mockMetadata]);

      const result = await storageService.getFileMetadata(fileName);

      expect(result).toEqual({
        size: 1024,
        contentType: 'application/pdf',
        created: '2024-01-01T00:00:00Z',
        updated: '2024-01-01T00:00:00Z',
        md5Hash: 'abc123',
      });
    });

    it('should throw ObjectNotFoundError for non-existent file metadata', async () => {
      const fileName = 'non-existent.pdf';

      mockFile.exists.mockResolvedValue([false]);

      await expect(storageService.getFileMetadata(fileName)).rejects.toThrow(ObjectNotFoundError);
    });
  });

  describe('moveFile', () => {
    it('should move file to new location', async () => {
      const oldFileName = 'old-location/file.pdf';
      const newFileName = 'new-location/file.pdf';

      const mockOldFile = { ...mockFile };
      const mockNewFile = { ...mockFile };

      mockBucket.file.mockImplementation((name: string) => {
        if (name === oldFileName) return mockOldFile;
        if (name === newFileName) return mockNewFile;
        return mockFile;
      });

      mockOldFile.exists.mockResolvedValue([true]);
      mockOldFile.move.mockResolvedValue([mockNewFile]);

      await storageService.moveFile(oldFileName, newFileName);

      expect(mockOldFile.move).toHaveBeenCalledWith(mockNewFile);
    });

    it('should throw ObjectNotFoundError when moving non-existent file', async () => {
      const oldFileName = 'non-existent.pdf';
      const newFileName = 'new-location/file.pdf';

      mockFile.exists.mockResolvedValue([false]);

      await expect(storageService.moveFile(oldFileName, newFileName)).rejects.toThrow(
        ObjectNotFoundError
      );
    });
  });

  describe('copyFile', () => {
    it('should copy file to new location', async () => {
      const sourceFileName = 'source/file.pdf';
      const destFileName = 'dest/file.pdf';

      const mockSourceFile = { ...mockFile };
      const mockDestFile = { ...mockFile };

      mockBucket.file.mockImplementation((name: string) => {
        if (name === sourceFileName) return mockSourceFile;
        if (name === destFileName) return mockDestFile;
        return mockFile;
      });

      mockSourceFile.exists.mockResolvedValue([true]);
      mockSourceFile.copy.mockResolvedValue([mockDestFile]);

      await storageService.copyFile(sourceFileName, destFileName);

      expect(mockSourceFile.copy).toHaveBeenCalledWith(mockDestFile);
    });
  });
});