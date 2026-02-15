import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RuleList } from './RuleList';

describe('RuleList', () => {
  const mockRules = [
    {
      id: 'rule-1',
      name: 'Objective First',
      description: 'Always write objective before execution',
      pattern: 'Write objective before any execution',
      weight: 2,
      category: 'Startup',
    },
    {
      id: 'rule-2',
      name: 'Confidence Calibration',
      description: 'Signal confidence level explicitly',
      pattern: 'State confidence level',
      weight: 1.5,
      category: 'Confidence',
    },
  ];

  it('renders rule list with count', () => {
    render(<RuleList rules={mockRules} />);
    
    expect(screen.getByText('Behavior Rules')).toBeInTheDocument();
    expect(screen.getByText('2 rules')).toBeInTheDocument();
  });

  it('displays rule names and descriptions', () => {
    render(<RuleList rules={mockRules} />);
    
    expect(screen.getByText('Objective First')).toBeInTheDocument();
    expect(screen.getByText('Confidence Calibration')).toBeInTheDocument();
    expect(screen.getByText('Always write objective before execution')).toBeInTheDocument();
  });

  it('displays rule categories as badges', () => {
    render(<RuleList rules={mockRules} />);
    
    expect(screen.getByText('Startup')).toBeInTheDocument();
    expect(screen.getByText('Confidence')).toBeInTheDocument();
  });

  it('displays rule weights', () => {
    render(<RuleList rules={mockRules} />);
    
    // Check for weight values ("2x" and "1.5x")
    expect(screen.getByText('2x')).toBeInTheDocument();
    expect(screen.getByText('1.5x')).toBeInTheDocument();
  });
});