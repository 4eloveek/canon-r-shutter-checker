import assert from 'node:assert/strict';
import test from 'node:test';

import { parseCanonFile } from '../../docs/canon-parser.js';
import {
  cameraInfoBytes,
  cr3Fixture,
  jpegFixture,
} from './fixtures.js';

function parse(bytes) {
  return parseCanonFile(bytes);
}

function expectError(fn, code, details = {}) {
  assert.throws(fn, (error) => {
    assert.equal(error.name, 'CanonFileError');
    assert.equal(error.code, code);
    for (const [key, value] of Object.entries(details)) {
      assert.deepEqual(error.details[key], value, 'detail ' + key);
    }
    return true;
  });
}

function r100Block(count, options = {}) {
  return cameraInfoBytes({
    prefix: [0xbb, 0xbb],
    counterOffset: 0x0acf,
    count,
    decoy: 7777,
    ...options,
  });
}

test('R10 JPEG 1.5.0 is verified', () => {
  const result = parse(jpegFixture({
    model: 'Canon EOS R10',
    firmware: '1.5.0',
    count: 16685,
  }));
  assert.deepEqual(result, {
    model: 'Canon EOS R10',
    firmware: '1.5.0',
    format: 'JPEG',
    shutterCount: 16685,
    status: 'verified',
  });
});

test('R7 JPEG 1.6.0 with big-endian TIFF is verified', () => {
  const bytes = jpegFixture({
    le: false,
    model: 'Canon EOS R7',
    firmware: '1.6.0',
    count: 4493,
  });
  assert.equal(parse(bytes).shutterCount, 4493);
  assert.equal(parse(bytes).status, 'verified');
});

test('R7 JPEG 1.8.0 is unverified but readable', () => {
  const result = parse(jpegFixture({
    model: 'Canon EOS R7',
    firmware: '1.8.0',
    count: 18650,
  }));
  assert.equal(result.shutterCount, 18650);
  assert.equal(result.status, 'unverified');
});

test('R10 JPEG 1.8.0 community pair is verified', () => {
  const result = parse(jpegFixture({
    model: 'Canon EOS R10',
    firmware: '1.8.0',
    count: 1200,
  }));
  assert.equal(result.shutterCount, 1200);
  assert.equal(result.status, 'verified');
});

test('R100 JPEG uses 0x0acf and stays preliminary', () => {
  const result = parse(jpegFixture({
    model: 'Canon EOS R100',
    firmware: '1.0.0',
    block: r100Block(5016),
  }));
  assert.deepEqual(result, {
    model: 'Canon EOS R100',
    firmware: '1.0.0',
    format: 'JPEG',
    shutterCount: 5016,
    status: 'preliminary',
  });
});

test('R100 unknown firmware is unverified', () => {
  const result = parse(jpegFixture({
    model: 'Canon EOS R100',
    firmware: '1.1.0',
    block: r100Block(5016),
  }));
  assert.equal(result.status, 'unverified');
});

test('R7 CR3 co64 sample is verified', () => {
  const result = parse(cr3Fixture({
    model: 'Canon EOS R7',
    firmware: '1.8.0',
    count: 18692,
    co64: true,
  }));
  assert.deepEqual(result, {
    model: 'Canon EOS R7',
    firmware: '1.8.0',
    format: 'CR3',
    shutterCount: 18692,
    status: 'verified',
  });
});

test('R10 CR3 stco sample is verified', () => {
  const result = parse(cr3Fixture({
    model: 'Canon EOS R10',
    firmware: '1.7.0',
    count: 31669,
    co64: false,
  }));
  assert.equal(result.shutterCount, 31669);
  assert.equal(result.status, 'verified');
});

test('R100 CR3 uses the same R100 offset', () => {
  const result = parse(cr3Fixture({
    model: 'Canon EOS R100',
    firmware: '1.0.0',
    count: 5055,
    prefix: [0xbb, 0xbb],
    counterOffset: 0x0acf,
  }));
  assert.equal(result.shutterCount, 5055);
  assert.equal(result.status, 'preliminary');
});

test('CR3 supports an extended-size mdat box', () => {
  const result = parse(cr3Fixture({
    model: 'Canon EOS R7',
    firmware: '1.8.0',
    count: 18693,
    extendedMdat: true,
  }));
  assert.equal(result.shutterCount, 18693);
});

test('CR3 supports a variable-size stsz table', () => {
  const result = parse(cr3Fixture({
    model: 'Canon EOS R7',
    firmware: '1.8.0',
    count: 18694,
    variableSize: true,
  }));
  assert.equal(result.shutterCount, 18694);
});

test('four-byte counter implementation reads values above 65535', () => {
  // This checks the reader only. No real high-count camera sample is implied.
  const result = parse(cr3Fixture({
    model: 'Canon EOS R7',
    firmware: '1.8.0',
    count: 100000,
  }));
  assert.equal(result.shutterCount, 100000);
});

test('CR3 with several samples is rejected as multiframe', () => {
  expectError(() => parse(cr3Fixture({ samples: 2 })), 'MULTIFRAME');
});

test('CR3 with several CTMD tracks is rejected as multiframe', () => {
  expectError(() => parse(cr3Fixture({ tracks: 2 })), 'MULTIFRAME');
});

test('CR3 sample offset outside mdat is rejected', () => {
  expectError(() => parse(cr3Fixture({ sampleOffset: 10 })), 'INVALID_FILE');
});

test('panorama block size is reported separately', () => {
  expectError(
    () => parse(jpegFixture({
      block: cameraInfoBytes({ size: 16896, count: 123 }),
    })),
    'UNKNOWN_LAYOUT',
    { panorama: true, blockSize: 16896 },
  );
});

test('focus-stack sentinel zero is unavailable', () => {
  expectError(
    () => parse(jpegFixture({ block: cameraInfoBytes({ count: 0 }) })),
    'COUNTER_UNAVAILABLE',
    { value: 0 },
  );
});

test('sentinel 65535 is unavailable', () => {
  expectError(
    () => parse(jpegFixture({ block: cameraInfoBytes({ count: 65535 }) })),
    'COUNTER_UNAVAILABLE',
    { value: 65535 },
  );
});

test('sentinel 0xffffffff is unavailable', () => {
  expectError(
    () => parse(jpegFixture({ block: cameraInfoBytes({ count: 0xffffffff }) })),
    'COUNTER_UNAVAILABLE',
    { value: 0xffffffff },
  );
});

test('conflicting static and dynamic CameraInfo blocks are rejected', () => {
  expectError(
    () => parse(cr3Fixture({ count: 200, staticCount: 100 })),
    'CONFLICTING_COUNTERS',
  );
});

test('unsupported camera model is reported', () => {
  expectError(
    () => parse(jpegFixture({ model: 'Canon EOS R5' })),
    'UNSUPPORTED_MODEL',
    { model: 'EOS R5' },
  );
});

test('non-Canon Make is rejected even with a supported model string', () => {
  expectError(
    () => parse(jpegFixture({ make: 'Nikon', model: 'Canon EOS R7' })),
    'UNSUPPORTED_MODEL',
    { model: 'Canon EOS R7' },
  );
});

test('R100 layout with an R7 prefix is unknown', () => {
  expectError(
    () => parse(jpegFixture({
      model: 'Canon EOS R100',
      firmware: '1.0.0',
      block: cameraInfoBytes({ prefix: [0xbb, 0xcc], counterOffset: 0x0acf, count: 5016 }),
    })),
    'UNKNOWN_LAYOUT',
    { panorama: false },
  );
});

test('missing CameraInfo block is missing metadata', () => {
  expectError(
    () => parse(jpegFixture({ includeCameraInfo: false })),
    'MISSING_METADATA',
  );
});

test('missing MakerNote is missing metadata', () => {
  expectError(
    () => parse(jpegFixture({ includeMakerNote: false })),
    'MISSING_METADATA',
  );
});

test('missing ExifIFD pointer is missing metadata', () => {
  expectError(
    () => parse(jpegFixture({ includeExifPointer: false })),
    'MISSING_METADATA',
  );
});

test('missing CR3 dynamic CameraInfo is missing metadata', () => {
  expectError(
    () => parse(cr3Fixture({ includeCameraInfo: false })),
    'MISSING_METADATA',
  );
});

test('unknown firmware is accepted as unverified', () => {
  const result = parse(jpegFixture({
    model: 'Canon EOS R7',
    includeFirmware: false,
    count: 18650,
  }));
  assert.equal(result.firmware, 'unknown');
  assert.equal(result.status, 'unverified');
});

test('An XMP APP1 segment before Exif is skipped', () => {
  const result = parse(jpegFixture({ xmpFirst: true, count: 4493 }));
  assert.equal(result.shutterCount, 4493);
});

test('truncated JPEG is rejected', () => {
  expectError(() => parse(jpegFixture().subarray(0, 20)), 'INVALID_FILE');
});

test('truncated CR3 is rejected', () => {
  expectError(() => parse(cr3Fixture().subarray(0, 100)), 'INVALID_FILE');
});

test('PNG bytes are an unsupported format', () => {
  const png = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d,
  ]);
  expectError(() => parse(png), 'UNSUPPORTED_FORMAT');
});

test('CR3 with a non-crx major brand is an unsupported format', () => {
  expectError(
    () => parse(cr3Fixture({ brand: 'isom' })),
    'UNSUPPORTED_FORMAT',
  );
});

test('counter bytes stay little-endian inside a big-endian TIFF', () => {
  const block = cameraInfoBytes({ count: 0x4a01 });
  const result = parse(jpegFixture({
    le: false,
    model: 'Canon EOS R7',
    firmware: '1.6.0',
    block,
  }));
  assert.equal(result.shutterCount, 0x4a01);
});
