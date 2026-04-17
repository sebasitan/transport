import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";

const ALLOWED_FOLDERS = ['drivers', 'vehicles', 'uploads'];
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif'];

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const folder = (formData.get("folder") as string) || "drivers";

    if (!file) {
      return NextResponse.json({ error: "No file received" }, { status: 400 });
    }

    // Validate folder (prevent path traversal)
    const cleanFolder = path.basename(folder);
    if (!ALLOWED_FOLDERS.includes(cleanFolder)) {
      return NextResponse.json({ error: "Invalid upload folder" }, { status: 400 });
    }

    // Validate file extension
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json({ error: `File type .${ext} not allowed. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}` }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const filename = `upload-${Date.now()}.${ext}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads", cleanFolder);

    await fs.mkdir(uploadDir, { recursive: true });

    const filePath = path.join(uploadDir, filename);
    await fs.writeFile(filePath, buffer);

    const url = `/uploads/${cleanFolder}/${filename}`;
    return NextResponse.json({ url });
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
