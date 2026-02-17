import { put } from "@vercel/blob"


export const runtime = "nodejs"


export async function POST(req: Request) {
  try {


    const formData = await req.formData()


    const files = formData.getAll("files") as File[]


    if (!files || files.length === 0) {
      return Response.json(
        { success: false, error: "No files received" },
        { status: 400 }
      )
    }


    const uploadedFiles: Array<{ name: string; url: string; size: number }> = []


    for (const file of files) {


      if (!(file instanceof File)) continue


      // Upload to Vercel Blob
      const blob = await put(file.name, file, {
        access: "public"
      })


      uploadedFiles.push({
        name: file.name,
        url: blob.url,
        size: file.size
      })
    }


    return Response.json({
      success: true,
      files: uploadedFiles
    })


  } catch (error: any) {


    console.error("UPLOAD ERROR:", error)


    return Response.json(
      {
        success: false,
        error: error.message
      },
      { status: 500 }
    )
  }
}
