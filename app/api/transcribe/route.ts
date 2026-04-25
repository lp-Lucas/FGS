import { NextResponse } from "next/server";

const MAX_INLINE_BYTES = 4 * 1024 * 1024;

function extractOutputText(data: {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}) {
  return data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Configure GEMINI_API_KEY no .env.local para transcrever com Gemini." },
      { status: 400 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("video");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Envie um arquivo de video." }, { status: 400 });
  }

  if (file.size > MAX_INLINE_BYTES) {
    return NextResponse.json(
      {
        error:
          "Este video esta grande para transcricao na Vercel. Use um arquivo de ate 4 MB ou comprima/corte o video."
      },
      { status: 413 }
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text:
                  "Transcreva o audio deste video em portugues do Brasil. Retorne apenas a transcricao, em texto limpo. Quando possivel, organize em blocos com timestamps aproximados no formato [MM:SS]. Nao resuma."
              },
              {
                inline_data: {
                  mime_type: file.type || "video/mp4",
                  data: base64
                }
              }
            ]
          }
        ]
      })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();

    return NextResponse.json(
      { error: `O Gemini nao conseguiu transcrever agora. ${errorText}` },
      { status: 500 }
    );
  }

  const data = await response.json();
  const transcript = extractOutputText(data);

  if (!transcript) {
    return NextResponse.json(
      { error: "O Gemini nao retornou uma transcricao valida." },
      { status: 500 }
    );
  }

  return NextResponse.json({ transcript });
}
