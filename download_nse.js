const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function downloadNSE() {
  try {
    console.log("Downloading official NSE Equity list...");
    
    // Using a reliable public github gist or API if NSE blocks us, but let's try NSE first.
    // Actually, nseindia often blocks axios. Let's use a known public dataset of Indian stocks or try NSE with headers.
    const response = await axios.get('https://archives.nseindia.com/content/equities/EQUITY_L.csv', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 10000
    });

    const data = response.data;
    const lines = data.split('\n');
    const symbols = new Set();
    
    // Skip header line
    for(let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',');
      if (parts.length > 0 && parts[0].trim()) {
        const symbol = parts[0].trim().replace(/['"]+/g, '');
        if (symbol !== "SYMBOL" && symbol.length > 0) {
          symbols.add(symbol);
        }
      }
    }

    const uniqueSymbols = Array.from(symbols);
    console.log(`Successfully parsed ${uniqueSymbols.length} unique NSE symbols.`);

    const outputContent = `// Auto-generated list of all active NSE Stocks
export const ALL_INDIAN_STOCKS = ${JSON.stringify(uniqueSymbols, null, 2)};
`;
    
    const outPath = path.join(__dirname, 'frontend', 'src', 'stocks.js');
    fs.writeFileSync(outPath, outputContent);
    console.log(`Wrote to ${outPath}`);

  } catch (error) {
    console.error("Failed to download directly from NSE, falling back to a massive precompiled fallback list.");
    // In case NSE blocks the request, fallback to fetching from another open source
    try {
      // Using a raw github user content that hosts a recent NSE list
      const fallbackResponse = await axios.get('https://raw.githubusercontent.com/NayakwadiS/NSE-BSE-Stock-List/master/NSE.csv');
      const data = fallbackResponse.data;
      const lines = data.split('\n');
      const symbols = new Set();
      
      for(let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',');
        if (parts.length > 0 && parts[0].trim()) {
          const symbol = parts[0].trim();
          if (symbol !== "SYMBOL" && symbol.length > 0) {
            symbols.add(symbol);
          }
        }
      }
      
      const uniqueSymbols = Array.from(symbols);
      const outPath = path.join(__dirname, 'frontend', 'src', 'stocks.js');
      const outputContent = `// Auto-generated list of NSE Stocks (Fallback source)
export const ALL_INDIAN_STOCKS = ${JSON.stringify(uniqueSymbols, null, 2)};
`;
      fs.writeFileSync(outPath, outputContent);
      console.log(`Wrote ${uniqueSymbols.length} symbols to ${outPath} using fallback.`);
    } catch(err2) {
      console.error("Total failure: ", err2.message);
    }
  }
}

downloadNSE();
