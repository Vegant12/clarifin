const { extractText } = require('unpdf');
const fs = require('fs');
const path = require('path');

async function getPages(pdfPath, pageList) {
  const buf = fs.readFileSync(pdfPath);
  const uint8 = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  const result = await extractText(uint8, { mergePages: false });
  const pages = result.text;
  console.log(`\n=== ${path.basename(pdfPath)} — ${pages.length} pages total ===`);
  for (const pg of pageList) {
    if (pg <= pages.length) {
      console.log(`\n--- Page ${pg} ---`);
      console.log(pages[pg-1]);
    }
  }
}

const args = process.argv.slice(2);
const pdf = args[0];
const pageList = args.slice(1).map(Number);
getPages(pdf, pageList).catch(console.error);
