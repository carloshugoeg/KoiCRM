import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { toCsv } from "@/lib/export/csv";
import { packStoreZip } from "@/lib/export/zip-store";

type OpenedZip = {
  names: string[];
  files: Record<string, string>;
  stored: boolean;
};

function unzipWithPython(bytes: Buffer): OpenedZip {
  const dir = mkdtempSync(join(tmpdir(), "csv-export-"));
  const zipPath = join(dir, "export.zip");
  try {
    writeFileSync(zipPath, bytes);
    const script = [
      "import json, sys, zipfile",
      "archive = zipfile.ZipFile(sys.argv[1])",
      "names = archive.namelist()",
      "files = {name: archive.read(name).decode('utf-8') for name in names}",
      "stored = all(info.compress_type == zipfile.ZIP_STORED for info in archive.infolist())",
      "print(json.dumps({'names': names, 'files': files, 'stored': stored}))",
    ].join("\n");
    const raw = execFileSync("python3", ["-c", script, zipPath], { encoding: "utf-8" });
    return JSON.parse(raw) as OpenedZip;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("toCsv", () => {
  it("quotes commas, quotes, and newlines", () => {
    expect(toCsv(["note"], [['say "hi",\nthere']])).toBe('\uFEFFnote\r\n"say ""hi"",\nthere"\r\n');
  });

  it("prefixes a formula so the cell is not executable", () => {
    expect(toCsv(["expr"], [["=1+1"]])).toBe("\uFEFFexpr\r\n'=1+1\r\n");
    expect(toCsv(["v"], [["+1"]])).toBe("\uFEFFv\r\n'+1\r\n");
    expect(toCsv(["v"], [["-1"]])).toBe("\uFEFFv\r\n'-1\r\n");
    expect(toCsv(["v"], [["@cmd"]])).toBe("\uFEFFv\r\n'@cmd\r\n");
    expect(toCsv(["v"], [["\t=1"]])).toBe("\uFEFFv\r\n'\t=1\r\n");
    expect(toCsv(["v"], [["\r=1"]])).toBe('\uFEFFv\r\n"\'\r=1"\r\n');
  });

  it("keeps the header when there are zero data rows", () => {
    expect(toCsv(["id", "name"], [])).toBe("\uFEFFid,name\r\n");
  });

  it("serializes empty cells, booleans, dates, bigints, decimals, and objects", () => {
    expect(
      toCsv(
        ["n", "b", "d", "i", "m", "o"],
        [
          [
            null,
            false,
            new Date("2026-11-17T00:00:00.000Z"),
            10n,
            new Prisma.Decimal("1999.50"),
            { n: 1 },
          ],
        ]
      )
    ).toBe('\uFEFFn,b,d,i,m,o\r\n,false,2026-11-17T00:00:00.000Z,10,1999.5,"{""n"":1}"\r\n');
    expect(toCsv(["a"], [[[1, "x"]]])).toBe('\uFEFFa\r\n"[1,""x""]"\r\n');
  });
});

describe("packStoreZip", () => {
  it("round-trips filenames and a csv that contains a comma and a quote", () => {
    const csv = toCsv(["name"], [['acme, "co"']]);
    expect(csv).toContain(",");
    expect(csv).toContain('"');

    const zip = packStoreZip([
      { name: "clients.csv", bytes: Buffer.from(csv, "utf8") },
      { name: "deals.csv", bytes: Buffer.from(toCsv(["id"], []), "utf8") },
    ]);
    const opened = unzipWithPython(zip);

    expect(opened.stored).toBe(true);
    expect(opened.names).toEqual(["clients.csv", "deals.csv"]);
    expect(opened.files["clients.csv"]).toBe(csv);
  });
});
