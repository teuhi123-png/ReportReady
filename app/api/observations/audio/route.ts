import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";

const AUDIO_BUCKET = process.env.SUPABASE_OBSERVATION_AUDIO_BUCKET || "observation-audio";

function sanitizePathPart(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "");
}

function extensionFromMimeType(mimeType: string) {
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("mpeg")) return "mp3";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("wav")) return "wav";
  return "webm";
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("audio");
  const studentId = sanitizePathPart(String(formData.get("student_id") || "unknown"));

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Audio file is required." }, { status: 400 });
  }

  if (!file.type.startsWith("audio/")) {
    return NextResponse.json({ error: "Invalid file type." }, { status: 400 });
  }

  const ext = extensionFromMimeType(file.type);
  const path = `${sanitizePathPart(user.id)}/${studentId}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage.from(AUDIO_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(AUDIO_BUCKET).getPublicUrl(path);

  return NextResponse.json({ url: publicUrl, path, bucket: AUDIO_BUCKET });
}
