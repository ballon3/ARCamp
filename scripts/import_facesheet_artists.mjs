import fs from 'fs';
import path from 'path';

const projectRoot = process.cwd();
const csvPath = path.join(projectRoot, 'Artist Facesheet.csv');
const artistsDir = path.join(projectRoot, 'src/data/artists');
const csvText = fs.readFileSync(csvPath, 'utf8');

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === ',' && !inQuotes) {
      row.push(field);
      field = '';
      continue;
    }

    if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && next === '\n') i += 1;
      row.push(field);
      field = '';
      if (row.some((v) => v !== '')) rows.push(row);
      row = [];
      continue;
    }

    field += ch;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((v) => v !== '')) rows.push(row);
  }

  return rows;
}

function clean(s) {
  return (s || '')
    .replace(/^\s+|\s+$/g, '')
    .replace(/^"|"$/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/\u202f/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function yamlStr(s) {
  const value = clean(s).replace(/'/g, "''");
  return `'${value}'`;
}

function slugify(input) {
  return clean(input)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'artist';
}

function extractUrls(value) {
  const urls = [];
  const text = value || '';
  const inParens = /\((https?:\/\/[^)\s]+)\)/g;
  let match;

  while ((match = inParens.exec(text)) !== null) {
    urls.push(match[1]);
  }

  if (urls.length === 0) {
    const raw = /(https?:\/\/[^)\s,]+)/g;
    while ((match = raw.exec(text)) !== null) {
      urls.push(match[1]);
    }
  }

  return [...new Set(urls)];
}

const rows = parseCsv(csvText);
if (rows.length < 2) {
  throw new Error('CSV appears empty or invalid.');
}

const headers = rows[0].map(clean);
const findCol = (label) => headers.findIndex((h) => h.toLowerCase().includes(label));
const index = {
  performer: findCol('performing artist'),
  stage: findCol('stage name'),
  day: findCol('day of show'),
  start: findCol('set time start'),
  end: findCol('set time end'),
  photo: findCol('press photo'),
};

for (const [k, v] of Object.entries(index)) {
  if (v < 0) throw new Error(`Missing expected CSV column: ${k}`);
}

const artists = new Map();

for (const row of rows.slice(1)) {
  const performer = clean(row[index.performer]);
  const stage = clean(row[index.stage]);
  const day = clean(row[index.day]);
  const setStart = clean(row[index.start]);
  const setEnd = clean(row[index.end]);
  const photoField = row[index.photo] || '';

  if (!performer || performer.toUpperCase() === 'GUESTS/ MISC') continue;

  const key = performer.toLowerCase();
  if (!artists.has(key)) {
    artists.set(key, {
      performer,
      performances: [],
      photoUrls: [],
    });
  }

  const artist = artists.get(key);

  if (stage || day || setStart || setEnd) {
    const performance = {
      stage: stage || 'NA',
      day: day || 'NA',
      set_start: setStart || 'NA',
      set_end: setEnd || 'NA',
    };

    const dedupeKey = `${performance.stage}|${performance.day}|${performance.set_start}|${performance.set_end}`;
    const exists = artist.performances.some(
      (p) => `${p.stage}|${p.day}|${p.set_start}|${p.set_end}` === dedupeKey,
    );
    if (!exists) artist.performances.push(performance);
  }

  for (const url of extractUrls(photoField)) {
    if (!artist.photoUrls.includes(url)) artist.photoUrls.push(url);
  }
}

for (const file of fs.readdirSync(artistsDir)) {
  if (file.endsWith('.md')) fs.unlinkSync(path.join(artistsDir, file));
}

const usedSlugs = new Map();
let created = 0;

for (const artist of artists.values()) {
  const baseSlug = slugify(artist.performer);
  const count = (usedSlugs.get(baseSlug) || 0) + 1;
  usedSlugs.set(baseSlug, count);
  const slug = count === 1 ? baseSlug : `${baseSlug}-${count}`;

  const imageUrl = artist.photoUrls[0] || 'https://placehold.co/800x1000?text=Artist+Photo';

  const lines = [];
  lines.push('---');
  lines.push(`name: ${yamlStr(artist.performer)}`);
  lines.push(`stage_name: ${yamlStr(artist.performer)}`);
  lines.push("genre: 'Festival Artist'");
  lines.push('image:');
  lines.push(`  src: ${yamlStr(imageUrl)}`);
  lines.push(`  alt: ${yamlStr(`Press photo for ${artist.performer}`)}`);
  lines.push('performances:');

  if (artist.performances.length === 0) {
    lines.push('  - stage: "NA"');
    lines.push('    day: "NA"');
    lines.push('    set_start: "NA"');
    lines.push('    set_end: "NA"');
  } else {
    for (const perf of artist.performances) {
      lines.push(`  - stage: ${yamlStr(perf.stage)}`);
      lines.push(`    day: ${yamlStr(perf.day)}`);
      lines.push(`    set_start: ${yamlStr(perf.set_start)}`);
      lines.push(`    set_end: ${yamlStr(perf.set_end)}`);
    }
  }

  lines.push('press_photo_urls:');
  if (artist.photoUrls.length === 0) {
    lines.push(`  - ${yamlStr(imageUrl)}`);
  } else {
    for (const url of artist.photoUrls) {
      lines.push(`  - ${yamlStr(url)}`);
    }
  }

  lines.push('---');
  lines.push('');
  lines.push(`${artist.performer} is featured in the ARCamp artist facesheet.`);
  lines.push('');
  lines.push('## Performance Schedule');
  lines.push('');

  if (artist.performances.length === 0) {
    lines.push('- Stage: NA');
    lines.push('- Day: NA');
    lines.push('- Set time: NA');
  } else {
    for (const perf of artist.performances) {
      lines.push(`- ${perf.day} | ${perf.stage} | ${perf.set_start} - ${perf.set_end}`);
    }
  }

  lines.push('');
  lines.push('## Press Photo URLs');
  lines.push('');
  for (const url of (artist.photoUrls.length ? artist.photoUrls : [imageUrl])) {
    lines.push(`- ${url}`);
  }
  lines.push('');

  fs.writeFileSync(path.join(artistsDir, `${slug}.md`), lines.join('\n'));
  created += 1;
}

console.log(`Created ${created} artist markdown files from CSV.`);
