import { supabase } from "@/lib/supabase";

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function uploadCover(file: File, userId: string): Promise<string> {
  const ext = TYPES[file.type];

  if (!ext) {
    throw new Error("Please choose a JPG, PNG or WebP image.");
  }

  if (file.size > MAX_BYTES) {
    throw new Error("That image is too large. The limit is 5 MB.");
  }

  const path = `${userId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from("book-covers")
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) {
    throw new Error("Couldn't upload the cover: " + error.message);
  }

  return supabase.storage.from("book-covers").getPublicUrl(path).data.publicUrl;
}