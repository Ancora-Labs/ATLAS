import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const indexPath = path.join(rootDir, "index.html");
const stylesPath = path.join(rootDir, "styles.css");
const scriptPath = path.join(rootDir, "script.js");

describe("velora landing page", () => {
  it("ships the hero with the required brand language and conversion actions", async () => {
    const indexHtml = await fs.readFile(indexPath, "utf8");

    assert.match(indexHtml, /<h1[^>]*>VELORA<\/h1>/i);
    assert.match(indexHtml, /Warm light, bold plates, and a table worth arriving early for\./i);
    assert.match(indexHtml, /VELORA brings fire-kissed cooking, candlelit hospitality, and distinctive plating/i);
    assert.match(indexHtml, /Explore the tasting menu/i);
    assert.match(indexHtml, /Reserve a table/i);
    assert.match(indexHtml, /Order for tonight/i);
  });

  it("keeps the hero warm and food-led instead of generic or off-brief", async () => {
    const [indexHtml, stylesCss] = await Promise.all([
      fs.readFile(indexPath, "utf8"),
      fs.readFile(stylesPath, "utf8"),
    ]);

    assert.match(indexHtml, /Signature presentation/i);
    assert.match(indexHtml, /Ember ribeye, saffron carrots, and citrus smoke\./i);
    assert.match(stylesCss, /--glow-amber:/i);
    assert.match(stylesCss, /\.plate-stage/i);
    assert.doesNotMatch(indexHtml, /ATLAS Desktop Onboarding|desktop-native software delivery shell/i);
  });

  it("includes responsive styling and a small interactive service toggle", async () => {
    const [stylesCss, scriptJs] = await Promise.all([
      fs.readFile(stylesPath, "utf8"),
      fs.readFile(scriptPath, "utf8"),
    ]);

    assert.match(stylesCss, /@media \(max-width: 980px\)/i);
    assert.match(stylesCss, /@media \(max-width: 720px\)/i);
    assert.match(scriptJs, /setActiveService/i);
    assert.match(scriptJs, /Reservations are leading the first impression right now\./i);
  });
});
