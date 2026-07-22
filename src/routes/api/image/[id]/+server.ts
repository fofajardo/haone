import { json } from "@sveltejs/kit";
import { authenticateResident, serverError } from "$lib/server/api-helper";
import {
  getImageFromFirestore,
  deleteImageFromFirestore
} from "$lib/server/services/firestore-service";

export async function GET({ params }) {
  const { id } = params;

  try {
    const doc = await getImageFromFirestore(id);
    if (!doc) {
      return new Response("Image Not Found", { status: 404 });
    }

    const { dataUri, contentType } = doc;

    // Extract base64 from data URI
    const matches = dataUri.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) {
      return new Response("Invalid image data in Firestore", { status: 500 });
    }

    const base64Data = matches[2];

    // Convert base64 string back to binary
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    return new Response(bytes, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Length": bytes.length.toString()
      }
    });
  } catch (err: any) {
    return serverError(err.message, "Image Fetch");
  }
}

export async function DELETE({ params, request }) {
  const { id } = params;

  const auth = await authenticateResident(request);
  if (auth.error) return auth.error;

  try {
    await deleteImageFromFirestore(id);
    return json({ success: true });
  } catch (err: any) {
    return serverError(err.message, "Image Delete");
  }
}
