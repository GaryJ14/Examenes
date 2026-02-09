// ============================================
// src/utils/cameraCapture.js
// ============================================
export const captureVideoFrameAsFile = async (videoEl, filename = "validacion.jpg") => {
  if (!videoEl) throw new Error("Video no disponible.");

  const width = videoEl.videoWidth || 640;
  const height = videoEl.videoHeight || 480;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  ctx.drawImage(videoEl, 0, 0, width, height);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));

  if (!blob) throw new Error("No se pudo capturar la foto.");

  return new File([blob], filename, { type: "image/jpeg" });
};
