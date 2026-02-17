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
      return Response.json(
        { success: false, error: "No message provided" },
        { status: 400 }
      )
    }

    if (!pdfUrl) {
      return Response.json(
        { success: false, error: "No PDF URL provided" },
        { status: 400 }
      )
    }

    const pdfResponse = await fetch(pdfUrl)
    if (!pdfResponse.ok) {
      return Response.json(
        { success: false, error: `Failed to fetch PDF (${pdfResponse.status})` },
        { status: 400 }
      )
    }
    const pdfBuffer = await pdfResponse.arrayBuffer()

    const parser = new PDFParse({ data: Buffer.from(pdfBuffer) })
    let pdfText = ""
    try {
      const pdfData = await parser.getText()
      pdfText = pdfData.text
    } finally {
      await parser.destroy()
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a building plan assistant. Answer ONLY using the provided plan text."
        },
        {
          role: "user",
          content:
            `
PLAN TEXT:
${pdfText}


QUESTION:
${message}
`
        }
      ]
    })


    return Response.json({
      success: true,
      answer: completion.choices[0].message.content
    })


  } catch (error: any) {


    console.error(error)


    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
