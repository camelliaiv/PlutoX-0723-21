export const STAR_RECORD_VALUE_COUNT = 5;

const SKY_ASSET_DIRECTORY = "/sky/";
const MANIFEST_FILE_NAME = "manifest.json";

export interface SkyManifest {
  stars: { file: string; count: number; brightGaiaCount: number; nearbyCount: number };
  brightStars: {
    file: string;
    count: number;
    catalogueCount: number;
    skippedDuplicateCount: number;
  };
  milkyWay: { file: string; width: number; height: number };
  credits: { milkyWay: string; hipparcos: string; gaia: string };
}

export interface SkyAssets {
  manifest: SkyManifest;
  stars: Float32Array;
  brightStars: Float32Array;
  milkyWayImage: ImageBitmap | null;
}

function readObject(value: unknown, description: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    throw new Error(`The sky manifest has no ${description}.`);
  }
  return value as Record<string, unknown>;
}

function readNumber(source: Record<string, unknown>, key: string): number {
  const value = source[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`The sky manifest has no number ${key}.`);
  }
  return value;
}

function readText(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  if (typeof value !== "string") {
    throw new Error(`The sky manifest has no text ${key}.`);
  }
  return value;
}

export function parseSkyManifest(json: unknown): SkyManifest {
  const root = readObject(json, "content");
  const stars = readObject(root["stars"], "stars section");
  const brightStars = readObject(root["bright_stars"], "bright stars section");
  const milkyWay = readObject(root["milky_way"], "Milky Way section");
  const credits = readObject(root["credits"], "credits section");
  return {
    stars: {
      file: readText(stars, "file"),
      count: readNumber(stars, "count"),
      brightGaiaCount: readNumber(stars, "bright_gaia_count"),
      nearbyCount: readNumber(stars, "nearby_count"),
    },
    brightStars: {
      file: readText(brightStars, "file"),
      count: readNumber(brightStars, "count"),
      catalogueCount: readNumber(brightStars, "catalogue_count"),
      skippedDuplicateCount: readNumber(brightStars, "skipped_duplicate_count"),
    },
    milkyWay: {
      file: readText(milkyWay, "file"),
      width: readNumber(milkyWay, "width"),
      height: readNumber(milkyWay, "height"),
    },
    credits: {
      milkyWay: readText(credits, "milky_way"),
      hipparcos: readText(credits, "hipparcos"),
      gaia: readText(credits, "gaia"),
    },
  };
}

export function parseStarRecords(content: ArrayBuffer, expectedCount: number): Float32Array {
  const valueCount = expectedCount * STAR_RECORD_VALUE_COUNT;
  if (content.byteLength !== valueCount * Float32Array.BYTES_PER_ELEMENT) {
    throw new Error("A star file does not have the size the manifest announces.");
  }
  const view = new DataView(content);
  const values = new Float32Array(valueCount);
  for (let index = 0; index < valueCount; index++) {
    values[index] = view.getFloat32(index * Float32Array.BYTES_PER_ELEMENT, true);
  }
  return values;
}

export function loadingFraction(
  files: readonly { loadedBytes: number; totalBytes: number }[],
): number {
  const total = files.reduce((sum, file) => sum + Math.max(file.totalBytes, file.loadedBytes), 0);
  if (total === 0) {
    return 0;
  }
  return files.reduce((sum, file) => sum + file.loadedBytes, 0) / total;
}

async function fetchContent(
  fileName: string,
  onBytes: (loadedBytes: number, totalBytes: number) => void,
): Promise<ArrayBuffer> {
  const response = await fetch(SKY_ASSET_DIRECTORY + fileName);
  if (!response.ok) {
    throw new Error(`The sky file ${fileName} could not be loaded (status ${response.status}).`);
  }
  const totalBytes = Number(response.headers.get("Content-Length") ?? 0);
  if (!response.body) {
    const content = await response.arrayBuffer();
    onBytes(content.byteLength, content.byteLength);
    return content;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loadedBytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    chunks.push(value);
    loadedBytes += value.byteLength;
    onBytes(loadedBytes, totalBytes);
  }
  const content = new Uint8Array(loadedBytes);
  let offset = 0;
  for (const chunk of chunks) {
    content.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return content.buffer;
}

export async function loadSkyAssets(onProgress: (fraction: number) => void): Promise<SkyAssets> {
  const manifestResponse = await fetch(SKY_ASSET_DIRECTORY + MANIFEST_FILE_NAME);
  if (!manifestResponse.ok) {
    throw new Error(`The sky manifest could not be loaded (status ${manifestResponse.status}).`);
  }
  const manifest = parseSkyManifest(await manifestResponse.json());

  const files = [0, 1, 2].map(() => ({ loadedBytes: 0, totalBytes: 0 }));
  const trackedFetch = (index: number, fileName: string): Promise<ArrayBuffer> =>
    fetchContent(fileName, (loadedBytes, totalBytes) => {
      files[index] = { loadedBytes, totalBytes };
      onProgress(loadingFraction(files));
    });

  const [starsContent, brightStarsContent, mapContent] = await Promise.all([
    trackedFetch(0, manifest.stars.file),
    trackedFetch(1, manifest.brightStars.file),
    trackedFetch(2, manifest.milkyWay.file),
  ]);
  let milkyWayImage: ImageBitmap | null = null;
  try {
    milkyWayImage = await createImageBitmap(new Blob([mapContent], { type: "image/jpeg" }), {
      colorSpaceConversion: "none",
    });
  } catch {
    milkyWayImage = null;
  }
  onProgress(1);
  return {
    manifest,
    stars: parseStarRecords(starsContent, manifest.stars.count),
    brightStars: parseStarRecords(brightStarsContent, manifest.brightStars.count),
    milkyWayImage,
  };
}
