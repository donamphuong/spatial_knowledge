import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { X, Scissors, Check, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, MousePointer2, PanelLeftClose, PanelLeftOpen, Layout, Plus } from 'lucide-react';
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
  onClip: (clip: { 
    imageUrl?: string; 
    text?: string; 
    type: 'pdf-clip' | 'pdf-page' | 'pdf-section';
    pages?: { imageUrl: string; label: string; aspectRatio: number }[];
    aspectRatio?: number;
  }) => void;
}

export default function PDFViewerModal({ file, onClose, onClip }: PDFViewerModalProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.2);
  const [isClipping, setIsClipping] = useState(false);
  const [pageAspectRatios, setPageAspectRatios] = useState<Record<number, number>>({});
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);

  const [documentRendered, setDocumentRendered] = useState(false);

  const onPageLoadSuccess = (pageIdx: number, page: any) => {
    const { originalWidth, originalHeight } = page;
    setPageAspectRatios(prev => ({
      ...prev,
      [pageIdx]: originalWidth / originalHeight
    }));
  };

  // Track current page via scroll position
  useEffect(() => {
    if (!documentRendered || numPages === 0 || !containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const pageNum = parseInt(entry.target.getAttribute('data-page-number') || '1');
            setPageNumber(pageNum);
          }
        });
      },
      {
        root: containerRef.current,
        threshold: 0.5, // Page is "active" when 50% visible
      }
    );

    const pages = containerRef.current.querySelectorAll('.pdf-page-container');
    pages.forEach((p) => observer.observe(p));

    return () => observer.disconnect();
  }, [documentRendered, numPages]);

  // Auto-scale to fit height on load
  useEffect(() => {
    const updateScale = () => {
      const windowHeight = window.innerHeight;
      const targetScale = (windowHeight - 100) / 842; // standard A4 height is ~842pt
      setScale(Math.max(0.4, Math.min(2.5, targetScale)));
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
    if (!rect || !containerRef.current) return;
    
    const startX = e.clientX - rect.left + containerRef.current.scrollLeft;
    const startY = e.clientY - rect.top + containerRef.current.scrollTop;
    
    selectionRef.current = { startX, startY };
    setIsDragging(true);
    setSelection({ x: startX, y: startY, w: 0, h: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !selectionRef.current || !containerRef.current) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const currentX = e.clientX - rect.left + containerRef.current.scrollLeft;
    const currentY = e.clientY - rect.top + containerRef.current.scrollTop;
    
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
    
    // In continuous scroll, find the page container that overlaps most with selection
    const pageContainers = Array.from(containerRef.current.querySelectorAll('.pdf-page-container'));
    
    let targetPageContainer: HTMLElement | null = null;
    let maxOverlap = 0;

    pageContainers.forEach((container) => {
      const htmlContainer = container as HTMLElement;
      const rect = {
        top: htmlContainer.offsetTop,
        left: htmlContainer.offsetLeft,
        bottom: htmlContainer.offsetTop + htmlContainer.offsetHeight,
        right: htmlContainer.offsetLeft + htmlContainer.offsetWidth
      };

      const overlapArea = Math.max(0, Math.min(selection.y + selection.h, rect.bottom) - Math.max(selection.y, rect.top)) *
                          Math.max(0, Math.min(selection.x + selection.w, rect.right) - Math.max(selection.x, rect.left));

      if (overlapArea > maxOverlap) {
        maxOverlap = overlapArea;
        targetPageContainer = htmlContainer;
      }
    });

    if (!targetPageContainer) return;

    const pageNum = parseInt(targetPageContainer.getAttribute('data-page-number') || '1');
    const pdfCanvas = targetPageContainer.querySelector('canvas') as HTMLCanvasElement;
    if (!pdfCanvas) return;

    const cropCanvas = document.createElement('canvas');
    const ctx = cropCanvas.getContext('2d');
    if (!ctx) return;

    // Canvas coordinates relative to the specific targeted page container
    const relativeX = selection.x - (targetPageContainer as HTMLElement).offsetLeft;
    const relativeY = selection.y - (targetPageContainer as HTMLElement).offsetTop;

    const canvasRect = pdfCanvas.getBoundingClientRect();
    const containerRect = targetPageContainer.getBoundingClientRect();

    const ox = canvasRect.left - containerRect.left;
    const oy = canvasRect.top - containerRect.top;

    const sourceX = (relativeX - ox) * (pdfCanvas.width / canvasRect.width);
    const sourceY = (relativeY - oy) * (pdfCanvas.height / canvasRect.height);
    const sourceW = selection.w * (pdfCanvas.width / canvasRect.width);
    const sourceH = selection.h * (pdfCanvas.height / canvasRect.height);

    cropCanvas.width = sourceW;
    cropCanvas.height = sourceH;

    ctx.drawImage(pdfCanvas, sourceX, sourceY, sourceW, sourceH, 0, 0, sourceW, sourceH);

    const imageUrl = cropCanvas.toDataURL('image/png');
    
    // TEXT EXTRACTION LOGIC
    let extractedText = "";
    const textLayer = targetPageContainer.querySelector('.react-pdf__Page__textContent');
    if (textLayer) {
      const textItems = Array.from(textLayer.querySelectorAll('span')) as HTMLElement[];
      const scrollLeft = containerRef.current.scrollLeft;
      const scrollTop = containerRef.current.scrollTop;
      const viewerRect = containerRef.current.getBoundingClientRect();
      
      const viewportSelLeft = selection.x - scrollLeft + viewerRect.left;
      const viewportSelTop = selection.y - scrollTop + viewerRect.top;
      const viewportSelRight = viewportSelLeft + selection.w;
      const viewportSelBottom = viewportSelTop + selection.h;

      const lineMap = new Map<number, { el: HTMLElement, rect: DOMRect }[]>();
      
      textItems.forEach(item => {
        const rect = item.getBoundingClientRect();
        const isIntersecting = !(
          rect.right < viewportSelLeft || 
          rect.left > viewportSelRight || 
          rect.bottom < viewportSelTop || 
          rect.top > viewportSelBottom
        );

        if (isIntersecting) {
          const y = Math.round(rect.top / 5) * 5;
          if (!lineMap.has(y)) lineMap.set(y, []);
          lineMap.get(y)?.push({ el: item, rect });
        }
      });

      const sortedLines = Array.from(lineMap.keys()).sort((a, b) => a - b);
      extractedText = sortedLines.map(y => {
        const items = lineMap.get(y) || [];
        return items.sort((a, b) => a.rect.left - b.rect.left)
                    .map(i => i.el.innerText)
                    .join(' ');
      }).join('\n');
    }

    onClip({ 
      imageUrl, 
      text: extractedText.trim() || `Annotation from page ${pageNum}`,
      type: 'pdf-clip'
    });
    
    setSelection(null);
    setIsClipping(false);
  }, [selection, onClip]);

  const togglePageSelection = (pageNum: number) => {
    setSelectedPages(prev => {
      const next = new Set(prev);
      if (next.has(pageNum)) next.delete(pageNum);
      else next.add(pageNum);
      return next;
    });
  };

  const exportSection = useCallback(() => {
    if (selectedPages.size === 0) return;

    const pages = Array.from(selectedPages).sort((a: number, b: number) => a - b).map(pageNum => {
      const thumbContainer = document.getElementById(`thumb-container-${pageNum}`);
      const thumbCanvas = thumbContainer?.querySelector('canvas') as HTMLCanvasElement;
      return {
        imageUrl: thumbCanvas?.toDataURL('image/png', 0.95) || '',
        label: `Page ${pageNum} from ${file.name}`,
        aspectRatio: pageAspectRatios[pageNum] || (thumbCanvas ? thumbCanvas.width / thumbCanvas.height : 1)
      };
    }).filter(p => p.imageUrl);

    onClip({
      type: 'pdf-section',
      pages,
      text: `${file.name} - Section (${pages.length} pages)`
    });

    setSelectedPages(new Set());
    setIsMultiSelectMode(false);
  }, [selectedPages, file.name, onClip]);

  const mapPage = useCallback((pageNum: number) => {
    const thumbContainer = document.getElementById(`thumb-container-${pageNum}`);
    const thumbCanvas = thumbContainer?.querySelector('canvas') as HTMLCanvasElement;
    if (!thumbCanvas) return;

    const imageUrl = thumbCanvas.toDataURL('image/png', 0.95);
    onClip({ 
      imageUrl, 
      text: `Page ${pageNum} from ${file.name}`,
      type: 'pdf-page',
      aspectRatio: pageAspectRatios[pageNum] || (thumbCanvas.width / thumbCanvas.height)
    });
  }, [file.name, onClip]);

  const scrollToPage = (pageNum: number) => {
    const el = document.getElementById(`main-page-${pageNum}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-slate-900/40 backdrop-blur-md">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-full flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300 border border-white/20">
        {/* Modal Header */}
        <header className="px-6 h-14 border-b border-slate-200 flex items-center justify-between shrink-0 bg-slate-100/80">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className={`p-2 rounded-lg transition-all ${isSidebarOpen ? 'bg-slate-200 text-slate-700' : 'text-slate-400 hover:bg-slate-100'}`}
              title="Toggle Overview"
            >
              {isSidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
            </button>
            <div className="h-4 w-[1px] bg-slate-300 mx-1" />
            <h2 className="font-bold text-[11px] uppercase tracking-[0.2em] text-slate-500 truncate max-w-[250px]">Document Viewer: {file.name}</h2>
            <div className="h-4 w-[1px] bg-slate-300" />
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-md p-0.5 shadow-sm">
              <button 
                onClick={() => scrollToPage(Math.max(1, pageNumber - 1))}
                className="p-1 hover:bg-slate-50 rounded-sm disabled:opacity-30"
                disabled={pageNumber <= 1}
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-[10px] font-mono px-2 min-w-[60px] text-center text-slate-600 font-bold">
                {pageNumber} / {numPages || '-'}
              </span>
              <button 
                onClick={() => scrollToPage(Math.min(numPages, pageNumber + 1))}
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

            <div className="h-4 w-[1px] bg-slate-200" />
            
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-md p-0.5 shadow-sm">
                <button onClick={() => setScale(s => Math.max(0.4, s - 0.1))} className="p-1 hover:bg-slate-50 text-slate-500 rounded"><ZoomOut size={14} /></button>
                <span className="text-[9px] font-mono w-10 text-center text-slate-400 font-bold">{Math.round(scale * 100)}%</span>
                <button onClick={() => setScale(s => Math.min(2.5, s + 0.1))} className="p-1 hover:bg-slate-50 text-slate-500 rounded"><ZoomIn size={14} /></button>
            </div>

            <div className="h-4 w-[1px] bg-slate-300 mx-1" />
            
            <button 
              onClick={onClose}
              className="p-1.5 hover:bg-red-50 rounded-full text-slate-400 hover:text-red-500 transition-all active:scale-95"
            >
              <X size={20} />
            </button>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar Overview */}
          {isSidebarOpen && (
            <aside className="w-48 border-r border-slate-200 bg-[#f5f5f5] overflow-y-auto custom-scrollbar flex flex-col p-4 gap-6 animate-in slide-in-from-left duration-300">
              <div className="flex items-center justify-between sticky top-0 bg-[#f5f5f5] z-20 pb-2 mb-2 border-b border-slate-200/50">
                 <div className="flex items-center gap-2">
                    <Layout size={10} className="text-slate-400" />
                    <span className="text-[9px] font-sans font-semibold uppercase tracking-wider text-slate-500">Thumbnails</span>
                 </div>
                 <button 
                    onClick={() => setIsMultiSelectMode(!isMultiSelectMode)}
                    className={`text-[9px] font-sans font-bold uppercase tracking-widest px-2 py-0.5 rounded transition-all ${isMultiSelectMode ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-200'}`}
                 >
                    {isMultiSelectMode ? 'Done' : 'Select'}
                 </button>
              </div>

              {isMultiSelectMode && (
                <div className="flex flex-col gap-2 mb-4 shrink-0">
                  <div className="flex items-center justify-between mb-1">
                    <button 
                      onClick={() => {
                        const all = new Set<number>();
                        for (let i = 1; i <= numPages; i++) all.add(i);
                        setSelectedPages(all);
                      }}
                      className="text-[9px] font-sans font-bold uppercase tracking-widest text-indigo-600 hover:underline"
                    >
                      Select All
                    </button>
                    <button 
                      onClick={() => setSelectedPages(new Set())}
                      className="text-[9px] font-sans font-bold uppercase tracking-widest text-slate-400 hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                  <button 
                    onClick={exportSection}
                    disabled={selectedPages.size === 0}
                    className="bg-indigo-600 text-white py-1.5 px-3 rounded text-[9px] font-bold uppercase tracking-widest shadow-sm hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-30 disabled:grayscale"
                  >
                    <Plus size={12} />
                    Export {selectedPages.size} Selection
                  </button>
                </div>
              )}

              <Document
                file={file.content}
                onLoadSuccess={onDocumentLoadSuccess}
                loading={null}
              >
                <div className="flex flex-col items-center gap-8">
                  {Array.from(new Array(numPages), (el, index) => {
                    const pageIdx = index + 1;
                    const isSelected = selectedPages.has(pageIdx);
                    const isActive = pageNumber === pageIdx;
                    return (
                      <div 
                        key={`thumb_${pageIdx}`}
                        id={`thumb-container-${pageIdx}`}
                        onClick={() => {
                          if (isMultiSelectMode) {
                            togglePageSelection(pageIdx);
                          } else {
                            scrollToPage(pageIdx);
                          }
                        }}
                        className="flex flex-col items-center gap-2 group w-full cursor-pointer relative"
                      >
                        <div className={`relative w-[100px] transition-all bg-white shadow-sm ring-1 ring-black/5 overflow-hidden ${isActive ? 'ring-2 ring-indigo-500 shadow-indigo-100' : isSelected ? 'ring-2 ring-indigo-400 shadow-indigo-50' : 'hover:ring-black/10'}`}>
                          <Page 
                            pageNumber={pageIdx} 
                            width={150} 
                            className="pdf-thumbnail-page bg-white"
                            renderAnnotationLayer={false}
                            renderTextLayer={false}
                            onLoadSuccess={(page) => onPageLoadSuccess(pageIdx, page)}
                          />
                          
                          {/* Selection Badge */}
                          {isMultiSelectMode && (
                            <div className={`absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center transition-all shadow-sm z-10 ${isSelected ? 'bg-indigo-600 text-white' : 'bg-white text-slate-300'}`}>
                               {isSelected && <Check size={12} />}
                            </div>
                          )}

                          {/* Map Action Overlay (only in normal mode) */}
                          {!isMultiSelectMode && (
                            <div className="absolute inset-0 bg-slate-900/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[1px]">
                               <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  mapPage(pageIdx);
                                }}
                                className="bg-white/90 text-indigo-600 p-1.5 rounded-full shadow-lg transform scale-90 group-hover:scale-100 transition-all hover:bg-white active:scale-95"
                               >
                                 <Plus size={16} />
                               </button>
                            </div>
                          )}
                        </div>

                        <div className={`text-[10px] font-sans font-medium transition-colors ${isActive || isSelected ? 'text-indigo-600 font-bold' : 'text-slate-400'}`}>
                          {pageIdx}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Document>
            </aside>
          )}

          {/* PDF Content */}
          <div 
            ref={containerRef}
            className="flex-1 overflow-auto bg-slate-100/80 flex flex-col items-center justify-start py-12 px-8 custom-scrollbar relative"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
          >
            <Document
              file={file.content}
              onLoadSuccess={(data) => {
                onDocumentLoadSuccess(data);
                setDocumentRendered(true);
              }}
              onLoadError={(error) => console.error('PDF Load Error:', error)}
              loading={<div className="p-20 text-center animate-pulse text-indigo-500 font-mono text-xs uppercase tracking-widest">Decoding Document Layer...</div>}
              error={<div className="p-20 text-center text-red-500 font-sans text-xs uppercase tracking-widest bg-red-50/50 rounded-lg border border-red-100 p-8">
                <p className="font-bold mb-2">Access Denied / Network Error</p>
                <p className="lowercase tracking-normal font-normal opacity-70">The document could not be fetched. This is usually due to CORS restrictions on the remote server. Try uploading a local PDF instead.</p>
              </div>}
              className="flex flex-col gap-12 items-center"
            >
              {Array.from(new Array(numPages), (el, index) => {
                const p = index + 1;
                // Performance Optimization: Virtual window rendering
                // Only render pages that are within a reasonable range of the current page
                const isNearCurrent = Math.abs(p - pageNumber) <= 3;
                const isInitialPages = p <= 5 && pageNumber <= 5;
                const shouldRender = isNearCurrent || isInitialPages || documentRendered === false;
                
                if (!shouldRender) {
                    return (
                      <div 
                        key={p} 
                        id={`main-page-${p}`}
                        data-page-number={p}
                        className="pdf-page-container bg-white shadow-md ring-1 ring-slate-200 rounded-sm flex items-center justify-center text-slate-300 font-mono text-[10px]"
                        style={{ 
                          width: scale * 595, // Approximately A4 width
                          height: scale * 842  // Approximately A4 height
                        }}
                      >
                        PAGE {p} / {numPages}
                      </div>
                    );
                }

                return (
                  <div 
                    key={p} 
                    id={`main-page-${p}`}
                    data-page-number={p}
                    className="pdf-page-container relative bg-white shadow-[0_20px_50px_rgba(0,0,0,0.1)] ring-1 ring-slate-200 rounded-sm"
                  >
                    <Page 
                      pageNumber={p} 
                      scale={scale}
                      renderAnnotationLayer={false}
                      renderTextLayer={true}
                      onLoadSuccess={(page) => onPageLoadSuccess(p, page)}
                    />
                  </div>
                );
              })}
            </Document>

            {/* Selection Box Overlay */}
            {selection && (
              <div 
                className="absolute border-2 border-indigo-500 bg-indigo-500/10 pointer-events-none transition-all z-20"
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
      </div>
    </div>
  );
}
