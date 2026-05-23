const fs = require("fs");
const data = JSON.parse(fs.readFileSync("scratch/lt_response.json", "utf8"));

console.log("--- LT KEYS ---");
console.log(Object.keys(data));
console.log("--- LT DATA KEYS ---");
console.log(Object.keys(data.data));

console.log("\n--- LAYER 8 (FUNDAMENTALS) ---");
console.log(JSON.stringify(data.layers.layer8, null, 2));

console.log("\n--- LAYER 10 (VALUATION) ---");
console.log(JSON.stringify(data.layers.layer10, null, 2));

console.log("\n--- LAYER 6 (INSTITUTIONAL) ---");
console.log(JSON.stringify(data.layers.layer6, null, 2));

console.log("\n--- LAYER 15 (NLP SENTIMENT) ---");
console.log(JSON.stringify(data.layers.layer15, null, 2));
