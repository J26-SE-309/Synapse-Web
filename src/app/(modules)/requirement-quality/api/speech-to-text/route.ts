
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Speech recognition is not configured." },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const audio = formData.get("audio");

    if (!(audio instanceof File)) {
      return NextResponse.json(
        { error: "An audio recording is required." },
        { status: 400 }
      );
    }

    if (audio.size === 0 || audio.size > 25 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Audio must be between 1 byte and 25 MB." },
        { status: 400 }
      );
    }

    const groqForm = new FormData();
    groqForm.append("file", audio);
    groqForm.append("model", "whisper-large-v3-turbo");
    groqForm.append("language", "en");
    groqForm.append("response_format", "json");

    const response = await fetch(
      "https://api.groq.com/openai/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: groqForm,
        signal: AbortSignal.timeout(60000),
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            response.status === 429
              ? "Speech recognition limit reached. Please try again later."
              : "Speech recognition failed. Please try again.",
        },
        { status: response.status === 429 ? 429 : 502 }
      );
    }

    const result: unknown = await response.json();

    if (
      typeof result !== "object" ||
      result === null ||
      !("text" in result) ||
      typeof result.text !== "string"
    ) {
      return NextResponse.json(
        { error: "Invalid transcription response." },
        { status: 502 }
      );
    }

    return NextResponse.json({ text: result.text });
  } catch {
    return NextResponse.json(
      { error: "Unable to process the audio recording." },
      { status: 500 }
    );
  }
}
