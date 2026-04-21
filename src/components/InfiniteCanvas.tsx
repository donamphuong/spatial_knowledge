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
  SelectionMode
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { WorkspaceNode, WorkspaceEdge, WorkspaceNodeData, PathData } from '../types';
import { motion } from 'motion/react';
import { StickyNote, Maximize2, Trash2, Link, Edit3, Quote, Copy, FileText, MousePointer2 } from 'lucide-react';
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
const PDFSnippetNode = ({ data }: NodeProps<WorkspaceNode>) => {
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
      className="bg-white border border-slate-200 rounded shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden min-w-[240px] max-w-[400px] border-b-2 border-b-indigo-100"
    >
      <Handle type="target" position={Position.Top} className="w-1.5 h-1.5 !bg-slate-300 border-none" />
      
      <div className="px-3 py-1.5 bg-[#fcfcf7] border-b border-slate-100 flex items-center justify-between">
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

      {data.imageUrl && (
        <div className="bg-[#fafafa] p-2 overflow-hidden flex items-center justify-center border-b border-slate-50">
          <img src={data.imageUrl} alt="Clip" className="w-full h-auto rounded border border-slate-200" />
        </div>
      )}
      
      <div className="p-4 pt-3">
        {data.content && (
          <div className="bg-[#fefce8]/40 p-3 rounded text-[11px] text-slate-800 font-sans border-l-2 border-indigo-400/50 italic mb-3 leading-relaxed">
            "{data.content}"
          </div>
        )}
        <div className="text-[11px] text-slate-500 leading-relaxed font-sans font-medium">
          {data.label}
        </div>
      </div>
      
      <Handle type="source" position={Position.Bottom} className="w-1.5 h-1.5 !bg-slate-300 border-none" />
    </motion.div>
  );
};

const NoteNode = ({ id, data }: NodeProps<WorkspaceNode>) => {
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
    const text = e.currentTarget.innerText;
    setNodes((nds) => nds.map((node) => node.id === id ? { ...node, data: { ...node.data, label: text || 'Add text' } } : node));
    setIsEditing(false);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9, rotate: -1 }}
      animate={{ opacity: 1, scale: 1, rotate: 0 }}
      onDoubleClick={() => setIsEditing(true)}
      className="bg-[#fef9c3] p-6 shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-2px_rgba(0,0,0,0.05)] border-t border-white/40 w-[220px] h-[220px] group relative flex items-center justify-center text-center cursor-pointer"
    >
      <Handle type="target" position={Position.Top} className="w-1.5 h-1.5 !bg-yellow-600/20 border-none opacity-0 group-hover:opacity-100 transition-opacity" />
      
      <button 
        onClick={(e) => { e.stopPropagation(); setIsEditing(!isEditing); }}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-40 p-1 hover:bg-yellow-200/50 rounded transition-all text-yellow-800 z-20"
        title="Edit Note"
      >
        <Edit3 size={12} />
      </button>

      <div className="w-full max-h-full overflow-y-auto custom-scrollbar pr-1 py-1">
        <div 
          ref={editRef}
          className={`text-sm font-sans text-yellow-900 font-medium leading-relaxed outline-none cursor-text w-full break-words whitespace-pre-wrap ${isEditing ? 'bg-white/30 rounded p-1 ring-1 ring-yellow-400/30' : ''}`} 
          contentEditable={isEditing}
          suppressContentEditableWarning
          onBlur={onUpdate}
        >
          {data.label}
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="w-1.5 h-1.5 !bg-yellow-600/20 border-none opacity-0 group-hover:opacity-100 transition-opacity" />
    </motion.div>
  );
};

const IdeaNode = ({ id, data }: NodeProps<WorkspaceNode>) => {
  const { setNodes } = useReactFlow();
  const [isEditing, setIsEditing] = useState(false);

  const onUpdate = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
     setNodes((nds) => nds.map((node) => node.id === id ? { ...node, data: { ...node.data, label: e.target.value } } : node));
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-slate-900 text-white p-5 rounded shadow-2xl flex flex-col items-center justify-center text-center border border-slate-800 min-w-[180px] max-w-[280px] group relative"
    >
      <Handle type="target" position={Position.Top} className="w-2 h-2 !bg-slate-700 border-none" />
      
      <div className="flex items-center justify-between w-full mb-2">
        <div className="text-[9px] font-sans font-bold opacity-30 uppercase tracking-[0.2em]">Synthesis</div>
        <button 
          onClick={() => setIsEditing(!isEditing)}
          className="opacity-0 group-hover:opacity-60 p-1 hover:bg-slate-800 rounded transition-all text-white"
          title="Edit Idea"
        >
          <Edit3 size={10} />
        </button>
      </div>
      
      {isEditing ? (
        <textarea 
          autoFocus
           onBlur={() => setIsEditing(false)}
           onDoubleClick={(e) => e.stopPropagation()}
           onChange={onUpdate}
           className="bg-transparent text-sm font-sans font-medium text-center outline-none w-full resize-none h-auto break-words"
           value={data.label}
        />
      ) : (
        <div 
          onDoubleClick={() => setIsEditing(true)}
          className="text-sm font-sans font-medium tracking-tight leading-snug cursor-text break-words whitespace-pre-wrap"
        >
          {data.label}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="w-2 h-2 !bg-slate-700 border-none" />
    </motion.div>
  );
};

const GroupNode = ({ id, data, selected }: NodeProps<WorkspaceNode>) => {
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

      <Handle type="source" position={Position.Bottom} className="w-2 h-2 !bg-indigo-300 border-none opacity-50 hover:opacity-100" />
    </div>
  );
};

const PDFPageNode = ({ data, selected }: NodeProps<WorkspaceNode>) => {
  const baseWidth = 250;
  const aspectRatio = data.aspectRatio || 0.707; // Default to vertical A4
  const nodeHeight = baseWidth / aspectRatio;

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`relative transition-all group ${selected ? 'ring-4 ring-indigo-500/20 rounded' : ''}`}
      style={{ width: baseWidth, height: nodeHeight }}
    >
      <Handle type="target" position={Position.Top} className="w-2 h-2 !bg-slate-300 border-none opacity-0 group-hover:opacity-100" />
      
      <div className="absolute top-2 right-2 bg-white/40 backdrop-blur-sm rounded px-1.5 py-0.5 text-[8px] font-bold text-slate-500 uppercase tracking-widest z-10 pointer-events-none opacity-0 group-hover:opacity-100">
        Full Page
      </div>

      {data.imageUrl ? (
        <div className="w-full h-full flex flex-col group overflow-hidden">
          <div className={`flex-1 transition-all ${selected ? 'shadow-2xl scale-[1.02]' : 'shadow-sm'}`}>
            <img 
              src={data.imageUrl} 
              alt="Page" 
              className="w-full h-full object-cover" 
              referrerPolicy="no-referrer"
            />
          </div>
          {selected && (
            <div className="absolute bottom-0 left-0 right-0 bg-white/80 backdrop-blur-sm px-2 py-1 flex items-center justify-center animate-in fade-in slide-in-from-bottom-1">
              <div className="text-[9px] font-bold text-slate-500 truncate">{data.label}</div>
            </div>
          )}
        </div>
      ) : (
        <div className="w-full h-full bg-slate-100/50 flex items-center justify-center rounded">
          <FileText size={24} className="text-slate-300" />
        </div>
      )}
      
      <Handle type="source" position={Position.Bottom} className="w-2 h-2 !bg-slate-300 border-none opacity-0 group-hover:opacity-100" />
    </motion.div>
  );
};

const nodeTypes = {
  pdfSnippet: PDFSnippetNode,
  pdfPage: PDFPageNode,
  idea: IdeaNode,
  note: NoteNode,
  group: GroupNode,
};

interface InfiniteCanvasProps {
  nodes: WorkspaceNode[];
  edges: WorkspaceEdge[];
  setNodes: React.Dispatch<React.SetStateAction<WorkspaceNode[]>>;
  setEdges: React.Dispatch<React.SetStateAction<WorkspaceEdge[]>>;
  paths: PathData[];
  setPaths: React.Dispatch<React.SetStateAction<PathData[]>>;
  drawingTool: 'none' | 'pen' | 'highlighter' | 'eraser' | 'connector' | 'marquee';
  currentColor: string;
}

function CanvasInner({ nodes, edges, setNodes, setEdges, paths, setPaths, drawingTool, currentColor }: InfiniteCanvasProps) {
  const { screenToFlowPosition } = useReactFlow();
  const { x, y, zoom } = useViewport();
  const [currentPath, setCurrentPath] = useState<number[][] | null>(null);
  const isDrawing = drawingTool === 'pen' || drawingTool === 'highlighter';

  const onMouseDown = useCallback((event: React.MouseEvent) => {
    if (!isDrawing) return;
    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    setCurrentPath([[position.x, position.y, event.pressure || 0.5]]);
  }, [isDrawing, screenToFlowPosition]);

  const onMouseMove = useCallback((event: React.MouseEvent) => {
    if (!currentPath) return;
    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    setCurrentPath([...currentPath, [position.x, position.y, event.pressure || 0.5]]);
  }, [currentPath, screenToFlowPosition]);

  const onMouseUp = useCallback(() => {
    if (!currentPath) return;

    const newPath: PathData = {
      id: uuidv4(),
      points: currentPath,
      color: currentColor,
      width: drawingTool === 'pen' ? 2 : 12,
      opacity: drawingTool === 'pen' ? 1 : 0.4
    };

    setPaths(prev => [...prev, newPath]);
    setCurrentPath(null);
  }, [currentPath, currentColor, drawingTool, setPaths]);

  const onPathClick = (id: string, e: React.MouseEvent) => {
    if (drawingTool === 'eraser') {
      e.stopPropagation();
      setPaths(prev => prev.filter(p => p.id !== id));
    }
  };

  const onNodeClick = (_: React.MouseEvent, node: WorkspaceNode) => {
    if (drawingTool === 'eraser') {
      setNodes((nds) => nds.filter((n) => n.id !== node.id));
      setEdges((eds) => eds.filter((e) => e.source !== node.id && e.target !== node.id));
    }
  };

  const onEdgeClick = (_: React.MouseEvent, edge: WorkspaceEdge) => {
    if (drawingTool === 'eraser') {
      setEdges((eds) => eds.filter((e) => e.id !== edge.id));
    }
  };

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
    <div className={`w-full h-full relative overflow-hidden ${isDrawing ? 'cursor-crosshair' : drawingTool === 'eraser' ? 'eraser-mode active cursor-crosshair' : ''}`}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        nodeTypes={nodeTypes}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        panOnDrag={drawingTool === 'none'}
        selectionOnDrag={drawingTool === 'marquee'}
        selectionMode={SelectionMode.Partial}
        selectionKeyCode={null} 
        zoomOnScroll={true}
        panOnScroll={drawingTool === 'none'}
        elementsSelectable={drawingTool === 'none' || drawingTool === 'connector' || drawingTool === 'eraser' || drawingTool === 'marquee'}
        nodesConnectable={drawingTool === 'connector'}
        nodesDraggable={drawingTool === 'none' || drawingTool === 'marquee'}
        fitView
      >
        <Background gap={32} size={1} color="#e2e8f0" />
        
        <Panel position="top-left" className="pointer-events-none !m-0 w-full h-full">
          <svg 
             className="w-full h-full overflow-visible pointer-events-none z-50"
             style={{ transformOrigin: '0 0' }}
          >
             <g transform={`translate(${x},${y}) scale(${zoom})`}>
                {paths.map((path) => {
                  const stroke = getStroke(path.points, {
                    size: path.width,
                    thinning: 0.5,
                    smoothing: 0.5,
                    streamline: 0.5,
                  });
                  const d = getSvgPathFromStroke(stroke);
                  return (
                    <path
                      key={path.id}
                      d={d}
                      fill={path.color}
                      opacity={path.opacity}
                      style={{ pointerEvents: drawingTool === 'eraser' ? 'auto' : 'none' }}
                      onClick={(e) => onPathClick(path.id, e)}
                      className={drawingTool === 'eraser' ? 'cursor-pointer hover:opacity-50 transition-opacity' : ''}
                    />
                  );
                })}
                
                {currentPath && (
                  <path
                    d={getSvgPathFromStroke(getStroke(currentPath, {
                      size: drawingTool === 'pen' ? 2 : 12,
                      thinning: 0.5,
                      smoothing: 0.5,
                      streamline: 0.5,
                    }))}
                    fill={currentColor}
                    opacity={drawingTool === 'pen' ? 1 : 0.4}
                  />
                )}
             </g>
          </svg>
        </Panel>

        <Controls />
      </ReactFlow>
    </div>
  );
}

export default function InfiniteCanvas(props: InfiniteCanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}
