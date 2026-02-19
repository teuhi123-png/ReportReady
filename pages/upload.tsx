import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import type { ChangeEvent } from "react";
import Button from "../components/ui/Button";
import DashboardShell from "../components/DashboardShell";
import { clearSignedInEmail, readSignedInEmail } from "../lib/auth";

type UploadedPlan = {
  name: string;
  pdfFileName?: string;
  pdfKey?: string;
  pathname?: string;
  uploadedAt?: string;
  projectName?: string;
  url: string;
};

type UploadApiResponse = {
  success?: boolean;
  files?: UploadedPlan[];
  error?: string;
};

type UploadsApiResponse = {
  success?: boolean;
  files?: UploadedPlan[];
  items?: UploadedPlan[];
  error?: string;
};

function isJsonResponse(response: Response): boolean {
  const contentType = response.headers.get("content-type") ?? "";
  return contentType.toLowerCase().includes("application/json");
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatUploadedAt(uploadedAt?: string): string {
  if (!uploadedAt) return "Unknown upload date";
  const date = new Date(uploadedAt);
  if (Number.isNaN(date.getTime())) return "Unknown upload date";
  return date.toLocaleString();
}

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [email, setEmail] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [projectName, setProjectName] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedPlan[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingUploads, setIsLoadingUploads] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string>("");

  useEffect(() => {
    const signedInEmail = readSignedInEmail();
    if (!signedInEmail) {
      void router.replace(`/login?next=${encodeURIComponent("/uploads")}`);
      return;
    }
    setEmail(signedInEmail);
  }, [router]);

  const selectedSizeBytes = useMemo(() => {
    return selectedFiles.reduce((sum, file) => sum + file.size, 0);
  }, [selectedFiles]);

  async function fetchUploadedPDFs(currentEmail: string): Promise<void> {
    try {
      const response = await fetch(`/api/uploads?userEmail=${encodeURIComponent(currentEmail)}`);
      if (!response.ok) {
        throw new Error("Could not load uploaded files yet.");
      }

      if (!isJsonResponse(response)) {
        throw new Error("Could not load uploaded files yet.");
      }

      const payload = (await response.json()) as UploadsApiResponse;
      if (payload.success === false) throw new Error(payload.error ?? "Could not load uploaded files yet.");
      if (payload.error) throw new Error(payload.error);
      setUploadedFiles(payload.files ?? payload.items ?? []);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not load uploaded files yet.";
      setStatusMessage(message);
    } finally {
      setIsLoadingUploads(false);
    }
  }

  useEffect(() => {
    if (!email) return;
    setIsLoadingUploads(true);
    void fetchUploadedPDFs(email);
  }, [email]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>): void {
    const files = Array.from(event.target.files ?? []);
    setSelectedFiles(files);

    if (files.length === 0) {
      setStatusMessage("Select one or more PDF files to upload.");
      return;
    }

    setStatusMessage(`${files.length} PDF file${files.length === 1 ? "" : "s"} selected.`);
  }

  async function onUpload(): Promise<void> {
    if (selectedFiles.length === 0 || isUploading) return;

    setIsUploading(true);
    setStatusMessage("Uploading plans...");

    try {
      const formData = new FormData();
      formData.append("projectName", projectName.trim());
      formData.append("userEmail", email);
      for (const file of selectedFiles) {
        formData.append("files", file);
      }

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as UploadApiResponse;
      console.log("UPLOAD RESPONSE:", payload);

      if (!response.ok || payload.success === false) {
        throw new Error(payload.error ?? "Upload failed. Please try again.");
      }

      if (payload.success !== true) {
        throw new Error("Upload failed");
      }

      const uploaded = payload.files ?? [];
      const savedProjectName = uploaded[0]?.projectName ?? "Untitled Project";
      setStatusMessage(
        `Successfully uploaded ${uploaded.length} PDF plan${
          uploaded.length === 1 ? "" : "s"
        } to ${savedProjectName}.`
      );
      setSelectedFiles([]);
      setProjectName("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      await fetchUploadedPDFs(email);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed";
      setStatusMessage(message);
    } finally {
      setIsUploading(false);
    }
  }

  function onLogout(): void {
    clearSignedInEmail();
    void router.push("/login?next=/uploads");
  }

  return (
    <DashboardShell
      pageTitle="Uploads"
      email={email}
      statusText={isUploading ? "Uploading..." : "Ready"}
      actions={
        <>
          <Link href="/chat">
            <Button variant="secondary">Go to Chat</Button>
          </Link>
          <Button variant="secondary" onClick={onLogout}>
            Log out
          </Button>
        </>
      }
    >
      <div className="upload-grid">
        <section className="card">
          <div className="card-body upload-card">
            <div className="upload-header">
              <h2 className="h2">Upload Site Plans</h2>
              <p className="muted">Upload PDFs and open them directly from your project list.</p>
            </div>

            <label className="input-field" htmlFor="project-name">
              <div className="label">Project name</div>
              <input
                id="project-name"
                type="text"
                className="input"
                placeholder="Project name (optional)"
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
              />
            </label>

            <label className="upload-dropzone" htmlFor="site-plan-upload">
              <span className="label">PDF files</span>
              <span className="upload-dropzone-title">Choose files to upload</span>
              <span className="muted">Drag-and-drop look enabled. Click to browse your files.</span>
              <input
                id="site-plan-upload"
                ref={fileInputRef}
                type="file"
                className="input upload-file-input"
                accept="application/pdf,.pdf"
                multiple
                onChange={handleFileChange}
              />
            </label>

            {selectedFiles.length > 0 && (
              <div className="selection-list">
                <div className="label">Selected files ({selectedFiles.length})</div>
                <ul>
                  {selectedFiles.map((file, index) => (
                    <li key={`${file.name}-${file.size}-${index}`}>
                      <span>{file.name}</span>
                      <span className="muted">{formatFileSize(file.size)}</span>
                    </li>
                  ))}
                </ul>
                <div className="muted">Total size: {formatFileSize(selectedSizeBytes)}</div>
              </div>
            )}

            <div className="upload-actions">
              <Button type="button" onClick={onUpload} loading={isUploading} disabled={selectedFiles.length === 0}>
                Upload PDF
              </Button>
              <Link href="/chat">
                <Button variant="secondary">Go to Chat</Button>
              </Link>
            </div>

            {statusMessage ? <div className="upload-status">{statusMessage}</div> : null}
          </div>
        </section>

        <section className="card">
          <div className="card-body upload-table-wrap">
            <h2 className="h2">Uploaded PDFs</h2>
            {isLoadingUploads ? (
              <div className="muted">Loading uploads...</div>
            ) : uploadedFiles.length === 0 ? (
              <div className="muted">No PDFs uploaded yet.</div>
            ) : (
              <div className="upload-table">
                <div className="upload-row upload-row-head">
                  <span>File name</span>
                  <span>Project</span>
                  <span>Uploaded</span>
                  <span>Action</span>
                </div>
                {uploadedFiles.map((file) => (
                  <div className="upload-row" key={`${file.url}-${file.uploadedAt ?? "unknown"}`}>
                    <span className="upload-name">{file.name}</span>
                    <span>{file.projectName ?? "Untitled Project"}</span>
                    <span>{formatUploadedAt(file.uploadedAt)}</span>
                    <span>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() =>
                          void router.push(
                            `/chat?pdfFileName=${encodeURIComponent(file.pdfFileName ?? file.name)}&name=${encodeURIComponent(file.name)}&planUrl=${encodeURIComponent(file.url)}`
                          )
                        }
                      >
                        Analyse
                      </Button>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
