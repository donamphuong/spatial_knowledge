import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NoteNode, IdeaNode, PDFSnippetNode, ImageNode, GroupNode, PDFPageNode } from '../components/InfiniteCanvas';
import React from 'react';

// Mock React Flow hooks
vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react');
  return {
    ...actual,
    useReactFlow: () => ({
      setNodes: vi.fn(),
      getNodes: vi.fn(() => []),
      screenToFlowPosition: vi.fn((pos) => pos),
    }),
    useViewport: () => ({ x: 0, y: 0, zoom: 1 }),
    Handle: ({ type, position, className }: any) => (
      <div data-testid={`handle-${type}-${position}`} className={className} />
    ),
    NodeResizer: ({ isVisible }: any) => (
      isVisible ? <div data-testid="node-resizer" /> : null
    ),
    Position: {
      Top: 'top',
      Bottom: 'bottom',
      Left: 'left',
      Right: 'right',
    },
  };
});

// Mock motion
vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

const mockNodeProps = (type: string, label: string = '') => ({
  id: 'test-id',
  data: { label, type: type as any },
  selected: false,
  zIndex: 0,
  isConnectable: true,
  xPos: 0,
  yPos: 0,
  dragging: false,
  type,
});

describe('Scholar Vault Feature Logic', () => {
  describe('Placeholders', () => {
    it('shows placeholder in NoteNode when label is empty', () => {
      render(<NoteNode {...(mockNodeProps('note') as any)} />);
      expect(screen.getByText('Start writing note...')).toBeInTheDocument();
    });

    it('shows placeholder in IdeaNode when label is empty', () => {
      render(<IdeaNode {...(mockNodeProps('idea') as any)} />);
      expect(screen.getByText('Research Synthesis...')).toBeInTheDocument();
    });

    it('shows actual text in NoteNode when label is present', () => {
      render(<NoteNode {...(mockNodeProps('note', 'My Insight') as any)} />);
      expect(screen.getByText('My Insight')).toBeInTheDocument();
      expect(screen.queryByText('Start writing note...')).not.toBeInTheDocument();
    });
  });

  describe('4-Point Connectivity', () => {
    it('NoteNode has handles on all 4 sides', () => {
      render(<NoteNode {...(mockNodeProps('note') as any)} />);
      expect(screen.getByTestId('handle-target-top')).toBeInTheDocument();
      expect(screen.getByTestId('handle-source-bottom')).toBeInTheDocument();
      expect(screen.getByTestId('handle-source-left')).toBeInTheDocument();
      expect(screen.getByTestId('handle-source-right')).toBeInTheDocument();
    });

    it('IdeaNode has handles on all 4 sides', () => {
      render(<IdeaNode {...(mockNodeProps('idea') as any)} />);
      expect(screen.getByTestId('handle-target-top')).toBeInTheDocument();
      expect(screen.getByTestId('handle-source-bottom')).toBeInTheDocument();
      expect(screen.getByTestId('handle-source-left')).toBeInTheDocument();
      expect(screen.getByTestId('handle-source-right')).toBeInTheDocument();
    });

    it('PDFSnippetNode has handles on all 4 sides', () => {
      render(<PDFSnippetNode {...(mockNodeProps('pdf-clip') as any)} />);
      expect(screen.getByTestId('handle-target-top')).toBeInTheDocument();
      expect(screen.getByTestId('handle-source-bottom')).toBeInTheDocument();
      expect(screen.getByTestId('handle-source-left')).toBeInTheDocument();
      expect(screen.getByTestId('handle-source-right')).toBeInTheDocument();
    });

    it('ImageNode has handles on all 4 sides', () => {
      render(<ImageNode {...(mockNodeProps('image') as any)} />);
      expect(screen.getByTestId('handle-target-top')).toBeInTheDocument();
      expect(screen.getByTestId('handle-source-bottom')).toBeInTheDocument();
      expect(screen.getByTestId('handle-source-left')).toBeInTheDocument();
      expect(screen.getByTestId('handle-source-right')).toBeInTheDocument();
    });

    it('GroupNode has handles on all 4 sides', () => {
      render(<GroupNode {...(mockNodeProps('group') as any)} />);
      expect(screen.getByTestId('handle-target-top')).toBeInTheDocument();
      expect(screen.getByTestId('handle-source-bottom')).toBeInTheDocument();
      expect(screen.getByTestId('handle-source-left')).toBeInTheDocument();
      expect(screen.getByTestId('handle-source-right')).toBeInTheDocument();
    });

    it('PDFPageNode has handles on all 4 sides', () => {
      render(<PDFPageNode {...(mockNodeProps('pdf-page') as any)} />);
      expect(screen.getByTestId('handle-target-top')).toBeInTheDocument();
      expect(screen.getByTestId('handle-source-bottom')).toBeInTheDocument();
      expect(screen.getByTestId('handle-source-left')).toBeInTheDocument();
      expect(screen.getByTestId('handle-source-right')).toBeInTheDocument();
    });
  });

  describe('Resizing', () => {
    it('NoteNode shows Resizer when selected', () => {
      const props = mockNodeProps('note');
      props.selected = true;
      render(<NoteNode {...(props as any)} />);
      expect(screen.getByTestId('node-resizer')).toBeInTheDocument();
    });

    it('IdeaNode shows Resizer when selected', () => {
      const props = mockNodeProps('idea');
      props.selected = true;
      render(<IdeaNode {...(props as any)} />);
      expect(screen.getByTestId('node-resizer')).toBeInTheDocument();
    });
  });

  describe('Visual Refinements', () => {
    it('NoteNode does not have a pencil icon', () => {
      render(<NoteNode {...(mockNodeProps('note') as any)} />);
      // Pencil icon is Edit3 from lucide-react. 
      // We can check if any component with lucide-icon-edit-3 class exists (if we didn't mock lucide)
      // Or just search for the title "Edit Note" which we removed
      expect(screen.queryByTitle('Edit Note')).not.toBeInTheDocument();
    });

    it('IdeaNode does not have "Synthesis" label', () => {
      render(<IdeaNode {...(mockNodeProps('idea') as any)} />);
      expect(screen.queryByText('Synthesis')).not.toBeInTheDocument();
    });
  });
});
