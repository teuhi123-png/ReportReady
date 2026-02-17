import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import type { ChangeEvent } from "react";
import Button from "../components/ui/Button";
import { clearSignedInEmail, readSignedInEmail } from "../lib/auth";

type UploadedPlan = {
  name: string;
  uploadedAt: string;
  projectName: string;
  url: string;
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

function isJsonResponse(response: Response): boolean {
  const contentType = response.headers.get("content-type") ?? "";
  return contentType.toLowerCase().includes("application/json");
}

export default function UploadPage() {
  const router = useRouter();
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

  const selectedSizeMb = useMemo(() => {
    const bytes = selectedFiles.reduce((sum, file) => sum + file.size, 0);
    return bytes / (1024 * 1024);
  }, [selectedFiles]);

  async function loadUploads(currentEmail: string): Promise<void> {
    try {
      const response = await fetch(`/api/uploads?userEmail=${encodeURIComponent(currentEmail)}`);
      if (!response.ok) {
        throw new Error("Could not load uploaded files yet.");
      }

      if (!isJsonResponse(response)) {
        throw new Error("Could not load uploaded files yet.");
      }

      const payload = (await response.json()) as UploadsApiResponse;
      if (payload.error) throw new Error(payload.error);
      setUploadedFiles(payload.files ?? []);
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
    void loadUploads(email);
  }, [email]);

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
      formData.append("projectName", projectName.trim());
      formData.append("userEmail", email);
      selectedFiles.forEach((file) => {
        formData.append("plans", file, file.name);
      });

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed. Please try again.");
      }

      if (!isJsonResponse(response)) {
        throw new Error("Upload failed due to an invalid server response.");
      }

      const payload = (await response.json()) as UploadApiResponse;

      if (!payload.ok || !payload.files) {
        throw new Error(payload.error ?? "Upload failed");
      }

      const savedProjectName = payload.files[0]?.projectName ?? "Untitled Project";
      setStatusMessage(
        `Successfully uploaded ${payload.files.length} PDF plan${
          payload.files.length === 1 ? "" : "s"
        } to ${savedProjectName}.`
      );
      setSelectedFiles([]);
      setProjectName("");
      await loadUploads(email);
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
    <main className="page">
      <div className="container">
        <section className="card">
          <div className="card-body" style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div>
                <h1 className="h1" style={{ marginBottom: 8 }}>
                  Upload Site Plans
                </h1>
                <p className="muted" style={{ margin: 0 }}>
                  Signed in as {email || "..."}. Upload PDFs and open them directly from the list.
                </p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Link href="/chat">
                  <Button variant="secondary">Go to Chat</Button>
                </Link>
                <Button variant="secondary" onClick={onLogout}>
                  Log out
                </Button>
              </div>
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
              <Link href="/chat">
                <Button variant="secondary">Go to Chat</Button>
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
                      <div style={{ display: "grid", gap: 3 }}>
                        <strong style={{ wordBreak: "break-word" }}>{file.name}</strong>
                        <span className="muted">Project: {file.projectName}</span>
                        <span className="muted">{new Date(file.uploadedAt).toLocaleString()}</span>
                      </div>
                      <a href={file.url} target="_blank" rel="noreferrer">
                        <Button variant="secondary">View Plan</Button>
                      </a>
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
