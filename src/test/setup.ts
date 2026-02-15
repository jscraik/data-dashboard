import '@testing-library/jest-dom';
import { vi } from 'vitest';

// GOLD: Test setup for Vitest + Testing Library (2026 standard)
// This file runs before each test file

// Mock Tauri API for tests
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

// Add any global test utilities here