/**
 * AES-GCM Authenticated Encryption Utility
 * Uses Web Crypto API for secure, tamper-proof data.
 */

const ALGO = 'AES-GCM';

async function deriveKey(passphrase: string): Promise<CryptoKey> {
	const encoder = new TextEncoder();
	const data = encoder.encode(passphrase);
	const hash = await crypto.subtle.digest('SHA-256', data);
	return crypto.subtle.importKey('raw', hash, ALGO, false, ['encrypt', 'decrypt']);
}

export async function encryptJSON(json: any, passphrase: string): Promise<string> {
	const key = await deriveKey(passphrase);
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const encoder = new TextEncoder();
	const data = encoder.encode(JSON.stringify(json));

	const encrypted = await crypto.subtle.encrypt({ name: ALGO, iv }, key, data);

	// Combine IV and Encrypted data
	const result = new Uint8Array(iv.length + encrypted.byteLength);
	result.set(iv);
	result.set(new Uint8Array(encrypted), iv.length);

	return btoa(String.fromCharCode(...result))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');
}

export async function decryptJSON(base64: string, passphrase: string): Promise<any> {
	try {
		const key = await deriveKey(passphrase);

		// Restore base64 padding and characters
		let b64 = base64.replace(/-/g, '+').replace(/_/g, '/');
		while (b64.length % 4) b64 += '=';

		const binary = atob(b64);
		const bytes = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; i++) {
			bytes[i] = binary.charCodeAt(i);
		}

		const iv = bytes.slice(0, 12);
		const data = bytes.slice(12);

		const decrypted = await crypto.subtle.decrypt({ name: ALGO, iv }, key, data);

		const decoder = new TextDecoder();
		return JSON.parse(decoder.decode(decrypted));
	} catch (e) {
		throw new Error('Failed to decrypt. Data may be tampered with or key is incorrect.');
	}
}
