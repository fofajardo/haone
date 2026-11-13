import { getSupabaseAdmin } from "$api/services/common";

const STORAGE_BUCKET = "uploads";

/**
 * Uploads an image file to Supabase Storage.
 */
export async function uploadImageToStorage(id: string, data: ArrayBuffer, contentType: string) {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(id, data, {
    contentType,
    upsert: true
  });

  if (error) {
    throw new Error(`Supabase Storage upload failed: ${error.message}`);
  }

  return id;
}

/**
 * Retrieves an image from Supabase Storage.
 */
export async function getImageFromStorage(id: string) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).download(id);

  if (error) {
    if (error.message.includes("not found") || error.message.includes("Object not found")) {
      return null;
    }
    throw new Error(`Supabase Storage download failed: ${error.message}`);
  }

  return {
    data: await data.arrayBuffer(),
    contentType: data.type || "application/octet-stream"
  };
}

/**
 * Deletes an image from Supabase Storage.
 */
export async function deleteImageFromStorage(id: string) {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase.storage.from(STORAGE_BUCKET).remove([id]);

  if (error) {
    throw new Error(`Supabase Storage delete failed: ${error.message}`);
  }

  return true;
}
