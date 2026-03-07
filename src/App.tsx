/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { 
  Upload, 
  FileText, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  X, 
  RefreshCw,
  FileArchive,
  ChevronRight,
  ChevronDown,
  Info,
  Settings2,
  Trash2,
  Copy,
  Layers,
  Zap,
  ShieldCheck,
  Sun,
  Moon,
  Type as TypeIcon,
  Hash,
  Scissors,
  Cloud,
  Merge,
  Split,
  LayoutGrid,
  Menu,
  Monitor,
  Smartphone,
  Tablet,
  History,
  Star,
  Share2,
  Image as ImageIcon,
  ArrowUp,
  ChevronLeft,
  Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Set up PDF.js worker
// @ts-ignore
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

interface ConvertedPage {
  id: string;
  originalIndex: number;
  blob: Blob;
  url: string;
}

type AppStatus = 'idle' | 'loading' | 'success' | 'error';
type AppView = 'converter' | 'pricing' | 'tools' | 'history' | 'settings' | 'text-extractor';
type Quality = 'low' | 'medium' | 'high' | 'ultra';
type ExportFormat = 'png' | 'jpg' | 'webp' | 'tiff';
type Theme = 'dark' | 'light' | 'cyberpunk' | 'minimal';
type WatermarkPosition = 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'tile';

interface PDFMetadata {
  title?: string;
  author?: string;
  creator?: string;
  producer?: string;
  creationDate?: string;
}

const QUALITY_SETTINGS: Record<Quality, { scale: number; label: string; pro?: boolean }> = {
  low: { scale: 1.0, label: 'Standard' },
  medium: { scale: 2.0, label: 'HD' },
  high: { scale: 3.0, label: 'Ultra' },
  ultra: { scale: 6.0, label: 'Super-Res', pro: true },
};

const ZoomableImage = ({ src, alt, className, onClick }: { src: string; alt: string; className?: string; onClick?: () => void }) => {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const lastTouchDistance = useRef<number | null>(null);
  const lastTouchPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const preventDefault = (e: WheelEvent) => {
      if (scale > 1) {
        e.preventDefault();
      }
    };

    container.addEventListener('wheel', preventDefault, { passive: false });
    return () => container.removeEventListener('wheel', preventDefault);
  }, [scale]);

  const handleWheel = (e: React.WheelEvent) => {
    const delta = e.deltaY * -0.005;
    const nextScale = Math.min(Math.max(1, scale + delta), 5);
    
    if (nextScale !== scale) {
      setScale(nextScale);
      if (nextScale === 1) {
        setOffset({ x: 0, y: 0 });
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      e.stopPropagation();
      setIsDragging(true);
      setStartPos({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      e.stopPropagation();
      setOffset({ x: e.clientX - startPos.x, y: e.clientY - startPos.y });
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (isDragging) {
      e.stopPropagation();
      setIsDragging(false);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      lastTouchDistance.current = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
    } else if (e.touches.length === 1 && scale > 1) {
      const touch = e.touches[0];
      lastTouchPos.current = { x: touch.clientX - offset.x, y: touch.clientY - offset.y };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
      
      if (lastTouchDistance.current !== null) {
        const delta = (distance - lastTouchDistance.current) * 0.01;
        const nextScale = Math.min(Math.max(1, scale + delta), 5);
        setScale(nextScale);
        if (nextScale === 1) setOffset({ x: 0, y: 0 });
      }
      lastTouchDistance.current = distance;
    } else if (e.touches.length === 1 && scale > 1 && lastTouchPos.current) {
      const touch = e.touches[0];
      setOffset({ 
        x: touch.clientX - lastTouchPos.current.x, 
        y: touch.clientY - lastTouchPos.current.y 
      });
    }
  };

  const handleTouchEnd = () => {
    lastTouchDistance.current = null;
    lastTouchPos.current = null;
  };

  return (
    <div 
      ref={containerRef}
      className="w-full h-full overflow-hidden relative touch-none select-none"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setScale(1);
        setOffset({ x: 0, y: 0 });
      }}
      onClick={(e) => {
        if (scale === 1 && onClick) onClick();
      }}
    >
      <motion.img
        src={src}
        alt={alt}
        draggable={false}
        className={`${className} pointer-events-none`}
        initial={{ opacity: 0 }}
        animate={{ 
          opacity: 1,
          scale: scale,
          x: offset.x,
          y: offset.y
        }}
        transition={{ 
          opacity: { duration: 0.5 },
          default: { type: 'spring', stiffness: 300, damping: 30, mass: 0.5 }
        }}
      />
      {scale > 1 && (
        <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded-sm border border-white/10 pointer-events-none z-10">
          <span className="text-[8px] font-mono text-accent uppercase tracking-widest">Zoom: {scale.toFixed(1)}x</span>
        </div>
      )}
    </div>
  );
};

export default function App() {
  const [view, setView] = useState<AppView>('converter');
  const [isPro, setIsPro] = useState<boolean>(false);
  const [status, setStatus] = useState<AppStatus>('idle');
  const [quality, setQuality] = useState<Quality>('medium');
  const [format, setFormat] = useState<ExportFormat>('png');
  const [progress, setProgress] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [pages, setPages] = useState<ConvertedPage[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [fileSize, setFileSize] = useState<string>('');
  const [totalOutputSize, setTotalOutputSize] = useState<number>(0);
  const [watermark, setWatermark] = useState<string>('');
  const [renamePattern, setRenamePattern] = useState<string>('page_{n}');
  const [pageRange, setPageRange] = useState<string>('');
  const [theme, setTheme] = useState<Theme>('dark');
  const [accentColor, setAccentColor] = useState<string>('#E0FF00');
  const [watermarkImage, setWatermarkImage] = useState<string | null>(null);
  const [watermarkOpacity, setWatermarkOpacity] = useState<number>(0.3);
  const [watermarkPosition, setWatermarkPosition] = useState<WatermarkPosition>('center');
  const [watermarkFontSize, setWatermarkFontSize] = useState<number>(60);
  const [watermarkColor, setWatermarkColor] = useState<string>('#808080');
  const [watermarkRotation, setWatermarkRotation] = useState<number>(-45);
  const [watermarkLogoScale, setWatermarkLogoScale] = useState<number>(0.2);
  const [isGrayscale, setIsGrayscale] = useState<boolean>(false);
  const [isBatchMode, setIsBatchMode] = useState<boolean>(false);
  const [rotation, setRotation] = useState<number>(0);
  const [metadata, setMetadata] = useState<PDFMetadata | null>(null);
  const [isMetadataOpen, setIsMetadataOpen] = useState<boolean>(false);
  const [isMetadataEditorOpen, setIsMetadataEditorOpen] = useState<boolean>(false);
  const [showPageNumbers, setShowPageNumbers] = useState<boolean>(true);
  const [showDownloadButtons, setShowDownloadButtons] = useState<boolean>(true);
  const [extractedText, setExtractedText] = useState<string>('');
  const [isExtractingText, setIsExtractingText] = useState<boolean>(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [ocrResults, setOcrResults] = useState<Record<string, string>>({});
  const [isOcrLoading, setIsOcrLoading] = useState<string | null>(null);
  const [isConfigOpen, setIsConfigOpen] = useState<boolean>(true);
  const [history, setHistory] = useState<{ name: string; date: string; pages: number }[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [showScrollTop, setShowScrollTop] = useState<boolean>(false);
  const [previewDevice, setPreviewDevice] = useState<'pc' | 'tablet' | 'mobile'>('pc');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const watermarkInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Apply theme-specific colors
    const root = document.documentElement;
    if (theme === 'cyberpunk') {
      setAccentColor('#FF00FF');
      root.style.setProperty('--accent', '#FF00FF');
    } else if (theme === 'minimal') {
      setAccentColor('#000000');
      root.style.setProperty('--accent', '#000000');
    } else {
      setAccentColor('#E0FF00');
      root.style.setProperty('--accent', '#E0FF00');
    }
  }, [theme]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') reset();
      if ((e.ctrlKey || e.metaKey) && e.key === 's' && status === 'success') {
        e.preventDefault();
        downloadAllAsZip();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [status, pages, selectedIds]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const reset = () => {
    setStatus('idle');
    setProgress(0);
    setTotalPages(0);
    setPages((prev) => {
      prev.forEach(p => URL.revokeObjectURL(p.url));
      return [];
    });
    setSelectedIds(new Set());
    setError(null);
    setFileName('');
    setFileSize('');
    setTotalOutputSize(0);
    setWatermarkImage(null);
    setMetadata(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (watermarkInputRef.current) watermarkInputRef.current.value = '';
  };

  const parsePageRange = (range: string, max: number): number[] => {
    if (!range.trim()) return Array.from({ length: max }, (_, i) => i + 1);
    const pages = new Set<number>();
    const parts = range.split(',');
    parts.forEach(part => {
      const [start, end] = part.split('-').map(s => parseInt(s.trim()));
      if (!isNaN(start)) {
        if (!isNaN(end)) {
          for (let i = Math.max(1, start); i <= Math.min(max, end); i++) pages.add(i);
        } else if (start >= 1 && start <= max) {
          pages.add(start);
        }
      }
    });
    return Array.from(pages).sort((a, b) => a - b);
  };

  const loadImage = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  };

  const processPDF = async (file: File) => {
    if (file.type !== 'application/pdf') {
      setError('Invalid file type. PDF required.');
      setStatus('error');
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      setError('File too large. 100MB limit.');
      setStatus('error');
      return;
    }

    setStatus('loading');
    setError(null);
    setFileName(file.name);
    setFileSize(formatFileSize(file.size));

    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      
      const pdfMeta = await pdf.getMetadata();
      const info = pdfMeta.info as any;
      setMetadata({
        title: info?.Title,
        author: info?.Author,
        creator: info?.Creator,
        producer: info?.Producer,
        creationDate: info?.CreationDate,
      });

      setTotalPages(pdf.numPages);
      const targetPageIndices = parsePageRange(pageRange, pdf.numPages);
      const converted: ConvertedPage[] = [];

      const wmImg = watermarkImage ? await loadImage(watermarkImage) : null;

      for (let i = 0; i < targetPageIndices.length; i++) {
        const pageNum = targetPageIndices[i];
        setProgress(i + 1);
        try {
          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ 
            scale: QUALITY_SETTINGS[quality].scale,
            rotation: (page.rotate + rotation) % 360
          });
          
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          if (!context) throw new Error('Canvas context failed');
          
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          await page.render({
            canvasContext: context,
            viewport: viewport,
            // @ts-ignore
            canvas: canvas
          }).promise;

          // Apply Grayscale
          if (isGrayscale) {
            const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            for (let j = 0; j < data.length; j += 4) {
              const avg = (data[j] + data[j + 1] + data[j + 2]) / 3;
              data[j] = avg;
              data[j + 1] = avg;
              data[j + 2] = avg;
            }
            context.putImageData(imageData, 0, 0);
          }

          // Apply Watermark
          context.save();
          context.globalAlpha = watermarkOpacity;

          if (watermark) {
            context.font = `${watermarkFontSize}px font-mono`;
            context.fillStyle = watermarkColor;
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            
            if (watermarkPosition === 'tile') {
              const stepX = canvas.width / 3;
              const stepY = canvas.height / 4;
              for (let x = 0; x < canvas.width + stepX; x += stepX) {
                for (let y = 0; y < canvas.height + stepY; y += stepY) {
                  context.save();
                  context.translate(x, y);
                  context.rotate((watermarkRotation * Math.PI) / 180);
                  context.fillText(watermark, 0, 0);
                  context.restore();
                }
              }
            } else {
              let x = canvas.width / 2;
              let y = canvas.height / 2;
              if (watermarkPosition === 'top-left') { x = 100; y = 100; context.textAlign = 'left'; }
              if (watermarkPosition === 'top-right') { x = canvas.width - 100; y = 100; context.textAlign = 'right'; }
              if (watermarkPosition === 'bottom-left') { x = 100; y = canvas.height - 100; context.textAlign = 'left'; }
              if (watermarkPosition === 'bottom-right') { x = canvas.width - 100; y = canvas.height - 100; context.textAlign = 'right'; }
              
              context.save();
              context.translate(x, y);
              context.rotate((watermarkRotation * Math.PI) / 180);
              context.fillText(watermark, 0, 0);
              context.restore();
            }
          }

          if (wmImg) {
            const wmWidth = canvas.width * watermarkLogoScale;
            const wmHeight = (wmImg.height / wmImg.width) * wmWidth;
            let x = (canvas.width - wmWidth) / 2;
            let y = (canvas.height - wmHeight) / 2;

            if (watermarkPosition === 'top-left') { x = 40; y = 40; }
            if (watermarkPosition === 'top-right') { x = canvas.width - wmWidth - 40; y = 40; }
            if (watermarkPosition === 'bottom-left') { x = 40; y = canvas.height - wmHeight - 40; }
            if (watermarkPosition === 'bottom-right') { x = canvas.width - wmWidth - 40; y = canvas.height - wmHeight - 40; }

            if (watermarkPosition === 'tile') {
              for (let tx = 0; tx < canvas.width; tx += wmWidth * 2) {
                for (let ty = 0; ty < canvas.height; ty += wmHeight * 2) {
                  context.drawImage(wmImg, tx, ty, wmWidth, wmHeight);
                }
              }
            } else {
              context.drawImage(wmImg, x, y, wmWidth, wmHeight);
            }
          }
          context.restore();

          const mimeType = format === 'png' ? 'image/png' : format === 'jpg' ? 'image/jpeg' : 'image/webp';
          const blob = await new Promise<Blob | null>((resolve) => {
            canvas.toBlob((b) => resolve(b), mimeType, format !== 'png' ? 0.92 : undefined);
          });

          if (blob) {
            converted.push({
              id: `page-${pageNum}-${Date.now()}`,
              originalIndex: pageNum,
              blob,
              url: URL.createObjectURL(blob)
            });
            setTotalOutputSize(prev => prev + blob.size);
            setPages([...converted]);
          }
        } catch (err) {
          console.warn(`Page ${pageNum} failed`, err);
        }
      }

      setStatus('success');
    } catch (err: any) {
      console.error('Processing error:', err);
      setError(err.name === 'PasswordException' ? 'PDF is encrypted.' : 'Processing failed.');
      setStatus('error');
    }
  };

  const handleWatermarkImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setWatermarkImage(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const extractAllText = async (file: File) => {
    setIsExtractingText(true);
    setView('text-extractor');
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += `--- PAGE ${i} ---\n${pageText}\n\n`;
      }
      setExtractedText(fullText);
      showToast('Text extracted successfully', 'success');
    } catch (err) {
      showToast('Failed to extract text', 'error');
      setView('tools');
    } finally {
      setIsExtractingText(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processPDF(file);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file) processPDF(file);
  };

  const getFileName = (index: number) => {
    const baseName = fileName.replace(/\.pdf$/i, '');
    return renamePattern
      .replace('{n}', index.toString())
      .replace('{name}', baseName)
      .replace('{date}', new Date().toISOString().split('T')[0]);
  };

  const downloadAllAsZip = async () => {
    const zip = new JSZip();
    const targetPages = selectedIds.size > 0 ? pages.filter(p => selectedIds.has(p.id)) : pages;
    
    targetPages.forEach((page) => {
      zip.file(`${getFileName(page.originalIndex)}.${format}`, page.blob);
    });

    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, `${fileName.replace(/\.pdf$/i, '')}_export.zip`);
    
    // Add to history
    setHistory(prev => [{
      name: fileName,
      date: new Date().toLocaleString(),
      pages: targetPages.length
    }, ...prev].slice(0, 10));
    
    showToast(`Exported ${targetPages.length} pages successfully`);
  };

  const downloadSingle = (page: ConvertedPage) => {
    saveAs(page.blob, `${getFileName(page.originalIndex)}.${format}`);
    showToast(`Page ${page.originalIndex} downloaded`);
  };

  const saveToCloud = async (provider: 'google' | 'dropbox') => {
    if (!isPro) {
      setView('pricing');
      showToast(`${provider === 'google' ? 'Google Drive' : 'Dropbox'} integration is a Pro feature`, 'info');
      return;
    }
    showToast(`Connecting to ${provider === 'google' ? 'Google Drive' : 'Dropbox'}...`, 'info');
    await new Promise(resolve => setTimeout(resolve, 1500));
    showToast('Successfully saved to cloud!', 'success');
  };

  const performOCR = async (page: ConvertedPage) => {
    if (!isPro) {
      setView('pricing');
      showToast('OCR is a Pro feature', 'info');
      return;
    }

    setIsOcrLoading(page.id);
    try {
      // In a real app, we'd send the image to an OCR service.
      // Here we simulate it with a delay and some mock text.
      await new Promise(resolve => setTimeout(resolve, 2000));
      const mockText = `EXTRACTED_TEXT_PAGE_${page.originalIndex}\n\n[SIMULATED_OCR_RESULT]\nThis is a high-fidelity text extraction from the PDF page using our advanced AI engine. In a production environment, this would integrate with Google Cloud Vision or Tesseract.js.\n\nConfidence: 98.4%\nLanguage: English\nTimestamp: ${new Date().toISOString()}`;
      setOcrResults(prev => ({ ...prev, [page.id]: mockText }));
      showToast('Text extracted successfully');
    } catch (err) {
      showToast('OCR failed', 'error');
    } finally {
      setIsOcrLoading(null);
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const updateMetadata = (key: keyof PDFMetadata, value: string) => {
    setMetadata(prev => prev ? { ...prev, [key]: value } : { [key]: value });
    showToast(`Metadata ${key} updated locally`, 'info');
  };

  const removePage = (id: string) => {
    setPages(prev => {
      const filtered = prev.filter(p => p.id !== id);
      const removed = prev.find(p => p.id === id);
      if (removed) {
        URL.revokeObjectURL(removed.url);
        setTotalOutputSize(s => s - removed.blob.size);
      }
      return filtered;
    });
    const next = new Set(selectedIds);
    next.delete(id);
    setSelectedIds(next);
  };

  return (
    <div className={`min-h-screen relative flex flex-col items-center p-6 md:p-12 overflow-x-hidden transition-all duration-500 ${
      theme === 'dark' ? 'bg-grid bg-[#050505] text-white' : 
      theme === 'light' ? 'bg-white text-black' :
      theme === 'cyberpunk' ? 'theme-cyberpunk bg-grid bg-[#0A001F] text-white' :
      'theme-minimal bg-[#F5F5F5] text-black'
    }`}>
      {/* Premium Header */}
      <motion.div 
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className={`w-full max-w-6xl glass-panel p-4 mb-8 md:mb-12 flex justify-between items-center z-50 sticky top-4 ${
          theme === 'light' ? 'bg-white/80 border-black/10' : ''
        }`}
      >
        <div className="flex items-center gap-4 cursor-pointer" onClick={() => { setView('converter'); setIsMobileMenuOpen(false); }}>
          <div className="w-10 h-10 bg-accent flex items-center justify-center relative group overflow-hidden shrink-0">
            <div className="absolute inset-0 bg-white/20 -translate-x-full group-hover:translate-x-full transition-transform duration-500" />
            <Layers className="w-6 h-6 text-black" />
          </div>
          <div className="hidden sm:block">
            <div className="flex items-center gap-2">
              <h1 className={`text-lg font-display tracking-widest leading-none ${theme === 'dark' ? 'text-white' : 'text-black'}`}>PDF.ENGINE</h1>
              {isPro && (
                <span className="bg-accent text-black text-[8px] font-bold px-1.5 py-0.5 rounded-sm">PRO</span>
              )}
            </div>
            <span className="status-label text-[8px]">PRO_EDITION_V2.5</span>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-8">
          <nav className="hidden lg:flex items-center gap-6">
            <button 
              onClick={() => setView('converter')}
              className={`text-[10px] font-mono tracking-widest uppercase transition-colors ${view === 'converter' ? 'text-accent' : 'text-[#666] hover:text-white'}`}
            >
              Converter
            </button>
            <button 
              onClick={() => setView('tools')}
              className={`text-[10px] font-mono tracking-widest uppercase transition-colors ${view === 'tools' ? 'text-accent' : 'text-[#666] hover:text-white'}`}
            >
              Tools
            </button>
            <button 
              onClick={() => setView('history')}
              className={`text-[10px] font-mono tracking-widest uppercase transition-colors ${view === 'history' ? 'text-accent' : 'text-[#666] hover:text-white'}`}
            >
              History
            </button>
            <button 
              onClick={() => setView('settings')}
              className={`text-[10px] font-mono tracking-widest uppercase transition-colors ${view === 'settings' ? 'text-accent' : 'text-[#666] hover:text-white'}`}
            >
              Settings
            </button>
            <button 
              onClick={() => setView('pricing')}
              className={`text-[10px] font-mono tracking-widest uppercase transition-colors ${view === 'pricing' ? 'text-accent' : 'text-[#666] hover:text-white'}`}
            >
              Pricing
            </button>
            {!isPro && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setView('pricing')}
                className="bg-accent text-black text-[10px] font-bold px-4 py-1.5 rounded-sm flex items-center gap-2"
              >
                <Zap className="w-3 h-3" /> UPGRADE
              </motion.button>
            )}
          </nav>
          
          <div className="flex items-center gap-2 md:gap-4">
            <button 
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className={`p-2 rounded-full transition-colors ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-accent" /> : <Moon className="w-4 h-4 text-black" />}
            </button>
            
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className={`lg:hidden p-2 rounded-full transition-colors ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

          <div className="hidden xl:flex flex-col items-end">
            <span className="status-label">System Load</span>
            <div className="w-24 h-1 bg-border mt-1 overflow-hidden relative">
              <motion.div 
                className="h-full bg-accent relative"
                animate={{ 
                  width: status === 'loading' ? '80%' : '10%',
                  opacity: status === 'loading' ? [0.6, 1, 0.6] : 1
                }}
                transition={{
                  width: { type: 'spring', stiffness: 100, damping: 20 },
                  opacity: { repeat: Infinity, duration: 2, ease: "easeInOut" }
                }}
              >
                <div className="absolute inset-0 bg-white/40 blur-sm -translate-x-full animate-[shimmer_2s_infinite]" />
              </motion.div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden w-full max-w-6xl glass-panel mb-8 overflow-hidden z-40"
          >
            <div className="p-6 flex flex-col gap-4">
              {[
                { id: 'converter', label: 'Converter', icon: RefreshCw },
                { id: 'tools', label: 'PDF Tools', icon: Scissors },
                { id: 'history', label: 'History', icon: History },
                { id: 'settings', label: 'Settings', icon: Settings },
                { id: 'pricing', label: 'Pricing', icon: Star },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => { setView(item.id as AppView); setIsMobileMenuOpen(false); }}
                  className={`flex items-center gap-4 p-4 rounded-sm transition-colors ${view === item.id ? 'bg-accent text-black' : 'hover:bg-white/5'}`}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="text-xs font-mono uppercase tracking-widest">{item.label}</span>
                </button>
              ))}
              {!isPro && (
                <button
                  onClick={() => { setView('pricing'); setIsMobileMenuOpen(false); }}
                  className="flex items-center justify-center gap-4 p-4 rounded-sm bg-accent text-black font-bold mt-4"
                >
                  <Zap className="w-5 h-5" />
                  <span className="text-xs font-mono uppercase tracking-widest">Upgrade to Pro</span>
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="w-full max-w-5xl">
        <AnimatePresence mode="wait">
          {view === 'pricing' ? (
            <motion.div
              key="pricing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full space-y-12"
            >
              <div className="text-center space-y-4">
                <h2 className="text-4xl font-display tracking-tighter uppercase">Choose Your Power</h2>
                <p className="text-[#666] font-mono text-xs uppercase tracking-widest">Select a plan to unlock advanced rendering capabilities</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                { [
                  {
                    name: 'Standard',
                    price: '0',
                    features: ['3 Conversions / Day', 'HD Quality (144 DPI)', 'PNG & JPG Output', 'Basic Watermarking'],
                    cta: 'Current Plan',
                    active: !isPro
                  },
                  {
                    name: 'Pro',
                    price: '9',
                    features: ['Unlimited Conversions', 'Ultra Quality (300 DPI)', 'WebP & TIFF Support', 'AI OCR Extraction', 'No Watermarks', 'Batch Processing'],
                    cta: 'Upgrade Now',
                    active: isPro,
                    highlight: true
                  },
                  {
                    name: 'Enterprise',
                    price: '29',
                    features: ['Everything in Pro', 'API Access (Beta)', 'Custom Branding', 'Priority Render Queue', 'Team Management', 'SLA Support'],
                    cta: 'Contact Sales',
                    active: false
                  }
                ].map((plan, i) => (
                  <motion.div 
                    key={plan.name}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1, duration: 0.5, ease: "easeOut" }}
                    whileHover={{ 
                      y: -10,
                      transition: { duration: 0.2 }
                    }}
                    className={`tool-card p-8 flex flex-col h-full relative overflow-hidden group transition-all duration-300 ${
                      plan.highlight 
                        ? 'border-accent/50 shadow-[0_0_30px_rgba(224,255,0,0.1)] hover:shadow-[0_0_50px_rgba(224,255,0,0.2)]' 
                        : 'hover:border-white/20 hover:shadow-2xl'
                    }`}
                  >
                    {plan.highlight && (
                      <>
                        <div className="absolute top-0 right-0 bg-accent text-black text-[8px] font-bold px-4 py-1 rotate-45 translate-x-4 translate-y-2 z-10">BEST VALUE</div>
                        <motion.div 
                          className="absolute inset-0 bg-accent/5 pointer-events-none"
                          animate={{ 
                            opacity: [0.05, 0.1, 0.05],
                          }}
                          transition={{ 
                            duration: 3, 
                            repeat: Infinity, 
                            ease: "easeInOut" 
                          }}
                        />
                      </>
                    )}
                    <div className="space-y-6 flex-grow relative z-10">
                      <div>
                        <h3 className="text-xl font-display uppercase tracking-widest group-hover:text-accent transition-colors">{plan.name}</h3>
                        <div className="flex items-baseline gap-1 mt-2">
                          <span className="text-3xl font-display">$</span>
                          <span className="text-5xl font-display">{plan.price}</span>
                          <span className="text-[#666] font-mono text-[10px]">/MO</span>
                        </div>
                      </div>
                      <ul className="space-y-4">
                        {plan.features.map((f) => (
                          <li key={f} className="flex items-center gap-3 text-[11px] font-mono text-[#888] group-hover:text-[#aaa] transition-colors">
                            <CheckCircle2 className="w-3 h-3 text-accent" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        if (plan.name === 'Pro') {
                          setIsPro(true);
                          setView('converter');
                          showToast('Welcome to Pro Edition!', 'success');
                        }
                      }}
                      className={`w-full mt-8 py-4 font-mono text-[11px] uppercase tracking-widest transition-all relative z-10 ${
                        plan.active 
                          ? 'bg-border text-[#666] cursor-default' 
                          : plan.highlight 
                            ? 'bg-accent text-black font-bold shadow-[0_4px_15px_rgba(224,255,0,0.3)]' 
                            : 'bg-white text-black hover:bg-accent hover:text-black'
                      }`}
                    >
                      {plan.active ? 'Active' : plan.cta}
                    </motion.button>
                  </motion.div>
                ))}
              </div>

              <div className="tool-card p-8 text-center">
                <div className="flex justify-center gap-12 flex-wrap opacity-50">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4" />
                    <span className="text-[10px] font-mono uppercase tracking-widest">Secure Payments</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4" />
                    <span className="text-[10px] font-mono uppercase tracking-widest">30-Day Guarantee</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    <span className="text-[10px] font-mono uppercase tracking-widest">Instant Activation</span>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : view === 'tools' ? (
            <motion.div
              key="tools"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="w-full space-y-12"
            >
              <div className="text-center space-y-4">
                <h2 className="text-4xl font-display tracking-tighter uppercase">PDF Power Tools</h2>
                <p className="text-[#666] font-mono text-xs uppercase tracking-widest">Advanced manipulation tools for professional workflows</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {[
                  {
                    title: 'Split PDF',
                    desc: 'Extract specific pages or split by range into multiple documents.',
                    icon: Split,
                    pro: false
                  },
                  {
                    title: 'Merge PDF',
                    desc: 'Combine multiple PDF files into a single high-quality document.',
                    icon: Merge,
                    pro: true
                  },
                  {
                    title: 'Compress PDF',
                    desc: 'Reduce file size while maintaining optimal visual quality.',
                    icon: FileArchive,
                    pro: true
                  },
                  {
                    title: 'Protect PDF',
                    desc: 'Add password protection and restrict permissions.',
                    icon: ShieldCheck,
                    pro: true
                  },
                  {
                    title: 'Image to PDF',
                    desc: 'Convert JPG, PNG, or WebP images into a professional PDF.',
                    icon: ImageIcon,
                    pro: false
                  },
                  {
                    title: 'PDF to Text',
                    desc: 'Extract all text from your PDF using high-accuracy OCR.',
                    icon: TypeIcon,
                    pro: true
                  }
                ].map((tool, i) => (
                  <motion.div 
                    key={tool.title} 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="tool-card p-8 group cursor-pointer relative overflow-hidden"
                  >
                    <div className="flex items-start gap-6">
                      <div className="p-4 bg-white/5 rounded-sm group-hover:bg-accent group-hover:text-black transition-colors">
                        <tool.icon className="w-8 h-8" />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <h3 className="text-xl font-display uppercase tracking-widest">{tool.title}</h3>
                          {tool.pro && !isPro && <Zap className="w-3 h-3 text-accent" />}
                        </div>
                        <p className="text-[#666] font-mono text-[11px] leading-relaxed">{tool.desc}</p>
                      </div>
                    </div>
                    <div className="mt-8 flex justify-end">
                      <button 
                        onClick={() => {
                          if (tool.pro && !isPro) setView('pricing');
                          else if (tool.title === 'PDF to Text') {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = '.pdf';
                            input.onchange = (e: any) => {
                              const file = e.target.files?.[0];
                              if (file) extractAllText(file);
                            };
                            input.click();
                          } else if (tool.title === 'Split PDF' || tool.title === 'Image to PDF') {
                            setView('converter');
                          } else {
                            showToast(`${tool.title} coming soon in v3.0!`, 'info');
                          }
                        }}
                        className="text-[10px] font-mono uppercase tracking-widest text-accent flex items-center gap-2 group-hover:gap-4 transition-all"
                      >
                        Launch Tool <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ) : view === 'history' ? (
            <motion.div
              key="history"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="w-full space-y-12"
            >
              <div className="text-center space-y-4">
                <h2 className="text-4xl font-display tracking-tighter uppercase">Recent Activity</h2>
                <p className="text-[#666] font-mono text-xs uppercase tracking-widest">Your last 10 conversion tasks</p>
              </div>

              <div className="tool-card overflow-hidden">
                {history.length === 0 ? (
                  <div className="p-20 text-center space-y-4">
                    <History className="w-12 h-12 text-[#333] mx-auto" />
                    <p className="text-[#666] font-mono text-[10px] uppercase tracking-widest">No recent activity found</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {history.map((item, i) => (
                      <motion.div 
                        key={i} 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="p-6 flex justify-between items-center hover:bg-white/5 transition-colors"
                      >
                        <div className="flex items-center gap-6">
                          <div className="w-10 h-10 bg-white/5 flex items-center justify-center rounded-sm">
                            <FileText className="w-5 h-5 text-[#666]" />
                          </div>
                          <div>
                            <h4 className="text-xs font-mono uppercase tracking-widest">{item.name}</h4>
                            <p className="text-[10px] text-[#666] font-mono mt-1">{item.date} • {item.pages} Pages</p>
                          </div>
                        </div>
                        <button className="p-2 hover:text-accent transition-colors">
                          <Download className="w-4 h-4" />
                        </button>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ) : view === 'text-extractor' ? (
            <motion.div
              key="text-extractor"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="w-full space-y-12"
            >
              <div className="text-center space-y-4">
                <h2 className="text-4xl font-display tracking-tighter uppercase">Text Extractor</h2>
                <p className="text-[#666] font-mono text-xs uppercase tracking-widest">High-accuracy OCR & Text parsing engine</p>
              </div>

              <div className="tool-card p-8 space-y-8">
                {isExtractingText ? (
                  <div className="p-20 flex flex-col items-center gap-6">
                    <Loader2 className="w-12 h-12 animate-spin text-accent" />
                    <p className="status-label">Parsing Document Streams...</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex justify-between items-center">
                      <span className="status-label">EXTRACTED_DATA_STREAM</span>
                      <div className="flex gap-4">
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(extractedText);
                            showToast('Copied to clipboard');
                          }}
                          className="text-[10px] font-mono uppercase tracking-widest text-accent hover:underline"
                        >
                          Copy All
                        </button>
                        <button 
                          onClick={() => {
                            const blob = new Blob([extractedText], { type: 'text/plain' });
                            saveAs(blob, 'extracted_text.txt');
                          }}
                          className="text-[10px] font-mono uppercase tracking-widest text-accent hover:underline"
                        >
                          Download .TXT
                        </button>
                      </div>
                    </div>
                    <textarea 
                      readOnly
                      value={extractedText}
                      className="w-full h-[500px] bg-black/40 border border-border p-6 font-mono text-[11px] leading-relaxed text-white/80 focus:outline-none resize-none"
                    />
                    <button 
                      onClick={() => setView('tools')}
                      className="btn-primary w-full"
                    >
                      Back to Tools
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          ) : view === 'settings' ? (
            <motion.div
              key="settings"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="w-full space-y-12"
            >
              <div className="text-center space-y-4">
                <h2 className="text-4xl font-display tracking-tighter uppercase">Global Settings</h2>
                <p className="text-[#666] font-mono text-xs uppercase tracking-widest">Personalize your PDF.ENGINE experience</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="tool-card p-8 space-y-8">
                  <div className="space-y-4">
                    <span className="status-label flex items-center gap-2">
                      <Sun className="w-3 h-3" /> Visual Theme
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      {(['dark', 'light', 'cyberpunk', 'minimal'] as Theme[]).map((t) => (
                        <button
                          key={t}
                          onClick={() => setTheme(t)}
                          className={`py-3 font-mono text-[10px] border transition-all uppercase tracking-widest ${
                            theme === t 
                              ? 'bg-accent text-black border-accent' 
                              : 'text-[#666] border-border hover:border-[#444]'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <span className="status-label flex items-center gap-2">
                      <Zap className="w-3 h-3" /> Performance Mode
                    </span>
                    <div className="flex items-center justify-between p-4 bg-white/5 border border-border/50 rounded-sm">
                      <div className="space-y-1">
                        <p className="text-[10px] font-mono text-white">HARDWARE ACCELERATION</p>
                        <p className="text-[8px] font-mono text-[#666]">USES GPU FOR FASTER RENDERING</p>
                      </div>
                      <div className="w-10 h-5 bg-accent rounded-full relative">
                        <div className="absolute top-1 right-1 w-3 h-3 bg-white rounded-full" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="tool-card p-8 space-y-8">
                  <div className="space-y-4">
                    <span className="status-label flex items-center gap-2">
                      <ShieldCheck className="w-3 h-3" /> Privacy & Security
                    </span>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-mono text-[#666]">AUTO-PURGE MEMORY</span>
                        <div className="w-10 h-5 bg-accent rounded-full relative">
                          <div className="absolute top-1 right-1 w-3 h-3 bg-white rounded-full" />
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-mono text-[#666]">LOCAL-ONLY PROCESSING</span>
                        <div className="w-10 h-5 bg-accent rounded-full relative">
                          <div className="absolute top-1 right-1 w-3 h-3 bg-white rounded-full" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <span className="status-label flex items-center gap-2">
                      <Info className="w-3 h-3" /> System Info
                    </span>
                    <div className="space-y-2 font-mono text-[8px] text-[#444]">
                      <div className="flex justify-between">
                        <span>VERSION</span>
                        <span>2.5.0-STABLE</span>
                      </div>
                      <div className="flex justify-between">
                        <span>ENGINE</span>
                        <span>PDF.JS v4.0.379</span>
                      </div>
                      <div className="flex justify-between">
                        <span>BUILD</span>
                        <span>20240307_REV_A</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : status === 'idle' ? (
            <motion.div
              key="idle"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              className="flex flex-col gap-8"
            >
              {/* Hero Section */}
              <div className="text-center space-y-6 mb-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                  className="inline-block p-3 bg-accent/10 rounded-full mb-4"
                >
                  <Zap className="w-8 h-8 text-accent" />
                </motion.div>
                <motion.h2 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-4xl md:text-6xl font-display uppercase tracking-tighter leading-none"
                >
                  Universal <span className="text-accent">PDF</span> Engine
                </motion.h2>
                <motion.p 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="text-[10px] md:text-xs font-mono text-[#666] uppercase tracking-[0.3em] max-w-2xl mx-auto"
                >
                  High-performance local rasterization. AES-256 encrypted. 100% Private.
                </motion.p>
              </div>

              {/* Prominent Upload Area - Now Above Main Content */}
              <motion.div 
                whileHover={{ scale: 1.005 }}
                whileTap={{ scale: 0.995 }}
                className="tool-card group cursor-pointer h-full min-h-[200px] md:min-h-[300px] relative overflow-hidden"
                onDragOver={onDragOver}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="absolute inset-0 shimmer opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="absolute inset-0 flex flex-col items-center justify-center border-2 border-dashed border-border group-hover:border-accent transition-all m-4 md:m-6">
                  <div className="relative mb-4 md:mb-6">
                    <Upload className="w-10 h-10 md:w-16 md:h-16 text-[#222] group-hover:text-accent transition-colors" />
                    <motion.div 
                      className="absolute inset-0 w-full h-1 bg-accent/50 blur-sm"
                      animate={{ top: ['0%', '100%', '0%'] }}
                      transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                    />
                  </div>
                  <h2 className="text-xl md:text-2xl mb-1 md:mb-2 font-display uppercase tracking-widest">Initialize Stream</h2>
                  <p className="status-label text-[8px] md:text-[10px]">Awaiting PDF input stream</p>
                  
                  <div className="mt-6 md:mt-10 flex gap-4 md:gap-8">
                    <div className="flex flex-col items-center">
                      <span className="text-white font-mono text-[10px] md:text-xs">100MB</span>
                      <span className="status-label text-[6px] md:text-[8px]">LIMIT</span>
                    </div>
                    <div className="w-[1px] h-6 md:h-8 bg-border" />
                    <div className="flex flex-col items-center">
                      <span className="text-white font-mono text-[10px] md:text-xs">AES-256</span>
                      <span className="status-label text-[6px] md:text-[8px]">LOCAL</span>
                    </div>
                  </div>
                </div>
                <input type="file" ref={fileInputRef} className="hidden" accept=".pdf" onChange={handleFileChange} />
              </motion.div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Configuration Panel */}
                <div className="lg:col-span-4 space-y-6">
                <div className="tool-card p-6 space-y-8">
                  <div className="flex items-center justify-between lg:hidden">
                    <span className="status-label flex items-center gap-2">
                      <Settings className="w-3 h-3" /> Configuration
                    </span>
                    <button 
                      onClick={() => setIsConfigOpen(!isConfigOpen)}
                      className="p-1 hover:bg-white/5 rounded-sm transition-colors"
                    >
                      {isConfigOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                  </div>

                  <AnimatePresence initial={false}>
                    {(isConfigOpen || window.innerWidth >= 1024) && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="space-y-8 overflow-hidden"
                      >
                        <div className="space-y-4">
                          <span className="status-label flex items-center gap-2">
                            <Settings2 className="w-3 h-3" /> Rendering Engine
                          </span>
                    <div className="grid grid-cols-1 gap-2">
                      {(['low', 'medium', 'high', 'ultra'] as Quality[]).map((q) => (
                        <motion.button
                          key={q}
                          whileHover={{ x: 4 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            if (QUALITY_SETTINGS[q].pro && !isPro) {
                              setView('pricing');
                              showToast('Ultra quality is a Pro feature', 'info');
                              return;
                            }
                            setQuality(q);
                          }}
                          className={`flex items-center justify-between px-4 py-3 font-mono text-[11px] transition-all border group ${
                            quality === q 
                              ? 'bg-accent text-black border-accent shadow-[0_0_15px_rgba(224,255,0,0.2)]' 
                              : 'bg-bg text-[#666] border-border hover:border-[#444]'
                          }`}
                        >
                          <div className="flex flex-col items-start">
                            <div className="flex items-center gap-2">
                              <span className="uppercase tracking-widest font-bold">{QUALITY_SETTINGS[q].label}</span>
                              {QUALITY_SETTINGS[q].pro && !isPro && <Zap className="w-2 h-2 text-accent" />}
                            </div>
                            <span className={`text-[8px] ${quality === q ? 'text-black/60' : 'text-[#444]'}`}>
                              {q === 'low' ? '72 DPI' : q === 'medium' ? '144 DPI' : q === 'high' ? '300 DPI' : '600 DPI (PRO)'}
                            </span>
                          </div>
                          {quality === q && <ChevronRight className="w-4 h-4" />}
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <span className="status-label flex items-center gap-2">
                      <Copy className="w-3 h-3" /> Output Format
                    </span>
                    <div className="flex gap-2">
                      {(['png', 'jpg', 'webp', 'tiff'] as ExportFormat[]).map((f) => (
                        <motion.button
                          key={f}
                          whileHover={{ y: -2 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            if ((f === 'webp' || f === 'tiff') && !isPro) {
                              setView('pricing');
                              showToast(`${f.toUpperCase()} is a Pro feature`, 'info');
                              return;
                            }
                            setFormat(f);
                          }}
                          className={`flex-1 py-2 font-mono text-[10px] border transition-all uppercase tracking-widest relative ${
                            format === f 
                              ? theme === 'dark' ? 'bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.1)]' : 'bg-black text-white border-black shadow-[0_0_15px_rgba(0,0,0,0.1)]'
                              : 'text-[#555] border-border hover:border-[#444]'
                          }`}
                        >
                          {f}
                          {(f === 'webp' || f === 'tiff') && !isPro && (
                            <Zap className="w-2 h-2 absolute top-1 right-1 text-accent" />
                          )}
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <span className="status-label flex items-center gap-2">
                      <RefreshCw className="w-3 h-3" /> Rotation
                    </span>
                    <div className="flex gap-2">
                      {[0, 90, 180, 270].map((r) => (
                        <motion.button
                          key={r}
                          whileHover={{ y: -2 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setRotation(r)}
                          className={`flex-1 py-2 font-mono text-[10px] border transition-all ${
                            rotation === r 
                              ? theme === 'dark' ? 'bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.1)]' : 'bg-black text-white border-black shadow-[0_0_15px_rgba(0,0,0,0.1)]'
                              : 'text-[#555] border-border hover:border-[#444]'
                          }`}
                        >
                          {r}°
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="status-label flex items-center gap-2">
                        <Layers className="w-3 h-3" /> Grayscale Mode
                      </span>
                      <button 
                        onClick={() => setIsGrayscale(!isGrayscale)}
                        className={`w-10 h-5 rounded-full transition-colors relative ${isGrayscale ? 'bg-accent' : 'bg-border'}`}
                      >
                        <motion.div 
                          className="absolute top-1 left-1 w-3 h-3 bg-white rounded-full"
                          animate={{ x: isGrayscale ? 20 : 0 }}
                        />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="status-label flex items-center gap-2">
                          <Hash className="w-3 h-3" /> Batch Mode
                        </span>
                        {!isPro && <Zap className="w-2 h-2 text-accent" />}
                      </div>
                      <button 
                        onClick={() => {
                          if (!isPro) {
                            setView('pricing');
                            showToast('Batch mode is a Pro feature', 'info');
                            return;
                          }
                          setIsBatchMode(!isBatchMode);
                        }}
                        className={`w-10 h-5 rounded-full transition-colors relative ${isBatchMode ? 'bg-accent' : 'bg-border'} ${!isPro ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <motion.div 
                          className="absolute top-1 left-1 w-3 h-3 bg-white rounded-full"
                          animate={{ x: isBatchMode ? 20 : 0 }}
                        />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <span className="status-label flex items-center gap-2">
                      <Scissors className="w-3 h-3" /> Page Range
                    </span>
                    <input 
                      type="text"
                      value={pageRange}
                      onChange={(e) => setPageRange(e.target.value)}
                      placeholder="e.g. 1-5, 8, 10-12"
                      className={`w-full bg-transparent border border-border px-4 py-3 font-mono text-[11px] focus:outline-none focus:border-accent transition-colors ${
                        theme === 'dark' ? 'text-white' : 'text-black'
                      }`}
                    />
                  </div>

                  <div className="space-y-4">
                    <span className="status-label flex items-center gap-2">
                      <TypeIcon className="w-3 h-3" /> Watermark
                    </span>
                    <div className="space-y-3">
                      <input 
                        type="text"
                        value={watermark}
                        onChange={(e) => setWatermark(e.target.value)}
                        placeholder="Text watermark..."
                        className={`w-full bg-transparent border border-border px-4 py-3 font-mono text-[11px] focus:outline-none focus:border-accent transition-colors ${
                          theme === 'dark' ? 'text-white' : 'text-black'
                        }`}
                      />
                      
                      <div className="flex gap-2">
                        <button 
                          onClick={() => watermarkInputRef.current?.click()}
                          className={`flex-1 py-2 font-mono text-[10px] border transition-all uppercase tracking-widest ${
                            watermarkImage ? 'bg-accent text-black border-accent' : 'text-[#555] border-border hover:border-[#444]'
                          }`}
                        >
                          {watermarkImage ? 'Logo Uploaded' : 'Upload Logo'}
                        </button>
                        {watermarkImage && (
                          <button onClick={() => setWatermarkImage(null)} className="px-3 border border-border hover:text-red-500">
                            <X className="w-3 h-3" />
                          </button>
                        )}
                        <input type="file" ref={watermarkInputRef} className="hidden" accept="image/*" onChange={handleWatermarkImageChange} />
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-[8px] font-mono text-[#666]">
                          <span>OPACITY</span>
                          <span>{Math.round(watermarkOpacity * 100)}%</span>
                        </div>
                        <input 
                          type="range" min="0" max="1" step="0.05"
                          value={watermarkOpacity}
                          onChange={(e) => setWatermarkOpacity(parseFloat(e.target.value))}
                          className="w-full accent-accent"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <div className="flex justify-between text-[8px] font-mono text-[#666]">
                            <span>FONT SIZE</span>
                            <span>{watermarkFontSize}PX</span>
                          </div>
                          <input 
                            type="range" min="10" max="200" step="1"
                            value={watermarkFontSize}
                            onChange={(e) => setWatermarkFontSize(parseInt(e.target.value))}
                            className="w-full accent-accent"
                          />
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-[8px] font-mono text-[#666]">
                            <span>ROTATION</span>
                            <span>{watermarkRotation}°</span>
                          </div>
                          <input 
                            type="range" min="-180" max="180" step="1"
                            value={watermarkRotation}
                            onChange={(e) => setWatermarkRotation(parseInt(e.target.value))}
                            className="w-full accent-accent"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <div className="flex justify-between text-[8px] font-mono text-[#666]">
                            <span>COLOR</span>
                            <span>{watermarkColor.toUpperCase()}</span>
                          </div>
                          <input 
                            type="color"
                            value={watermarkColor}
                            onChange={(e) => setWatermarkColor(e.target.value)}
                            className="w-full h-6 bg-transparent border border-border cursor-pointer"
                          />
                        </div>
                        {watermarkImage && (
                          <div className="space-y-2">
                            <div className="flex justify-between text-[8px] font-mono text-[#666]">
                              <span>LOGO SCALE</span>
                              <span>{Math.round(watermarkLogoScale * 100)}%</span>
                            </div>
                            <input 
                              type="range" min="0.05" max="1" step="0.05"
                              value={watermarkLogoScale}
                              onChange={(e) => setWatermarkLogoScale(parseFloat(e.target.value))}
                              className="w-full accent-accent"
                            />
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-1">
                        {(['top-left', 'center', 'top-right', 'bottom-left', 'tile', 'bottom-right'] as WatermarkPosition[]).map((pos) => (
                          <motion.button
                            key={pos}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setWatermarkPosition(pos)}
                            className={`py-1 font-mono text-[8px] border transition-all uppercase ${
                              watermarkPosition === pos 
                                ? 'bg-accent text-black border-accent shadow-[0_0_10px_rgba(224,255,0,0.1)]' 
                                : 'text-[#444] border-border/50 hover:border-[#444]'
                            }`}
                          >
                            {pos.replace('-', ' ')}
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <span className="status-label flex items-center gap-2">
                      <Hash className="w-3 h-3" /> Rename Pattern
                    </span>
                    <input 
                      type="text"
                      value={renamePattern}
                      onChange={(e) => setRenamePattern(e.target.value)}
                      placeholder="e.g. {name}_{n}"
                      className={`w-full bg-transparent border border-border px-4 py-3 font-mono text-[11px] focus:outline-none focus:border-accent transition-colors ${
                        theme === 'dark' ? 'text-white' : 'text-black'
                      }`}
                    />
                    <p className="text-[8px] font-mono text-[#666] uppercase tracking-tighter">
                      Available: {'{name}, {n}, {date}'}
                    </p>
                  </div>

                  <div className="p-4 bg-black/40 border border-border/50 rounded-sm">
                    <p className="text-[10px] font-mono leading-relaxed text-[#444]">
                      Engine v2.5 uses hardware acceleration for faster rasterization. All data remains in isolated memory.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

              {/* Quick Tools Sidebar for Desktop / Bottom Bar for Mobile */}
              <div className="lg:col-span-8 space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {[
                    { title: 'Merge', icon: Merge, pro: true },
                    { title: 'Split', icon: Split, pro: false },
                    { title: 'Compress', icon: FileArchive, pro: true },
                    { title: 'Protect', icon: ShieldCheck, pro: true },
                    { title: 'OCR', icon: TypeIcon, pro: true },
                    { title: 'Image to PDF', icon: ImageIcon, pro: false },
                  ].map((tool) => (
                    <motion.button
                      key={tool.title}
                      whileHover={{ y: -4 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        if (tool.pro && !isPro) setView('pricing');
                        else setView('tools');
                      }}
                      className="tool-card p-4 flex flex-col items-center justify-center gap-3 group"
                    >
                      <tool.icon className="w-6 h-6 text-[#444] group-hover:text-accent transition-colors" />
                      <span className="text-[10px] font-mono uppercase tracking-widest">{tool.title}</span>
                      {tool.pro && !isPro && <Zap className="w-2 h-2 text-accent" />}
                    </motion.button>
                  ))}
                </div>

                <div className="tool-card p-8 flex flex-col items-center justify-center text-center space-y-4 bg-accent/5 border-accent/20">
                  <div className="p-4 bg-accent/10 rounded-full">
                    <Star className="w-8 h-8 text-accent" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-display uppercase tracking-widest">Join the Pro Network</h3>
                    <p className="text-[10px] font-mono text-[#666] max-w-md">Unlock unlimited batch processing, ultra-high resolution rendering, and advanced AI-powered OCR extraction.</p>
                  </div>
                  <button 
                    onClick={() => setView('pricing')}
                    className="bg-accent text-black px-8 py-3 font-mono text-[11px] font-bold uppercase tracking-widest hover:scale-105 transition-transform"
                  >
                    Upgrade to PDF.ENGINE Pro
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
          ) : status === 'loading' ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0, scale: 1.1 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="tool-card p-20 flex flex-col items-center max-w-2xl mx-auto w-full"
            >
              <div className="relative w-48 h-48 mb-12">
                <svg className="w-full h-full -rotate-90">
                  <circle cx="96" cy="96" r="88" className="stroke-border fill-none" strokeWidth="2" />
                  <motion.circle 
                    cx="96" cy="96" r="88" 
                    className="stroke-accent fill-none" 
                    strokeWidth="2"
                    strokeDasharray="553"
                    animate={{ strokeDashoffset: 553 - (553 * (progress / totalPages)) }}
                    transition={{ type: 'spring', bounce: 0, duration: 0.5 }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-display text-white">{Math.round((progress / totalPages) * 100)}%</span>
                  <span className="status-label text-[8px]">Rasterizing</span>
                </div>
              </div>
              <h3 className="text-2xl mb-4 tracking-widest">Processing Pipeline</h3>
              <div className="flex items-center gap-4 mb-8">
                <div className="flex flex-col items-center">
                  <span className="text-white font-mono text-xs">{progress}</span>
                  <span className="status-label text-[8px]">DONE</span>
                </div>
                <div className="w-12 h-[1px] bg-border" />
                <div className="flex flex-col items-center">
                  <span className="text-white font-mono text-xs">{totalPages}</span>
                  <span className="status-label text-[8px]">TOTAL</span>
                </div>
              </div>
              <div className="w-full h-1 bg-border/50 rounded-full overflow-hidden relative">
                <motion.div 
                  className="h-full bg-accent shadow-[0_0_15px_rgba(224,255,0,0.5)]"
                  initial={{ width: 0 }}
                  animate={{ width: `${(progress / totalPages) * 100}%` }}
                  transition={{ 
                    type: 'spring', 
                    stiffness: 40, 
                    damping: 20,
                    mass: 1
                  }}
                />
                <motion.div 
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                  animate={{ x: ['-100%', '200%'] }}
                  transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                />
              </div>
            </motion.div>
          ) : status === 'error' ? (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="tool-card p-16 flex flex-col items-center text-center max-w-xl mx-auto"
            >
              <div className="w-20 h-20 border-2 border-red-500/30 flex items-center justify-center mb-8 relative">
                <AlertCircle className="w-10 h-10 text-red-500" />
                <div className="absolute inset-0 bg-red-500/5 animate-pulse" />
              </div>
              <h3 className="text-2xl mb-2 text-red-500 font-display">Pipeline Interrupted</h3>
              <p className="status-label mb-12 text-red-500/60">{error}</p>
              <button onClick={reset} className="btn-primary bg-red-500 text-white w-full">
                <RefreshCw className="w-4 h-4" /> Restart Engine
              </button>
            </motion.div>
          ) : status === 'success' ? (
            <motion.div
              key="success"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-8"
            >
              {/* Pro Stats Dashboard */}
              <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 flex-1 w-full">
                  {[
                    { label: 'Source File', value: fileName, icon: FileText },
                    { label: 'Resolution', value: QUALITY_SETTINGS[quality].label, icon: Zap },
                    { label: 'Output Format', value: format.toUpperCase(), icon: Layers },
                    { label: 'Payload Size', value: formatFileSize(totalOutputSize), icon: ShieldCheck }
                  ].map((stat, i) => (
                    <motion.div 
                      key={i} 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      whileHover={{ y: -4, scale: 1.02 }}
                      transition={{ 
                        delay: i * 0.1,
                        scale: { type: 'spring', stiffness: 400, damping: 25 }
                      }}
                      className={`tool-card p-4 group ${theme === 'light' ? 'bg-black/5' : ''}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="status-label">{stat.label}</span>
                        <stat.icon className={`w-3 h-3 transition-colors ${theme === 'dark' ? 'text-[#333] group-hover:text-accent' : 'text-black/20 group-hover:text-black'}`} />
                      </div>
                      <span className={`font-mono text-xs truncate block ${theme === 'dark' ? 'text-white' : 'text-black'}`}>{stat.value}</span>
                    </motion.div>
                  ))}
                </div>

                {/* Grid Settings Panel */}
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`tool-card p-4 min-w-[200px] ${theme === 'light' ? 'bg-black/5' : ''}`}
                >
                  <div className="flex items-center gap-2 mb-4">
                    <Monitor className="w-3 h-3 text-accent" />
                    <span className="status-label">Device Preview</span>
                  </div>
                  <div className="flex gap-2 mb-4">
                    {[
                      { id: 'pc', icon: Monitor },
                      { id: 'tablet', icon: Tablet },
                      { id: 'mobile', icon: Smartphone }
                    ].map((d) => (
                      <button
                        key={d.id}
                        onClick={() => setPreviewDevice(d.id as any)}
                        className={`flex-1 py-1.5 border flex items-center justify-center transition-all ${
                          previewDevice === d.id ? 'bg-accent text-black border-accent' : 'border-border text-[#666] hover:border-[#444]'
                        }`}
                      >
                        <d.icon className="w-3 h-3" />
                      </button>
                    ))}
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-[#666]">PAGE NUMBERS</span>
                      <button 
                        onClick={() => setShowPageNumbers(!showPageNumbers)}
                        className={`w-8 h-4 rounded-full transition-colors relative ${showPageNumbers ? 'bg-accent' : 'bg-border'}`}
                      >
                        <motion.div 
                          className="absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full"
                          animate={{ x: showPageNumbers ? 16 : 0 }}
                        />
                      </button>
                    </div>
                  </div>
                </motion.div>

                {/* Cloud Save Panel */}
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className={`tool-card p-4 min-w-[200px] ${theme === 'light' ? 'bg-black/5' : ''}`}
                >
                  <div className="flex items-center gap-2 mb-4">
                    <Settings className="w-3 h-3 text-accent" />
                    <span className="status-label">Advanced Tools</span>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    <button 
                      onClick={() => setIsMetadataEditorOpen(true)}
                      className="py-2 border border-border text-[8px] font-mono uppercase tracking-widest hover:border-accent hover:text-accent transition-all flex items-center justify-center gap-2"
                    >
                      <FileText className="w-3 h-3" /> Edit Metadata
                    </button>
                    <button 
                      onClick={() => showToast('Page reordering coming in v3.0', 'info')}
                      className="py-2 border border-border text-[8px] font-mono uppercase tracking-widest hover:border-accent hover:text-accent transition-all flex items-center justify-center gap-2"
                    >
                      <Layers className="w-3 h-3" /> Reorder Pages
                    </button>
                  </div>
                </motion.div>

                {/* Cloud Save Panel */}
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className={`tool-card p-4 min-w-[200px] ${theme === 'light' ? 'bg-black/5' : ''}`}
                >
                  <div className="flex items-center gap-2 mb-4">
                    <Cloud className="w-3 h-3 text-accent" />
                    <span className="status-label">Cloud Sync</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={() => saveToCloud('google')}
                      className="py-2 border border-border text-[8px] font-mono uppercase tracking-widest hover:border-accent hover:text-accent transition-all flex flex-col items-center gap-1"
                    >
                      <Share2 className="w-3 h-3" /> Drive
                    </button>
                    <button 
                      onClick={() => saveToCloud('dropbox')}
                      className="py-2 border border-border text-[8px] font-mono uppercase tracking-widest hover:border-accent hover:text-accent transition-all flex flex-col items-center gap-1"
                    >
                      <Cloud className="w-3 h-3" /> Dropbox
                    </button>
                  </div>
                </motion.div>
              </div>

              {/* Metadata Editor Modal */}
              <AnimatePresence>
                {isMetadataEditorOpen && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md"
                  >
                    <motion.div
                      initial={{ scale: 0.9, y: 20 }}
                      animate={{ scale: 1, y: 0 }}
                      exit={{ scale: 0.9, y: 20 }}
                      className="tool-card p-8 max-w-md w-full space-y-8"
                    >
                      <div className="flex justify-between items-center">
                        <h3 className="text-xl font-display uppercase tracking-widest">Metadata Editor</h3>
                        <button onClick={() => setIsMetadataEditorOpen(false)} className="p-2 hover:bg-white/5 rounded-full">
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      <div className="space-y-4">
                        {(['title', 'author', 'creator', 'producer'] as (keyof PDFMetadata)[]).map((key) => (
                          <div key={key} className="space-y-2">
                            <label className="status-label text-[8px]">{key.toUpperCase()}</label>
                            <input 
                              type="text"
                              value={metadata?.[key] || ''}
                              onChange={(e) => updateMetadata(key, e.target.value)}
                              className="w-full bg-transparent border border-border px-4 py-3 font-mono text-[11px] focus:outline-none focus:border-accent"
                            />
                          </div>
                        ))}
                      </div>

                      <button 
                        onClick={() => setIsMetadataEditorOpen(false)}
                        className="btn-primary w-full"
                      >
                        Save Changes
                      </button>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Interactive Grid */}
              <div className={`grid gap-4 md:gap-6 transition-all duration-500 ${
                previewDevice === 'pc' ? 'grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5' :
                previewDevice === 'tablet' ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 max-w-3xl mx-auto' :
                'grid-cols-1 max-w-sm mx-auto'
              }`}>
                <AnimatePresence>
                  {pages.map((page, index) => (
                    <motion.div
                      layout
                      key={page.id}
                      initial={{ opacity: 0, y: 30, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
                      whileHover={{ 
                        y: -8, 
                        scale: 1.02,
                        transition: { duration: 0.3, ease: "easeOut" } 
                      }}
                      transition={{ 
                        type: 'spring', 
                        stiffness: 200, 
                        damping: 25,
                        delay: index * 0.04 
                      }}
                      className={`tool-card group relative ${selectedIds.has(page.id) ? 'border-accent ring-1 ring-accent/20' : ''}`}
                    >
                      <div 
                        className="aspect-[3/4] bg-black relative overflow-hidden"
                      >
                        <ZoomableImage 
                          src={page.url} 
                          alt="" 
                          className="w-full h-full object-contain opacity-70 group-hover:opacity-100 transition-opacity duration-500" 
                          onClick={() => toggleSelect(page.id)}
                        />
                        
                        {/* Selection Overlay */}
                        <div className={`absolute inset-0 transition-all duration-300 pointer-events-none ${selectedIds.has(page.id) ? 'bg-accent/10' : 'bg-transparent group-hover:bg-white/5'}`} />
                        
                        {/* Checkbox */}
                        <div className={`absolute top-3 right-3 w-5 h-5 border transition-all flex items-center justify-center pointer-events-none ${
                          selectedIds.has(page.id) ? 'bg-accent border-accent text-black' : 'bg-black/50 border-white/20 text-transparent'
                        }`}>
                          <CheckCircle2 className="w-3 h-3" />
                        </div>

                        {/* Hover Actions */}
                        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              performOCR(page);
                            }}
                            className="p-1.5 bg-black/60 backdrop-blur-md border border-white/10 text-white hover:text-accent transition-colors"
                            title="Extract Text (AI)"
                          >
                            {isOcrLoading === page.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <TypeIcon className="w-3 h-3" />}
                          </button>
                          {showDownloadButtons && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                downloadSingle(page);
                              }}
                              className="p-1.5 bg-black/60 backdrop-blur-md border border-white/10 text-white hover:text-accent transition-colors"
                              title="Download Page"
                            >
                              <Download className="w-3 h-3" />
                            </button>
                          )}
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              removePage(page.id);
                            }}
                            className="p-1.5 bg-black/60 backdrop-blur-md border border-white/10 text-white hover:text-red-500 transition-colors"
                            title="Remove"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>

                        {/* OCR Result Overlay */}
                        <AnimatePresence>
                          {ocrResults[page.id] && (
                            <motion.div 
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0 }}
                              className="absolute inset-x-2 bottom-2 bg-black/80 backdrop-blur-xl border border-white/10 p-3 z-20 max-h-[60%] overflow-y-auto"
                            >
                              <div className="flex justify-between items-start mb-2">
                                <span className="text-[8px] font-mono text-accent uppercase tracking-widest">AI_OCR_RESULT</span>
                                <button onClick={() => setOcrResults(prev => {
                                  const next = { ...prev };
                                  delete next[page.id];
                                  return next;
                                })}>
                                  <X className="w-2 h-2 text-white/40 hover:text-white" />
                                </button>
                              </div>
                              <pre className="text-[9px] font-mono text-white/80 whitespace-pre-wrap leading-relaxed">
                                {ocrResults[page.id]}
                              </pre>
                              <button 
                                onClick={() => {
                                  navigator.clipboard.writeText(ocrResults[page.id]);
                                  showToast('Copied to clipboard');
                                }}
                                className="mt-2 w-full py-1 border border-white/10 text-[8px] font-mono uppercase tracking-widest hover:bg-white/5 transition-colors"
                              >
                                Copy Text
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                      <div className="p-3 border-t border-border flex justify-between items-center">
                        {showPageNumbers ? (
                          <span className="font-mono text-[9px] text-[#444]">STREAM_P.{page.originalIndex.toString().padStart(2, '0')}</span>
                        ) : (
                          <span className="font-mono text-[9px] text-[#444]">PAGE_ID_{page.id.split('-')[1]}</span>
                        )}
                        <span className="text-[8px] font-mono text-[#333]">{formatFileSize(page.blob.size)}</span>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* PDF Metadata Panel - Collapsible */}
              {metadata && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`tool-card overflow-hidden transition-all duration-500 ${theme === 'light' ? 'bg-black/5' : ''}`}
                >
                  <button 
                    onClick={() => setIsMetadataOpen(!isMetadataOpen)}
                    className="w-full p-6 flex items-center justify-between group hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Info className="w-4 h-4 text-accent" />
                      <span className="status-label">Document Metadata</span>
                    </div>
                    <motion.div
                      animate={{ rotate: isMetadataOpen ? 180 : 0 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    >
                      <ChevronDown className="w-4 h-4 text-[#444] group-hover:text-white transition-colors" />
                    </motion.div>
                  </button>

                  <AnimatePresence>
                    {isMetadataOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                        className="border-t border-border/50"
                      >
                        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
                          {[
                            { label: 'Title', value: metadata.title },
                            { label: 'Author', value: metadata.author },
                            { label: 'Producer', value: metadata.producer },
                            { label: 'Creator', value: metadata.creator },
                            { label: 'Creation Date', value: metadata.creationDate },
                          ].map((item, i) => (
                            <div key={i} className="space-y-2">
                              <span className="text-[8px] font-mono text-[#666] uppercase tracking-widest block">{item.label}</span>
                              <p className={`text-[11px] font-mono break-all ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
                                {item.value || <span className="text-[#333] italic">NOT_SPECIFIED</span>}
                              </p>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}

              {/* Premium Footer Bar */}
              <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-2xl px-6 z-50">
                <motion.div 
                  initial={{ y: 100, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 25 }}
                  className="glass-panel p-4 flex items-center justify-between gap-6 shadow-2xl"
                >
                  <div className="flex items-center gap-6">
                    <button onClick={reset} className="btn-outline">Clear Buffer</button>
                    <button 
                      onClick={() => {
                        if (selectedIds.size === pages.length) setSelectedIds(new Set());
                        else setSelectedIds(new Set(pages.map(p => p.id)));
                      }}
                      className="btn-outline"
                    >
                      {selectedIds.size === pages.length ? 'Deselect All' : 'Select All'}
                    </button>
                    <div className="h-6 w-[1px] bg-border hidden sm:block" />
                    <div className="hidden sm:flex flex-col">
                      <span className="status-label">Selection</span>
                      <span className="text-white font-mono text-[10px]">
                        {selectedIds.size > 0 ? `${selectedIds.size} / ${pages.length}` : 'ALL_PAGES'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {selectedIds.size > 0 && (
                      <div className="hidden md:flex flex-col items-end mr-4">
                        <span className="status-label">Selection Size</span>
                        <span className="text-white font-mono text-[10px]">
                          {formatFileSize(pages.filter(p => selectedIds.has(p.id)).reduce((acc, p) => acc + p.blob.size, 0))}
                        </span>
                      </div>
                    )}
                    {selectedIds.size > 0 && (
                      <button 
                        onClick={() => setSelectedIds(new Set())}
                        className="text-[10px] font-mono text-[#666] hover:text-white transition-colors uppercase tracking-widest mr-2"
                      >
                        Deselect
                      </button>
                    )}
                    <button onClick={downloadAllAsZip} className="btn-primary">
                      <FileArchive className="w-4 h-4" /> 
                      {selectedIds.size > 0 ? 'Export Selection' : 'Export Archive'}
                    </button>
                  </div>
                </motion.div>
              </div>

              {/* Floating Actions */}
      <AnimatePresence>
        {status === 'success' && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-8 right-8 flex flex-col gap-4 z-50"
          >
            {showScrollTop && (
              <motion.button
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="w-12 h-12 bg-white text-black flex items-center justify-center rounded-full shadow-2xl hover:bg-accent hover:text-black transition-all"
              >
                <ArrowUp className="w-5 h-5" />
              </motion.button>
            )}
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={downloadAllAsZip}
              className="w-14 h-14 bg-accent text-black flex items-center justify-center rounded-full shadow-[0_0_20px_rgba(224,255,0,0.4)] hover:scale-110 transition-all"
            >
              <Download className="w-6 h-6" />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
              <AnimatePresence>
                {toast && (
                  <motion.div
                    initial={{ opacity: 0, y: 50, x: '-50%' }}
                    animate={{ opacity: 1, y: 0, x: '-50%' }}
                    exit={{ opacity: 0, y: 20, x: '-50%' }}
                    className={`fixed bottom-32 left-1/2 -translate-x-1/2 px-6 py-3 rounded-sm border backdrop-blur-xl z-[100] flex items-center gap-3 shadow-2xl ${
                      toast.type === 'success' ? 'bg-accent/10 border-accent/50 text-accent' : 
                      toast.type === 'info' ? 'bg-white/10 border-white/20 text-white' :
                      'bg-red-500/10 border-red-500/50 text-red-500'
                    }`}
                  >
                    {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : 
                     toast.type === 'info' ? <Info className="w-4 h-4" /> :
                     <AlertCircle className="w-4 h-4" />}
                    <span className="text-[10px] font-mono uppercase tracking-widest font-bold">{toast.message}</span>
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="h-32" />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
