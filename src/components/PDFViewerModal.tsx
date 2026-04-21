import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { X, Scissors, Check, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, MousePointer2 } from 'lucide-react';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Set up the worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFViewerModalProps {
  file: {
    id: string;
    name: string;
    type: 'pdf';
    parentId: string | null;
    content?: string;
  };
  onClose: () => void;
  onClip: (clip: { imageUrl: string; text?: string }) => void;
}

export default function PDFViewerModal({ file, onClose, onClip }: PDFViewerModalProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.2);
  const [isClipping, setIsClipping] = useState(false);

  // Auto-scale to fit height on load
  useEffect(() => {
    const updateScale = () => {
      const windowHeight = window.innerHeight;
      const targetScale = (windowHeight - 200) / 842; // standard A4 height is ~842pt
      setScale(Math.max(0.6, Math.min(1.5, targetScale)));
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && pageNumber < numPages) {
        setPageNumber(prev => prev + 1);
      } else if (e.key === 'ArrowLeft' && pageNumber > 1) {
        setPageNumber(prev => prev - 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pageNumber, numPages]);

  const [selection, setSelection] = useState<{ x: number, y: number, w: number, h: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const selectionRef = useRef<{ startX: number, startY: number } | null>(null);
  const pageCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isClipping) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const startX = e.clientX - rect.left;
    const startY = e.clientY - rect.top;
    
    selectionRef.current = { startX, startY };
    setIsDragging(true);
    setSelection({ x: startX, y: startY, w: 0, h: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !selectionRef.current) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;
    
    const x = Math.min(selectionRef.current.startX, currentX);
    const y = Math.min(selectionRef.current.startY, currentY);
    const w = Math.abs(selectionRef.current.startX - currentX);
    const h = Math.abs(selectionRef.current.startY - currentY);
    
    setSelection({ x, y, w, h });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const captureClip = useCallback(() => {
    if (!selection || !containerRef.current) return;

    // Find the canvas rendered by react-pdf inside our container
    const pdfCanvas = containerRef.current.querySelector('canvas');
    if (!pdfCanvas) return;

    const cropCanvas = document.createElement('canvas');
    const ctx = cropCanvas.getContext('2d');
    if (!ctx) return;

    // The react-pdf canvas might be scaled by devicePixelRatio
    const dpr = window.devicePixelRatio || 1;
    // We need to find where the page canvas is relative to our selection container
    const canvasRect = pdfCanvas.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();

    const offsetX = canvasRect.left - containerRect.left;
    const offsetY = canvasRect.top - containerRect.top;

    // Convert selection to canvas coordinates
    const sourceX = (selection.x - offsetX) * (pdfCanvas.width / canvasRect.width);
    const sourceY = (selection.y - offsetY) * (pdfCanvas.height / canvasRect.height);
    const sourceW = selection.w * (pdfCanvas.width / canvasRect.width);
    const sourceH = selection.h * (pdfCanvas.height / canvasRect.height);

    cropCanvas.width = sourceW;
    cropCanvas.height = sourceH;

    ctx.drawImage(
      pdfCanvas,
      sourceX, sourceY, sourceW, sourceH, // source
      0, 0, sourceW, sourceH // destination
    );

    const imageUrl = cropCanvas.toDataURL('image/png');
    
    // TEXT EXTRACTION LOGIC
    // We inspect the rendered text layer spans to find what falls within selection
    let extractedText = "";
    if (containerRef.current) {
      const textLayer = containerRef.current.querySelector('.react-pdf__Page__textContent');
      if (textLayer) {
        const textItems = Array.from(textLayer.querySelectorAll('span')) as HTMLElement[];
        const containerRect = containerRef.current.getBoundingClientRect();
        
        // Selection relative to viewport
        const selLeft = selection.x + containerRect.left;
        const selTop = selection.y + containerRect.top;
        const selRight = selLeft + selection.w;
        const selBottom = selTop + selection.h;

        // Group items into lines to preserve roughly correct layout
        const lineMap = new Map<number, { el: HTMLElement, rect: DOMRect }[]>();
        
        textItems.forEach(item => {
          const rect = item.getBoundingClientRect();
          // Check intersection
          const isIntersecting = !(
            rect.right < selLeft || 
            rect.left > selRight || 
            rect.bottom < selTop || 
            rect.top > selBottom
          );

          if (isIntersecting) {
            const y = Math.round(rect.top / 5) * 5; // Bucket by vertical position
            if (!lineMap.has(y)) lineMap.set(y, []);
            lineMap.get(y)?.push({ el: item, rect });
          }
        });

        // Sort lines vertically, then items horizontally within lines
        const sortedLines = Array.from(lineMap.keys()).sort((a, b) => a - b);
        extractedText = sortedLines.map(y => {
          const items = lineMap.get(y) || [];
          return items.sort((a, b) => a.rect.left - b.rect.left)
                      .map(i => i.el.innerText)
                      .join(' ');
        }).join('\n');
      }
    }

    onClip({ 
      imageUrl, 
      text: extractedText.trim() || `Annotation from page ${pageNumber}` 
    });
    
    setSelection(null);
    setIsClipping(false);
  }, [selection, pageNumber, onClip]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-slate-900/40 backdrop-blur-md">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-full flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300 border border-white/20">
        {/* Modal Header */}
        <header className="px-6 h-14 border-b border-slate-200 flex items-center justify-between shrink-0 bg-slate-100/80">
          <div className="flex items-center gap-4">
            <h2 className="font-bold text-[11px] uppercase tracking-[0.2em] text-slate-500 truncate max-w-[300px]">Document Viewer: {file.name}</h2>
            <div className="h-4 w-[1px] bg-slate-300" />
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-md p-0.5 shadow-sm">
              <button 
                onClick={() => setPageNumber(p => Math.max(1, p - 1))}
                className="p-1 hover:bg-slate-50 rounded-sm disabled:opacity-30"
                disabled={pageNumber <= 1}
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-[10px] font-mono px-2 min-w-[60px] text-center text-slate-600 font-bold">
                {pageNumber} / {numPages || '-'}
              </span>
              <button 
                onClick={() => setPageNumber(p => Math.min(numPages, p + 1))}
                className="p-1 hover:bg-slate-50 rounded-sm disabled:opacity-30"
                disabled={pageNumber >= numPages}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsClipping(!isClipping)}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all shadow-sm ${isClipping ? 'bg-indigo-600 text-white shadow-indigo-200' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'}`}
            >
              {isClipping ? <MousePointer2 size={14} /> : <Scissors size={14} />}
              <span>{isClipping ? 'Pointer' : 'Clip Tool'}</span>
            </button>
            
            {selection && isClipping && (
              <button 
                onClick={captureClip}
                className="flex items-center gap-2 px-5 py-1.5 rounded-full bg-indigo-600 text-white text-[11px] font-bold uppercase tracking-wider hover:bg-indigo-700 shadow-lg shadow-indigo-200 animate-in bounce-in duration-300"
              >
                <Check size={14} />
                <span>Confirm Selection</span>
              </button>
            )}

            <div className="h-4 w-[1px] bg-slate-300 mx-1" />
            
            <button 
              onClick={onClose}
              className="p-1.5 hover:bg-red-50 rounded-full text-slate-400 hover:text-red-500 transition-all active:scale-95"
            >
              <X size={20} />
            </button>
          </div>
        </header>

        {/* PDF Content */}
        <div className="flex-1 overflow-auto bg-slate-200 p-12 flex justify-center custom-scrollbar">
          <div 
            ref={containerRef}
            className="relative shadow-[0_32px_64px_-12px_rgba(0,0,0,0.15)] bg-white cursor-crosshair select-none rounded-sm overflow-hidden"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
          >
            <Document
              file={file.content}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={(error) => console.error('PDF Load Error:', error)}
              loading={<div className="p-20 text-center animate-pulse text-indigo-500 font-mono text-xs uppercase tracking-widest">Decoding Document Layer...</div>}
              error={<div className="p-20 text-center text-red-500 font-sans text-xs uppercase tracking-widest bg-red-50/50 rounded-lg border border-red-100 p-8">
                <p className="font-bold mb-2">Access Denied / Network Error</p>
                <p className="lowercase tracking-normal font-normal opacity-70">The document could not be fetched. This is usually due to CORS restrictions on the remote server. Try uploading a local PDF instead.</p>
              </div>}
            >
              <Page 
                pageNumber={pageNumber} 
                scale={scale}
                renderAnnotationLayer={false}
                renderTextLayer={true}
              />
            </Document>

            {/* Selection Box Overlay */}
            {selection && (
              <div 
                className="absolute border-2 border-indigo-500 bg-indigo-500/10 pointer-events-none transition-all"
                style={{
                  left: selection.x,
                  top: selection.y,
                  width: selection.w,
                  height: selection.h,
                  boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.4)'
                }}
              >
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-widest whitespace-nowrap shadow-md shadow-indigo-300">
                  Target Area
                </div>
                {/* Visual corners like the design */}
                <div className="absolute bottom-0 right-0 w-2 h-2 bg-indigo-600 translate-x-1/2 translate-y-1/2"></div>
              </div>
            )}

            {!isClipping && (
               <div className="absolute inset-0 z-10 pointer-events-none" />
            )}
          </div>
        </div>
        
        {/* Footer info */}
        <footer className="h-10 border-t border-slate-100 bg-white px-6 flex items-center justify-between shrink-0 text-[9px] text-slate-400 font-bold tracking-[0.2em] uppercase">
          <div className="flex items-center gap-2">
             <div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>
             <span>Spatial Intelligence Engine v1.2</span>
          </div>
          <div>Drag crosshair to isolate evidence • Confirm to sync to workspace</div>
          <div className="flex items-center gap-4">
             <button onClick={() => setScale(s => s - 0.1)} className="hover:text-indigo-600 transition-colors">Zoom -</button>
             <span className="text-slate-300 font-normal">|</span>
             <button onClick={() => setScale(s => s + 0.1)} className="hover:text-indigo-600 transition-colors">Zoom +</button>
          </div>
        </footer>
      </div>
    </div>
  );
}
