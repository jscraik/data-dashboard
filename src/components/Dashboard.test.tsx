import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Dashboard } from './Dashboard';

// Mock the Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('Dashboard', () => {
  it('renders dashboard with stats cards', async () => {
    render(<Dashboard />);
    
    // Wait for mock data to load
    await waitFor(() => {
      expect(screen.getByText('Average Score')).toBeInTheDocument();
    });
    
    // Check for expected elements
    expect(screen.getByText('Total Sessions')).toBeInTheDocument();
    expect(screen.getByText('Current Trend')).toBeInTheDocument();
  });

  it('displays rule performance section', async () => {
    render(<Dashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('Rule Performance')).toBeInTheDocument();
    });
  });

  it('shows score trend chart', async () => {
    render(<Dashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('Score Trend')).toBeInTheDocument();
    });
  });

  it('has accessible section labels', async () => {
    render(<Dashboard />);
    
    await waitFor(() => {
      const statsSection = screen.getByLabelText('Dashboard statistics');
      expect(statsSection).toBeInTheDocument();
    });
  });
});