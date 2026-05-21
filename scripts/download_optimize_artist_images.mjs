import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';

const projectRoot = process.cwd();
const artistsDir = path.join(projectRoot, 'src/data/artists');
const outputDir = path.join(projectRoot, 'public/images/artists/facesheet');

const USER_AGENT = 'ARCamp-ImageFetcher/1.0';
const REQUEST_TIMEOUT_MS = 20000;

const ensureDir = async (dir) => {
  await fs.mkdir(dir, { recursive: true });
};

const slugify = (value) => {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'artist';
};

const parseFrontmatter = (content) => {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return null;
  return {
    frontmatter: match[1],
    body: match[2],
  };
};

const getYamlValue = (frontmatter, key) => {
  const pattern = new RegExp(`^${key}:\\s*'([^']*)'`, 'm');
  const match = frontmatter.match(pattern);
  return match ? match[1] : null;
};

const getPressUrls = (frontmatter) => {
  const blockMatch = frontmatter.match(/press_photo_urls:\n([\s\S]*?)(\n[a-zA-Z_]+:|$)/);
  if (!blockMatch) return [];
  const block = blockMatch[1];
  const urls = [];
  const lineRegex = /^\s*-\s*'([^']+)'/gm;
  let m;
  while ((m = lineRegex.exec(block)) !== null) {
    urls.push(m[1]);
  }
  return urls;
};

const updateImageSrc = (frontmatter, nextSrc) => {
  return frontmatter.replace(/^\s*src:\s*'[^']*'/m, `  src: '${nextSrc}'`);
};

const fetchBuffer = async (url) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } finally {
    clearTimeout(timeout);
  }
};

const optimizeToWebp = async (inputBuffer, outputPath) => {
  await sharp(inputBuffer)
    .rotate()
    .resize({ width: 900, height: 1125, fit: 'cover', position: 'centre', withoutEnlargement: true })
    .webp({ quality: 78, effort: 5 })
    .toFile(outputPath);
};

const run = async () => {
  await ensureDir(outputDir);

  const files = (await fs.readdir(artistsDir)).filter((name) => name.endsWith('.md'));
  let success = 0;
  let failed = 0;

  for (const file of files) {
    const fullPath = path.join(artistsDir, file);
    const original = await fs.readFile(fullPath, 'utf8');
    const parsed = parseFrontmatter(original);

    if (!parsed) {
      failed += 1;
      console.warn(`Skipping ${file}: invalid frontmatter`);
      continue;
    }

    const name = getYamlValue(parsed.frontmatter, 'name') || path.basename(file, '.md');
    const urls = getPressUrls(parsed.frontmatter);
    const fallback = getYamlValue(parsed.frontmatter, 'src');

    const candidates = [...urls, ...(fallback ? [fallback] : [])].filter(Boolean);
    if (candidates.length === 0) {
      failed += 1;
      console.warn(`Skipping ${file}: no source URLs`);
      continue;
    }

    const slug = slugify(name);
    const outputRel = `/images/artists/facesheet/${slug}.webp`;
    const outputPath = path.join(outputDir, `${slug}.webp`);

    let downloaded = false;
    let lastError = null;

    for (const url of candidates) {
      try {
        const buffer = await fetchBuffer(url);
        await optimizeToWebp(buffer, outputPath);
        downloaded = true;
        break;
      } catch (error) {
        lastError = error;
      }
    }

    if (!downloaded) {
      failed += 1;
      console.warn(`Failed ${file}: ${lastError?.message || 'unknown error'}`);
      continue;
    }

    const nextFrontmatter = updateImageSrc(parsed.frontmatter, outputRel);
    const updated = `---\n${nextFrontmatter}\n---\n${parsed.body}`;
    await fs.writeFile(fullPath, updated, 'utf8');
    success += 1;
  }

  console.log(`Optimized ${success} artists to local WebP. Failed: ${failed}.`);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
