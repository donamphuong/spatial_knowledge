import { Node, Edge } from '@xyflow/react';

export interface FileItem {
  id: string;
  name: string;
  type: 'pdf' | 'note' | 'folder';
  parentId: string | null;
  content?: string; // URL for PDF, text for Note
  data?: any;
}

export type WorkspaceNodeData = {
  label: string;
  type: 'pdf-clip' | 'note' | 'idea' | 'group';
  content?: string;
  imageUrl?: string;
  clipRect?: { x: number; y: number; width: number; height: number };
  pageNumber?: number;
};

export type WorkspaceNode = Node<WorkspaceNodeData>;
export type WorkspaceEdge = Edge;

export interface PathData {
  id: string;
  points: number[][];
  color: string;
  width: number;
  opacity: number;
}
