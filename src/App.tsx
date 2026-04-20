/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import { 
  Folder, 
  FileText, 
  File, 
  Plus, 
  ChevronRight, 
  ChevronDown,
  Upload,
  Layout,
  Layers,
  ZoomIn,
  MousePointer2,
  Type,
  Square,
  StickyNote,
  BoxSelect,
  Pen,
  Highlighter,
  Eraser,
  Palette
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { WorkspaceNode, WorkspaceEdge, FileItem, PathData } from './types';
import InfiniteCanvas from './components/InfiniteCanvas';
import PDFViewerModal from './components/PDFViewerModal';
import Sidebar from './components/Sidebar';

export default function App() {
  const [files, setFiles] = useState<FileItem[]>([
    { id: 'root', name: 'Academic Project', type: 'folder', parentId: null },
    { id: '1', name: 'Tutorial_Guide.pdf', type: 'pdf', parentId: 'root', content: 'https://raw.githubusercontent.com/mozilla/pdf.js/master/web/compressed.tracemonkey-pldi-09.pdf' }
  ]);
  
  const [nodes, setNodes] = useState<WorkspaceNode[]>([]);
  const [edges, setEdges] = useState<WorkspaceEdge[]>([]);
  const [paths, setPaths] = useState<PathData[]>([]);
  const [activePdf, setActivePdf] = useState<FileItem | null>(null);

  // Drawing State
  const [drawingTool, setDrawingTool] = useState<'none' | 'pen' | 'highlighter' | 'eraser' | 'connector'>('none');
  const [currentColor, setCurrentColor] = useState('#4f46e5');

  const onDeleteFile = useCallback((id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  }, []);

  const addNode = useCallback((type: 'idea' | 'note' | 'group') => {
    const id = uuidv4();
    let newNode: WorkspaceNode;

    if (type === 'group') {
      newNode = {
        id,
        type: 'group',
        position: { x: 100, y: 100 },
        style: { width: 400, height: 300 },
        data: { label: 'Conceptual Group', type: 'group' }
      };
    } else {
      newNode = {
        id,
        type,
        position: { x: Math.random() * 400, y: Math.random() * 400 },
        data: { 
          label: type === 'idea' ? 'Synthesis Thesis' : 'Critical Annotation...', 
          type 
        }
      };
    }
    setNodes((nds) => [...nds, newNode]);
  }, []);

  const onFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      const url = URL.createObjectURL(file);
      const newFile: FileItem = {
        id: uuidv4(),
        name: file.name,
        type: 'pdf',
        parentId: 'root',
        content: url
      };
      setFiles(prev => [...prev, newFile]);
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#FAF9F6] font-sans text-slate-800 overflow-hidden select-none">
      {/* Sidebar - Integrated & Minimal */}
      <Sidebar 
        files={files} 
        onSelectFile={(f) => f.type === 'pdf' ? setActivePdf(f) : null}
        onDeleteFile={onDeleteFile}
        onUpload={() => document.getElementById('pdf-upload')?.click()}
      />
      <input id="pdf-upload" type="file" accept=".pdf" className="hidden" onChange={onFileUpload} />

      {/* Main Content Area */}
      <main className="flex-1 relative flex flex-col min-w-0">
        {/* Scholar Toolbar */}
        <header className="h-14 border-b border-slate-200 bg-white/80 backdrop-blur-sm flex items-center px-6 justify-between shrink-0 z-20">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 flex items-center justify-center">
               <Layers className="text-slate-900" size={20} />
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-tight text-slate-900 leading-none">Scholar Map</h1>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Aesthetic Workspace</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 bg-slate-100/50 border border-slate-200 rounded-full p-1 px-1.5">
            <button 
              onClick={() => { setDrawingTool('none'); addNode('note'); }}
              className="p-2 hover:bg-white hover:shadow-sm rounded-full transition-all text-slate-600 group"
              title="Add Note"
            >
               <StickyNote size={18} className="group-hover:text-indigo-500 transition-colors" />
            </button>
            <button 
              onClick={() => { setDrawingTool('none'); addNode('idea'); }}
              className="p-2 hover:bg-white hover:shadow-sm rounded-full transition-all text-slate-600 group"
              title="Add Idea"
            >
               <Type size={18} className="group-hover:text-indigo-500 transition-colors" />
            </button>
            <button 
              onClick={() => { setDrawingTool('none'); addNode('group'); }}
              className="p-2 hover:bg-white hover:shadow-sm rounded-full transition-all text-slate-600 group"
              title="Add Group"
            >
               <BoxSelect size={18} className="group-hover:text-indigo-500 transition-colors" />
            </button>
            <div className="w-px h-5 bg-slate-200 mx-1"></div>
            <button 
              onClick={() => setDrawingTool(drawingTool === 'connector' ? 'none' : 'connector')}
              className={`p-2 rounded-full transition-all ${drawingTool === 'connector' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-600 hover:bg-white hover:shadow-sm'}`}
              title="Connect objects by dragging handles"
            >
               <MousePointer2 size={18} className={drawingTool === 'connector' ? 'rotate-0' : 'rotate-45 opacity-40'} />
            </button>
          </div>

          <div className="flex items-center gap-2 bg-slate-100/50 border border-slate-200 rounded-full p-1 px-1.5">
            <button 
              onClick={() => setDrawingTool(drawingTool === 'pen' ? 'none' : 'pen')}
              className={`p-2 rounded-full transition-all ${drawingTool === 'pen' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-600 hover:bg-white hover:shadow-sm'}`}
              title="Pen Tool"
            >
               <Pen size={16} />
            </button>
            <button 
              onClick={() => setDrawingTool(drawingTool === 'highlighter' ? 'none' : 'highlighter')}
              className={`p-2 rounded-full transition-all ${drawingTool === 'highlighter' ? 'bg-yellow-400 text-slate-900 shadow-lg shadow-yellow-100' : 'text-slate-600 hover:bg-white hover:shadow-sm'}`}
              title="Highlighter Tool"
            >
               <Highlighter size={16} />
            </button>
            <button 
              onClick={() => setDrawingTool(drawingTool === 'eraser' ? 'none' : 'eraser')}
              className={`p-2 rounded-full transition-all ${drawingTool === 'eraser' ? 'bg-red-500 text-white shadow-lg shadow-red-100' : 'text-slate-600 hover:bg-white hover:shadow-sm'}`}
              title="Eraser Tool"
            >
               <Eraser size={16} />
            </button>
            
            {drawingTool !== 'none' && drawingTool !== 'eraser' && (
              <div className="flex items-center gap-1.5 px-2">
                {['#4f46e5', '#ef4444', '#10b981', '#000000'].map(color => (
                  <button 
                    key={color}
                    onClick={() => setCurrentColor(color)}
                    className={`w-4 h-4 rounded-full border-2 transition-transform hover:scale-110 ${currentColor === color ? 'border-white ring-2 ring-slate-300 scale-125' : 'border-transparent'}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
             <button className="text-[11px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-colors">Export Map</button>
             <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden ring-1 ring-slate-300"></div>
          </div>
        </header>

        {/* Canvas Area */}
        <div className="flex-1 relative bg-[#FAF9F6]">
          <InfiniteCanvas 
            nodes={nodes} 
            edges={edges} 
            setNodes={setNodes} 
            setEdges={setEdges} 
            paths={paths}
            setPaths={setPaths}
            drawingTool={drawingTool}
            currentColor={currentColor}
          />
        </div>
      </main>

      {/* PDF Clipping Engine */}
      {activePdf && (
        <PDFViewerModal 
          file={activePdf} 
          onClose={() => setActivePdf(null)}
          onClip={(clip) => {
            setNodes((nds) => [...nds, {
              id: uuidv4(),
              type: 'pdfSnippet',
              position: { x: 100, y: 100 },
              data: { 
                label: `Exerpt: ${activePdf.name}`, 
                type: 'pdf-clip',
                imageUrl: clip.imageUrl,
                content: clip.text
              }
            }]);
            setActivePdf(null);
          }}
        />
      )}
    </div>
  );
}
