import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock ResizeObserver which is not present in jsdom
class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal('ResizeObserver', ResizeObserver);
