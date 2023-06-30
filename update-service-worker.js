/* eslint-env node */
console.log("update service worker...");

const fs = require("fs");
const path = require("path");

// read manifest file
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "dist", "manifest.json"), "utf-8"));

// extract the build file paths
const buildFilePaths = Object.values(manifest).map((fileDetails) => "/" + fileDetails.file);

// default files to cache
const urlsToCache = ["/", "/favicon.ico", "/site.webmanifest", "/icons/icon-180.png"];

// add the build files to urlsToCache
const allUrlsToCache = [...urlsToCache, ...buildFilePaths];

// update service-worker.js
let swCode = fs.readFileSync(path.join(__dirname, "dist", "service-worker.js"), "utf-8");
swCode = swCode.replace(
  /(const urlsToCache = )\[.*?\];/s,
  `$1[${allUrlsToCache.map((url) => `'${url}'`).join(", ")}];`,
);
fs.writeFileSync(path.join(__dirname, "dist", "service-worker.js"), swCode);
