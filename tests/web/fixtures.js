// Synthetic metadata only. No real photos, serial numbers, GPS or user data.

const encoder = new TextEncoder();

export const MODEL_LAYOUT = Object.freeze({
  'Canon EOS R7': { prefix: [0xbb, 0xcc], counterOffset: 0x0c93 },
  'Canon EOS R10': { prefix: [0xbb, 0xcc], counterOffset: 0x0c93 },
  'Canon EOS R100': { prefix: [0xbb, 0xbb], counterOffset: 0x0acf },
});

export function concat(...arrays) {
  const result = new Uint8Array(arrays.reduce((sum, array) => sum + array.length, 0));
  let offset = 0;
  for (const array of arrays) {
    result.set(array, offset);
    offset += array.length;
  }
  return result;
}

const ascii = (value) => encoder.encode(value);

function u16be(value) {
  const bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setUint16(0, value);
  return bytes;
}

function u32be(value) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value);
  return bytes;
}

function u64be(value) {
  const bytes = new Uint8Array(8);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, Math.floor(value / 0x100000000));
  view.setUint32(4, value % 0x100000000);
  return bytes;
}

function setU16(bytes, offset, value, le) {
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    .setUint16(offset, value, le);
}

function setU32(bytes, offset, value, le) {
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    .setUint32(offset, value, le);
}

function setU64(bytes, offset, value, le) {
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    .setUint32(offset, Math.floor(value / 0x100000000), le);
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    .setUint32(offset + 4, value % 0x100000000, le);
}

function setText(bytes, offset, value) {
  bytes.set(ascii(value), offset);
}

function entry(bytes, offset, tag, type, count, value, le) {
  setU16(bytes, offset, tag, le);
  setU16(bytes, offset + 2, type, le);
  setU32(bytes, offset + 4, count, le);
  setU32(bytes, offset + 8, value, le);
}

export function cameraInfoBytes({
  size = 4608,
  prefix = [0xbb, 0xcc],
  counterOffset = 0x0c93,
  count = 0,
  decoy = 7777,
} = {}) {
  const bytes = new Uint8Array(size);
  bytes[0] = prefix[0];
  bytes[1] = prefix[1];
  if (size >= 0x0c97) setU32(bytes, 0x0c93, decoy, true);
  setU32(bytes, counterOffset, count, true);
  return bytes;
}

// Standalone Canon MakerNote TIFF. Counter bytes are always little-endian.
export function makerNoteTiff({
  le = true,
  firmware = '1.8.0',
  includeFirmware = true,
  count = 0,
  block,
  blockTag = 0x000d,
} = {}) {
  const cameraInfo = block || cameraInfoBytes({ count });
  const buffer = new Uint8Array(128 + cameraInfo.length);
  setText(buffer, 0, le ? 'II' : 'MM');
  setU16(buffer, 2, 42, le);
  setU32(buffer, 4, 8, le);

  const entries = [];
  if (includeFirmware) {
    const text = 'Firmware Version ' + firmware + '\0';
    setText(buffer, 64, text);
    entries.push({ tag: 0x0007, type: 2, count: text.length, value: 64 });
  }
  entries.push({ tag: blockTag, type: 7, count: cameraInfo.length, value: 128 });

  setU16(buffer, 8, entries.length, le);
  entries.forEach((item, index) => {
    entry(buffer, 10 + index * 12, item.tag, item.type, item.count, item.value, le);
  });
  setU32(buffer, 10 + entries.length * 12, 0, le);
  buffer.set(cameraInfo, 128);
  return buffer;
}

export function identityTiff({
  le = true,
  make = 'Canon',
  model = 'Canon EOS R7',
} = {}) {
  const buffer = new Uint8Array(256);
  setText(buffer, 0, le ? 'II' : 'MM');
  setU16(buffer, 2, 42, le);
  setU32(buffer, 4, 8, le);
  setU16(buffer, 8, 2, le);
  const makeText = make + '\0';
  const modelText = model + '\0';
  setText(buffer, 64, makeText);
  setText(buffer, 96, modelText);
  entry(buffer, 10, 0x010f, 2, makeText.length, 64, le);
  entry(buffer, 22, 0x0110, 2, modelText.length, 96, le);
  setU32(buffer, 34, 0, le);
  return buffer;
}

// Full Exif TIFF for JPEG: IFD0 -> ExifIFD -> MakerNote -> CameraInfo.
export function exifTiff({
  le = true,
  make = 'Canon',
  model = 'Canon EOS R7',
  firmware = '1.8.0',
  includeFirmware = true,
  includeCameraInfo = true,
  includeMakerNote = true,
  includeExifPointer = true,
  count = 0,
  block,
} = {}) {
  const cameraInfo = block || cameraInfoBytes({ count });
  const blockSize = cameraInfo.length;
  const buffer = new Uint8Array(1024 + blockSize);
  setText(buffer, 0, le ? 'II' : 'MM');
  setU16(buffer, 2, 42, le);
  setU32(buffer, 4, 8, le);

  const makeText = make + '\0';
  const modelText = model + '\0';
  setText(buffer, 64, makeText);
  setText(buffer, 96, modelText);

  setU16(buffer, 8, includeExifPointer ? 3 : 2, le);
  entry(buffer, 10, 0x010f, 2, makeText.length, 64, le);
  entry(buffer, 22, 0x0110, 2, modelText.length, 96, le);
  if (includeExifPointer) {
    entry(buffer, 34, 0x8769, 4, 1, 160, le);
    setU32(buffer, 46, 0, le);
  } else {
    setU32(buffer, 34, 0, le);
  }

  if (!includeMakerNote) return buffer;

  const noteLength = buffer.length - 256;
  setU16(buffer, 160, 1, le);
  entry(buffer, 162, 0x927c, 7, noteLength, 256, le);
  setU32(buffer, 174, 0, le);

  const noteEntries = [];
  if (includeFirmware) {
    const text = 'Firmware Version ' + firmware + '\0';
    setText(buffer, 512, text);
    noteEntries.push({ tag: 0x0007, type: 2, count: text.length, value: 512 });
  }
  if (includeCameraInfo) {
    noteEntries.push({ tag: 0x000d, type: 7, count: blockSize, value: 1024 });
    buffer.set(cameraInfo, 1024);
  }
  setU16(buffer, 256, noteEntries.length, le);
  noteEntries.forEach((item, index) => {
    entry(buffer, 258 + index * 12, item.tag, item.type, item.count, item.value, le);
  });
  setU32(buffer, 258 + noteEntries.length * 12, 0, le);
  return buffer;
}

function app1(payload) {
  const length = payload.length + 2;
  const segment = new Uint8Array(4 + payload.length);
  segment[0] = 0xff;
  segment[1] = 0xe1;
  segment[2] = (length >> 8) & 0xff;
  segment[3] = length & 0xff;
  segment.set(payload, 4);
  return segment;
}

export function jpegFixture(options = {}) {
  const { xmpFirst = false, ...tiffOptions } = options;
  const tiff = exifTiff(tiffOptions);
  const exifSegment = app1(concat(ascii('Exif\0\0'), tiff));
  const xmpSegment = app1(concat(
    ascii('http://ns.adobe.com/xap/1.0/\0'),
    ascii('<x:xmpmeta/>'),
  ));
  return concat(
    new Uint8Array([0xff, 0xd8]),
    xmpFirst ? xmpSegment : new Uint8Array(0),
    exifSegment,
    new Uint8Array([0xff, 0xd9]),
  );
}

function box(type, ...payload) {
  const body = concat(...payload);
  return concat(u32be(body.length + 8), ascii(type), body);
}

const CANON_UUID = new Uint8Array([
  0x85, 0xc0, 0xb6, 0x87, 0x82, 0x0f, 0x11, 0xe0,
  0x81, 0x11, 0xf4, 0xce, 0x46, 0x2b, 0x6a, 0x48,
]);

function ctmdSample(tiff) {
  const sub = new Uint8Array(8 + tiff.length);
  const subView = new DataView(sub.buffer);
  subView.setUint32(0, sub.length, true);
  subView.setUint32(4, 0x927c, true);
  sub.set(tiff, 8);

  const record = new Uint8Array(12 + sub.length);
  const recordView = new DataView(record.buffer);
  recordView.setUint32(0, record.length, true);
  recordView.setUint16(4, 8, true);
  record.set(sub, 12);
  return record;
}

export function cr3Fixture({
  model = 'Canon EOS R7',
  firmware = '1.8.0',
  le = true,
  count = 18692,
  prefix,
  counterOffset,
  blockSize = 4608,
  staticCount,
  co64 = true,
  variableSize = false,
  extendedMdat = false,
  samples = 1,
  tracks = 1,
  sampleOffset,
  brand = 'crx ',
  includeCameraInfo = true,
  includeFirmware = true,
} = {}) {
  const layout = MODEL_LAYOUT[model] || MODEL_LAYOUT['Canon EOS R7'];
  const block = cameraInfoBytes({
    size: blockSize,
    prefix: prefix || layout.prefix,
    counterOffset: counterOffset ?? layout.offset,
    count,
  });
  const staticBlock = staticCount === undefined ? undefined : cameraInfoBytes({
    size: blockSize,
    prefix: prefix || layout.prefix,
    counterOffset: counterOffset ?? layout.offset,
    count: staticCount,
  });

  const timedNotes = makerNoteTiff({
    le,
    firmware,
    includeFirmware,
    block: includeCameraInfo ? block : new Uint8Array(0),
    blockTag: includeCameraInfo ? 0x000d : 0x9999,
  });
  const staticNotes = makerNoteTiff({
    le,
    firmware,
    block: staticBlock || new Uint8Array(0),
    blockTag: staticBlock ? 0x000d : 0x9999,
  });
  const sample = ctmdSample(timedNotes);

  function track(offset) {
    const sizes = variableSize
      ? box('stsz', u32be(0), u32be(0), u32be(samples), ...Array(samples).fill(u32be(sample.length)))
      : box('stsz', u32be(0), u32be(sample.length), u32be(samples));
    const locations = co64
      ? box('co64', u32be(0), u32be(1), u64be(offset))
      : box('stco', u32be(0), u32be(1), u32be(offset));
    const table = box(
      'stbl',
      box('stsd', u32be(0), u32be(1), box('CTMD', new Uint8Array(8))),
      box('stsc', u32be(0), u32be(1), u32be(1), u32be(1), u32be(1)),
      sizes,
      locations,
    );
    return box('trak', box('mdia', box('minf', table)));
  }

  function movie(offset) {
    const metadata = box(
      'uuid',
      CANON_UUID,
      box('CMT1', identityTiff({ le, model })),
      box('CMT3', staticNotes),
    );
    const trackBoxes = Array.from({ length: tracks }, () => track(offset));
    return box('moov', metadata, ...trackBoxes);
  }

  const ftyp = box('ftyp', ascii(brand), u32be(1), ascii(brand), ascii('isom'));
  const padding = new Uint8Array(31);
  const mdatHeader = extendedMdat ? 16 : 8;
  const computedOffset = ftyp.length + movie(0).length + mdatHeader + padding.length;
  const offset = sampleOffset ?? computedOffset;
  const moov = movie(offset);
  const mdat = extendedMdat
    ? concat(
      u32be(1),
      ascii('mdat'),
      u64be(16 + padding.length + sample.length),
      padding,
      sample,
    )
    : box('mdat', padding, sample);

  return concat(ftyp, moov, mdat);
}
