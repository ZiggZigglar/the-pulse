#!/usr/bin/env node
// The Pulse - daily page builder.
//
//   node build.js <content-file> <YYYY-MM-DD>
//
// Splices a content fragment into template.html and writes index.html.
// Item count and read time are derived from the content, not passed in.
// The template holds all CSS and JS; the daily run never rewrites it.

const fs = require('fs');
const path = require('path');

const [, , contentFile, editionDate] = process.argv;

if (!contentFile || !editionDate) {
  console.error('usage: node build.js <content-file> <YYYY-MM-DD>');
  process.exit(1);
}
if (!/^\d{4}-\d{2}-\d{2}$/.test(editionDate)) {
  console.error('edition date must be YYYY-MM-DD, got: ' + editionDate);
  process.exit(1);
}

const root = __dirname;
const template = fs.readFileSync(path.join(root, 'template.html'), 'utf8');
const content = fs.readFileSync(contentFile, 'utf8');

// Guard: the em dash rule is permanent once pushed, so fail the build not the review.
const banned = [
  ['em dash', '—'],
  ['en dash', '–'],
  ['&mdash;', '&mdash;'],
  ['&ndash;', '&ndash;']
];
for (const [label, needle] of banned) {
  if (content.includes(needle)) {
    console.error('BUILD FAILED: content contains ' + label + '. Rewrite it.');
    process.exit(1);
  }
}

// Item count = every filterable node (cards plus also-noted lines).
const itemCount = (content.match(/data-topic=/g) || []).length;
if (itemCount === 0) {
  console.error('BUILD FAILED: no data-topic nodes found in content.');
  process.exit(1);
}

// Read time = visible words / 200, rounded up.
const words = content
  .replace(/<[^>]+>/g, ' ')
  .replace(/&[a-z]+;|&#\d+;/gi, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .split(' ')
  .filter(Boolean).length;
const readTime = Math.max(1, Math.ceil(words / 200));

// Format the date without letting the host timezone shift the weekday.
const d = new Date(editionDate + 'T12:00:00Z');
const titleDate = d.toLocaleDateString('en-US', {
  month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC'
});
const weekday = d.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
const metaLine = weekday + ', ' + titleDate +
  ' &middot; Central &middot; ' + itemCount + ' items &middot; ' + readTime + ' min read';

const out = template
  .replace('{{EDITION_DATE}}', editionDate)
  .replace('{{TITLE_DATE}}', titleDate)
  .replace('{{META_LINE}}', metaLine)
  .replace('{{CONTENT}}', content);

if (out.includes('{{')) {
  console.error('BUILD FAILED: unsubstituted placeholder left in output.');
  process.exit(1);
}

fs.writeFileSync(path.join(root, 'index.html'), out);
console.log('built index.html  date=' + editionDate + '  items=' + itemCount +
  '  words=' + words + '  read=' + readTime + ' min');
