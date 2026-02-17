# SiteMind AI Assistant

## API routes used by the app

- Upload page:
  - `POST /api/upload`
  - `GET /api/uploads`
- Chat page:
  - `POST /api/chat`

All API error paths return JSON.

## Vercel production env checklist

Required:
- `OPENAI_API_KEY`
- `BLOB_READ_WRITE_TOKEN`

Optional:
- KV vars: none currently used (metadata is persisted in Blob as JSON alongside uploaded PDFs).

## Upload persistence model

- PDFs are stored in Vercel Blob.
- Metadata persisted per upload: `name`, `projectName`, `url`, `uploadedAt`.
- On Vercel, upload/list/chat requires `BLOB_READ_WRITE_TOKEN` and does not rely on local filesystem persistence.
