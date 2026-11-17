import { crc32 } from "node:zlib";

const LOCAL_FILE_HEADER = 0x04034b50;
const CENTRAL_DIRECTORY_HEADER = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const STORE = 0;
const UTF8_NAMES = 0x0800;
const VERSION = 20;
const UINT16_MAX = 0xffff;
const UINT32_MAX = 0xffffffff;

export type ZipEntry = {
  name: string;
  bytes: Buffer;
};

function dosDateTime(when: Date): { time: number; date: number } {
  const year = Math.min(2107, Math.max(1980, when.getFullYear()));
  const time =
    (when.getHours() << 11) | (when.getMinutes() << 5) | Math.floor(when.getSeconds() / 2);
  const date = ((year - 1980) << 9) | ((when.getMonth() + 1) << 5) | when.getDate();
  return { time, date };
}

function localHeader(
  name: Buffer,
  crc: number,
  size: number,
  stamp: { time: number; date: number }
): Buffer {
  const header = Buffer.alloc(30 + name.length);
  header.writeUInt32LE(LOCAL_FILE_HEADER, 0);
  header.writeUInt16LE(VERSION, 4);
  header.writeUInt16LE(UTF8_NAMES, 6);
  header.writeUInt16LE(STORE, 8);
  header.writeUInt16LE(stamp.time, 10);
  header.writeUInt16LE(stamp.date, 12);
  header.writeUInt32LE(crc, 14);
  header.writeUInt32LE(size, 18);
  header.writeUInt32LE(size, 22);
  header.writeUInt16LE(name.length, 26);
  header.writeUInt16LE(0, 28);
  name.copy(header, 30);
  return header;
}

function centralHeader(
  name: Buffer,
  crc: number,
  size: number,
  offset: number,
  stamp: { time: number; date: number }
): Buffer {
  const header = Buffer.alloc(46 + name.length);
  header.writeUInt32LE(CENTRAL_DIRECTORY_HEADER, 0);
  header.writeUInt16LE(VERSION, 4);
  header.writeUInt16LE(VERSION, 6);
  header.writeUInt16LE(UTF8_NAMES, 8);
  header.writeUInt16LE(STORE, 10);
  header.writeUInt16LE(stamp.time, 12);
  header.writeUInt16LE(stamp.date, 14);
  header.writeUInt32LE(crc, 16);
  header.writeUInt32LE(size, 20);
  header.writeUInt32LE(size, 24);
  header.writeUInt16LE(name.length, 28);
  header.writeUInt16LE(0, 30);
  header.writeUInt16LE(0, 32);
  header.writeUInt16LE(0, 34);
  header.writeUInt16LE(0, 36);
  header.writeUInt32LE(0, 38);
  header.writeUInt32LE(offset, 42);
  name.copy(header, 46);
  return header;
}

export function packStoreZip(entries: readonly ZipEntry[]): Buffer {
  if (entries.length > UINT16_MAX) throw new Error("too many zip entries");

  const stamp = dosDateTime(new Date());
  const parts: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    if (entry.name.length === 0 || entry.name.includes("/") || entry.name.includes("\\")) {
      throw new Error(`invalid zip entry name: ${entry.name}`);
    }
    if (entry.bytes.length > UINT32_MAX) throw new Error(`zip entry too large: ${entry.name}`);

    const name = Buffer.from(entry.name, "utf8");
    if (name.length > UINT16_MAX) throw new Error(`zip entry name too long: ${entry.name}`);

    const size = entry.bytes.length;
    const crc = crc32(entry.bytes) >>> 0;
    const local = localHeader(name, crc, size, stamp);
    parts.push(local, entry.bytes);
    centrals.push(centralHeader(name, crc, size, offset, stamp));
    offset += local.length + size;
  }

  const central = Buffer.concat(centrals);
  if (central.length > UINT32_MAX || offset > UINT32_MAX) throw new Error("zip too large");

  const end = Buffer.alloc(22);
  end.writeUInt32LE(END_OF_CENTRAL_DIRECTORY, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...parts, central, end]);
}
