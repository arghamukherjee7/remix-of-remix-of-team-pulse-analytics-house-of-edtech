const fs = require("fs");
const path = require("path");

const wranglerPath = path.join(
  process.cwd(),
  "dist",
  "client",
  "wrangler.json"
);

if (fs.existsSync(wranglerPath)) {
  fs.unlinkSync(wranglerPath);
  console.log("Removed dist/client/wrangler.json");
} else {
  console.log("No wrangler.json found");
}