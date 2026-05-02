import sharp from 'sharp';

export type ProcessedImage = {
  thumb: { buffer: Buffer; width: number; height: number };
  web: { buffer: Buffer; width: number; height: number };
  original: { width: number; height: number };
};

export async function processImage(input: Buffer): Promise<ProcessedImage> {
  const image = sharp(input, { failOn: 'none' }).rotate();
  const meta = await image.metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (!width || !height) throw new Error('Invalid image: cannot read dimensions');

  const thumb = await sharp(input)
    .rotate()
    .resize({ width: 400, height: 400, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 78, progressive: true, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });

  const web = await sharp(input)
    .rotate()
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85, progressive: true, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });

  return {
    thumb: { buffer: thumb.data, width: thumb.info.width, height: thumb.info.height },
    web: { buffer: web.data, width: web.info.width, height: web.info.height },
    original: { width, height },
  };
}
