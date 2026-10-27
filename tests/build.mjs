import test from "node:test";
import assert from "node:assert/strict";
import { readFile, access, readdir } from "node:fs/promises";
test("MV3 distribution has local entrypoints, least-privilege permissions and valid assets", async () => {
  const root = "dist/chrome-extension/";
  const m = JSON.parse(await readFile(root + "manifest.json", "utf8"));
  assert.equal(m.manifest_version, 3);
  assert.deepEqual(m.permissions, ["storage", "sidePanel", "alarms"]);
  assert.equal(m.host_permissions, undefined);
  assert.equal(m.content_scripts, undefined);
  for (const file of [
    m.action.default_popup,
    m.side_panel.default_path,
    m.background.service_worker,
    ...Object.values(m.icons),
  ])
    await access(root + file);
  for (const file of [m.action.default_popup, m.side_panel.default_path]) {
    const html = await readFile(root + file, "utf8");
    for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
      assert.ok(!match[1].startsWith("http"));
      await access(root + match[1].replace(/^\.\//, ""));
    }
  }
  for (const file of await readdir(root + "icons")) {
    const png = await readFile(root + "icons/" + file);
    assert.equal(png.subarray(1, 4).toString(), "PNG");
  }
  assert.ok(
    (await readFile("releases/AutoGroupPoster-1.0.0.zip")).length > 10000,
  );
});
