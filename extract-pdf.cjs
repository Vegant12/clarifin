const { extractText } = require('unpdf');
const fs = require('fs');
const path = require('path');

async function extractPdfFinancials(pdfPath) {
  const buf = fs.readFileSync(pdfPath);
  const uint8 = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  const result = await extractText(uint8, { mergePages: false });
  const pages = result.text;
  console.log(`\n=== ${path.basename(pdfPath)} — ${pages.length} pages total ===`);
  
  // Find denomination note
  let denomination = null;
  for (let i = 0; i < Math.min(20, pages.length); i++) {
    const t = pages[i];
    if (t.includes('jutaan Rupiah') || t.includes('jutaan rupiah')) {
      denomination = `jutaan (×1,000,000) found on page ${i+1}`;
    } else if (t.includes('miliaran Rupiah') || t.includes('miliaran rupiah')) {
      denomination = `miliaran (×1,000,000,000) found on page ${i+1}`;
    }
  }
  // Also check later pages for note
  for (let i = 20; i < pages.length && !denomination; i++) {
    const t = pages[i];
    if (t.includes('jutaan Rupiah') || t.includes('jutaan rupiah')) {
      denomination = `jutaan (×1,000,000) found on page ${i+1}`;
    } else if (t.includes('miliaran Rupiah') || t.includes('miliaran rupiah')) {
      denomination = `miliaran (×1,000,000,000) found on page ${i+1}`;
    }
  }
  console.log(`Denomination: ${denomination || 'NOT FOUND'}`);
  
  // Find income statement
  let incomePages = [];
  let balancePages = [];
  let cashflowPages = [];
  
  for (let i = 0; i < pages.length; i++) {
    const t = pages[i];
    const tLower = t.toLowerCase();
    
    // Income statement
    if ((tLower.includes('laba rugi') || tLower.includes('profit or loss') || tLower.includes('profit and loss') || tLower.includes('laporan laba')) && 
        (tLower.includes('konsolidasian') || tLower.includes('consolidated'))) {
      incomePages.push(i+1);
    }
    
    // Balance sheet
    if ((tLower.includes('posisi keuangan') || tLower.includes('financial position') || tLower.includes('neraca')) && 
        (tLower.includes('konsolidasian') || tLower.includes('consolidated'))) {
      balancePages.push(i+1);
    }
    
    // Cash flow
    if ((tLower.includes('arus kas') || tLower.includes('cash flow') || tLower.includes('cash flows')) && 
        (tLower.includes('konsolidasian') || tLower.includes('consolidated'))) {
      cashflowPages.push(i+1);
    }
  }
  
  console.log(`Income stmt pages: ${incomePages.slice(0,5).join(', ')}`);
  console.log(`Balance sheet pages: ${balancePages.slice(0,5).join(', ')}`);
  console.log(`Cash flow pages: ${cashflowPages.slice(0,5).join(', ')}`);
  
  // Print key pages content for manual inspection
  const interesting = [...new Set([...incomePages.slice(0,2), ...balancePages.slice(0,2), ...cashflowPages.slice(0,2)])];
  for (const pg of interesting.slice(0, 4)) {
    console.log(`\n--- Page ${pg} content (first 800 chars) ---`);
    console.log(pages[pg-1].substring(0, 800));
  }
}

const args = process.argv.slice(2);
const pdf = args[0];
extractPdfFinancials(pdf).catch(console.error);
