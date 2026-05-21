import fs from 'fs';
import path from 'path';

const root = process.cwd();
const csvPath = path.join(root, 'Artist Facesheet.csv');
const artistsDir = path.join(root, 'src/data/artists');
const artistImagesDir = path.join(root, 'public/images/artists/facesheet');

function clean(value) {
  return (value || '')
    .replace(/^\s+|\s+$/g, '')
    .replace(/^"|"$/g, '')
    .replace(/\u00a0|\u202f/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
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

function yamlStr(value) {
  return `'${clean(value).replace(/'/g, "''")}'`;
}

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return null;

  const frontmatter = match[1];
  const body = match[2];
  const pick = (key) => {
    const result = frontmatter.match(new RegExp(`^\\s*${key}:\\s*'([^']*)'`, 'm'));
    return result ? result[1].replace(/''/g, "'") : '';
  };

  return {
    name: pick('name'),
    stageName: pick('stage_name'),
    genre: pick('genre'),
    imageSrc: pick('src'),
    imageAlt: pick('alt'),
    body,
  };
}

const csv = fs.readFileSync(csvPath, 'utf8');
const rows = parseCsv(csv);
const headers = rows[0].map(clean);

const col = {
  artist: headers.findIndex((h) => h.toLowerCase().includes('performing artist')),
  stage: headers.findIndex((h) => h.toLowerCase().includes('stage name')),
  day: headers.findIndex((h) => h.toLowerCase().includes('day of show')),
  programming: headers.findIndex((h) => h.toLowerCase().includes('programming time')),
  soundcheck: headers.findIndex((h) => h.toLowerCase().includes('soundcheck time')),
  start: headers.findIndex((h) => h.toLowerCase().includes('set time start')),
  end: headers.findIndex((h) => h.toLowerCase().includes('set time end')),
  greenrooms: headers.findIndex((h) => h.toLowerCase().includes('# confirmed greenrooms')),
  greenRoomSched: headers.findIndex((h) => h.toLowerCase().includes('green room sched')),
  greenroomStart: headers.findIndex((h) => h.toLowerCase().includes('greenroom start')),
  greenroomEnd: headers.findIndex((h) => h.toLowerCase().includes('greenroom end')),
};

function resolveImageSrc(fileName, existingSrc) {
  if (existingSrc) return existingSrc;

  const slug = path.basename(fileName, '.md');
  const webpPath = path.join(artistImagesDir, `${slug}.webp`);
  if (fs.existsSync(webpPath)) {
    return `/images/artists/facesheet/${slug}.webp`;
  }

  return '/images/artists/facesheet/placeholder.svg';
}

const detailsByArtist = new Map();

for (const row of rows.slice(1)) {
  const name = clean(row[col.artist]);
  if (!name || name.toUpperCase() === 'GUESTS/ MISC') continue;

  const key = name.toLowerCase();
  if (!detailsByArtist.has(key)) {
    detailsByArtist.set(key, {
      performances: [],
      stages: [],
      showDays: [],
    });
  }

  const item = detailsByArtist.get(key);
  const performance = {
    stage: clean(row[col.stage]) || 'TBD',
    day: clean(row[col.day]) || 'TBD',
    programming_time: clean(row[col.programming]) || 'TBD',
    soundcheck_time: clean(row[col.soundcheck]) || 'TBD',
    set_start: clean(row[col.start]) || 'TBD',
    set_end: clean(row[col.end]) || 'TBD',
    confirmed_greenrooms: clean(row[col.greenrooms]) || 'TBD',
    green_room_sched: clean(row[col.greenRoomSched]) || 'TBD',
    greenroom_start: clean(row[col.greenroomStart]) || 'TBD',
    greenroom_end: clean(row[col.greenroomEnd]) || 'TBD',
  };

  const perfKey = [
    performance.stage,
    performance.day,
    performance.programming_time,
    performance.soundcheck_time,
    performance.set_start,
    performance.set_end,
    performance.confirmed_greenrooms,
    performance.green_room_sched,
    performance.greenroom_start,
    performance.greenroom_end,
  ].join('|');
  const perfExists = item.performances.some((p) => [
    p.stage,
    p.day,
    p.programming_time,
    p.soundcheck_time,
    p.set_start,
    p.set_end,
    p.confirmed_greenrooms,
    p.green_room_sched,
    p.greenroom_start,
    p.greenroom_end,
  ].join('|') === perfKey);
  if (!perfExists) item.performances.push(performance);

  if (!item.stages.includes(performance.stage)) item.stages.push(performance.stage);
  if (!item.showDays.includes(performance.day)) item.showDays.push(performance.day);

}

const artistFiles = fs.readdirSync(artistsDir).filter((file) => file.endsWith('.md'));
let updated = 0;

for (const file of artistFiles) {
  const fullPath = path.join(artistsDir, file);
  const raw = fs.readFileSync(fullPath, 'utf8');
  const parsed = parseFrontmatter(raw);
  if (!parsed) continue;

  const details = detailsByArtist.get(clean(parsed.name).toLowerCase());
  if (!details) continue;

  const frontmatterLines = [];
  frontmatterLines.push('---');
  frontmatterLines.push(`name: ${yamlStr(parsed.name)}`);
  frontmatterLines.push(`stage_name: ${yamlStr(parsed.stageName || parsed.name)}`);
  frontmatterLines.push(`genre: ${yamlStr(parsed.genre || 'Festival Artist')}`);
  frontmatterLines.push('image:');
  frontmatterLines.push(`  src: ${yamlStr(resolveImageSrc(file, parsed.imageSrc))}`);
  frontmatterLines.push(`  alt: ${yamlStr(parsed.imageAlt || `Press photo for ${parsed.name}`)}`);
  frontmatterLines.push('performances:');

  details.performances.forEach((p) => {
    frontmatterLines.push(`  - stage: ${yamlStr(p.stage)}`);
    frontmatterLines.push(`    day: ${yamlStr(p.day)}`);
    frontmatterLines.push(`    programming_time: ${yamlStr(p.programming_time)}`);
    frontmatterLines.push(`    soundcheck_time: ${yamlStr(p.soundcheck_time)}`);
    frontmatterLines.push(`    set_start: ${yamlStr(p.set_start)}`);
    frontmatterLines.push(`    set_end: ${yamlStr(p.set_end)}`);
    frontmatterLines.push(`    confirmed_greenrooms: ${yamlStr(p.confirmed_greenrooms)}`);
    frontmatterLines.push(`    green_room_sched: ${yamlStr(p.green_room_sched)}`);
    frontmatterLines.push(`    greenroom_start: ${yamlStr(p.greenroom_start)}`);
    frontmatterLines.push(`    greenroom_end: ${yamlStr(p.greenroom_end)}`);
  });

  frontmatterLines.push('stages:');
  details.stages.forEach((stage) => {
    frontmatterLines.push(`  - ${yamlStr(stage)}`);
  });

  frontmatterLines.push('show_days:');
  details.showDays.forEach((day) => {
    frontmatterLines.push(`  - ${yamlStr(day)}`);
  });

  frontmatterLines.push('---');
  frontmatterLines.push('');
  frontmatterLines.push(`${parsed.name} is featured in the ARCamp artist facesheet.`);
  frontmatterLines.push('');
  frontmatterLines.push('## Stage Details');
  frontmatterLines.push('');
  details.performances.forEach((p) => {
    frontmatterLines.push(`**Stage:** ${p.stage}`);
    frontmatterLines.push('');
    frontmatterLines.push(`**Day of Show:** ${p.day}`);
    frontmatterLines.push('');
    frontmatterLines.push(`**Set Time:** ${p.set_start} - ${p.set_end}`);
    frontmatterLines.push('');
    frontmatterLines.push(`**Programming Time:** ${p.programming_time}`);
    frontmatterLines.push('');
    frontmatterLines.push(`**Soundcheck Time:** ${p.soundcheck_time}`);
    frontmatterLines.push('');
    frontmatterLines.push(`**Confirmed Greenrooms:** ${p.confirmed_greenrooms}`);
    frontmatterLines.push('');
    frontmatterLines.push(`**Greenroom Start:** ${p.greenroom_start}`);
    frontmatterLines.push('');
    frontmatterLines.push(`**Greenroom End:** ${p.greenroom_end}`);
    frontmatterLines.push('');
  });

  fs.writeFileSync(fullPath, frontmatterLines.join('\n'));
  updated += 1;
}

console.log(`Updated ${updated} artist markdown files from CSV details.`);
