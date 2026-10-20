export async function readArticleImage(file: File): Promise<HTMLImageElement> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('请选择 JPEG、PNG 或 WebP 图片。');
  }
  if (file.size > 5 * 1024 * 1024) throw new Error('图片不能超过 5 MB。');
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('图片读取失败，请重新选择。'));
    reader.onabort = () => reject(new Error('图片读取已取消。'));
    reader.readAsDataURL(file);
  });
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.alt = file.name.replace(/\.[^.]+$/, '');
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('图片无法打开，请选择有效的 JPEG、PNG 或 WebP 图片。'));
    image.src = data;
  });
}
