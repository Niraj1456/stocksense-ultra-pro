const fs = require("fs");
const data = JSON.parse(fs.readFileSync("scratch/st_response.json", "utf8"));

console.log("--- LAYER 12 ---");
console.log(JSON.stringify(data.layers.layer12, null, 2));

console.log("\n--- LAYER 18 ---");
console.log(JSON.stringify(data.layers.layer18, null, 2));

console.log("\n--- LAYER 3 (INDICATORS) ---");
if (data.layers.layer3?.data?.indicators) {
  console.log(JSON.stringify(data.layers.layer3.data.indicators, null, 2));
} else {
  console.log("No indicators found in layer3:", Object.keys(data.layers.layer3 || {}));
}

console.log("\n--- LAYER 2 ---");
console.log(JSON.stringify(data.layers.layer2, null, 2));

console.log("\n--- LAYER 7 ---");
console.log(JSON.stringify(data.layers.layer7, null, 2));
