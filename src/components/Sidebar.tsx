import React, { useState } from 'react';
import { 
  Folder, 
  FileText, 
  Plus, 
  FolderPlus,
  ChevronRight, 
  ChevronDown,
  Upload,
  Search,
  Trash2,
  Map as MapIcon,
  StickyNote,
  HardDrive,
  Link,
  Settings
} from 'lucide-react';
import { ExplorerItem } from '../types';
import { 
  DndContext, 
  useDraggable, 
  useDroppable, 
  DragEndEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  PointerSensor
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

interface SidebarProps {
  items: ExplorerItem[];
  activeMapId: string;
  vaultName: string | null;
  onConnectFolder: () => void;
  onSelectItem: (item: ExplorerItem) => void;
  onDeleteItem: (id: string) => void;
  onRenameItem: (id: string, name: string) => void;
  onMoveItem: (id: string, newParentId: string | null) => void;
  onCreateItem: (type: 'folder' | 'map' | 'pdf' | 'note', parentId: string | null) => void;
  onUpload: () => void;
}

interface ExplorerTreeItemProps {
  key?: string | number;
  item: ExplorerItem;
  items: ExplorerItem[];
  activeMapId: string;
  onSelectItem: (item: ExplorerItem) => void;
  onDeleteItem: (id: string) => void;
  onRenameItem: (id: string, name: string) => void;
  onCreateItem: (type: 'folder' | 'map' | 'pdf' | 'note', parentId: string | null) => void;
  depth?: number;
}

const ExplorerTreeItem = ({ 
  item, 
  items, 
  activeMapId, 
  onSelectItem, 
  onDeleteItem, 
  onRenameItem, 
  onCreateItem, 
  depth = 0 
}: ExplorerTreeItemProps) => {
  const [isOpen, setIsOpen] = useState(true);
  const [isRenaming, setIsRenaming] = useState(false);
  const children = items.filter(i => i.parentId === item.id);
  const isFolder = item.type === 'folder';
  const isActive = item.type === 'map' && activeMapId === item.id;

  const { attributes, listeners, setNodeRef: setDraggableRef, transform, isDragging } = useDraggable({
    id: item.id,
    data: item
  });

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `drop-${item.id}`,
    disabled: !isFolder,
    data: { id: item.id }
  });

  const style = transform ? {
    transform: CSS.Translate.toString(transform),
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.5 : 1,
  } : undefined;

  const getIcon = () => {
    switch (item.type) {
      case 'folder': return <Folder size={16} fill="currentColor" className="opacity-20 translate-y-[1px]" />;
      case 'map': return <MapIcon size={16} className={isActive ? 'text-indigo-600' : ''} />;
      case 'note': return <StickyNote size={16} />;
      case 'pdf': return <FileText size={16} />;
      default: return <FileText size={16} />;
    }
  };

  return (
    <div ref={setDroppableRef} className={`${isOver ? 'bg-indigo-50/50 rounded-md ring-2 ring-indigo-200 ring-inset' : ''}`}>
      <div 
        ref={setDraggableRef}
        style={style}
        {...attributes}
        {...listeners}
        className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-slate-50 rounded-md transition-all group ${depth > 0 ? 'ml-3' : ''} ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600'}`}
        onClick={() => {
          if (isFolder) setIsOpen(!isOpen);
          onSelectItem(item);
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          setIsRenaming(true);
        }}
      >
        <span className="text-slate-400">
          {isFolder ? (
            isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />
          ) : (
            <div className="w-[14px]" />
          )}
        </span>
        <span className={`${isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-indigo-500'} transition-colors`}>
          {getIcon()}
        </span>
        
        {isRenaming ? (
          <input 
            autoFocus
            defaultValue={item.name}
            onBlur={(e) => {
              onRenameItem(item.id, e.target.value);
              setIsRenaming(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onRenameItem(item.id, e.currentTarget.value);
                setIsRenaming(false);
              }
            }}
            className="text-sm font-medium bg-white border border-indigo-200 rounded px-1 w-full outline-none ring-1 ring-indigo-300"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="text-xs font-medium truncate flex-1 group-hover:text-slate-900 leading-none">
            {item.name}
          </span>
        )}
        
        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
          {isFolder && (
            <>
               <button 
                onClick={(e) => { e.stopPropagation(); onCreateItem('map', item.id); }}
                className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-indigo-600 transition-all"
                title="Add Map"
              >
                <MapIcon size={12} />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); onCreateItem('folder', item.id); }}
                className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-indigo-600 transition-all"
                title="Add Sub-folder"
              >
                <FolderPlus size={12} />
              </button>
            </>
          )}

          <button 
            onClick={(e) => {
              e.stopPropagation();
              onDeleteItem(item.id);
            }}
            className="p-1 hover:bg-red-50 hover:text-red-500 rounded transition-all"
            title="Delete"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
      
      {isFolder && isOpen && children.map(child => (
        <ExplorerTreeItem 
          key={child.id} 
          item={child} 
          items={items} 
          activeMapId={activeMapId}
          onSelectItem={onSelectItem} 
          onDeleteItem={onDeleteItem} 
          onRenameItem={onRenameItem}
          onCreateItem={onCreateItem}
          depth={depth + 1} 
        />
      ))}
    </div>
  );
};

export default function Sidebar({ 
  items, 
  activeMapId, 
  vaultName,
  onConnectFolder,
  onSelectItem, 
  onDeleteItem, 
  onRenameItem,
  onMoveItem,
  onCreateItem,
  onUpload
}: SidebarProps) {
  const rootItems = items.filter(i => !i.parentId);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(MouseSensor),
    useSensor(TouchSensor)
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const activeId = active.id as string;
      const overId = (over.id as string).replace('drop-', '');
      onMoveItem(activeId, overId);
    }
  };

  return (
    <aside className="w-64 border-r border-slate-200 bg-white flex flex-col shrink-0 z-10 shadow-sm">
      <div className="p-4 border-b border-slate-100 flex flex-col gap-3">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">
          <span>Local Vault</span>
          {vaultName ? <HardDrive size={10} className="text-emerald-500" /> : <Link size={10} />}
        </div>
        
        <button 
          onClick={onConnectFolder}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all text-left group ${vaultName ? 'border-emerald-100 bg-emerald-50/30' : 'border-slate-200 border-dashed hover:border-indigo-400 hover:bg-slate-50'}`}
        >
          <div className={`p-1.5 rounded-md ${vaultName ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400 group-hover:text-indigo-600 group-hover:bg-indigo-50'}`}>
            <HardDrive size={14} />
          </div>
          <div className="flex-1 overflow-hidden">
            <div className={`text-[11px] font-bold truncate ${vaultName ? 'text-emerald-800' : 'text-slate-500 group-hover:text-indigo-700'}`}>
              {vaultName || 'Connect Root Folder'}
            </div>
            <div className="text-[9px] text-slate-400 font-medium">
              {vaultName ? 'Synced to Disk' : 'Private Storage Only'}
            </div>
          </div>
          <ChevronRight size={12} className="text-slate-300" />
        </button>
      </div>

      <div className="p-5 pb-2 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-indigo-600 rounded-sm flex items-center justify-center p-1">
               <div className="w-full h-full bg-white opacity-80"></div>
            </div>
            <span className="font-bold text-sm tracking-tight text-slate-900 uppercase">Library</span>
          </div>
          <div className="flex items-center gap-1">
             <button 
              onClick={() => onCreateItem('folder', null)}
              className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-indigo-600 transition-all"
              title="New Folder"
            >
              <FolderPlus size={16} />
            </button>
            <button 
              onClick={() => onCreateItem('map', null)}
              className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-indigo-600 transition-all font-bold"
              title="New Map"
            >
              <MapIcon size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="px-3 pt-4">
        <div className="relative mx-2 mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
          <input 
            type="text" 
            placeholder="Search library..." 
            className="w-full bg-slate-50 border border-slate-100 rounded-md py-1.5 pl-8 pr-4 text-[10px] focus:outline-none focus:border-indigo-500 focus:bg-white transition-all text-slate-600"
          />
        </div>
        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-3 ml-2">Explorer</div>
      </div>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="flex-1 overflow-y-auto px-3 custom-scrollbar">
          {rootItems.map(item => (
            <ExplorerTreeItem 
              key={item.id} 
              item={item} 
              items={items} 
              activeMapId={activeMapId}
              onSelectItem={onSelectItem} 
              onDeleteItem={onDeleteItem} 
              onRenameItem={onRenameItem}
              onCreateItem={onCreateItem}
            />
          ))}
        </div>
      </DndContext>

      <div className="p-4 border-t border-slate-100 bg-slate-50">
        <button 
          onClick={onUpload}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-2.5 rounded-lg hover:bg-indigo-700 transition-all text-xs font-bold uppercase tracking-wide active:scale-[0.98] shadow-md shadow-indigo-100"
        >
          <Upload size={14} />
          <span>Import Dataset</span>
        </button>
      </div>
    </aside>
  );
}
