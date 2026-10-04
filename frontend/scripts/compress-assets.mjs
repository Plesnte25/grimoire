import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { brotliCompress, constants } from "node:zlib";

const assetsRoot = path.resolve("dist/assets");
const compressedExtensions = new Set([".css", ".html", ".js", ".svg"]);

function compress(buffer) {
  return new Promise((resolve, reject) => {
    brotliCompress(
      buffer,
      { params: { [constants.BROTLI_PARAM_QUALITY]: 10 } },
      (error, result) => error ? reject(error) : resolve(result),
    );
  });
}

async function visit(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await visit(file);
    } else if (compressedExtensions.has(path.extname(entry.name))) {
      const source = await readFile(file);
      const result = await compress(source);
      if (result.length < source.length) await writeFile(`${file}.br`, result);
    }
  }
}

await visit(assetsRoot);
