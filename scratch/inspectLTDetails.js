const fs = require("fs");
const data = JSON.parse(fs.readFileSync("scratch/lt_response.json", "utf8"));

console.log("--- LAYER 15 SENTIMENT ---");
console.log(JSON.stringify(data.layers.layer15.sentiment, null, 2));
