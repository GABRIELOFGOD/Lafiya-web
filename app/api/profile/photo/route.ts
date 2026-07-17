import { NextResponse } from "next/server";
import sharp from "sharp";

import { createClient } from "@/lib/supabase/server";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "Photo must be under 5 MB." },
        { status: 400 },
      );
    }

    // Read the file into a Node Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Process the image: resize and strip EXIF (sharp strips EXIF by default)
    let sharpInstance = sharp(buffer);

    // Get metadata to confirm format
    const metadata = await sharpInstance.metadata();
    if (!metadata.format) {
      return NextResponse.json(
        { error: "Invalid image data" },
        { status: 400 },
      );
    }

    // Resize: max 800px on any side, keep aspect ratio
    sharpInstance = sharpInstance.resize({
      width: 800,
      height: 800,
      fit: "inside",
      withoutEnlargement: true,
    });

    let outputBuffer: Buffer;
    const mimeType = file.type;
    let extension = "jpg";

    if (file.type === "image/png") {
      outputBuffer = await sharpInstance.png().toBuffer();
      extension = "png";
    } else if (file.type === "image/webp") {
      outputBuffer = await sharpInstance.webp().toBuffer();
      extension = "webp";
    } else {
      outputBuffer = await sharpInstance.jpeg().toBuffer();
      extension = "jpg";
    }

    const path = `${user.id}/photo.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, outputBuffer, {
        upsert: true,
        contentType: mimeType,
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data } = supabase.storage.from("avatars").getPublicUrl(path);

    return NextResponse.json({ publicUrl: data.publicUrl });
  } catch (error: unknown) {
    console.error("Error handling avatar upload:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
