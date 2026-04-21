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
  Palette,
  Save,
  Download
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { WorkspaceNode, WorkspaceEdge, PathData, ExplorerItem } from './types';
import InfiniteCanvas from './components/InfiniteCanvas';
import PDFViewerModal from './components/PDFViewerModal';
import Sidebar from './components/Sidebar';

const DEFAULT_ITEMS: ExplorerItem[] = [
  {
    id: 'map-1',
    name: 'Main Research Map',
    type: 'map',
    parentId: null,
    nodes: [],
    edges: [],
    paths: [],
    lastModified: new Date().toISOString()
  }
];

import { get, set, del, update } from 'idb-keyval';

// OBSIDIAN-STYLE LOCAL-FIRST STORAGE ENGINE
// 1. Storage Keys: 
//    'explorer-metadata' -> The tree structure (id, name, type, parentId)
//    'content-{id}' -> The heavy lifting (nodes, edges, paths, or text content)

interface WorkspaceContent {
  nodes?: WorkspaceNode[];
  edges?: WorkspaceEdge[];
  paths?: PathData[];
  content?: string;
}

const saveMetadata = async (items: ExplorerItem[]) => {
  // Strip content before saving metadata to keep the index tiny and fast
  const metadata = items.map(({ id, name, type, parentId, lastModified }) => ({
    id, name, type, parentId, lastModified
  }));
  await set('explorer-metadata', metadata);
};

const saveContent = async (id: string, content: WorkspaceContent) => {
  await set(`content-${id}`, content);
};

const loadMetadata = async (): Promise<ExplorerItem[]> => {
  return (await get('explorer-metadata')) || DEFAULT_ITEMS;
};

const loadContent = async (id: string): Promise<WorkspaceContent | null> => {
  return (await get(`content-${id}`)) || null;
};

const deleteWorkspaceItem = async (id: string) => {
  await del(`content-${id}`);
  await del(`file-${id}`); // Previous uploads
};

const storeFileContent = async (id: string, content: Blob) => {
  await set(`file-${id}`, content);
};

const getFileContent = async (id: string): Promise<Blob | null> => {
  return await get(`file-${id}`);
};

export default function App() {
  const [items, setItems] = useState<ExplorerItem[]>([]);
  const [activeMapId, setActiveMapId] = useState<string>(DEFAULT_ITEMS[0].id);
  const [activeMapData, setActiveMapData] = useState<WorkspaceContent>({ nodes: [], edges: [], paths: [] });
  const [resolvedPdfUrl, setResolvedPdfUrl] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  const activeMap = items.find(i => i.id === activeMapId) || items[0] || DEFAULT_ITEMS[0];

  // 1. Initial Metadata Load - Instant
  useEffect(() => {
    loadMetadata().then(meta => {
      setItems(meta);
      const firstMap = meta.find(i => i.type === 'map');
      if (firstMap) setActiveMapId(firstMap.id);
      setIsInitialLoad(false);
    });
  }, []);

  // 2. Load Content for Active Map - Lazy
  useEffect(() => {
    if (isInitialLoad) return;
    loadContent(activeMapId).then(data => {
      if (data) {
        setActiveMapData(data);
      } else {
        setActiveMapData({ nodes: [], edges: [], paths: [] });
      }
    });
  }, [activeMapId, isInitialLoad]);

  // 3. Optimized Auto-save (Incremental)
  useEffect(() => {
    if (isInitialLoad) return;
    setSaveStatus('saving');
    const timer = setTimeout(async () => {
      try {
        await saveMetadata(items);
        await saveContent(activeMapId, activeMapData);
        setSaveStatus('saved');
      } catch (e) {
        setSaveStatus('error');
      }
    }, 1000); // 1s debounce for "Obsidian-like" feel
    return () => clearTimeout(timer);
  }, [items, activeMapData, activeMapId, isInitialLoad]);

  // State setters that ONLY modify the active chunk
  const setNodes = useCallback((update: WorkspaceNode[] | ((nds: WorkspaceNode[]) => WorkspaceNode[])) => {
    setActiveMapData(prev => ({
      ...prev,
      nodes: typeof update === 'function' ? update(prev.nodes || []) : update
    }));
  }, []);

  const setEdges = useCallback((update: WorkspaceEdge[] | ((eds: WorkspaceEdge[]) => WorkspaceEdge[])) => {
    setActiveMapData(prev => ({
      ...prev,
      edges: typeof update === 'function' ? update(prev.edges || []) : update
    }));
  }, []);

  const setPaths = useCallback((update: PathData[] | ((ps: PathData[]) => PathData[])) => {
    setActiveMapData(prev => ({
      ...prev,
      paths: typeof update === 'function' ? update(prev.paths || []) : update
    }));
  }, []);

  // Logic to resolve PDF content on selection
  const [activePdf, setActivePdf] = useState<ExplorerItem | null>(null);

  useEffect(() => {
    if (activePdf && activePdf.type === 'pdf') {
      getFileContent(activePdf.id).then(blob => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          setResolvedPdfUrl(url);
        }
      });
    } else {
      setResolvedPdfUrl(null);
    }
  }, [activePdf]);

  useEffect(() => {
    return () => {
      if (resolvedPdfUrl && resolvedPdfUrl.startsWith('blob:')) {
        URL.revokeObjectURL(resolvedPdfUrl);
      }
    };
  }, [resolvedPdfUrl]);

  const onCreateItem = useCallback((type: 'folder' | 'map' | 'pdf' | 'note', parentId: string | null = null) => {
    const id = uuidv4();
    const newItem: ExplorerItem = {
      id,
      name: type === 'folder' ? 'New Folder' : 
            type === 'map' ? `Exploration Map` :
            type === 'note' ? 'Literature Note' : 'Scientific Source',
      type,
      parentId,
      lastModified: new Date().toISOString()
    };
    
    setItems(prev => [...prev, newItem]);
    
    // Initialize content for new item
    const initialContent = type === 'map' ? { nodes: [], edges: [], paths: [] } : { content: '' };
    saveContent(id, initialContent);

    if (type === 'map') setActiveMapId(id);
  }, []);

  const onDeleteItem = useCallback((id: string) => {
    setItems(prev => {
      const remaining = prev.filter(i => i.id !== id);
      deleteWorkspaceItem(id);
      
      if (id === activeMapId) {
        const nextMap = remaining.find(i => i.type === 'map');
        if (nextMap) setActiveMapId(nextMap.id || '');
      }
      return remaining;
    });
  }, [activeMapId]);

  const onRenameItem = useCallback((id: string, name: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, name, lastModified: new Date().toISOString() } : i));
  }, []);

  const onMoveItem = useCallback((id: string, newParentId: string | null) => {
    setItems(prev => {
      const findDescendants = (parentId: string): string[] => {
        const children = prev.filter(i => i.parentId === parentId);
        return [...children.map(c => c.id), ...children.flatMap(c => findDescendants(c.id))];
      };
      if (id === newParentId) return prev;
      if (newParentId && findDescendants(id).includes(newParentId)) return prev;
      return prev.map(i => i.id === id ? { ...i, parentId: newParentId, lastModified: new Date().toISOString() } : i);
    });
  }, []);

  const exportWorkspace = () => {
    const data = JSON.stringify({ metadata: items, activeMap: { id: activeMapId, ...activeMapData } }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `scholar-vault-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importWorkspace = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (imported.metadata) {
          setItems(imported.metadata);
          // Standard metadata restoration
          saveMetadata(imported.metadata);
        }
      } catch (err) {
        alert('Invalid vault file');
      }
    };
    reader.readAsText(file);
  };

  // Drawing State
  const [drawingTool, setDrawingTool] = useState<'none' | 'pen' | 'highlighter' | 'eraser' | 'connector'>('none');
  const [currentColor, setCurrentColor] = useState('#4f46e5');

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
          label: type === 'idea' ? 'Research Synthesis' : 'New Annotation', 
          type 
        }
      };
    }
    setNodes((nds) => [...nds, newNode]);
  }, [setNodes]);

  const onFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      const id = uuidv4();
      await storeFileContent(id, file);
      const newItem: ExplorerItem = {
        id,
        name: file.name,
        type: 'pdf',
        parentId: null,
        content: id, // Store ID instead of blob URL
        lastModified: new Date().toISOString()
      };
      setItems(prev => [...prev, newItem]);
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#FAF9F6] font-sans text-slate-800 overflow-hidden select-none">
      {/* Sidebar - Integrated & Minimal */}
      <Sidebar 
        items={items}
        activeMapId={activeMapId}
        onSelectItem={(i) => {
          if (i.type === 'map') setActiveMapId(i.id);
          else if (i.type === 'pdf') setActivePdf(i);
        }}
        onDeleteItem={onDeleteItem}
        onRenameItem={onRenameItem}
        onMoveItem={onMoveItem}
        onCreateItem={onCreateItem}
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
              <h1 className="font-bold text-sm tracking-tight text-slate-900 leading-none">{activeMap?.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-none">Scholar Vault</span>
                <span className="text-[9px] text-slate-300">•</span>
                <div className="flex items-center gap-1.5 min-w-[70px]">
                  <div className={`w-1 h-1 rounded-full ${saveStatus === 'saving' ? 'bg-amber-400 animate-pulse' : saveStatus === 'saved' ? 'bg-emerald-400' : 'bg-red-400'}`}></div>
                  <span className={`text-[9px] font-bold uppercase tracking-tighter ${saveStatus === 'saving' ? 'text-amber-500' : 'text-slate-400'}`}>
                    {saveStatus === 'saving' ? 'Writing...' : saveStatus === 'saved' ? 'Vault Synced' : 'Sync Error'}
                  </span>
                </div>
              </div>
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

          <div className="flex items-center gap-2 bg-slate-100/50 border border-slate-200 rounded-full p-1 px-1.5">
            <button 
              onClick={exportWorkspace}
              className="p-2 hover:bg-white hover:shadow-sm rounded-full transition-all text-slate-600"
              title="Export Workspace"
            >
               <Download size={18} />
            </button>
            <button 
              onClick={() => document.getElementById('workspace-import')?.click()}
              className="p-2 hover:bg-white hover:shadow-sm rounded-full transition-all text-slate-600"
              title="Import Workspace"
            >
               <Upload size={18} />
            </button>
            <input 
              id="workspace-import" 
              type="file" 
              accept=".json" 
              className="hidden" 
              onChange={importWorkspace} 
            />
          </div>
          <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden ring-1 ring-slate-300 ml-2"></div>
        </header>

        {/* Canvas Area */}
        <div className="flex-1 relative bg-[#FAF9F6]">
          {isInitialLoad ? (
             <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm z-50">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-indigo-600">Mounting Filesystem</span>
                </div>
             </div>
          ) : (
            <InfiniteCanvas 
              nodes={activeMapData.nodes || []} 
              edges={activeMapData.edges || []} 
              setNodes={setNodes} 
              setEdges={setEdges} 
              paths={activeMapData.paths || []}
              setPaths={setPaths}
              drawingTool={drawingTool}
              currentColor={currentColor}
            />
          )}
        </div>
      </main>

      {/* PDF Clipping Engine */}
      {activePdf && resolvedPdfUrl && (
        <PDFViewerModal 
          file={{ 
            id: activePdf.id, 
            name: activePdf.name, 
            type: 'pdf', 
            parentId: activePdf.parentId, 
            content: resolvedPdfUrl 
          }} 
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
