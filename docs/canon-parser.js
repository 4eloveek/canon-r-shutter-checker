// Browser-side reader for the Canon EOS R7 / R10 / R100 frame counter.
// No dependencies, no image decoding, no network access. Input stays in memory.

export const BLOCK_SIZE = 4608;
export const PANORAMA_BLOCK_SIZE = 16896;
export const R7_R10_COUNTER_OFFSET = 0x0c93;
export const R100_COUNTER_OFFSET = 0x0acf;
export const SPECIAL_COUNTER_VALUES = Object.freeze([0, 0xffff, 0xffffffff]);

export const CAMERAS = Object.freeze({
  'Canon EOS R7': Object.freeze({
    formats: Object.freeze(['JPEG', 'CR3']),
    verified: Object.freeze(['1.8.0/CR3', '1.6.0/JPEG']),
    prefix: Object.freeze([0xbb, 0xcc]),
    counterOffset: R7_R10_COUNTER_OFFSET,
    baseStatus: 'verified',
  }),
  'Canon EOS R10': Object.freeze({
    formats: Object.freeze(['JPEG', 'CR3']),
    verified: Object.freeze([
      '1.5.0/CR3',
      '1.5.0/JPEG',
      '1.7.0/CR3',
      '1.8.0/JPEG',
    ]),
    prefix: Object.freeze([0xbb, 0xcc]),
    counterOffset: R7_R10_COUNTER_OFFSET,
    baseStatus: 'verified',
  }),
  'Canon EOS R100': Object.freeze({
    formats: Object.freeze(['JPEG', 'CR3']),
    verified: Object.freeze(['1.0.0/JPEG', '1.0.0/CR3']),
    prefix: Object.freeze([0xbb, 0xbb]),
    counterOffset: R100_COUNTER_OFFSET,
    baseStatus: 'preliminary',
  }),
});

const CANON_UUID = '85c0b687820f11e08111f4ce462b6a48';
const MODEL_NAMES = new Map([
  ['EOS R7', 'Canon EOS R7'],
  ['EOS R10', 'Canon EOS R10'],
  ['EOS R100', 'Canon EOS R100'],
]);
const TYPE_SIZES = Object.freeze({ 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 });

export class CanonFileError extends Error {
  constructor(code, details = {}) {
    super(code);
    this.name = 'CanonFileError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, details) {
  throw new CanonFileError(code, details);
}

function isOffset(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function checkBounds(bytes, offset, length, end = bytes.length) {
  if (!isOffset(offset) || !isOffset(length) || !isOffset(end)
    || end > bytes.length || offset > end || length > end - offset) {
    fail('INVALID_FILE');
  }
}

function viewOf(bytes) {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function readAscii(bytes, offset, length, end = bytes.length) {
  checkBounds(bytes, offset, length, end);
  let value = '';
  for (let index = 0; index < length; index += 1) {
    value += String.fromCharCode(bytes[offset + index]);
  }
  return value;
}

function cleanText(value, limit = 64) {
  if (value === null || value === undefined) return null;
  const text = String(value)
    .replace(/\0/g, '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text ? text.slice(0, limit) : null;
}

function normalizeModel(value) {
  const text = cleanText(value, 64);
  if (!text) return null;
  const compact = text.replace(/^canon\s+/i, '').trim();
  return MODEL_NAMES.get(compact.toUpperCase()) || compact;
}

function normalizeFirmware(value) {
  const text = cleanText(value, 40);
  if (!text) return null;
  return text.replace(/^firmware version\s+/i, '').trim() || null;
}

class Tiff {
  constructor(bytes) {
    checkBounds(bytes, 0, 8);
    const order = readAscii(bytes, 0, 2);
    if (order !== 'II' && order !== 'MM') fail('INVALID_FILE');
    this.bytes = bytes;
    this.le = order === 'II';
    this.view = viewOf(bytes);
    if (this.u16(2) !== 42) fail('INVALID_FILE');
    this.root = this.u32(4);
    if (this.root < 8) fail('INVALID_FILE');
  }

  u16(offset, end = this.bytes.length) {
    checkBounds(this.bytes, offset, 2, end);
    return this.view.getUint16(offset, this.le);
  }

  u32(offset, end = this.bytes.length) {
    checkBounds(this.bytes, offset, 4, end);
    return this.view.getUint32(offset, this.le);
  }

  directory(offset = this.root, end = this.bytes.length) {
    checkBounds(this.bytes, offset, 2, end);
    const count = this.u16(offset, end);
    if (count > 4096) fail('INVALID_FILE');
    checkBounds(this.bytes, offset + 2, count * 12 + 4, end);
    const entries = new Map();
    for (let index = 0; index < count; index += 1) {
      const entry = offset + 2 + index * 12;
      const tag = this.u16(entry, end);
      if (entries.has(tag)) fail('INVALID_FILE');
      entries.set(tag, entry);
    }
    return entries;
  }

  value(entry, types, start = 0, end = this.bytes.length) {
    if (entry === undefined) fail('MISSING_METADATA');
    const type = this.u16(entry + 2, end);
    const size = TYPE_SIZES[type];
    if (!size || !types.includes(type)) fail('INVALID_FILE');
    const count = this.u32(entry + 4, end);
    const length = count * size;
    const offset = length <= 4 ? entry + 8 : this.u32(entry + 8, end);
    checkBounds(this.bytes, offset, length, end);
    if (offset < start) fail('INVALID_FILE');
    return { offset, length, type, count };
  }

  text(entry, limit = 256, start = 0, end = this.bytes.length) {
    if (entry === undefined) return null;
    const value = this.value(entry, [2], start, end);
    if (value.length === 0 || value.length > limit) return null;
    return readAscii(this.bytes, value.offset, value.length, end)
      .split('\0')[0];
  }

  pointer(entry) {
    const value = this.value(entry, [4]);
    if (value.length !== 4) fail('INVALID_FILE');
    return this.u32(value.offset);
  }
}

function readIdentity(tiff, state) {
  const entries = tiff.directory();
  const make = cleanText(tiff.text(entries.get(0x010f)), 64);
  const model = normalizeModel(tiff.text(entries.get(0x0110)));
  if (make && make.toLowerCase() !== 'canon') state.foreignMake = true;
  if (model) state.models.add(model);
  return entries;
}

function resolveCamera(state) {
  if (state.models.size === 0) fail('UNSUPPORTED_MODEL', { model: null });
  if (state.models.size > 1) fail('INVALID_FILE', { reason: 'conflicting-models' });
  const model = [...state.models][0];
  if (state.foreignMake || !CAMERAS[model]) {
    fail('UNSUPPORTED_MODEL', { model });
  }
  return { model, spec: CAMERAS[model] };
}

function acceptBlock(tiff, block, spec, state) {
  state.sawCameraInfo = true;
  if (block.length === PANORAMA_BLOCK_SIZE) {
    state.panorama = true;
    return;
  }
  if (block.length !== BLOCK_SIZE) {
    state.otherLayout = true;
    return;
  }
  const { bytes } = tiff;
  if (bytes[block.offset] !== spec.prefix[0]
    || bytes[block.offset + 1] !== spec.prefix[1]) {
    state.otherLayout = true;
    return;
  }
  state.counts.add(tiff.view.getUint32(block.offset + spec.counterOffset, true));
}

function scanMakerNotes(tiff, directory, spec, state, start, end) {
  const firmware = normalizeFirmware(tiff.text(directory.get(0x0007), 40, start, end));
  if (firmware) state.firmwares.add(firmware);

  const cameraInfo = directory.get(0x000d);
  if (cameraInfo !== undefined) {
    // Canon stores CameraInfo as UNDEFINED; accept BYTE as well for tolerance.
    const block = tiff.value(cameraInfo, [7, 1], start, end);
    acceptBlock(tiff, block, spec, state);
  }
}

function parseExif(tiffBytes, state) {
  const tiff = new Tiff(tiffBytes);
  const root = readIdentity(tiff, state);
  const { spec } = resolveCamera(state);

  const exifPointer = root.get(0x8769);
  if (exifPointer === undefined) fail('MISSING_METADATA');
  const exif = tiff.directory(tiff.pointer(exifPointer));

  const makerNote = exif.get(0x927c);
  if (makerNote === undefined) fail('MISSING_METADATA');
  const note = tiff.value(makerNote, [7, 1]);
  const noteEnd = note.offset + note.length;
  const noteDirectory = tiff.directory(note.offset, noteEnd);
  scanMakerNotes(tiff, noteDirectory, spec, state, note.offset, noteEnd);
}

function parseJpeg(bytes, state) {
  let position = 2;
  while (position < bytes.length) {
    if (bytes[position] !== 0xff) fail('INVALID_FILE');
    while (position < bytes.length && bytes[position] === 0xff) position += 1;
    if (position >= bytes.length) fail('INVALID_FILE');
    const marker = bytes[position];
    position += 1;

    if (marker === 0xda || marker === 0xd9) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (marker === 0x00 || marker === 0xd8) fail('INVALID_FILE');

    checkBounds(bytes, position, 2);
    const length = (bytes[position] << 8) | bytes[position + 1];
    if (length < 2) fail('INVALID_FILE');
    checkBounds(bytes, position, length);

    if (marker === 0xe1 && length >= 8
      && readAscii(bytes, position + 2, 6) === 'Exif\0\0') {
      parseExif(bytes.subarray(position + 8, position + length), state);
      return;
    }
    position += length;
  }
  fail('MISSING_METADATA');
}

class Bmff {
  constructor(bytes) {
    this.bytes = bytes;
    this.view = viewOf(bytes);
    this.boxCount = 0;
  }

  u32(offset, end = this.bytes.length) {
    checkBounds(this.bytes, offset, 4, end);
    return this.view.getUint32(offset);
  }

  u64(offset, end = this.bytes.length) {
    const high = this.u32(offset, end);
    const low = this.u32(offset + 4, end);
    const value = high * 0x100000000 + low;
    if (!Number.isSafeInteger(value)) fail('INVALID_FILE');
    return value;
  }

  boxes(start, end) {
    const result = [];
    let offset = start;
    while (offset < end) {
      this.boxCount += 1;
      if (this.boxCount > 10000) fail('INVALID_FILE');
      checkBounds(this.bytes, offset, 8, end);
      let size = this.u32(offset, end);
      const type = readAscii(this.bytes, offset + 4, 4, end);
      let header = 8;
      if (size === 1) {
        checkBounds(this.bytes, offset, 16, end);
        size = this.u64(offset + 8, end);
        header = 16;
      } else if (size === 0) {
        size = end - offset;
      }
      if (!Number.isSafeInteger(size) || size < header || size > end - offset) {
        fail('INVALID_FILE');
      }
      result.push({ type, start: offset + header, end: offset + size });
      offset += size;
    }
    return result;
  }

  children(box) {
    return this.boxes(box.start, box.end);
  }
}

function uuidHex(bytes, box) {
  if (box.end - box.start < 16) return '';
  let value = '';
  for (let index = 0; index < 16; index += 1) {
    value += bytes[box.start + index].toString(16).padStart(2, '0');
  }
  return value;
}

function onlyBoxOrNull(boxes, type) {
  const matches = boxes.filter((box) => box.type === type);
  if (matches.length > 1) fail('INVALID_FILE');
  return matches[0] || null;
}

function requireOneBox(boxes, type, missingCode) {
  const matches = boxes.filter((box) => box.type === type);
  if (matches.length !== 1) fail(matches.length ? 'INVALID_FILE' : missingCode);
  return matches[0];
}

function parseCtmd(bytes, spec, state) {
  const view = viewOf(bytes);
  let offset = 0;
  let records = 0;
  while (offset < bytes.length) {
    records += 1;
    if (records > 100000) fail('INVALID_FILE');
    checkBounds(bytes, offset, 12);
    const size = view.getUint32(offset, true);
    const type = view.getUint16(offset + 4, true);
    if (size < 12 || size > bytes.length - offset) fail('INVALID_FILE');

    if (type === 7 || type === 8 || type === 9) {
      let inner = offset + 12;
      while (inner < offset + size) {
        checkBounds(bytes, inner, 8, offset + size);
        const length = view.getUint32(inner, true);
        const tag = view.getUint32(inner + 4, true);
        if (length < 8 || length > offset + size - inner) fail('INVALID_FILE');
        if (tag === 0x927c) {
          const tiff = new Tiff(bytes.subarray(inner + 8, inner + length));
          const directory = tiff.directory();
          scanMakerNotes(tiff, directory, spec, state, 8, tiff.bytes.length);
        }
        inner += length;
      }
    }
    offset += size;
  }
}

function trackStbl(bmff, track) {
  const mdia = onlyBoxOrNull(bmff.children(track), 'mdia');
  if (!mdia) return null;
  const minf = onlyBoxOrNull(bmff.children(mdia), 'minf');
  if (!minf) return null;
  return onlyBoxOrNull(bmff.children(minf), 'stbl');
}

function parseCtmdTrack(bmff, track, bytes, topLevel, spec, state) {
  const stbl = trackStbl(bmff, track);
  if (!stbl) return;
  const stsd = onlyBoxOrNull(bmff.children(stbl), 'stsd');
  if (!stsd) return;
  const declared = bmff.u32(stsd.start + 4, stsd.end);
  const descriptions = bmff.boxes(stsd.start + 8, stsd.end);
  if (declared !== descriptions.length) fail('INVALID_FILE');
  if (!descriptions.some((box) => box.type === 'CTMD')) return;

  state.ctmdTracks += 1;
  if (state.ctmdTracks > 1) fail('MULTIFRAME');
  if (descriptions.length !== 1) fail('MULTIFRAME');

  const stsz = onlyBoxOrNull(bmff.children(stbl), 'stsz');
  const stsc = onlyBoxOrNull(bmff.children(stbl), 'stsc');
  if (!stsz || !stsc) fail('MISSING_METADATA');

  const sampleSize = bmff.u32(stsz.start + 4, stsz.end);
  const sampleCount = bmff.u32(stsz.start + 8, stsz.end);
  if (sampleCount !== 1) fail(sampleCount > 1 ? 'MULTIFRAME' : 'INVALID_FILE');
  let size = sampleSize;
  if (size === 0) {
    checkBounds(bytes, stsz.start + 12, 4, stsz.end);
    size = bmff.u32(stsz.start + 12, stsz.end);
  }
  if (size === 0) fail('INVALID_FILE');

  const chunkCount = bmff.u32(stsc.start + 4, stsc.end);
  if (chunkCount !== 1) fail('MULTIFRAME');
  if (bmff.u32(stsc.start + 8, stsc.end) !== 1
    || bmff.u32(stsc.start + 12, stsc.end) !== 1
    || bmff.u32(stsc.start + 16, stsc.end) !== 1) {
    fail('MULTIFRAME');
  }

  const locations = bmff.children(stbl).filter(
    (box) => box.type === 'stco' || box.type === 'co64',
  );
  if (locations.length !== 1) fail('INVALID_FILE');
  const location = locations[0];
  const offsetCount = bmff.u32(location.start + 4, location.end);
  if (offsetCount !== 1) fail('MULTIFRAME');
  const sampleOffset = location.type === 'co64'
    ? bmff.u64(location.start + 8, location.end)
    : bmff.u32(location.start + 8, location.end);
  checkBounds(bytes, sampleOffset, size);
  if (!topLevel.some((box) => box.type === 'mdat'
    && sampleOffset >= box.start && sampleOffset + size <= box.end)) {
    fail('INVALID_FILE');
  }

  parseCtmd(bytes.subarray(sampleOffset, sampleOffset + size), spec, state);
}

function parseCr3(bytes, state) {
  const bmff = new Bmff(bytes);
  const topLevel = bmff.boxes(0, bytes.length);
  const ftyp = requireOneBox(topLevel, 'ftyp', 'UNSUPPORTED_FORMAT');
  if (readAscii(bytes, ftyp.start, 4, ftyp.end) !== 'crx ') fail('UNSUPPORTED_FORMAT');

  const moov = requireOneBox(topLevel, 'moov', 'INVALID_FILE');
  const moovChildren = bmff.children(moov);
  const canonBoxes = moovChildren.filter((box) => box.type === 'uuid'
    && uuidHex(bytes, box) === CANON_UUID);
  if (canonBoxes.length !== 1) fail('MISSING_METADATA');
  const metadata = bmff.boxes(canonBoxes[0].start + 16, canonBoxes[0].end);

  const cmt1 = requireOneBox(metadata, 'CMT1', 'MISSING_METADATA');
  const identityTiff = new Tiff(bytes.subarray(cmt1.start, cmt1.end));
  readIdentity(identityTiff, state);
  const { spec } = resolveCamera(state);

  const cmt3 = metadata.filter((box) => box.type === 'CMT3');
  if (cmt3.length > 1) fail('INVALID_FILE');
  if (cmt3.length === 1) {
    const tiff = new Tiff(bytes.subarray(cmt3[0].start, cmt3[0].end));
    const directory = tiff.directory();
    scanMakerNotes(tiff, directory, spec, state, 8, tiff.bytes.length);
  }

  for (const track of moovChildren.filter((box) => box.type === 'trak')) {
    parseCtmdTrack(bmff, track, bytes, topLevel, spec, state);
  }
}

function finish(state, format) {
  const { model, spec } = resolveCamera(state);
  if (!spec.formats.includes(format)) {
    fail('UNSUPPORTED_FILE_TYPE', { model, format });
  }
  const firmware = state.firmwares.size === 1
    ? [...state.firmwares][0]
    : 'unknown';

  if (state.counts.size === 0) {
    if (state.panorama) {
      fail('UNKNOWN_LAYOUT', { panorama: true, blockSize: PANORAMA_BLOCK_SIZE });
    }
    if (state.sawCameraInfo || state.otherLayout) {
      fail('UNKNOWN_LAYOUT', { panorama: false, blockSize: BLOCK_SIZE });
    }
    fail('MISSING_METADATA');
  }
  if (state.counts.size > 1) fail('CONFLICTING_COUNTERS');

  const shutterCount = [...state.counts][0];
  if (SPECIAL_COUNTER_VALUES.includes(shutterCount)) {
    fail('COUNTER_UNAVAILABLE', { value: shutterCount });
  }
  const combination = firmware + '/' + format;
  const status = spec.verified.includes(combination)
    ? spec.baseStatus
    : 'unverified';
  return { model, firmware, format, shutterCount, status };
}

export function parseCanonFile(input) {
  let bytes;
  if (input instanceof Uint8Array) {
    bytes = input;
  } else if (input instanceof ArrayBuffer) {
    bytes = new Uint8Array(input);
  } else {
    throw new TypeError('parseCanonFile expects a Uint8Array or ArrayBuffer');
  }
  if (bytes.length < 8) fail('UNSUPPORTED_FORMAT');

  const state = {
    models: new Set(),
    firmwares: new Set(),
    counts: new Set(),
    sawCameraInfo: false,
    panorama: false,
    otherLayout: false,
    foreignMake: false,
    ctmdTracks: 0,
  };

  let format;
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    format = 'JPEG';
    parseJpeg(bytes, state);
  } else if (readAscii(bytes, 4, 4) === 'ftyp') {
    format = 'CR3';
    parseCr3(bytes, state);
  } else {
    fail('UNSUPPORTED_FORMAT');
  }
  return finish(state, format);
}
