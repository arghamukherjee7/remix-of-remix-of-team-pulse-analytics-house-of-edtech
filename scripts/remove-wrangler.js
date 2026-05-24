const fs = require("fs");

const path = "./dist/client/wrangler.json";

if (fs.existsSync(path)) {
  fs.unlinkSync(path);
  console.log("Removed dist/client/wrangler.json");
}