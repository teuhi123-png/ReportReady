"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import * as pdfjsLib from "pdfjs-dist";
import { GlobalWorkerOptions } from "pdfjs-dist";

GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

type PageProps = {
  params: Promise<{
    fileName: string;
  }>;
};

function decodeFileName(rawName: string): string {
  return decodeURIComponent(rawName).replace(/\.(pdf|png|jpg|jpeg)$/i, "");
}

export default function PlanViewerPage({ params }: PageProps) {
  const searchParams = useSearchParams();
  const [fileName, setFileName] = useState("plan");
  const [pdfLib, setPdfLib] = useState<any>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pageCount, setPageCount] = useState(0);
  const [selectedPage, setSelectedPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [fitWidth, setFitWidth] = useState(true);
  const [mainImage, setMainImage] = useState("");
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const planUrl = searchParams?.get("planUrl") ?? "";
  const displayName = searchParams?.get("name") ?? fileName;

  useEffect(() => {
    let active = true;
    const resolveParams = async () => {
      const resolved = await params;
      if (!active) return;
      setFileName(decodeFileName(resolved.fileName));
    };
    void resolveParams();
    return () => {
      active = false;
    };
  }, [params]);

  useEffect(() => {
    let active = true;
    if (active) setPdfLib(pdfjsLib);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!pdfLib || !planUrl) return;
    let active = true;

    const run = async () => {
      setIsLoading(true);
      setError("");
      setMainImage("");
      setThumbnails([]);
      try {
        const loadingTask = pdfLib.getDocument({ url: planUrl });
        const doc = await loadingTask.promise;
        if (!active) return;

        setPdfDoc(doc);
        setPageCount(doc.numPages);
        setSelectedPage(1);

        const thumbs: string[] = [];
        for (let page = 1; page <= doc.numPages; page += 1) {
          const pdfPage = await doc.getPage(page);
          const viewport = pdfPage.getViewport({ scale: 0.2 });
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          canvas.width = Math.max(1, Math.floor(viewport.width));
          canvas.height = Math.max(1, Math.floor(viewport.height));
          await pdfPage.render({ canvasContext: ctx, viewport }).promise;
          thumbs.push(canvas.toDataURL("image/jpeg", 0.84));
        }

        if (active) {
          setThumbnails(thumbs);
        }
      } catch (renderError) {
        if (!active) return;
        setError(renderError instanceof Error ? renderError.message : "Failed to open PDF.");
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, [pdfLib, planUrl]);

  useEffect(() => {
    if (!pdfDoc || selectedPage < 1 || selectedPage > pageCount) return;
    let active = true;

    const renderSelected = async () => {
      try {
        const page = await pdfDoc.getPage(selectedPage);
        const baseViewport = page.getViewport({ scale: 1 });
        const containerWidth = viewportRef.current?.clientWidth ?? 1024;
        const fitScale = containerWidth > 0 ? (containerWidth - 28) / baseViewport.width : 1;
        const scale = Math.max(0.1, (fitWidth ? fitScale : 1) * zoom);
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        canvas.width = Math.max(1, Math.floor(viewport.width));
        canvas.height = Math.max(1, Math.floor(viewport.height));

        await page.render({ canvasContext: ctx, viewport }).promise;
        if (active) {
          setMainImage(canvas.toDataURL("image/png"));
        }
      } catch (pageError) {
        if (!active) return;
        setError(pageError instanceof Error ? pageError.message : "Failed to render page.");
      }
    };

    void renderSelected();

    return () => {
      active = false;
    };
  }, [pdfDoc, selectedPage, pageCount, fitWidth, zoom]);

  function onPrev(): void {
    setSelectedPage((prev) => Math.max(1, prev - 1));
  }

  function onNext(): void {
    setSelectedPage((prev) => Math.min(pageCount, prev + 1));
  }

  return (
    <div className="viewer-layout">
      <aside className="viewer-sidebar">
        <div className="viewer-header">
          <h1>Plan Viewer</h1>
          <p>{displayName}</p>
        </div>

        {!planUrl ? <div className="viewer-note">No plan URL found. Open this from Uploads.</div> : null}

        <div className="thumb-list">
          {Array.from({ length: pageCount || 0 }, (_, idx) => idx + 1).map((pageNum) => (
            <button
              key={pageNum}
              type="button"
              onClick={() => setSelectedPage(pageNum)}
              className={`thumb-item ${selectedPage === pageNum ? "active" : ""}`.trim()}
            >
              <div className="thumb-title">Page {pageNum}</div>
              {thumbnails[pageNum - 1] ? (
                <img src={thumbnails[pageNum - 1]} alt={`Page ${pageNum}`} />
              ) : (
                <div className="thumb-placeholder">Preview</div>
              )}
            </button>
          ))}
        </div>

        <div className="sidebar-links">
          <Link href="/uploads">Back to Uploads</Link>
          {planUrl ? (
            <a href={planUrl} target="_blank" rel="noreferrer">
              Open Original PDF
            </a>
          ) : null}
        </div>
      </aside>

      <main className="viewer-main">
        <div className="toolbar">
          <div className="toolbar-left">
            <button type="button" onClick={onPrev} disabled={selectedPage <= 1 || !pageCount}>
              Prev
            </button>
            <span>
              Page {pageCount ? selectedPage : 0} of {pageCount}
            </span>
            <button type="button" onClick={onNext} disabled={!pageCount || selectedPage >= pageCount}>
              Next
            </button>
          </div>
          <div className="toolbar-right">
            <button type="button" onClick={() => setZoom((prev) => Math.max(0.35, Number((prev - 0.15).toFixed(2))))} disabled={!pageCount}>
              Zoom -
            </button>
            <span>{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={() => setZoom((prev) => Math.min(3, Number((prev + 0.15).toFixed(2))))} disabled={!pageCount}>
              Zoom +
            </button>
            <button type="button" onClick={() => setFitWidth((prev) => !prev)} disabled={!pageCount}>
              {fitWidth ? "Fit width: On" : "Fit width: Off"}
            </button>
          </div>
        </div>

        <section className="viewer-canvas" ref={viewportRef}>
          {error ? <div className="viewer-error">{error}</div> : null}
          {isLoading ? <div className="viewer-note">Loading PDF...</div> : null}
          {!isLoading && !error && mainImage ? (
            <img src={mainImage} alt={`Plan page ${selectedPage}`} className="main-image" />
          ) : null}
          {!isLoading && !error && !mainImage && planUrl ? (
            <div className="viewer-note">Rendering pages...</div>
          ) : null}
        </section>
      </main>

      <style jsx>{`
        .viewer-layout {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 280px 1fr;
          background: #0b1020;
          color: #e5e7eb;
        }
        .viewer-sidebar {
          border-right: 1px solid #1f2937;
          padding: 16px;
          background: #0f172a;
          overflow: auto;
        }
        .viewer-header h1 {
          margin: 0;
          font-size: 20px;
        }
        .viewer-header p {
          margin: 8px 0 0;
          color: #94a3b8;
          font-size: 13px;
        }
        .thumb-list {
          margin-top: 14px;
          display: grid;
          gap: 10px;
        }
        .thumb-item {
          text-align: left;
          border-radius: 10px;
          padding: 8px;
          border: 1px solid #1f2937;
          background: #111827;
          color: #e5e7eb;
          cursor: pointer;
        }
        .thumb-item.active {
          border-color: #3b82f6;
          background: #1e293b;
        }
        .thumb-title {
          font-size: 12px;
          color: #94a3b8;
          margin-bottom: 6px;
        }
        .thumb-item img {
          width: 100%;
          border-radius: 8px;
          display: block;
          background: #020617;
        }
        .thumb-placeholder {
          border-radius: 8px;
          border: 1px dashed #334155;
          color: #94a3b8;
          font-size: 12px;
          text-align: center;
          padding: 18px 8px;
        }
        .sidebar-links {
          margin-top: 12px;
          display: grid;
          gap: 8px;
        }
        .sidebar-links a {
          color: #60a5fa;
          text-decoration: none;
          font-size: 14px;
        }
        .viewer-main {
          display: grid;
          grid-template-rows: auto 1fr;
          gap: 12px;
          padding: 16px;
        }
        .toolbar {
          border: 1px solid #1f2937;
          border-radius: 12px;
          background: #111827;
          padding: 12px;
          display: flex;
          justify-content: space-between;
          gap: 10px;
          flex-wrap: wrap;
        }
        .toolbar-left,
        .toolbar-right {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .toolbar button {
          border: 1px solid #334155;
          border-radius: 8px;
          background: #0f172a;
          color: #e5e7eb;
          padding: 6px 10px;
          cursor: pointer;
        }
        .toolbar button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .toolbar span {
          color: #94a3b8;
          font-size: 13px;
        }
        .viewer-canvas {
          border: 1px solid #1f2937;
          border-radius: 14px;
          background: #020617;
          overflow: auto;
          display: grid;
          place-items: center;
          padding: 12px;
        }
        .main-image {
          width: auto;
          max-width: 100%;
          height: auto;
          border: 1px solid #1f2937;
          border-radius: 8px;
          background: white;
        }
        .viewer-note {
          border: 1px dashed #334155;
          border-radius: 10px;
          color: #94a3b8;
          text-align: center;
          padding: 14px;
          font-size: 13px;
        }
        .viewer-error {
          border: 1px solid #ef4444;
          color: #fecaca;
          background: rgba(127, 29, 29, 0.25);
          border-radius: 10px;
          padding: 12px;
          max-width: 520px;
          margin-bottom: 8px;
        }
        @media (max-width: 900px) {
          .viewer-layout {
            grid-template-columns: 1fr;
          }
          .viewer-sidebar {
            border-right: none;
            border-bottom: 1px solid #1f2937;
            max-height: 45vh;
          }
        }
      `}</style>
    </div>
  );
}
