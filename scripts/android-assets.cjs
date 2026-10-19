"use strict";
const fs = require("node:fs");
const path = require("node:path");
const destination = path.join(__dirname, "../android/app/src/main/assets");
fs.mkdirSync(destination, { recursive: true });
fs.cpSync(path.join(__dirname, "../web"), path.join(destination, "web"), {
  recursive: true,
});
console.log("Copied offline sandbox into Android assets.");
