import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { ChangeEvent } from "react";
import Button from "../components/ui/Button";

type UploadedPlan = {
  name: string;
  uploadedAt: string;
};

type UploadApiResponse = {
  ok: boolean;
  files?: UploadedPlan[];
  error?: string;
};

type UploadsApiResponse = {
  files?: UploadedPlan[];
  error?: string;
};

export default function UploadPage() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedPlan[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingUploads, setIsLoadingUploads] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string>("");

  const selectedSizeMb = useMemo(() => {
    const bytes = selectedFiles.reduce((sum, file) => sum + file.size, 0);
    return bytes / (1024 * 1024);
  }, [selectedFiles]);

  async function loadUploads(): Promise<void> {
    try {
      const response = await fetch("/api/uploads");
      const payload = (await response.json()) as UploadsApiResponse;
      if (!response.ok || payload.error) {
        throw new Error(payload.error ?? "Failed loading uploads");
      }
      setUploadedFiles(payload.files ?? []);
    } catch {
      setStatusMessage("Could not load uploaded files yet.");
    } finally {
      setIsLoadingUploads(false);
    }
  }

  useEffect(() => {
    void loadUploads();
  }, []);

  function onFilesChange(event: ChangeEvent<HTMLInputElement>): void {
    const picked = Array.from(event.target.files ?? []);
    const pdfOnly = picked.filter(
      (file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
    );

    setSelectedFiles(pdfOnly);

    if (pdfOnly.length === 0) {
      setStatusMessage("Select one or more PDF files to upload.");
      return;
    }

    setStatusMessage(`${pdfOnly.length} PDF file${pdfOnly.length === 1 ? "" : "s"} selected.`);
  }

  async function onUpload(): Promise<void> {
    if (selectedFiles.length === 0 || isUploading) return;

    setIsUploading(true);
    setStatusMessage("Uploading plans...");

    try {
      const formData = new FormData();
      selectedFiles.forEach((file) => {
        formData.append("plans", file, file.name);
      });

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as UploadApiResponse;

      if (!response.ok) {
        const message = payload.error ?? "Upload failed";
        throw new Error(message);
      }

      if (!payload.ok || !payload.files) {
        throw new Error(payload.error ?? "Upload failed");
      }

      setStatusMessage(
        `Successfully uploaded ${payload.files.length} PDF plan${payload.files.length === 1 ? "" : "s"}.`
      );
      setSelectedFiles([]);
      await loadUploads();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed";
      setStatusMessage(message);
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <main className="page">
      <div className="container">
        <section className="card">
          <div className="card-body" style={{ display: "grid", gap: 14 }}>
            <div>
              <h1 className="h1" style={{ marginBottom: 8 }}>
                Upload Site Plans
              </h1>
              <p className="muted" style={{ margin: 0 }}>
                Upload one or more PDF files and keep a running list of plans saved on the server.
              </p>
            </div>

            <label className="input-field" htmlFor="site-plan-upload">
              <div className="label">PDF files</div>
              <input
                id="site-plan-upload"
                type="file"
                className="input"
                accept="application/pdf,.pdf"
                multiple
                onChange={onFilesChange}
              />
            </label>

            {selectedFiles.length > 0 && (
              <div className="card" style={{ borderRadius: 12 }}>
                <div className="card-body" style={{ padding: "12px 14px", display: "grid", gap: 8 }}>
                  <div className="label" style={{ marginBottom: 0 }}>
                    Selected files ({selectedFiles.length})
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4 }}>
                    {selectedFiles.map((file, index) => (
                      <li key={`${file.name}-${file.size}-${index}`} style={{ wordBreak: "break-word" }}>
                        {file.name}
                      </li>
                    ))}
                  </ul>
                  <div className="muted">Total size: {selectedSizeMb.toFixed(2)} MB</div>
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button onClick={onUpload} loading={isUploading} disabled={selectedFiles.length === 0}>
                Upload Plans
              </Button>
              <Link href="/">
                <Button variant="secondary">Back Home</Button>
              </Link>
            </div>

            {statusMessage && <div className="muted">{statusMessage}</div>}
          </div>
        </section>

        <section className="card">
          <div className="card-body" style={{ display: "grid", gap: 10 }}>
            <div className="h2" style={{ marginBottom: 0 }}>
              Uploaded PDFs
            </div>
            {isLoadingUploads ? (
              <div className="muted">Loading uploads...</div>
            ) : uploadedFiles.length === 0 ? (
              <div className="muted">No PDFs uploaded yet.</div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {uploadedFiles.map((file) => (
                  <div
                    key={`${file.name}-${file.uploadedAt}`}
                    className="card"
                    style={{ borderRadius: 12, boxShadow: "none" }}
                  >
                    <div
                      className="card-body"
                      style={{
                        padding: "10px 12px",
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 8,
                        flexWrap: "wrap",
                      }}
                    >
                      <strong style={{ wordBreak: "break-word" }}>{file.name}</strong>
                      <span className="muted">{new Date(file.uploadedAt).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
