#!/usr/bin/env python3
"""Read the total shutter counter from a Canon EOS R10 CR3/JPEG file.

The R10 stores a 16-bit little-endian lifetime frame counter in the
CanonCameraInfo block at byte offset 0x0c93.  It advances by one for every
frame, including electronic-shutter frames and frames deleted later.  It is
independent of file numbering.

Current ExifTool releases do not have a tag table for the R10 CameraInfo
block, so the block location is obtained from ``exiftool -v3`` and the field
is read directly.

Tested on: Canon EOS R10, firmware 1.5.0, CR3 and JPEG.
"""

from __future__ import annotations

import argparse
import json
import re
import struct
import subprocess
import sys
from pathlib import Path

__version__ = "1.0.0"

COUNTER_OFFSET = 0x0C93
EXIFTOOL = "exiftool"


def extract_camera_info(path: Path, exiftool: str = EXIFTOOL) -> bytes:
    """Return the raw CanonCameraInfo block located by ``exiftool -v3``."""
    proc = subprocess.run(
        [exiftool, "-lang", "en", "-v3", str(path)],
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        raise RuntimeError(f"exiftool failed: {proc.stderr.strip()}")

    lines = proc.stdout.splitlines()
    for i, line in enumerate(lines):
        if "CanonCameraInfoUnknown" not in line or "SubDirectory" not in line:
            continue
        if i + 2 >= len(lines):
            break
        m_size = re.search(r"\((\d+) bytes", lines[i + 1])
        m_off = re.search(r"^\s*(?:\|\s*)*([0-9a-fA-F]+):", lines[i + 2])
        if not m_size or not m_off:
            continue
        size = int(m_size.group(1))
        offset = int(m_off.group(1), 16)
        with path.open("rb") as fh:
            fh.seek(offset)
            data = fh.read(size)
        if len(data) != size:
            raise RuntimeError("short read of CanonCameraInfo block")
        return data

    raise RuntimeError(
        "CanonCameraInfoUnknown block not found. "
        "Is this an unmodified EOS R10 file?"
    )


def read_counter(camera_info: bytes) -> int:
    """Read the u16 little-endian counter at 0x0c93."""
    if len(camera_info) < COUNTER_OFFSET + 2:
        raise ValueError("CanonCameraInfo block too small")
    return struct.unpack_from("<H", camera_info, COUNTER_OFFSET)[0]


def file_number(path: Path) -> int | None:
    """Extract the number from names like IMG_7641.CR3, if present."""
    match = re.search(r"IMG_(\d+)", path.stem, re.IGNORECASE)
    if match:
        return int(match.group(1))
    match = re.search(r"(\d+)$", path.stem)
    return int(match.group(1)) if match else None


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Read the Canon EOS R10 shutter counter from CR3/JPEG files."
    )
    parser.add_argument("files", nargs="+", type=Path)
    parser.add_argument(
        "--json", action="store_true", help="print machine-readable JSON"
    )
    parser.add_argument(
        "--exiftool", default=EXIFTOOL, help="path to the exiftool executable"
    )
    parser.add_argument(
        "--version", action="version", version=f"%(prog)s {__version__}"
    )
    args = parser.parse_args(argv)

    results = []
    for path in args.files:
        try:
            info = extract_camera_info(path, args.exiftool)
            count = read_counter(info)
        except Exception as exc:  # noqa: BLE001 - report per-file errors
            results.append({"file": str(path), "error": str(exc)})
            continue
        results.append(
            {
                "file": str(path),
                "file_number": file_number(path),
                "shutter_count": count,
            }
        )

    if args.json:
        print(json.dumps(results, indent=2))
    else:
        for item in results:
            if "error" in item:
                print(f"{item['file']}: ERROR: {item['error']}", file=sys.stderr)
                continue
            number = item["file_number"]
            prefix = f"IMG_{number}" if number is not None else item["file"]
            print(f"{prefix}: {item['shutter_count']}")

    return 0 if all("error" not in item for item in results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
