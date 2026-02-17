import OpenAI from "openai"

export const runtime = "nodejs"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const planUrl = body.planUrl
    const message =
      body.message ||
      body.question ||
      body.prompt ||
      ""


    if (!message) {
      return Response.json(
        { success: false, error: "No message provided" },
        { status: 400 }
      )
    }


    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a construction plan assistant. Answer questions about building plans clearly."
        },
        {
          role: "user",
          content:
            `Plan URL: ${planUrl || "none"}\n\nQuestion: ${message}`
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
