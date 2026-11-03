#!/usr/bin/env python3
"""Read Canon EOS R7, R10 and R100 frame counters from original files.

ExifTool locates the Canon CameraInfo block. The script then validates the
camera model, file type, block size and layout before reading the model-specific
little-endian counter field. Unknown firmware versions are accepted when the
verified binary layout still matches, but their result is marked unverified.

Verified combinations:
- EOS R7 firmware 1.8.0: CR3, offset 0x0c93
- EOS R7 firmware 1.6.0: JPEG, offset 0x0c93
- EOS R10 firmware 1.5.0: CR3/JPEG; 1.7.0: CR3; 1.8.0: JPEG,
  offset 0x0c93
- EOS R100 firmware 1.0.0: JPEG/CR3, preliminary offset 0x0acf
"""

from __future__ import annotations

import argparse
import json
import re
import struct
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import FrozenSet, Tuple

# Keep this at 2.0 until the repository owner explicitly requests a change.
__version__ = "2.0"

EXIFTOOL = "exiftool"
BLOCK_SIZE = 4608
SPECIAL_COUNTER_VALUES = {0, 0xFFFF, 0xFFFFFFFF}


@dataclass(frozen=True)
class CameraSpec:
    verified_combinations: FrozenSet[Tuple[str, str]]
    file_types: FrozenSet[str]
    block_prefix: bytes
    counter_offset: int
    status: str


@dataclass(frozen=True)
class Reading:
    model: str
    firmware: str
    file_type: str
    shutter_count: int
    status: str


CAMERAS = {
    "Canon EOS R7": CameraSpec(
        verified_combinations=frozenset(
            {("1.8.0", "CR3"), ("1.6.0", "JPEG")}
        ),
        file_types=frozenset({"CR3", "JPEG"}),
        block_prefix=b"\xbb\xcc",
        counter_offset=0x0C93,
        status="verified",
    ),
    "Canon EOS R10": CameraSpec(
        verified_combinations=frozenset(
            {
                ("1.5.0", "CR3"),
                ("1.5.0", "JPEG"),
                ("1.7.0", "CR3"),
                ("1.8.0", "JPEG"),
            }
        ),
        file_types=frozenset({"CR3", "JPEG"}),
        block_prefix=b"\xbb\xcc",
        counter_offset=0x0C93,
        status="verified",
    ),
    "Canon EOS R100": CameraSpec(
        verified_combinations=frozenset(
            {("1.0.0", "JPEG"), ("1.0.0", "CR3")}
        ),
        file_types=frozenset({"CR3", "JPEG"}),
        block_prefix=b"\xbb\xbb",
        counter_offset=0x0ACF,
        status="preliminary",
    ),
}


def _run_exiftool(path: Path, exiftool: str) -> list[str]:
    proc = subprocess.run(
        [exiftool, "-lang", "en", "-v3", str(path)],
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        message = proc.stderr.strip() or proc.stdout.strip()
        raise RuntimeError(f"exiftool failed: {message}")
    return proc.stdout.splitlines()


def _parse_identity(lines: list[str]) -> tuple[str, str, str, CameraSpec]:
    model = None
    firmware = None
    file_type = None

    for line in lines:
        match = re.search(
            r"^\s*(?:\|\s*)*FileType(?: \[override\])? = (\S+)\s*$", line
        )
        if match:
            file_type = match.group(1)
        if model is None:
            match = re.search(r"\bModel = (.+?)\s*$", line)
            if match:
                model = match.group(1)
        if firmware is None:
            match = re.search(
                r"\bCanonFirmwareVersion = Firmware Version (.+?)\s*$", line
            )
            if match:
                firmware = match.group(1)

    spec = CAMERAS.get(model or "")
    if spec is None:
        raise RuntimeError(
            f"unsupported camera model: {model or 'unknown'}. "
            "Supported models: EOS R7, EOS R10 and EOS R100."
        )
    if file_type not in spec.file_types:
        supported = ", ".join(sorted(spec.file_types))
        raise RuntimeError(
            f"unsupported file type for {model}: {file_type or 'unknown'} "
            f"(supported for this model: {supported})"
        )
    return model, firmware or "unknown", file_type, spec


def _extract_blocks(path: Path, lines: list[str], spec: CameraSpec) -> list[bytes]:
    blocks = []
    saw_camera_info = False

    for index, line in enumerate(lines):
        match = re.search(
            r"\d+\)\s+(CanonCameraInfo\w*)\s+\(SubDirectory\)", line
        )
        if not match:
            continue
        saw_camera_info = True
        if index + 2 >= len(lines):
            continue

        size_match = re.search(r"\((\d+) bytes", lines[index + 1])
        offset_match = re.search(
            r"^\s*(?:\|\s*)*([0-9a-fA-F]+):", lines[index + 2]
        )
        if not size_match or not offset_match:
            continue

        size = int(size_match.group(1))
        if size != BLOCK_SIZE:
            continue
        offset = int(offset_match.group(1), 16)
        with path.open("rb") as handle:
            handle.seek(offset)
            block = handle.read(size)
        if len(block) != size:
            raise RuntimeError("short read of CanonCameraInfo block")
        if not block.startswith(spec.block_prefix):
            continue
        if block not in blocks:
            blocks.append(block)

    if blocks:
        return blocks
    if saw_camera_info:
        prefix = spec.block_prefix.hex(" ")
        raise RuntimeError(
            f"unsupported CameraInfo layout (expected {BLOCK_SIZE} bytes, "
            f"prefix {prefix})"
        )
    raise RuntimeError("CanonCameraInfo block not found in the original file")


def read_counter(camera_info: bytes, offset: int = 0x0C93) -> int:
    """Read a likely u32 little-endian counter at the supplied block offset."""
    if len(camera_info) < offset + 4:
        raise ValueError("CanonCameraInfo block too small")
    return struct.unpack_from("<I", camera_info, offset)[0]


def inspect_file(path: Path, exiftool: str = EXIFTOOL) -> Reading:
    lines = _run_exiftool(path, exiftool)
    model, firmware, file_type, spec = _parse_identity(lines)
    blocks = _extract_blocks(path, lines, spec)
    counts = {read_counter(block, spec.counter_offset) for block in blocks}
    if len(counts) != 1:
        raise RuntimeError("conflicting counter values in CameraInfo blocks")
    count = counts.pop()
    if count in SPECIAL_COUNTER_VALUES:
        raise RuntimeError(
            f"frame counter unavailable in this file "
            f"(special-mode sentinel {count})"
        )
    combination = (firmware, file_type)
    status = (
        spec.status if combination in spec.verified_combinations else "unverified"
    )
    return Reading(model, firmware, file_type, count, status)


def extract_camera_info(path: Path, exiftool: str = EXIFTOOL) -> bytes:
    """Return the validated CameraInfo block for a supported file."""
    lines = _run_exiftool(path, exiftool)
    _, _, _, spec = _parse_identity(lines)
    return _extract_blocks(path, lines, spec)[0]


def file_number(path: Path) -> int | None:
    """Extract a trailing camera file number, if present."""
    match = re.search(r"(\d+)$", path.stem)
    return int(match.group(1)) if match else None


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Read Canon EOS R7, R10 and R100 frame counters from original files."
        )
    )
    parser.add_argument("files", nargs="+", type=Path)
    parser.add_argument(
        "--json", action="store_true", help="print machine-readable JSON"
    )
    parser.add_argument(
        "--exiftool", default=EXIFTOOL, help="path to the exiftool executable"
    )
    parser.add_argument(
        "-v", "--version", action="version", version=f"%(prog)s {__version__}"
    )
    args = parser.parse_args(argv)

    results = []
    for path in args.files:
        try:
            reading = inspect_file(path, args.exiftool)
        except Exception as exc:  # report errors separately for every input file
            results.append({"file": str(path), "error": str(exc)})
            continue
        results.append(
            {
                "file": str(path),
                "model": reading.model,
                "firmware": reading.firmware,
                "format": reading.file_type,
                "file_number": file_number(path),
                "shutter_count": reading.shutter_count,
                "status": reading.status,
            }
        )

    if args.json:
        print(json.dumps(results, indent=2, ensure_ascii=False))
    else:
        for item in results:
            if "error" in item:
                print(f"{item['file']}: ERROR: {item['error']}", file=sys.stderr)
                continue
            suffixes = {
                "verified": "",
                "preliminary": " [preliminary]",
                "unverified": " [unverified firmware/format]",
            }
            suffix = suffixes[item["status"]]
            print(
                f"{Path(item['file']).stem} ({item['model']}): "
                f"{item['shutter_count']}{suffix}"
            )

    return 0 if all("error" not in item for item in results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
