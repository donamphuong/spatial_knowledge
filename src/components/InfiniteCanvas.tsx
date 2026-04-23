import React, { useState, useRef, useCallback, useEffect } from 'react';
import { 
  ReactFlow, 
  Background, 
  Controls, 
  Connection, 
  addEdge, 
  OnNodesChange, 
  OnEdgesChange,
  applyNodeChanges,
  applyEdgeChanges,
  Handle,
  Position,
  NodeProps,
  NodeToolbar,
  Panel,
  useReactFlow,
  ReactFlowProvider,
  useViewport,
  NodeResizer,
  SelectionMode,
  ConnectionLineComponentProps,
  getBezierPath,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { WorkspaceNode, WorkspaceEdge, WorkspaceNodeData, PathData } from '../types';
import { motion } from 'motion/react';
import { StickyNote, Maximize2, Trash2, Link, Edit3, Quote, Copy, FileText, MousePointer2, Layers } from 'lucide-react';
import { getStroke } from 'perfect-freehand';
import { v4 as uuidv4 } from 'uuid';

// Helper to convert freehand points to SVG path
function getSvgPathFromStroke(stroke: number[][]) {
  if (!stroke.length) return '';
  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ['M', ...stroke[0], 'Q']
  );
  d.push('Z');
  return d.join(' ');
}

// ... keeping custom nodes ...
export // Helper to calculate bounding box of points
function getBoundingBox(points: number[][], strokeWidth: number) {
  if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  let minX = points[0][0];
  let minY = points[0][1];
  let maxX = points[0][0];
  let maxY = points[0][1];
  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  const padding = strokeWidth + 5;
  return { 
    x: minX - padding, 
    y: minY - padding, 
    width: (maxX - minX) + padding * 2, 
    height: (maxY - minY) + padding * 2 
  };
}

const PathNode = React.memo(({ data, selected, id }: NodeProps<WorkspaceNode>) => {
  const { setNodes } = useReactFlow();
  
  const d = React.useMemo(() => {
    if (!data.pathData) return '';
    const stroke = getStroke(data.pathData.points, {
      size: data.pathData.width,
      thinning: 0.5,
      smoothing: 0.5,
      streamline: 0.5,
    });
    return getSvgPathFromStroke(stroke);
  }, [data.pathData]);

  if (!data.pathData) return null;

  return (
    <div className={`group relative w-full h-full ${selected ? 'ring-2 ring-indigo-500 rounded-sm' : ''}`}>
       <svg 
         className="overflow-visible w-full h-full pointer-events-none"
         style={{ position: 'absolute', top: 0, left: 0 }}
       >
          <path
            d={d}
            fill={data.pathData.color}
            opacity={data.pathData.opacity}
          />
       </svg>
       {selected && (
         <button
           onClick={(e) => {
             e.stopPropagation();
             setNodes(nds => nds.filter(n => n.id !== id));
           }}
           className="absolute -top-6 -right-6 p-1 bg-white border border-slate-200 rounded shadow-sm text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
         >
           <Trash2 size={12} />
         </button>
       )}
    </div>
  );
});

export const PDFSnippetNode = React.memo(({ data, selected }: NodeProps<WorkspaceNode>) => {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    if (data.content) {
      navigator.clipboard.writeText(data.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className={`relative h-full w-full bg-white border border-slate-200 rounded shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden border-b-2 border-b-indigo-100 group transition-all ${selected ? 'ring-4 ring-indigo-500/20' : ''}`}
    >
      <NodeResizer minWidth={150} minHeight={100} isVisible={selected} lineClassName="border-indigo-400" handleClassName="h-2 w-2 bg-white border-2 border-indigo-500 rounded" />
      <Handle type="target" position={Position.Top} className="w-1.5 h-1.5 !bg-slate-300 border-none" />
      <Handle type="source" position={Position.Bottom} className="w-1.5 h-1.5 !bg-slate-300 border-none" />
      <Handle type="source" position={Position.Left} className="w-1.5 h-1.5 !bg-slate-300 border-none" />
      <Handle type="source" position={Position.Right} className="w-1.5 h-1.5 !bg-slate-300 border-none" />
      
      <div className="px-3 py-1.5 bg-[#fcfcf7] border-b border-slate-100 flex items-center justify-between shrink-0">
         <div className="flex items-center gap-2">
           <Quote size={10} className="text-indigo-400" />
           <span className="text-[9px] font-sans font-bold text-slate-400 uppercase tracking-widest leading-none">Document Fragment</span>
         </div>
         {data.content && (
           <button 
             onClick={copyToClipboard}
             className="text-slate-400 hover:text-indigo-600 transition-all active:scale-95"
             title="Copy extracted text"
           >
             {copied ? <span className="text-[8px] font-bold text-emerald-500 lowercase tracking-normal bg-emerald-50 px-1 rounded">Copied!</span> : <Copy size={10} />}
           </button>
         )}
      </div>

      <div className="flex flex-col h-full overflow-hidden">
        {data.imageUrl && (
          <div className="bg-[#fafafa] p-2 overflow-hidden flex items-center justify-center border-b border-slate-50 shrink-0">
            <img src={data.imageUrl} alt="Clip" className="w-full h-auto rounded border border-slate-200" />
          </div>
        )}
        
        <div className="p-4 pt-3 flex-1 overflow-auto custom-scrollbar">
          {data.content && (
            <div className="bg-[#fefce8]/40 p-3 rounded text-[11px] text-slate-800 font-sans border-l-2 border-indigo-400/50 italic mb-3 leading-relaxed">
              "{data.content}"
            </div>
          )}
          <div className="text-[11px] text-slate-500 leading-relaxed font-sans font-medium">
            {data.label}
          </div>
        </div>
      </div>
    </motion.div>
  );
});

export const NoteNode = React.memo(({ id, data, selected }: NodeProps<WorkspaceNode>) => {
  const { setNodes } = useReactFlow();
  const [isEditing, setIsEditing] = useState(false);
  const editRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isEditing && editRef.current) {
      editRef.current.focus();
      if (editRef.current.innerText === 'Add text') {
        const range = document.createRange();
        range.selectNodeContents(editRef.current);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }
  }, [isEditing]);

  const onUpdate = (e: React.FormEvent<HTMLDivElement>) => {
    const text = e.currentTarget.innerText.trim();
    setNodes((nds) => nds.map((node) => node.id === id ? { ...node, data: { ...node.data, label: text } } : node));
    setIsEditing(false);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9, rotate: -1 }}
      animate={{ opacity: 1, scale: 1, rotate: 0 }}
      onDoubleClick={() => setIsEditing(true)}
      className={`bg-[#fef9c3] p-6 shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-2px_rgba(0,0,0,0.05)] border-t border-white/40 w-full h-full group relative flex items-center justify-center text-center cursor-pointer transition-all ${selected ? 'ring-2 ring-yellow-400/50' : ''}`}
    >
      <NodeResizer minWidth={100} minHeight={100} isVisible={selected} lineClassName="border-yellow-400" handleClassName="h-2 w-2 bg-white border-2 border-yellow-500 rounded" />
      
      <Handle type="target" position={Position.Top} className="w-1.5 h-1.5 !bg-yellow-600/20 border-none opacity-0 group-hover:opacity-100 transition-opacity" />
      <Handle type="source" position={Position.Bottom} className="w-1.5 h-1.5 !bg-yellow-600/20 border-none opacity-0 group-hover:opacity-100 transition-opacity" />
      <Handle type="source" position={Position.Left} className="w-1.5 h-1.5 !bg-yellow-600/20 border-none opacity-0 group-hover:opacity-100 transition-opacity" />
      <Handle type="source" position={Position.Right} className="w-1.5 h-1.5 !bg-yellow-600/20 border-none opacity-0 group-hover:opacity-100 transition-opacity" />
      
      <div className="w-full max-h-full overflow-y-auto custom-scrollbar pr-1 py-1">
        <div 
          ref={editRef}
          className={`text-sm font-sans text-yellow-900 font-medium leading-relaxed outline-none cursor-text w-full break-words whitespace-pre-wrap ${isEditing ? 'bg-white/10 rounded p-1' : ''} ${!data.label && !isEditing ? 'text-yellow-900/30 italic' : ''}`} 
          contentEditable={isEditing}
          suppressContentEditableWarning
          onBlur={onUpdate}
        >
          {isEditing ? data.label : (data.label || 'Start writing note...')}
        </div>
      </div>
    </motion.div>
  );
});

export const IdeaNode = React.memo(({ id, data, selected }: NodeProps<WorkspaceNode>) => {
  const { setNodes } = useReactFlow();
  const [isEditing, setIsEditing] = useState(false);

  const onUpdate = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
     setNodes((nds) => nds.map((node) => node.id === id ? { ...node, data: { ...node.data, label: e.target.value } } : node));
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`p-5 flex flex-col items-center justify-center text-center w-full h-full group relative transition-all ${selected ? 'bg-slate-50/50 rounded-xl ring-2 ring-slate-200' : ''}`}
    >
      <NodeResizer minWidth={80} minHeight={40} isVisible={selected} lineClassName="border-slate-300" handleClassName="h-2 w-2 bg-white border-2 border-slate-400 rounded" />
      
      <Handle type="target" position={Position.Top} className="w-2 h-2 !bg-slate-400 border-none opacity-20 group-hover:opacity-100" />
      <Handle type="source" position={Position.Bottom} className="w-2 h-2 !bg-slate-400 border-none opacity-20 group-hover:opacity-100" />
      <Handle type="source" position={Position.Left} className="w-2 h-2 !bg-slate-400 border-none opacity-20 group-hover:opacity-100" />
      <Handle type="source" position={Position.Right} className="w-2 h-2 !bg-slate-400 border-none opacity-20 group-hover:opacity-100" />
      
      {isEditing ? (
        <textarea 
          autoFocus
           onBlur={() => setIsEditing(false)}
           onDoubleClick={(e) => e.stopPropagation()}
           onChange={onUpdate}
           placeholder="Synthesis idea..."
           className="bg-transparent text-sm font-sans font-medium text-center outline-none w-full resize-none h-auto break-words text-slate-900 placeholder:text-slate-900/20"
           value={data.label}
        />
      ) : (
        <div 
          onDoubleClick={() => setIsEditing(true)}
          className={`text-sm font-sans font-medium tracking-tight leading-snug cursor-text break-words whitespace-pre-wrap text-slate-900 ${!data.label ? 'text-slate-900/20 italic' : ''}`}
        >
          {data.label || 'Research Synthesis...'}
        </div>
      )}
    </motion.div>
  );
});

export const GroupNode = React.memo(({ id, data, selected }: NodeProps<WorkspaceNode>) => {
  const { setNodes } = useReactFlow();
  const [isEditing, setIsEditing] = useState(false);

  const onUpdate = (e: React.FormEvent<HTMLDivElement>) => {
    const text = e.currentTarget.innerText;
    setNodes((nds) => nds.map((node) => node.id === id ? { ...node, data: { ...node.data, label: text } } : node));
    setIsEditing(false);
  };

  return (
    <div 
      onDoubleClick={() => setIsEditing(true)}
      className={`w-full h-full border-2 rounded-lg transition-all relative ${selected ? 'border-indigo-400 bg-indigo-50/10' : 'border-slate-200 border-dashed bg-slate-50/5'}`}
    >
      <Handle type="target" position={Position.Top} className="w-2 h-2 !bg-indigo-300 border-none opacity-50 hover:opacity-100" />
      <Handle type="source" position={Position.Bottom} className="w-2 h-2 !bg-indigo-300 border-none opacity-50 hover:opacity-100" />
      <Handle type="source" position={Position.Left} className="w-2 h-2 !bg-indigo-300 border-none opacity-50 hover:opacity-100" />
      <Handle type="source" position={Position.Right} className="w-2 h-2 !bg-indigo-300 border-none opacity-50 hover:opacity-100" />
      
      <NodeResizer 
        color="#818cf8" 
        minWidth={100} 
        minHeight={100} 
        isVisible={selected}
      />
      <div 
        className={`absolute top-2 left-3 px-2 py-0.5 bg-white border border-slate-200 rounded text-[9px] font-sans font-bold text-slate-400 uppercase tracking-widest outline-none cursor-text z-10 ${isEditing ? 'ring-2 ring-indigo-400 border-transparent shadow-sm' : ''}`}
        contentEditable={isEditing}
        suppressContentEditableWarning
        onBlur={onUpdate}
      >
        {data.label}
      </div>
    </div>
  );
});

export const PDFPageNode = React.memo(({ data, selected }: NodeProps<WorkspaceNode>) => {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`relative h-full w-full transition-all group ${selected ? 'ring-2 ring-indigo-500 rounded-sm' : ''}`}
    >
      <NodeResizer 
        minWidth={50} 
        minHeight={50} 
        isVisible={selected} 
        lineClassName="border-indigo-400" 
        handleClassName="h-3 w-3 bg-white border-2 border-indigo-500 rounded-full shadow-md"
        keepAspectRatio={true}
      />
      <Handle type="target" position={Position.Top} className="w-2 h-2 !bg-slate-300 border-none opacity-0 group-hover:opacity-100" />
      <Handle type="source" position={Position.Bottom} className="w-2 h-2 !bg-slate-300 border-none opacity-0 group-hover:opacity-100" />
      <Handle type="source" position={Position.Left} className="w-2 h-2 !bg-slate-300 border-none opacity-0 group-hover:opacity-100" />
      <Handle type="source" position={Position.Right} className="w-2 h-2 !bg-slate-300 border-none opacity-0 group-hover:opacity-100" />
      
      <div className="absolute top-2 right-2 bg-white/60 backdrop-blur-md rounded-full px-2 py-0.5 text-[7px] font-bold text-slate-500 uppercase tracking-widest z-10 pointer-events-none opacity-0 group-hover:opacity-100 shadow-sm border border-white/40">
        Page Layer
      </div>

      {data.imageUrl ? (
        <div className="w-full h-full flex flex-col group overflow-hidden bg-white shadow-sm ring-1 ring-black/5 rounded-sm">
          <div className={`flex-1 transition-all h-full w-full ${selected ? 'shadow-xl' : ''}`}>
            <img 
              src={data.imageUrl} 
              alt="Page" 
              className="w-full h-full object-contain" 
              referrerPolicy="no-referrer"
            />
          </div>
          {selected && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-slate-900/80 backdrop-blur-md px-3 py-1 rounded-full flex items-center justify-center animate-in fade-in slide-in-from-bottom-2 border border-white/10 shadow-2xl z-20">
              <div className="text-[8px] font-bold text-white truncate max-w-[120px] tracking-tight">{data.label}</div>
            </div>
          )}
        </div>
      ) : (
        <div className="w-full h-full bg-slate-50 flex items-center justify-center rounded-sm border border-slate-100">
          <FileText size={24} className="text-slate-300" />
        </div>
      )}
    </motion.div>
  );
});

export const ImageNode = React.memo(({ data, selected }: NodeProps<WorkspaceNode>) => {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`relative h-full w-full transition-all group bg-white border border-slate-200 rounded shadow-sm overflow-hidden ${selected ? 'ring-2 ring-indigo-500' : ''}`}
    >
      <NodeResizer 
        minWidth={50} 
        minHeight={50} 
        isVisible={selected} 
        keepAspectRatio={true}
        lineClassName="border-indigo-400" 
        handleClassName="h-2 w-2 bg-white border-2 border-indigo-500 rounded"
      />
      <Handle type="target" position={Position.Top} className="w-1.5 h-1.5 !bg-slate-300 border-none opacity-0 group-hover:opacity-100" />
      <Handle type="source" position={Position.Bottom} className="w-1.5 h-1.5 !bg-slate-300 border-none opacity-0 group-hover:opacity-100" />
      <Handle type="source" position={Position.Left} className="w-1.5 h-1.5 !bg-slate-300 border-none opacity-0 group-hover:opacity-100" />
      <Handle type="source" position={Position.Right} className="w-1.5 h-1.5 !bg-slate-300 border-none opacity-0 group-hover:opacity-100" />
      
      {data.imageUrl ? (
        <img 
          src={data.imageUrl} 
          alt="Uploaded" 
          className="w-full h-full object-contain" 
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="w-full h-full bg-slate-50 flex items-center justify-center">
            <FileText size={24} className="text-slate-300" />
        </div>
      )}
    </motion.div>
  );
});

const AnimatedConnectionLine = ({
  fromX,
  fromY,
  toX,
  toY,
}: ConnectionLineComponentProps) => {
  const [edgePath] = getBezierPath({
    sourceX: fromX,
    sourceY: fromY,
    targetX: toX,
    targetY: toY,
  });

  return (
    <g>
      <path
        fill="none"
        stroke="#6366f1"
        strokeWidth={2}
        className="animated-connection"
        d={edgePath}
      />
      <circle
        cx={toX}
        cy={toY}
        fill="#fff"
        r={4}
        stroke="#6366f1"
        strokeWidth={2}
      />
    </g>
  );
};

const nodeTypes = {
  pdfSnippet: PDFSnippetNode,
  pdfPage: PDFPageNode,
  idea: IdeaNode,
  note: NoteNode,
  group: GroupNode,
  image: ImageNode,
  pathNode: PathNode,
};

interface InfiniteCanvasProps {
  nodes: WorkspaceNode[];
  edges: WorkspaceEdge[];
  setNodes: React.Dispatch<React.SetStateAction<WorkspaceNode[]>>;
  setEdges: React.Dispatch<React.SetStateAction<WorkspaceEdge[]>>;
  paths: PathData[];
  setPaths: React.Dispatch<React.SetStateAction<PathData[]>>;
  drawingTool: 'none' | 'pen' | 'highlighter' | 'eraser' | 'connector' | 'marquee' | 'hand' | 'group';
  setDrawingTool: (tool: 'none' | 'pen' | 'highlighter' | 'eraser' | 'connector' | 'marquee' | 'hand' | 'group') => void;
  currentColor: string;
  penWidth: number;
  highlighterWidth: number;
  onUndo?: () => void;
  onRedo?: () => void;
  onCopy?: (nodes: WorkspaceNode[]) => void;
  onPaste?: () => void;
  onSnapshot?: () => void;
  clipboardAvailable?: boolean;
}

function CanvasInner({ 
  nodes, 
  edges, 
  setNodes, 
  setEdges, 
  paths, 
  setPaths, 
  drawingTool, 
  setDrawingTool,
  currentColor,
  penWidth,
  highlighterWidth,
  onUndo,
  onRedo,
  onCopy,
  onPaste,
  onSnapshot,
  clipboardAvailable
}: InfiniteCanvasProps) {
  const { screenToFlowPosition, getNodes } = useReactFlow();
  const { x, y, zoom } = useViewport();
  const [currentPath, setCurrentPath] = useState<number[][] | null>(null);
  const [groupStart, setGroupStart] = useState<{ x: number, y: number } | null>(null);
  const [groupCurrent, setGroupCurrent] = useState<{ x: number, y: number } | null>(null);
  const [menu, setMenu] = useState<{ x: number, y: number } | null>(null);
  const isDrawing = drawingTool === 'pen' || drawingTool === 'highlighter';

  // Migration effect: convert legacy paths to nodes
  useEffect(() => {
    if (paths && paths.length > 0) {
      const newPathNodes: WorkspaceNode[] = paths.map(p => {
        const strokeWidth = p.width || 2;
        const box = getBoundingBox(p.points, strokeWidth);
        const normalizedPoints = p.points.map(([px, py, pr]) => [px - box.x, py - box.y, pr]);
        return {
          id: p.id,
          type: 'pathNode',
          position: { x: box.x, y: box.y },
          style: { width: box.width, height: box.height },
          data: {
            label: 'Path',
            type: 'path',
            pathData: { ...p, points: normalizedPoints, width: strokeWidth }
          },
          draggable: true,
          selectable: true,
        };
      });
      setNodes(nds => [...nds, ...newPathNodes]);
      setPaths([]);
    }
  }, [paths, setNodes, setPaths]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (cmdOrCtrl) {
        if (e.key === 'z') {
          e.preventDefault();
          if (e.shiftKey) onRedo?.();
          else onUndo?.();
        } else if (e.key === 'y') {
          e.preventDefault();
          onRedo?.();
        } else if (e.key === 'c') {
          const selectedNodes = (getNodes() as WorkspaceNode[]).filter(n => n.selected);
          if (selectedNodes.length > 0) {
            e.preventDefault();
            onCopy?.(selectedNodes);
          }
        } else if (e.key === 'v') {
          if (clipboardAvailable) {
            e.preventDefault();
            onPaste?.();
          }
        }
      }
      
      // Delete selected
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Only if not editing text
        if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA' && !document.activeElement?.hasAttribute('contenteditable')) {
          const selectedNodes = (getNodes() as WorkspaceNode[]).filter(n => n.selected);
          if (selectedNodes.length > 0) {
            onSnapshot?.();
            const selectedIds = new Set(selectedNodes.map(n => n.id));
            setNodes(nds => nds.filter(n => !selectedIds.has(n.id)));
            setEdges(eds => eds.filter(e => !selectedIds.has(e.source) && !selectedIds.has(e.target)));
          }
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onUndo, onRedo, onCopy, onPaste, onSnapshot, getNodes, setNodes, setEdges]);

  const onPaneContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    setMenu({ x: event.clientX, y: event.clientY });
  }, []);

  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: WorkspaceNode) => {
    event.preventDefault();
    // If node not selected, select it
    if (!node.selected) {
      setNodes(nds => nds.map(n => ({ ...n, selected: n.id === node.id })));
    }
    setMenu({ x: event.clientX, y: event.clientY });
  }, [setNodes]);

  const onContextMenuClose = useCallback(() => setMenu(null), []);

  const handleGroupSelected = useCallback(() => {
    const selectedNodes = getNodes().filter(n => n.selected);
    if (selectedNodes.length === 0) {
      setMenu(null);
      return;
    }

    onSnapshot?.();

    const minX = Math.min(...selectedNodes.map(n => n.position.x));
    const minY = Math.min(...selectedNodes.map(n => n.position.y));
    const maxX = Math.max(...selectedNodes.map(n => {
      const width = (n.style?.width as number) || 100;
      return n.position.x + width;
    }));
    const maxY = Math.max(...selectedNodes.map(n => {
      const height = (n.style?.height as number) || 100;
      return n.position.y + height;
    }));

    const padding = 40;
    const groupId = uuidv4();
    
    const groupNode: WorkspaceNode = {
      id: groupId,
      type: 'group',
      position: { x: minX - padding, y: minY - padding },
      style: { 
        width: (maxX - minX) + padding * 2, 
        height: (maxY - minY) + padding * 2, 
        zIndex: -1 
      },
      data: { label: 'Conceptual Cluster', type: 'group' }
    };

    setNodes(nds => {
      const newNodes = [...nds, groupNode];
      // Set parentId for the selected nodes
      return newNodes.map(n => {
        if (n.selected && n.id !== groupId) {
          return { ...n, parentId: groupId };
        }
        return n;
      });
    });

    setMenu(null);
  }, [getNodes, setNodes, onSnapshot]);

  const onMouseDown = useCallback((event: React.MouseEvent) => {
    if (menu) setMenu(null);
    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    if (isDrawing) {
      setCurrentPath([[position.x, position.y, event.pressure || 0.5]]);
    } else if (drawingTool === 'group') {
      setGroupStart(position);
      setGroupCurrent(position);
    }
  }, [isDrawing, drawingTool, screenToFlowPosition]);

  const onMouseMove = useCallback((event: React.MouseEvent) => {
    if (!currentPath && !groupStart) return;
    
    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    if (currentPath) {
      // Revert to freehand during drawing for both, but we'll convert highlighter on mouseUp
      setCurrentPath(prev => prev ? [...prev, [position.x, position.y, event.pressure || 0.5]] : [[position.x, position.y, event.pressure || 0.5]]);
    } else if (groupStart) {
      setGroupCurrent(position);
    }
  }, [currentPath, groupStart, screenToFlowPosition]);

  const onMouseUp = useCallback(() => {
    if (currentPath) {
      onSnapshot?.();
      
      let finalPoints = currentPath;
      
      // Convert highlighter to straight line on completion
      if (drawingTool === 'highlighter' && currentPath.length > 1) {
        const start = currentPath[0];
        const end = currentPath[currentPath.length - 1];
        finalPoints = [start, end];
      }

      const strokeWidth = drawingTool === 'pen' ? penWidth : highlighterWidth;
      const box = getBoundingBox(finalPoints, strokeWidth);
      
      // Normalize points relative to the node position
      const normalizedPoints = finalPoints.map(([px, py, p]) => [px - box.x, py - box.y, p]);

      const newNode: WorkspaceNode = {
        id: uuidv4(),
        type: 'pathNode',
        position: { x: box.x, y: box.y },
        style: { width: box.width, height: box.height },
        data: {
          label: 'Path',
          type: 'path',
          pathData: {
            id: uuidv4(),
            points: normalizedPoints,
            color: currentColor,
            width: strokeWidth,
            opacity: drawingTool === 'pen' ? 1 : 0.4
          }
        },
        draggable: true,
        selectable: true,
      };

      setNodes(prev => [...prev, newNode]);
      setCurrentPath(null);
    } else if (groupStart && groupCurrent) {
      onSnapshot?.();
      const x = Math.min(groupStart.x, groupCurrent.x);
      const y = Math.min(groupStart.y, groupCurrent.y);
      const width = Math.abs(groupStart.x - groupCurrent.x);
      const height = Math.abs(groupStart.y - groupCurrent.y);

      if (width > 20 && height > 20) {
        setNodes(nds => [...nds, {
          id: uuidv4(),
          type: 'group',
          position: { x, y },
          style: { width, height, zIndex: -1 },
          data: { label: 'New Conceptual Group', type: 'group' }
        }]);
      }
      setGroupStart(null);
      setGroupCurrent(null);
      setDrawingTool('hand');
    }
  }, [currentPath, groupStart, groupCurrent, currentColor, drawingTool, penWidth, highlighterWidth, setPaths, setNodes, setDrawingTool, onSnapshot]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: WorkspaceNode) => {
    if (drawingTool === 'eraser') {
      onSnapshot?.();
      setNodes((nds) => nds.filter((n) => n.id !== node.id));
      setEdges((eds) => eds.filter((e) => e.source !== node.id && e.target !== node.id));
    }
  }, [drawingTool, setNodes, setEdges, onSnapshot]);

  const onEdgeClick = useCallback((_: React.MouseEvent, edge: WorkspaceEdge) => {
    if (drawingTool === 'eraser') {
      onSnapshot?.();
      setEdges((eds) => eds.filter((e) => e.id !== edge.id));
    }
  }, [drawingTool, setEdges, onSnapshot]);

  const dragRef = useRef<{ id: string, x: number, y: number } | null>(null);

  const onNodeDragStart = useCallback((_: React.MouseEvent, node: WorkspaceNode) => {
    onSnapshot?.();
    if (node.type === 'group') {
      dragRef.current = { id: node.id, x: node.position.x, y: node.position.y };
    }
  }, [onSnapshot]);

  const onNodeDrag = useCallback((_: React.MouseEvent, node: WorkspaceNode) => {
    if (node.type === 'group' && dragRef.current && dragRef.current.id === node.id) {
      const dx = node.position.x - dragRef.current.x;
      const dy = node.position.y - dragRef.current.y;
      
      if (Math.abs(dx) > 0 || Math.abs(dy) > 0) {
        // Find all nodes visually contained within this group
        const gx = dragRef.current.x;
        const gy = dragRef.current.y;
        const gw = (node.style?.width as number) || 100;
        const gh = (node.style?.height as number) || 100;

        setNodes((nds) => nds.map((n) => {
          if (n.id === node.id) return n;

          // Check visual containment in the PREVIOUS position of the group
          const isInside = n.position.x >= gx && 
                           n.position.x <= gx + gw && 
                           n.position.y >= gy && 
                           n.position.y <= gy + gh;

          if (isInside) {
            return {
              ...n,
              position: {
                x: n.position.x + dx,
                y: n.position.y + dy
              }
            };
          }
          return n;
        }));

        // Update ref for next drag frame
        dragRef.current = { id: node.id, x: node.position.x, y: node.position.y };
      }
    }
  }, [setNodes]);

  const onNodeDragStop = useCallback((_: React.MouseEvent, node: WorkspaceNode) => {
    dragRef.current = null;

    // Establishing explicit parent-child relationship on drop
    if (node.type !== 'group') {
      setNodes((nds) => {
        const activeNode = nds.find(n => n.id === node.id);
        if (!activeNode) return nds;

        // Check if dropped inside a group
        const groups = nds.filter(g => g.type === 'group' && g.id !== activeNode.id);
        const nx = activeNode.position.x;
        const ny = activeNode.position.y;

        const parentGroup = groups.find(g => {
          const gx = g.position.x;
          const gy = g.position.y;
          const gw = (g.style?.width as number) || 100;
          const gh = (g.style?.height as number) || 100;
          return nx >= gx && nx <= gx + gw && ny >= gy && ny <= gy + gh;
        });

        return nds.map(n => {
          if (n.id === activeNode.id) {
            return {
              ...n,
              parentId: parentGroup?.id || undefined
            };
          }
          return n;
        });
      });
    }
  }, [setNodes]);

  const onNodesChange: OnNodesChange<WorkspaceNode> = (changes) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  };

  const onEdgesChange: OnEdgesChange<WorkspaceEdge> = (changes) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
  };

  const onConnect = (params: Connection) => {
    setEdges((eds) => addEdge({ ...params, animated: true }, eds));
  };

  return (
    <div 
      onContextMenu={onPaneContextMenu}
      className={`w-full h-full relative overflow-hidden ${isDrawing || drawingTool === 'group' ? 'cursor-crosshair' : drawingTool === 'eraser' ? 'eraser-mode active cursor-crosshair' : drawingTool === 'hand' ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onPaneContextMenu={onPaneContextMenu}
        onNodeContextMenu={onNodeContextMenu}
        onPaneClick={onContextMenuClose}
        nodeTypes={nodeTypes}
        connectionLineComponent={AnimatedConnectionLine}
        panOnDrag={drawingTool === 'hand'}
        selectionOnDrag={drawingTool === 'marquee' || drawingTool === 'hand'}
        selectionMode={SelectionMode.Partial}
        selectionKeyCode="Shift"
        zoomOnScroll={true}
        panOnScroll={drawingTool !== 'pen' && drawingTool !== 'highlighter'}
        elementsSelectable={drawingTool === 'hand' || drawingTool === 'connector' || drawingTool === 'eraser' || drawingTool === 'marquee'}
        nodesConnectable={drawingTool === 'connector'}
        nodesDraggable={drawingTool === 'hand'}
        fitView
      >
        <Background gap={32} size={1} color="#e2e8f0" />
        
        <Panel position="top-left" className={`${isDrawing || drawingTool === 'group' ? 'pointer-events-auto' : 'pointer-events-none'} !m-0 w-full h-full z-50`}>
          <svg 
             onMouseDown={onMouseDown}
             onMouseMove={onMouseMove}
             onMouseUp={onMouseUp}
             onContextMenu={onPaneContextMenu}
             className={`w-full h-full overflow-visible ${isDrawing || drawingTool === 'group' ? 'pointer-events-auto' : 'pointer-events-none'}`}
             style={{ transformOrigin: '0 0' }}
          >
             <g transform={`translate(${x},${y}) scale(${zoom})`}>
                {currentPath && (
                  <path
                    d={getSvgPathFromStroke(getStroke(currentPath, {
                      size: drawingTool === 'pen' ? penWidth : highlighterWidth,
                      thinning: 0.5,
                      smoothing: 0.5,
                      streamline: 0.5,
                    }))}
                    fill={currentColor}
                    opacity={drawingTool === 'pen' ? 1 : 0.4}
                  />
                )}

                {groupStart && groupCurrent && (
                  <rect
                    x={Math.min(groupStart.x, groupCurrent.x)}
                    y={Math.min(groupStart.y, groupCurrent.y)}
                    width={Math.abs(groupStart.x - groupCurrent.x)}
                    height={Math.abs(groupStart.y - groupCurrent.y)}
                    fill="rgba(79, 70, 229, 0.1)"
                    stroke="#4f46e5"
                    strokeWidth={2 / zoom}
                    strokeDasharray={`${4 / zoom}, ${4 / zoom}`}
                    rx={8 / zoom}
                  />
                )}
             </g>
          </svg>
        </Panel>

        <Controls />
        
        {menu && (
          <div 
            className="fixed z-[1000] bg-white border border-slate-200 shadow-xl rounded-lg py-1 w-44 animate-in fade-in zoom-in-95 duration-100"
            style={{ left: menu.x, top: menu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleGroupSelected}
              disabled={getNodes().filter(n => n.selected).length === 0}
              className="flex items-center gap-2 w-full px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed group"
            >
              <div className="p-1 rounded bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                <Layers size={14} />
              </div>
              Group Selected
            </button>
            
            <div className="h-[1px] bg-slate-100 my-1 mx-2" />
            
            <button
              onClick={() => {
                const selectedNodes = getNodes().filter(n => n.selected);
                if (selectedNodes.length > 0) {
                  onSnapshot?.();
                  const selectedIds = new Set(selectedNodes.map(n => n.id));
                  setNodes(nds => nds.filter(n => !selectedIds.has(n.id)));
                  setEdges(eds => eds.filter(e => !selectedIds.has(e.source) && !selectedIds.has(e.target)));
                }
                setMenu(null);
              }}
              className="flex items-center gap-2 w-full px-4 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 transition-colors group"
            >
              <div className="p-1 rounded bg-red-50 text-red-500 group-hover:bg-red-500 group-hover:text-white transition-colors">
                <Trash2 size={14} />
              </div>
              Delete Selected
            </button>
          </div>
        )}
      </ReactFlow>
    </div>
  );
}

export default function InfiniteCanvas(props: InfiniteCanvasProps) {
  return (
    <CanvasInner {...props} />
  );
}
