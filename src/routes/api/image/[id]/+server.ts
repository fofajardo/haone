import { authenticateResident } from "$api/services/auth-service";
import { serverError } from "$api/services/server-google-service";
import { deleteImageFromStorage, getImageFromStorage } from "$api/services/storage-service";
import { json } from "@sveltejs/kit";

export async function GET({ params }) {
  const { id } = params;

  try {
    const file = await getImageFromStorage(id);
    if (!file) {
      return new Response("Image Not Found", { status: 404 });
    }

    return new Response(file.data, {
      headers: {
        "Content-Type": file.contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Length": file.data.byteLength.toString()
      }
    });
  } catch (err: any) {
    return serverError(err.message, "Image Fetch");
  }
}

export async function DELETE({ params, request }) {
  const { id } = params;

  const auth = await authenticateResident(request);
  if (auth.error) {
    return auth.error;
  }

  try {
    await deleteImageFromStorage(id);
    return json({ success: true });
  } catch (err: any) {
    return serverError(err.message, "Image Delete");
  }
}
