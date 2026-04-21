import React, { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Rnd } from "react-rnd";
import {
  Upload,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Trash2,
  Scissors,
  Loader2,
} from "lucide-react";
import { PDFDocument } from "pdf-lib";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Configuração do Worker do PDF.js para processamento em background
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

type Mold = { id: string; x: number; y: number; width: number; height: number };

export default function App() {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [zoom, setZoom] = useState<number>(1.0);
  const [molds, setMolds] = useState<Mold[]>([]);
  const [isCutting, setIsCutting] = useState(false);

  // Manipulação de arquivos e navegação
  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file?.type === "application/pdf") {
      setPdfFile(file);
      setPageNumber(1);
      setZoom(1.0);
      setMolds([]);
    }
  };

  const changePage = (offset: number) =>
    setPageNumber((prev) => Math.min(Math.max(1, prev + offset), numPages));

  const zoomIn = () => setZoom((prev) => Math.min(prev + 0.2, 3.0));
  const zoomOut = () => setZoom((prev) => Math.max(prev - 0.2, 0.4));

  // Gerenciamento de Moldes (Etiquetas)
  const spawnMold = () => {
    const newMold: Mold = {
      id: Date.now().toString(),
      x: 50,
      y: 50,
      width: 100,
      height: 150,
    };
    setMolds([...molds, newMold]);
  };

  const clearMolds = () => setMolds([]);

  const toggleOrientation = (index: number) => {
    const newMolds = [...molds];
    const m = newMolds[index];
    [m.width, m.height] = [m.height, m.width]; // Swap de dimensões
    setMolds(newMolds);
  };

  const handleWheelResize = (e: React.WheelEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();

    const delta = e.deltaY < 0 ? 10 : -10;
    const newMolds = [...molds];
    const m = newMolds[index];
    const isLandscape = m.width > m.height;

    let newWidth = Math.max(50, m.width + delta);
    let newHeight = isLandscape
      ? Math.round(newWidth / 1.5)
      : Math.round(newWidth * 1.5);

    if (newHeight < 50) {
      newHeight = 50;
      newWidth = isLandscape
        ? Math.round(newHeight * 1.5)
        : Math.round(newHeight / 1.5);
    }

    m.width = newWidth;
    m.height = newHeight;
    setMolds(newMolds);
  };

  /**
   * Processa o recorte do PDF original com base nos moldes posicionados.
   * Converte coordenadas do DOM (pixels/zoom) para pontos de PDF (72 DPI).
   */
  const executeTacticalCut = async () => {
    if (!pdfFile || molds.length === 0) return;
    setIsCutting(true);

    try {
      const fileBuffer = await pdfFile.arrayBuffer();
      const originalPdf = await PDFDocument.load(fileBuffer);
      const newPdf = await PDFDocument.create();

      const pageIndex = pageNumber - 1;
      const originalPage = originalPdf.getPage(pageIndex);
      const { width: origWidth, height: origHeight } = originalPage.getSize();
      const [embeddedPage] = await newPdf.embedPages([originalPage]);

      for (const mold of molds) {
        // Normalização de escala: Desfaz o zoom do visualizador para obter pontos reais do PDF
        const ptWidth = mold.width / zoom;
        const ptHeight = mold.height / zoom;
        const ptX = mold.x / zoom;

        // Inversão do Eixo Y: PDFs usam origem (0,0) no canto inferior esquerdo
        const ptY = origHeight - mold.y / zoom - ptHeight;

        const newPage = newPdf.addPage([ptWidth, ptHeight]);
        newPage.drawPage(embeddedPage, {
          x: -ptX,
          y: -ptY,
          width: origWidth,
          height: origHeight,
        });
      }

      const pdfBytes = await newPdf.save();
      downloadBlob(pdfBytes, `labels_page_${pageNumber}.pdf`);
    } catch (error) {
      console.error("Error processing PDF:", error);
      alert("Erro ao processar o PDF.");
    } finally {
      setIsCutting(false);
    }
  };

  const downloadBlob = (data: Uint8Array, fileName: string) => {
    // Forçamos o TypeScript a entender que isso é um ArrayBuffer limpo
    const blob = new Blob([data.buffer as ArrayBuffer], {
      type: "application/pdf",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col antialiased">
      <header className="bg-gray-800 p-4 border-b border-gray-700 flex items-center justify-between z-20">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <span className="text-red-500 text-2xl">🎯</span> PDF Label Cutter
        </h1>

        <div className="flex items-center gap-2 lg:gap-4">
          <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded flex items-center gap-2 transition-all">
            <Upload size={18} />
            <span className="hidden md:inline">Abrir PDF</span>
            <input
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={onFileChange}
            />
          </label>

          {pdfFile && (
            <>
              <div className="flex items-center bg-gray-700 rounded p-1">
                <button
                  onClick={() => changePage(-1)}
                  disabled={pageNumber <= 1 || isCutting}
                  className="p-1 hover:bg-gray-600 rounded disabled:opacity-30"
                >
                  <ChevronLeft size={20} />
                </button>
                <span className="text-xs px-2 min-w-[80px] text-center uppercase font-medium">
                  {pageNumber} / {numPages}
                </span>
                <button
                  onClick={() => changePage(1)}
                  disabled={pageNumber >= numPages || isCutting}
                  className="p-1 hover:bg-gray-600 rounded disabled:opacity-30"
                >
                  <ChevronRight size={20} />
                </button>
              </div>

              <div className="flex items-center bg-gray-700 rounded p-1">
                <button
                  onClick={zoomOut}
                  className="p-1 hover:bg-gray-600 rounded"
                >
                  <ZoomOut size={18} />
                </button>
                <span className="text-xs px-2 min-w-[50px] text-center font-mono">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  onClick={zoomIn}
                  className="p-1 hover:bg-gray-600 rounded"
                >
                  <ZoomIn size={18} />
                </button>
              </div>

              <div className="h-6 w-px bg-gray-600 hidden lg:block" />

              <div className="flex items-center gap-2">
                <button
                  onClick={spawnMold}
                  className="p-2 bg-green-600/20 text-green-400 hover:bg-green-600 hover:text-white rounded transition-all flex gap-2 items-center"
                >
                  <Crosshair size={18} />{" "}
                  <span className="hidden xl:inline text-sm font-bold">
                    Adicionar
                  </span>
                </button>
                <button
                  onClick={clearMolds}
                  disabled={molds.length === 0}
                  className="p-2 text-red-400 hover:bg-red-500/20 rounded transition-all"
                >
                  <Trash2 size={18} />
                </button>
              </div>

              <button
                onClick={executeTacticalCut}
                disabled={molds.length === 0 || isCutting}
                className="bg-red-600 hover:bg-red-700 px-6 py-2 rounded font-bold flex items-center gap-2 shadow-lg shadow-red-900/20 disabled:bg-gray-600 transition-all"
              >
                {isCutting ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Scissors size={18} />
                )}
                <span>{isCutting ? "Processando..." : "Gerar Etiquetas"}</span>
              </button>
            </>
          )}
        </div>
      </header>

      <main className="flex-1 bg-gray-800 overflow-auto p-4 md:p-10 flex justify-center items-start">
        {pdfFile ? (
          <div className="relative shadow-2xl bg-white border border-gray-600">
            <Document
              file={pdfFile}
              onLoadSuccess={({ numPages }) => setNumPages(numPages)}
              loading={
                <div className="p-20 text-gray-900 font-medium">
                  Renderizando documento...
                </div>
              }
            >
              <Page
                pageNumber={pageNumber}
                scale={zoom}
                renderTextLayer={false}
                renderAnnotationLayer={false}
              />
            </Document>

            {!isCutting &&
              molds.map((mold, index) => (
                <Rnd
                  key={mold.id}
                  size={{ width: mold.width, height: mold.height }}
                  position={{ x: mold.x, y: mold.y }}
                  bounds="parent"
                  style={{
                    border: "2px dashed #ef4444",
                    backgroundColor: "rgba(239, 68, 68, 0.15)",
                    zIndex: 10,
                  }}
                  // Tipagens explícitas injetadas aqui
                  onDragStop={(_e: any, d: { x: number; y: number }) => {
                    const newMolds = [...molds];
                    newMolds[index].x = d.x;
                    newMolds[index].y = d.y;
                    setMolds(newMolds);
                  }}
                  onResizeStop={(
                    _e: any,
                    _dir: any,
                    ref: HTMLElement,
                    _delta: any,
                    pos: { x: number; y: number },
                  ) => {
                    const newMolds = [...molds];
                    newMolds[index].width = parseInt(ref.style.width, 10);
                    newMolds[index].height = parseInt(ref.style.height, 10);
                    newMolds[index].x = pos.x;
                    newMolds[index].y = pos.y;
                    setMolds(newMolds);
                  }}
                  onContextMenu={(e: React.MouseEvent) => {
                    e.preventDefault();
                    toggleOrientation(index);
                  }}
                  onWheel={(e: React.WheelEvent) => handleWheelResize(e, index)}
                />
              ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-gray-500 h-full py-40">
            <div className="p-6 bg-gray-700 rounded-full mb-4 animate-pulse">
              <Upload size={48} />
            </div>
            <p className="text-lg font-medium">
              Aguardando carregamento de PDF
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
