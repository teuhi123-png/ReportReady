"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type PageProps = {
  params: {
    fileName: string;
  };
};

function toTitleCaseName(rawName: string): string {
  return decodeURIComponent(rawName).replace(/\.(pdf|png|jpg|jpeg)$/i, "");
}

function getInitialImageUrls(imagesParam: string | null): string[] {
  if (!imagesParam) return [];
  return imagesParam
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => {
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    });
}

export default function PlanViewerPage({ params }: PageProps) {
  const searchParams = useSearchParams();
  const planUrl = searchParams?.get("planUrl") ?? "";
  const explicitName = searchParams?.get("name") ?? "";

  const imageUrls = useMemo(
    () => getInitialImageUrls(searchParams?.get("images") ?? null),
    [searchParams]
  );

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [zoom, setZoom] = useState(1);

  const activeImage = imageUrls[selectedIndex] ?? "";
  const displayName = explicitName || toTitleCaseName(params.fileName);

  function zoomIn(): void {
    setZoom((prev) => Math.min(3, Number((prev + 0.2).toFixed(2))));
  }

  function zoomOut(): void {
    setZoom((prev) => Math.max(0.4, Number((prev - 0.2).toFixed(2))));
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        gridTemplateColumns: "280px 1fr",
        background: "#0b1020",
        color: "#e5e7eb",
      }}
    >
      <aside
        style={{
          borderRight: "1px solid #1f2937",
          padding: "24px 16px",
          background: "#0f172a",
        }}
      >
        <div style={{ marginBottom: 16 }}>
          <h1 style={{ margin: 0, fontSize: 20 }}>Plan Pages</h1>
          <p style={{ margin: "8px 0 0", color: "#94a3b8", fontSize: 13 }}>{displayName}</p>
        </div>

        {imageUrls.length === 0 ? (
          <div
            style={{
              border: "1px solid #1f2937",
              borderRadius: 12,
              padding: 12,
              color: "#94a3b8",
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            No rendered page images are available yet for this plan.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {imageUrls.map((url, idx) => (
              <button
                key={`${url}-${idx}`}
                type="button"
                onClick={() => setSelectedIndex(idx)}
                style={{
                  textAlign: "left",
                  background: idx === selectedIndex ? "#1e293b" : "#111827",
                  border: idx === selectedIndex ? "1px solid #3b82f6" : "1px solid #1f2937",
                  color: "#e5e7eb",
                  borderRadius: 10,
                  padding: 8,
                  cursor: "pointer",
                }}
              >
                <div style={{ fontSize: 12, marginBottom: 6, color: "#94a3b8" }}>Page {idx + 1}</div>
                <img
                  src={url}
                  alt={`Plan page ${idx + 1}`}
                  style={{ width: "100%", borderRadius: 8, display: "block", background: "#0b1020" }}
                />
              </button>
            ))}
          </div>
        )}

        <div style={{ marginTop: 16, display: "grid", gap: 8 }}>
          <Link href="/uploads" style={{ color: "#60a5fa", textDecoration: "none", fontSize: 14 }}>
            Back to Uploads
          </Link>
          {planUrl ? (
            <a href={planUrl} target="_blank" rel="noreferrer" style={{ color: "#60a5fa", textDecoration: "none", fontSize: 14 }}>
              Open Original PDF
            </a>
          ) : null}
        </div>
      </aside>

      <main style={{ padding: 24, display: "grid", gridTemplateRows: "auto 1fr", gap: 16 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            border: "1px solid #1f2937",
            borderRadius: 14,
            padding: "12px 14px",
            background: "#111827",
          }}
        >
          <div>
            <div style={{ fontSize: 12, color: "#94a3b8" }}>Viewing</div>
            <div style={{ fontSize: 18 }}>{displayName}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button type="button" onClick={zoomOut} style={{ borderRadius: 8, border: "1px solid #334155", background: "#0f172a", color: "#e5e7eb", padding: "6px 12px", cursor: "pointer" }}>
              -
            </button>
            <div style={{ minWidth: 70, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
              {Math.round(zoom * 100)}%
            </div>
            <button type="button" onClick={zoomIn} style={{ borderRadius: 8, border: "1px solid #334155", background: "#0f172a", color: "#e5e7eb", padding: "6px 12px", cursor: "pointer" }}>
              +
            </button>
          </div>
        </div>

        <section
          style={{
            border: "1px solid #1f2937",
            borderRadius: 16,
            background: "#020617",
            display: "grid",
            placeItems: "center",
            overflow: "auto",
            padding: 20,
          }}
        >
          {activeImage ? (
            <img
              src={activeImage}
              alt="Selected plan page"
              style={{
                maxWidth: "100%",
                maxHeight: "calc(100vh - 220px)",
                transform: `scale(${zoom})`,
                transformOrigin: "center center",
                transition: "transform 120ms ease",
                borderRadius: 12,
                border: "1px solid #1f2937",
              }}
            />
          ) : (
            <div
              style={{
                border: "1px dashed #334155",
                borderRadius: 12,
                padding: 24,
                color: "#94a3b8",
                textAlign: "center",
                maxWidth: 420,
                lineHeight: 1.6,
              }}
            >
              Plan image previews are not available for this file yet.
              <br />
              Upload-generated page images can be passed via the <code>images</code> query parameter.
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
