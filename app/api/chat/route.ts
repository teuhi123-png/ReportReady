import OpenAI from "openai";
import { NextResponse } from "next/server";


const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});


export async function POST(req: Request) {
  try {
    const { message } = await req.json();


    if (!message) {
      return NextResponse.json(
        { success: false, error: "No message provided" },
        { status: 400 }
      );
    }


    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a helpful building plan assistant.",
        },
        {
          role: "user",
          content: message,
        },
      ],
    });


    const reply = completion.choices[0].message.content;


    return NextResponse.json({
      success: true,
      reply,
    });


  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Server error" },
      { status: 500 }
    );
  }
}
