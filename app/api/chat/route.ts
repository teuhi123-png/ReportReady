import OpenAI from "openai"
import { PDFParse } from "pdf-parse"

export const runtime = "nodejs"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function POST(req: Request) {
  try {
    const { message, pdfUrl } = await req.json()

    if (!message) {
      return Response.json({
        success: false,
        error: "No message provided"
      }, { status: 400 })
    }

    if (!pdfUrl) {
      return Response.json({
        success: false,
        error: "No pdfUrl provided"
      }, { status: 400 })
    }

    const pdfResponse = await fetch(pdfUrl)
    if (!pdfResponse.ok) {
      return Response.json({
        success: false,
        error: `Failed to download PDF (${pdfResponse.status})`
      }, { status: 400 })
    }

    const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer())
    const parser = new PDFParse({ data: pdfBuffer })
    let pdfText = ""
    try {
      const parsed = await parser.getText()
      pdfText = parsed.text ?? ""
    } finally {
      await parser.destroy()
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a building plan assistant. Answer using the PDF content."
        },
        {
          role: "user",
          content:
            "PDF CONTENT:\n" +
            pdfText +
            "\n\nQUESTION:\n" +
            message
        }
      ]
    })

    const assistantReply = completion.choices[0]?.message?.content ?? ""

    return Response.json({
      success: true,
      reply: assistantReply,
      answer: assistantReply
    })
  } catch (error: any) {
    console.error("CHAT ERROR:", error)
    return Response.json({
      success: false,
      error: error?.message || "Failed to process chat request"
    }, { status: 500 })
  }
}
