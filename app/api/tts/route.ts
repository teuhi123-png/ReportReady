export const runtime = "nodejs";

import { NextRequest } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
 apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
 try {

  const { text } = await req.json();

  if (!text) {
   return Response.json({ error: "Missing text" }, { status: 400 });
  }

  const speech = await openai.audio.speech.create({
   model: "gpt-4o-mini-tts",
   voice: "alloy",
   input: text,
   response_format: "mp3",
  });

  const buffer = await speech.arrayBuffer();

  return new Response(buffer, {
   headers: {
    "Content-Type": "audio/mpeg",
   },
  });

 } catch (err: any) {

  return Response.json({
   error: err.message || "TTS failed"
  }, { status: 500 });

 }
}
