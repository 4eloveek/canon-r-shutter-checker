# Canon EOS R7 / R10 / R100 CameraInfo counter layouts

This document describes the model-specific metadata fields used by
`canon_r_shutter_count.py`.

## Summary

| Camera | Firmware | File type | Block prefix | Offset | Status |
|---|---|---|---|---:|---|
| EOS R7 | 1.8.0 | CR3 | `bb cc` | `0x0c93` | verified |
| EOS R7 | 1.6.0 | JPEG | `bb cc` | `0x0c93` | unverified; composite sentinel observed |
| EOS R10 | 1.5.0 | CR3/JPEG | `bb cc` | `0x0c93` | verified |
| EOS R10 | 1.7.0 | CR3 | `bb cc` | `0x0c93` | verified |
| EOS R10 | 1.8.0 | JPEG | `bb cc` | `0x0c93` | verified (community report) |
| EOS R100 | 1.0.0 | JPEG/CR3 | `bb bb` | `0x0acf` | preliminary |

All observed blocks are 4608 bytes (`0x1200`) and are currently reported by
ExifTool as `CanonCameraInfoUnknown`. The absolute location of the block varies
between files; only the offset *inside* the block is stable for a verified
layout.

The firmware rows above describe direct evidence, not a hard allowlist. Other
firmware versions are accepted for a supported model/file type when the block
size and prefix still match. Such results receive status `unverified`. A known
evidence pair receives `verified` (or `preliminary` for R100 1.0.0 JPEG/CR3).

## Locating the block

Run:

```bash
exiftool -lang en -v3 FILE.CR3
```

Relevant output resembles:

```text
| | | | 2)  CanonCameraInfoUnknown (SubDirectory) -->
| | | |     - Tag 0x000d (4608 bytes, undef[4608]):
| | | |      1dcdd28: bb cc 00 00 ...
```

Here `1dcdd28` is the absolute file offset. It must be read from each file;
it is not a model constant.

The CLI validates:

- `Model`;
- `FileType`;
- block size;
- block prefix.

`CanonFirmwareVersion` is recorded and used to assign evidence status, but an
unknown version is not rejected by itself. This allows compatible firmware
updates while still making the lack of direct testing visible.

This prevents using a valid offset from one CameraInfo layout on another.

## R7 and R10 layout

The R7/R10 block starts with `bb cc`. The counter begins at `0x0c93`:

```text
0x0c90: 00 00 00 c4 4a 00 00 00
                ^^ ^^ ^^ ^^
                +----------- 0x0c93..0x0c96
```

`c4 4a 00 00` interpreted as little-endian is 19140.

### R10 evidence

R10 firmware 1.5.0 was checked across consecutive CR3/JPEG files, deleted
frames, a controlled capture, and a mechanical-to-electronic transition.
Firmware 1.7.0 was cross-checked on consecutive CR3 files. The field advanced
by one per frame and did not follow filename numbering.

Firmware 1.8.0 JPEG was community-confirmed with two Medium Fine EFCS files:
`IMG_1267` contained 1200 and `IMG_1277` contained 1210 after ten frames.
Original email attachments retained CameraInfo, while a phone-sharing route
stripped EXIF and produced the expected missing-metadata failure.

Example verified values include:

| File | Mode | Value |
|---|---|---:|
| `IMG_7640.CR3` | mechanical | 19139 |
| `IMG_7641.CR3` | mechanical | 19140 |
| `IMG_7668.CR3` | mechanical | 19163 |
| `IMG_7669.CR3` | electronic | 19164 |

### R7 evidence

An initial R7 firmware 1.8.0 set produced values 18650, 18681, 18690 and
18691. Their differences exactly matched the number of frames between files.

A controlled sequence from the same camera then crossed a filename reset and
both shutter modes:

| File | EXIF shutter mode | Value |
|---|---|---:|
| `_MG_1300.CR3` | Mechanical | 18691 |
| `_MG_0001.CR3` | Mechanical | 18692 |
| `_MG_0002.CR3` | Electronic | 18693 |
| `_MG_0003.CR3` | Mechanical | 18694 |

The camera identifiers matched across both sets. The filename reset while the
metadata value continued by one, proving that the field is independent of the
current filename sequence. Fully electronic and mechanical frames incremented
the same total counter.

### Composite JPEG sentinel

An EOS R7 firmware 1.6.0 in-camera focus-stacking composite
(`1K0A4186.JPG`) contains the normal 4608-byte `bb cc` block but stores
`00 00 00 00` at `0x0c93`. The next ordinary image was reported with a normal
counter of 4493. Panorama composites were also reported to store 65535.

The CLI treats `0`, `65535` and `0xffffffff` as unavailable special-mode
sentinels. It returns an error instead of presenting them as a shutter count.
This is intentionally conservative: a genuine camera count exactly equal to a
sentinel cannot currently be distinguished from a special-mode output file.

Composite files may combine several source exposures while storing no usable
counter in the final JPEG. Read the newest nearby ordinary frame instead.

## R100 layout

The R100 block starts with `bb bb`, not `bb cc`. Its `0x0c93` data is unrelated
to the counter. The candidate begins at `0x0acf`:

| File | EXIF shutter mode | Bytes at `0x0acf` | Value |
|---|---|---|---:|
| `IMG_5220.JPG` | Electronic | `98 13 00 00` | 5016 |
| `IMG_5221.JPG` | Electronic | `99 13 00 00` | 5017 |
| `IMG_5224.JPG` | Electronic First Curtain | `9c 13 00 00` | 5020 |
| `IMG_5225.JPG` | Electronic First Curtain | `9d 13 00 00` | 5021 |

The missing source files `IMG_5222` and `IMG_5223` were confirmed to have been
taken after the shutter-mode change and then deleted. They account exactly for
values 5018 and 5019. This demonstrates counting for electronic and EFCS frames
and retention of deleted frames.

The candidate remains 204 below the filenames, so it is not the raw file
number. A separate R100 metadata sample from the public ExifTool archive has
the value 64 at the same offset while nearby file/session fields have unrelated
values.

A second directly consecutive sequence provided explicit mode transitions:

| File | EXIF shutter mode | Bytes at `0x0acf` | Value |
|---|---|---|---:|
| `IMG_5234.JPG` | Electronic | `a6 13 00 00` | 5030 |
| `IMG_5235.JPG` | Electronic First Curtain | `a7 13 00 00` | 5031 |
| `IMG_5236.JPG` | Electronic | `a8 13 00 00` | 5032 |
| `IMG_5237.JPG` | Electronic | `a9 13 00 00` | 5033 |

This confirms +1 across Electronic-to-EFCS, EFCS-to-Electronic and consecutive
Electronic frames. The earlier last file (`IMG_5225`, 5021) and this set's
first file (`IMG_5234`, 5030) differ by 9 in both filename and counter. All
eight supplied files keep the same filename-minus-counter difference of 204.

A later tethered-shooting test directly separated exposures from SD-card file
numbering:

| Saved file/event | File-number change | Counter |
|---|---:|---:|
| `IMG_5242.JPG` | baseline | 5041 |
| two tethered exposures uploaded directly to the computer | 0 | 5042, 5043 |
| `IMG_5243.JPG` | +1 | 5044 |

The saved filename advanced by one while `0x0acf` advanced by three. This
proves that the field counts captured exposures that never create an SD-card
file. Repeated tethered and composite shooting also provides a plausible cause
for the historical difference between filename numbering and this counter;
composite-mode behavior itself has not yet been measured in a controlled set.

Three consecutive original CR3 files verified that RAW uses the same layout
and offset:

| File | EXIF shutter mode | Bytes at `0x0acf` | Value |
|---|---|---|---:|
| `IMG_5248.CR3` | Electronic First Curtain | `bf 13 00 00` | 5055 |
| `IMG_5249.CR3` | Electronic | `c0 13 00 00` | 5056 |
| `IMG_5250.CR3` | Electronic First Curtain | `c1 13 00 00` | 5057 |

All three contain one matching 4608-byte `bb bb` block. `0x0acf` was the only
little-endian 32-bit candidate advancing by +1 across the sequence, confirming
that the JPEG offset also applies to CR3.

R100 status remains preliminary because persistence across card formatting or
file-number resets is unknown. The CLI accepts original firmware 1.0.0 JPEG
and CR3 files and marks their results as `preliminary`.

## Field width

Each candidate occupies an observed four-byte slot and is interpreted as an
unsigned 32-bit little-endian integer. Known Canon CameraInfo shutter counters
on other models are also `int32u`.

However, all available real R7/R10/R100 values are below 65536, leaving the
upper two bytes at zero. A real high-count file is still required to exercise
those bytes directly.

## Manual extraction

After obtaining the absolute block offset from ExifTool, extract the block:

```bash
dd if=FILE.CR3 \
   of=/tmp/caminfo.bin \
   bs=1 skip=$((0xABSOLUTE_OFFSET)) count=4608
```

R7/R10:

```bash
xxd -s $((0x0c93)) -l 4 /tmp/caminfo.bin
```

R100:

```bash
xxd -s $((0x0acf)) -l 4 /tmp/caminfo.bin
```

Python check:

```python
import struct

data = open("/tmp/caminfo.bin", "rb").read()
offset = 0x0C93  # R7/R10; use 0x0ACF for R100
print(struct.unpack_from("<I", data, offset)[0])
```

Do not use these offsets without first confirming the camera model, file type,
block size and prefix. Record the firmware and treat an untested version as
unverified until controlled samples confirm it.

## Acknowledgements

- [@ralvarezz](https://github.com/ralvarezz) supplied the R7 CR3 sets used to
  verify filename-reset continuity and mechanical/electronic behavior.
- [@ofnuts](https://github.com/ofnuts) supplied R100 JPEG/CR3 and R7 composite
  samples, explained deleted-frame gaps, tested tethered exposures and special
  modes, and provided detailed CLI usability feedback.
- [@kurmudgen](https://github.com/kurmudgen) community-confirmed EOS R10
  firmware 1.8.0 with a ten-frame Medium Fine JPEG sequence.
