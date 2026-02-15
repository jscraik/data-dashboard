import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TrendChart } from './TrendChart';

describe('TrendChart', () => {
  const mockSessions = [
    {
      session_id: 'session-1',
      timestamp: '2026-02-15T10:00:00Z',
      score_percentage: 75,
    },
    {
      session_id: 'session-2',
      timestamp: '2026-02-14T10:00:00Z',
      score_percentage: 82,
    },
    {
      session_id: 'session-3',
      timestamp: '2026-02-13T10:00:00Z',
      score_percentage: 68,
    },
  ];

  it('renders chart with sessions', () => {
    render(<TrendChart sessions={mockSessions} />);
    
    // Should have Y-axis labels
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('shows empty state when no sessions', () => {
    render(<TrendChart sessions={[]} />);
    
    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  it('renders date labels for sessions', () => {
    render(<TrendChart sessions={mockSessions} />);
    
    // Should show formatted dates
    const dates = screen.getAllByText(/Feb \d+/);
    expect(dates.length).toBeGreaterThan(0);
  });
});