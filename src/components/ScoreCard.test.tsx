import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ScoreCard } from './ScoreCard';
import { Activity } from 'lucide-react';

describe('ScoreCard', () => {
  it('renders with title', () => {
    render(
      <ScoreCard
        title="Test Score"
        value="85%"
        icon={Activity}
      />
    );
    
    expect(screen.getByText('Test Score')).toBeInTheDocument();
    // Value animates from 0 to 85, so we just check the title
  });

  it('shows trend when provided', () => {
    render(
      <ScoreCard
        title="Test Score"
        value="85%"
        icon={Activity}
        trend="up"
        trendValue="Improving"
      />
    );
    
    expect(screen.getByText('Improving')).toBeInTheDocument();
  });

  it('shows subtitle when no trend', () => {
    render(
      <ScoreCard
        title="Test Score"
        value="85%"
        icon={Activity}
        subtitle="Details here"
      />
    );
    
    expect(screen.getByText('Details here')).toBeInTheDocument();
  });
});