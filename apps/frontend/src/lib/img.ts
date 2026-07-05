/** Chỉ co ảnh RẤT lớn (>4MB) cho chắc dưới giới hạn upload; phần nén + chuyển WebP để compressImage (lib/api.ts) lo 1 lần cho ảnh nét nhất. */
export async function resizeImage(file: File, max = 2200, quality = 0.9): Promise<File> {
  if (!file.type.startsWith('image/') || file.size < 4 * 1024 * 1024) return file;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = url;
    });
    let { width, height } = img;
    if (width > max || height > max) {
      const r = Math.min(max / width, max / height);
      width = Math.round(width * r); height = Math.round(height * r);
    }
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
    const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b as Blob), 'image/jpeg', quality));
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch { return file; } finally { URL.revokeObjectURL(url); }
}
