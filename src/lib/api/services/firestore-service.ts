import { GOOGLE_SERVICE_ACCOUNT_JSON } from "$env/static/private";
import { fetchGoogleAPI, getFirebaseToken } from "$lib/server/api-helper";

const FIRESTORE_UPLOADS_COLLECTION = "uploads";

/**
 * Saves a base64 image data URI to Firestore.
 */
export async function saveImageToFirestore(id: string, dataUri: string, contentType: string) {
  const token = await getFirebaseToken();
  const keys = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON);
  const projectId = keys.project_id;

  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${FIRESTORE_UPLOADS_COLLECTION}?documentId=${id}`;

  await fetchGoogleAPI(url, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fields: {
        data: { stringValue: dataUri },
        contentType: { stringValue: contentType },
        createdAt: { timestampValue: new Date().toISOString() }
      }
    })
  });

  return id;
}

/**
 * Retrieves image data from Firestore.
 */
export async function getImageFromFirestore(id: string) {
  const token = await getFirebaseToken();
  const keys = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON);
  const projectId = keys.project_id;

  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${FIRESTORE_UPLOADS_COLLECTION}/${id}`;

  try {
    const resp = await fetchGoogleAPI(url, token);
    const doc = await resp.json();
    return {
      dataUri: doc.fields.data.stringValue,
      contentType: doc.fields.contentType.stringValue
    };
  } catch (err: any) {
    if (err.message.includes("(404)")) return null;
    throw err;
  }
}

/**
 * Deletes an image from Firestore.
 */
export async function deleteImageFromFirestore(id: string) {
  const token = await getFirebaseToken();
  const keys = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON);
  const projectId = keys.project_id;

  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${FIRESTORE_UPLOADS_COLLECTION}/${id}`;

  try {
    await fetchGoogleAPI(url, token, { method: "DELETE" });
    return true;
  } catch (err: any) {
    if (err.message.includes("(404)")) return true;
    throw err;
  }
}
