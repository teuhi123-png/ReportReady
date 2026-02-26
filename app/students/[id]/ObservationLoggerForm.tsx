"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type SubjectValue = "reading" | "maths" | "general";
type RatingValue = "needs_support" | "on_track" | "excelling";

type GroupLevels = {
  reading?: string | null;
  maths?: string | null;
  general?: string | null;
};

type Props = {
  studentId: string;
  classId: string;
  studentFirstName: string;
  classYearLevel?: string | null;
  defaultSubject: SubjectValue;
  groupLevels: GroupLevels;
};

const SUBJECTS: Array<{ label: string; value: SubjectValue }> = [
  { label: "Reading", value: "reading" },
  { label: "Maths", value: "maths" },
  { label: "General", value: "general" },
];

const RATINGS: Array<{ label: string; value: RatingValue }> = [
  { label: "Needs Support", value: "needs_support" },
  { label: "On Track", value: "on_track" },
  { label: "Excelling", value: "excelling" },
];

function getCurrentTermAndYear(now = new Date()) {
  const month = now.getMonth() + 1;
  let term = 1;

  if (month >= 4 && month <= 6) term = 2;
  if (month >= 7 && month <= 9) term = 3;
  if (month >= 10) term = 4;

  return { term, year: now.getFullYear() };
}

export default function ObservationLoggerForm({
  studentId,
  classId,
  studentFirstName,
  classYearLevel,
  defaultSubject,
  groupLevels,
}: Props) {
  const router = useRouter();
  const [subject, setSubject] = useState<SubjectValue>(defaultSubject);
  const [rating, setRating] = useState<RatingValue | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [recordingSupported, setRecordingSupported] = useState(true);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const displayedGroupLevel = useMemo(() => {
    const fromSubject = groupLevels[subject];
    if (fromSubject && String(fromSubject).trim()) return fromSubject;
    if (classYearLevel && String(classYearLevel).trim()) return classYearLevel;
    return "Not set";
  }, [classYearLevel, groupLevels, subject]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setRecordingSupported(
      typeof navigator !== "undefined" &&
        !!navigator.mediaDevices?.getUserMedia &&
        typeof MediaRecorder !== "undefined",
    );
  }, []);

  useEffect(() => {
    return () => {
      if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
      mediaRecorderRef.current?.stop();
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [audioPreviewUrl]);

  async function startRecording() {
    if (!recordingSupported || isRecording) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        setAudioBlob(blob);
        if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
        setAudioPreviewUrl(URL.createObjectURL(blob));
        mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      };

      recorder.start();
      setIsRecording(true);
      setError(null);
    } catch {
      setError("Microphone access was denied or unavailable.");
    }
  }

  function stopRecording() {
    if (!isRecording) return;
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  }

  async function uploadAudioClip(blob: Blob) {
    const formData = new FormData();
    formData.append("student_id", studentId);
    formData.append("audio", new File([blob], `observation-${Date.now()}.webm`, { type: blob.type }));

    const uploadResponse = await fetch("/api/observations/audio", {
      method: "POST",
      body: formData,
    });

    if (!uploadResponse.ok) {
      const payload = await uploadResponse.json().catch(() => null);
      throw new Error(payload?.error || "Could not upload audio.");
    }

    const payload = await uploadResponse.json();
    return String(payload.url);
  }

  async function handleSave() {
    if (!rating || saving) return;
    if (isRecording) {
      setError("Stop recording before saving.");
      return;
    }

    setSaving(true);
    setError(null);

    const { term, year } = getCurrentTermAndYear();
    let noteAudioUrl: string | null = null;

    if (audioBlob) {
      try {
        noteAudioUrl = await uploadAudioClip(audioBlob);
      } catch (uploadError) {
        const message =
          uploadError instanceof Error ? uploadError.message : "Could not upload audio clip.";
        setError(message);
        setSaving(false);
        return;
      }
    }

    const response = await fetch("/api/observations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        student_id: studentId,
        subject,
        rating,
        note: note.trim() || null,
        note_audio_url: noteAudioUrl,
        term,
        year,
        created_at: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setError(payload?.error || "Could not save observation.");
      setSaving(false);
      return;
    }

    setSaved(true);

    setTimeout(() => {
      router.push(`/classes/${classId}`);
      router.refresh();
    }, 1500);
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5">
      <div className="mx-auto w-full max-w-md">
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h1 className="text-4xl font-bold leading-tight text-slate-900">{studentFirstName}</h1>
          <p className="mt-2 text-sm font-medium text-slate-500">Subject being observed</p>
          <p className="text-2xl font-semibold text-slate-900">
            {SUBJECTS.find((s) => s.value === subject)?.label}
          </p>
          <p className="mt-3 text-sm font-medium text-slate-500">Group level</p>
          <p className="text-xl font-semibold text-slate-900">{displayedGroupLevel}</p>

          <section className="mt-6">
            <p className="mb-2 text-sm font-semibold text-slate-700">Subject</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {SUBJECTS.map((item) => {
                const active = subject === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setSubject(item.value)}
                    className={`min-h-[68px] rounded-xl border-2 px-4 text-lg font-semibold transition ${
                      active
                        ? "border-emerald-700 bg-emerald-700 text-white"
                        : "border-slate-300 bg-white text-slate-900"
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="mt-5">
            <p className="mb-2 text-sm font-semibold text-slate-700">Rating</p>
            <div className="grid grid-cols-3 gap-2">
              {RATINGS.map((item) => {
                const active = rating === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setRating(item.value)}
                    className={`min-h-[68px] rounded-xl border-2 px-2 text-center text-base font-semibold leading-tight transition ${
                      active
                        ? "border-emerald-700 bg-emerald-700 text-white"
                        : "border-slate-300 bg-white text-slate-900"
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="mt-5">
            <p className="mb-2 text-sm font-semibold text-slate-700">Voice note (optional)</p>
            <div className="space-y-2">
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                disabled={!recordingSupported || saving}
                className={`w-full rounded-xl px-4 py-4 text-lg font-semibold text-white transition ${
                  isRecording ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"
                } disabled:cursor-not-allowed disabled:bg-slate-300`}
              >
                {isRecording ? "Stop Recording" : "Tap to Record"}
              </button>
              {!recordingSupported && (
                <p className="text-sm text-slate-500">Voice recording is not supported on this device.</p>
              )}
              {audioPreviewUrl && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="mb-2 text-sm font-medium text-slate-700">Recording ready</p>
                  <audio controls src={audioPreviewUrl} className="w-full" />
                </div>
              )}
            </div>
          </section>

          <section className="mt-5">
            <label htmlFor="note" className="mb-2 block text-sm font-semibold text-slate-700">
              Note (optional)
            </label>
            <textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Add a quick note..."
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base text-slate-900 outline-none ring-emerald-200 transition focus:border-emerald-600 focus:ring-2"
            />
          </section>

          {error && (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={!rating || saving}
            className="mt-5 w-full rounded-xl bg-emerald-600 px-4 py-4 text-lg font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>

        {saved && (
          <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-base font-semibold text-emerald-700">
            Saved!
          </p>
        )}
      </div>
    </main>
  );
}
