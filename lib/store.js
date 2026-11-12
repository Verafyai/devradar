import { promises as fs } from "node:fs";
import path from "node:path";

const PREFIX = "devradar";

function blobOn() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

function rootDir() {
  if (process.env.DEVRADAR_DATA_DIR) return process.env.DEVRADAR_DATA_DIR;
  if (process.env.VERCEL) return "/tmp/devradar-app";
  return path.join(process.cwd(), ".data");
}

function fileFor(key) {
  if (key.includes("..") || key.startsWith("/") || key.includes("\\")) {
    throw new Error("Refused storage key.");
  }
  return path.join(rootDir(), `${key}.json`);
}

export async function readDoc(key) {
  if (blobOn()) {
    const { get } = await import("@vercel/blob");
    try {
      const result = await get(`${PREFIX}/${key}.json`, {
        access: "private",
        token: process.env.BLOB_READ_WRITE_TOKEN,
        useCache: false,
      });
      if (!result || result.statusCode !== 200 || !result.stream) return null;
      const text = await new Response(result.stream).text();
      return JSON.parse(text);
    } catch (err) {
      if (err?.name === "BlobNotFoundError" || err?.statusCode === 404) return null;
      throw err;
    }
  }
  try {
    const raw = await fs.readFile(fileFor(key), "utf8");
    return JSON.parse(raw);
  } catch (err) {
    if (err?.code === "ENOENT") return null;
    throw err;
  }
}

export async function writeDoc(key, value) {
  const body = JSON.stringify(value);
  if (blobOn()) {
    const { put } = await import("@vercel/blob");
    await put(`${PREFIX}/${key}.json`, body, {
      access: "private",
      token: process.env.BLOB_READ_WRITE_TOKEN,
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return;
  }
  const file = fileFor(key);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, body);
}

export async function deleteDoc(key) {
  if (blobOn()) {
    const { del } = await import("@vercel/blob");
    try {
      await del(`${PREFIX}/${key}.json`, { token: process.env.BLOB_READ_WRITE_TOKEN });
    } catch (err) {
      if (err?.name === "BlobNotFoundError") return;
      throw err;
    }
    return;
  }
  try {
    await fs.unlink(fileFor(key));
  } catch (err) {
    if (err?.code !== "ENOENT") throw err;
  }
}

export function storageMode() {
  if (blobOn()) return "blob";
  if (process.env.VERCEL) return "tmp";
  return "file";
}
