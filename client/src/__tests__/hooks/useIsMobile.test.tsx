import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIsMobile } from '@/hooks/use-mobile';

// Mock window.matchMedia
const mockMatchMedia = vi.fn();

describe('useIsMobile', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();

    // Mock window.matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: mockMatchMedia,
    });

    // Mock window.innerWidth
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return false for desktop screen size', () => {
    const mockMql = {
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    mockMatchMedia.mockReturnValue(mockMql);

    // Set desktop width
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      value: 1024,
    });

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(false);
  });

  it('should return true for mobile screen size', () => {
    const mockMql = {
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    mockMatchMedia.mockReturnValue(mockMql);

    // Set mobile width
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      value: 500,
    });

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(true);
  });

  it('should respond to window resize events', () => {
    const mockMql = {
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    mockMatchMedia.mockReturnValue(mockMql);

    // Start with desktop width
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      value: 1024,
    });

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(false);

    // Simulate window resize to mobile
    act(() => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        value: 500,
      });

      // Trigger the change event listener
      const changeListener = mockMql.addEventListener.mock.calls.find(
        call => call[0] === 'change'
      )?.[1];

      if (changeListener) {
        changeListener();
      }
    });

    expect(result.current).toBe(true);
  });

  it('should add and remove event listeners correctly', () => {
    const mockMql = {
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    mockMatchMedia.mockReturnValue(mockMql);

    const { unmount } = renderHook(() => useIsMobile());

    expect(mockMql.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));

    unmount();

    expect(mockMql.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('should handle breakpoint boundary correctly', () => {
    const mockMql = {
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    mockMatchMedia.mockReturnValue(mockMql);

    // Test exactly at breakpoint (768px)
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      value: 768,
    });

    const { result } = renderHook(() => useIsMobile());

    // 768px should be considered desktop (not mobile)
    expect(result.current).toBe(false);

    // Test just below breakpoint (767px)
    act(() => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        value: 767,
      });

      const changeListener = mockMql.addEventListener.mock.calls.find(
        call => call[0] === 'change'
      )?.[1];

      if (changeListener) {
        changeListener();
      }
    });

    expect(result.current).toBe(true);
  });

  it('should handle missing matchMedia gracefully', () => {
    // Remove matchMedia support
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: undefined,
    });

    expect(() => {
      renderHook(() => useIsMobile());
    }).toThrow();
  });
});