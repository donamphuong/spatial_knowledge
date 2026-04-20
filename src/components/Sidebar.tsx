import React, { useState } from 'react';
import { 
  Folder, 
  FileText, 
  File, 
  Plus, 
  ChevronRight, 
  ChevronDown,
  Upload,
  Search,
  BookOpen,
  Layers,
  Trash2
} from 'lucide-react';
import { FileItem } from '../types';

interface SidebarProps {
  files: FileItem[];
  onSelectFile: (file: FileItem) => void;
  onDeleteFile: (id: string) => void;
  onUpload: () => void;
}

interface FileTreeItemProps {
  key?: string | number;
  item: FileItem;
  files: FileItem[];
  onSelectFile: (file: FileItem) => void;
  onDeleteFile: (id: string) => void;
  depth?: number;
}

const FileTreeItem = ({ item, files, onSelectFile, onDeleteFile, depth = 0 }: FileTreeItemProps) => {
  const [isOpen, setIsOpen] = useState(true);
  const children = files.filter(f => f.parentId === item.id);
  const isFolder = item.type === 'folder';

  return (
    <div>
      <div 
        className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-slate-50 rounded-md transition-all group ${depth > 0 ? 'ml-3' : ''} text-slate-600`}
        onClick={() => {
          if (isFolder) setIsOpen(!isOpen);
          onSelectFile(item);
        }}
      >
        <span className="text-slate-400">
          {isFolder ? (
            isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />
          ) : (
            <div className="w-[14px]" />
          )}
        </span>
        <span className="text-slate-400 group-hover:text-indigo-500 transition-colors">
          {isFolder ? <Folder size={16} fill="currentColor" className="opacity-20" /> : <BookOpen size={16} />}
        </span>
        <span className="text-sm font-medium truncate flex-1 group-hover:text-slate-900 focus-within:text-slate-900 leading-none">
          {item.name}
        </span>
        
        {item.id !== 'root' && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onDeleteFile(item.id);
            }}
            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 hover:text-red-500 rounded transition-all transition-opacity"
            title="Delete File"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
      
      {isFolder && isOpen && children.map(child => (
        <FileTreeItem key={child.id} item={child} files={files} onSelectFile={onSelectFile} onDeleteFile={onDeleteFile} depth={depth + 1} />
      ))}
    </div>
  );
};

export default function Sidebar({ files, onSelectFile, onDeleteFile, onUpload }: SidebarProps) {
  const rootFiles = files.filter(f => !f.parentId);

  return (
    <aside className="w-64 border-r border-slate-200 bg-white flex flex-col shrink-0 z-10 shadow-sm">
      <div className="p-5 pb-4 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-indigo-600 rounded-sm flex items-center justify-center p-1">
             <div className="w-full h-full bg-white opacity-80"></div>
          </div>
          <span className="font-bold text-sm tracking-tight text-slate-900 uppercase">Library</span>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input 
            type="text" 
            placeholder="Search files..." 
            className="w-full bg-slate-50 border border-slate-100 rounded-md py-1.5 pl-9 pr-4 text-[11px] focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
          />
        </div>
      </div>

      <div className="px-3 pt-2">
        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-3 ml-2">Research Explorer</div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 custom-scrollbar">
        {rootFiles.map(file => (
          <FileTreeItem key={file.id} item={file} files={files} onSelectFile={onSelectFile} onDeleteFile={onDeleteFile} />
        ))}
      </div>

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
