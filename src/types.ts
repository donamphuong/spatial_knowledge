import { Node, Edge } from '@xyflow/react';

export type ExplorerItemType = 'folder' | 'map' | 'pdf' | 'note';

export interface ExplorerItem {
  id: string;
  name: string;
  type: ExplorerItemType;
  parentId: string | null;
  // Map specific data
  nodes?: WorkspaceNode[];
  edges?: WorkspaceEdge[];
  paths?: PathData[];
  // File/Note/Folder data
  content?: string;
  lastModified?: string;
}

export type WorkspaceNodeData = {
  label: string;
  type: 'pdf-clip' | 'note' | 'idea' | 'group' | 'pdf-page' | 'image' | 'path';
  content?: string;
  imageUrl?: string;
  clipRect?: { x: number; y: number; width: number; height: number };
  pageNumber?: number;
  aspectRatio?: number;
  // Path specific data
  pathData?: PathData;
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

