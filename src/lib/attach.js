// Turns a picked or pasted image into a small data URL before it's uploaded.
// Screenshots are scaled to at most 1600 px on the long side and saved as WebP
// (JPEG where the browser can't make WebP), so each one is usually 100-400 KB.

export const MAX_FILES = 8;
const MAX_SIDE = 1600;
const MAX_CHARS = 1_900_000; // the database refuses anything over 2 MB

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("not_image"));
    };
    img.src = url;
  });
}

export async function compressImage(file) {
  if (!file || !/^image\//.test(file.type)) throw new Error("not_image");
  const { img, url } = await loadImage(file);
  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff"; // transparent PNGs would turn black as JPEG
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    for (const q of [0.82, 0.7, 0.55, 0.4]) {
      let data = canvas.toDataURL("image/webp", q);
      if (!data.startsWith("data:image/webp")) data = canvas.toDataURL("image/jpeg", q);
      if (data.length <= MAX_CHARS) return { name: file.name || "screenshot", data };
    }
    throw new Error("too_big");
  } finally {
    URL.revokeObjectURL(url);
  }
}

export const kb = (chars) => `${Math.max(1, Math.round((chars * 0.75) / 1024))} KB`;
