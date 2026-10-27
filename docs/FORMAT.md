# EOS R10 CameraInfo shutter counter format

This document describes the field used by `read_shutter_cr3.py`.

Tested on: **Canon EOS R10, firmware 1.5.0**, CR3 and JPEG.

## Summary

| Item | Value |
|---|---|
| Container | Canon CR3 or JPEG from the camera |
| Metadata block | `CanonCameraInfoUnknown` (ExifTool name) |
| Block size | 4608 bytes (`0x1200`) |
| Field offset | `0x0c93` |
| Field type | unsigned 16-bit, little-endian |
| Meaning | lifetime total frame counter |
| Increment | +1 per frame, including electronic shutter |
| Deleted frames | still counted |
| File numbering | independent |
| Mechanical-only count | not present in this field |

The block is not decoded by current ExifTool releases (13.x at the time of
writing), so no public tag name exists for this R10 field.

## Locating the block

ExifTool still parses the container and exposes the block as an unknown
subdirectory. Run:

```bash
exiftool -lang en -v3 IMG_7641.CR3
```

Relevant output:

```text
| | | | 2)  CanonCameraInfoUnknown (SubDirectory) -->
| | | |     - Tag 0x000d (4608 bytes, undef[4608]):
| | | |      1dcdd28: bb cc 00 00 00 00 00 00 00 00 00 00 00 00 00 00
```

- `4608 bytes` is the block size.
- `1dcdd28` is the absolute offset of the block in the file.
- The offset is **not fixed**: it depends on the file and its metadata.
  Always use the offset reported for that file.

The script parses these two values from the verbose output and reads the
block directly.

## Field layout

The field starts at `0x0c93` inside the block:

```text
0x0c8c: 0a 00 00 00 00 00 00 9f 47 00 00 00 00 00 00 00 00 b4 bf 00
                          ^^ ^^
                          |  |
                          |  +-- 0x0c94
                          +----- 0x0c93
```

For the example above:

```text
9f 47  ->  0x479f  ->  18335
```

The `u16` is little-endian. The adjacent byte at `0x0c90` is the low byte
of the same value and can be used as a quick sanity check, but the value
must be read from `0x0c93`.

## Why this is the counter

The field was compared across consecutive frames:

| File | Value |
|---|---:|
| `IMG_6744.CR3` | 18249 |
| `IMG_6858.CR3` | 18335 |
| `IMG_6899.CR3` | 18376 |
| `IMG_6939.CR3` | 18416 |
| `IMG_6979.CR3` | 18456 |
| `IMG_7019.CR3` | 18496 |
| `IMG_7633.CR3` | 19135 |
| `IMG_7634.CR3` | 19136 |
| `IMG_7639.CR3` | 19138 |
| `IMG_7640.CR3` | 19139 |
| `IMG_7641.CR3` | 19140 |
| `IMG_7667.CR3` | 19161 |
| `IMG_7668.CR3` (mechanical) | 19163 |
| `IMG_7669.CR3` (electronic) | 19164 |

Observations:

- Neighbouring frames differ by exactly 1.
- A controlled capture changed the value by exactly +1.
- Switching from mechanical to electronic shutter still changed it by +1,
  so the value is a **total** frame counter.
- The value does not match the file number (`19140` vs `IMG_7641`), so it
  is not a filename index.
- Frames deleted from the card still increase the value.
- Ordinary video files do not use this counter.

## Manual extraction

Find the block offset and size:

```bash
exiftool -lang en -v3 IMG_7641.CR3 | grep -A3 CanonCameraInfoUnknown
```

Extract the block (replace the offset and size with the reported values):

```bash
dd if=IMG_7641.CR3 \
   of=/tmp/caminfo.bin \
   bs=1 skip=$((0x1dcdd28)) count=4608
```

Read the two bytes at the field offset:

```bash
xxd -s $((0x0c93)) -l 2 /tmp/caminfo.bin
```

Example output:

```text
00000c93: c44a                                     .J
```

`c4 4a` little-endian is `0x4ac4` = 19140.

## Manual Python check

```python
import struct

data = open("/tmp/caminfo.bin", "rb").read()
count = struct.unpack_from("<H", data, 0x0C93)[0]
print(count)
```

## Non-universal offset

The offset is tied to the R10 CameraInfo layout. Other Canon models use
different blocks and offsets:

| Model | Block / offset | Source |
|---|---|---|
| EOS R5, R6 | `CameraInfoR6`, `0x0af1` | ExifTool |
| EOS R6 Mark II, R8, R50 | `CameraInfoR6m2`, `0x0d29` | ExifTool |
| EOS R10 | `CameraInfoUnknown`, `0x0c93` | this document |
| EOS R6 Mark III | `CameraInfoR6m3`, `0x086d` (`ImageCount`) | ExifTool |
| EOS R7, R100, R3, R5 Mark II, R1 | unknown | not verified |

Using `0x0c93` on another model will return a number, but that number is
not guaranteed to be a shutter counter.

## Limitations

1. **Firmware-specific.** A future R10 firmware may change the layout.
2. **16-bit field.** Values above 65535 are not covered by testing.
3. **Point-in-time value.** The file contains the count at capture time.
4. **Total only.** No mechanical-only counter was found in the block.
5. **Unmodified files only.** Converted or edited images may lose the
   block or change its contents.
6. **ExifTool dependency.** The block location is taken from ExifTool's
   verbose output. Different future output formats could break parsing.
