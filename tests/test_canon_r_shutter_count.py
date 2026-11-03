import io
import os
import sys
import tempfile
import textwrap
import unittest
from contextlib import redirect_stdout
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import canon_r_shutter_count as reader


class CounterTest(unittest.TestCase):
    def test_short_and_long_version_flags(self):
        for flag in ("-v", "--version"):
            output = io.StringIO()
            with self.subTest(flag=flag), redirect_stdout(output):
                with self.assertRaises(SystemExit) as raised:
                    reader.main([flag])
            self.assertEqual(raised.exception.code, 0)
            self.assertIn(reader.__version__, output.getvalue())

    def test_reads_u32_at_model_specific_offsets(self):
        block = bytearray(reader.BLOCK_SIZE)
        block[0x0C93:0x0C97] = (100000).to_bytes(4, "little")
        block[0x0ACF:0x0AD3] = (5016).to_bytes(4, "little")
        self.assertEqual(reader.read_counter(bytes(block), 0x0C93), 100000)
        self.assertEqual(reader.read_counter(bytes(block), 0x0ACF), 5016)

    def test_default_offset_remains_r7_r10_offset(self):
        block = bytearray(reader.BLOCK_SIZE)
        block[0x0C93:0x0C97] = (19140).to_bytes(4, "little")
        self.assertEqual(reader.read_counter(bytes(block)), 19140)

    def test_small_block_is_rejected(self):
        with self.assertRaises(ValueError):
            reader.read_counter(b"\0" * 16, 0x0C93)

    def test_file_number(self):
        self.assertEqual(reader.file_number(Path("IMG_7641.CR3")), 7641)
        self.assertEqual(reader.file_number(Path("_MG_0002.CR3")), 2)
        self.assertIsNone(reader.file_number(Path("photo.JPG")))


@unittest.skipIf(os.name == "nt", "fake exiftool wrapper is a POSIX script")
class ExtractionTest(unittest.TestCase):
    def make_fixture(
        self,
        directory,
        *,
        model,
        firmware,
        file_type,
        prefix,
        offset,
        value,
        block_size=reader.BLOCK_SIZE,
        second_value=None,
    ):
        block_offset = 256
        total_size = block_offset + block_size
        if second_value is not None:
            total_size += block_size
        image = bytearray(total_size)

        def put_block(position, count):
            image[position:position + len(prefix)] = prefix
            if block_size >= offset + 4:
                image[position + offset:position + offset + 4] = count.to_bytes(
                    4, "little"
                )

        put_block(block_offset, value)
        file_type_lines = (
            ["FileType = CRX", "| | FileType [override] = CR3"]
            if file_type == "CR3"
            else [f"FileType = {file_type}"]
        )
        firmware_lines = (
            [f"| | 5) CanonFirmwareVersion = Firmware Version {firmware}"]
            if firmware is not None
            else []
        )
        lines = file_type_lines + [
            f"| | 1) Model = {model}",
        ] + firmware_lines + [
            "| | 7) CanonCameraInfoUnknown (SubDirectory) -->",
            f"| |    - Tag 0x000d ({block_size} bytes, undef[{block_size}]):",
            f"| |      {block_offset:x}: {prefix.hex(' ')} 00 00",
        ]
        if second_value is not None:
            second_offset = block_offset + block_size
            put_block(second_offset, second_value)
            lines.extend(
                [
                    "| | 8) CanonCameraInfoUnknown (SubDirectory) -->",
                    f"| |    - Tag 0x000d ({block_size} bytes, undef[{block_size}]):",
                    f"| |      {second_offset:x}: {prefix.hex(' ')} 00 00",
                ]
            )

        image_path = Path(directory) / f"sample.{file_type.lower()}"
        image_path.write_bytes(image)
        fake_exiftool = Path(directory) / "fake-exiftool"
        output = "\n".join(f"echo {line!r}" for line in lines)
        fake_exiftool.write_text(f"#!/bin/sh\n{output}\n")
        fake_exiftool.chmod(0o755)
        return image_path, str(fake_exiftool)

    def test_supported_model_layouts(self):
        cases = [
            ("Canon EOS R7", "1.8.0", "CR3", b"\xbb\xcc", 0x0C93, 18694),
            ("Canon EOS R7", "1.6.0", "JPEG", b"\xbb\xcc", 0x0C93, 4493),
            ("Canon EOS R10", "1.5.0", "JPEG", b"\xbb\xcc", 0x0C93, 19140),
            ("Canon EOS R10", "1.7.0", "CR3", b"\xbb\xcc", 0x0C93, 31671),
            ("Canon EOS R10", "1.8.0", "JPEG", b"\xbb\xcc", 0x0C93, 1210),
            ("Canon EOS R100", "1.0.0", "JPEG", b"\xbb\xbb", 0x0ACF, 5021),
            ("Canon EOS R100", "1.0.0", "CR3", b"\xbb\xbb", 0x0ACF, 5057),
        ]
        for model, firmware, file_type, prefix, offset, value in cases:
            with self.subTest(model=model, firmware=firmware, file_type=file_type):
                with tempfile.TemporaryDirectory() as tmp:
                    path, exiftool = self.make_fixture(
                        tmp,
                        model=model,
                        firmware=firmware,
                        file_type=file_type,
                        prefix=prefix,
                        offset=offset,
                        value=value,
                    )
                    result = reader.inspect_file(path, exiftool)
                    self.assertEqual(result.model, model)
                    self.assertEqual(result.firmware, firmware)
                    self.assertEqual(result.file_type, file_type)
                    self.assertEqual(result.shutter_count, value)
                    expected_status = (
                        "preliminary" if model == "Canon EOS R100" else "verified"
                    )
                    self.assertEqual(result.status, expected_status)

    def test_r100_cr3_uses_the_verified_jpeg_offset(self):
        with tempfile.TemporaryDirectory() as tmp:
            path, exiftool = self.make_fixture(
                tmp,
                model="Canon EOS R100",
                firmware="1.0.0",
                file_type="CR3",
                prefix=b"\xbb\xbb",
                offset=0x0ACF,
                value=5057,
            )
            result = reader.inspect_file(path, exiftool)
            self.assertEqual(result.shutter_count, 5057)
            self.assertEqual(result.status, "preliminary")

    def test_r7_jpeg_matching_layout_is_read_as_unverified(self):
        with tempfile.TemporaryDirectory() as tmp:
            path, exiftool = self.make_fixture(
                tmp,
                model="Canon EOS R7",
                firmware="1.8.0",
                file_type="JPEG",
                prefix=b"\xbb\xcc",
                offset=0x0C93,
                value=4493,
            )
            result = reader.inspect_file(path, exiftool)
            self.assertEqual(result.shutter_count, 4493)
            self.assertEqual(result.status, "unverified")

    def test_panorama_layout_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            path, exiftool = self.make_fixture(
                tmp,
                model="Canon EOS R7",
                firmware="1.6.0",
                file_type="JPEG",
                prefix=b"\xbb\xcc",
                offset=0x0C93,
                value=4493,
                block_size=16896,
            )
            with self.assertRaisesRegex(
                RuntimeError, "expected 4608 bytes"
            ):
                reader.inspect_file(path, exiftool)

    def test_special_mode_sentinels_are_rejected(self):
        for sentinel in (0, 0xFFFF, 0xFFFFFFFF):
            with self.subTest(sentinel=sentinel):
                with tempfile.TemporaryDirectory() as tmp:
                    path, exiftool = self.make_fixture(
                        tmp,
                        model="Canon EOS R7",
                        firmware="1.6.0",
                        file_type="JPEG",
                        prefix=b"\xbb\xcc",
                        offset=0x0C93,
                        value=sentinel,
                    )
                    with self.assertRaisesRegex(
                        RuntimeError, f"special-mode sentinel {sentinel}"
                    ):
                        reader.inspect_file(path, exiftool)

    def test_unverified_firmware_or_format_pair_is_accepted_with_warning(self):
        with tempfile.TemporaryDirectory() as tmp:
            path, exiftool = self.make_fixture(
                tmp,
                model="Canon EOS R10",
                firmware="1.7.0",
                file_type="JPEG",
                prefix=b"\xbb\xcc",
                offset=0x0C93,
                value=31671,
            )
            result = reader.inspect_file(path, exiftool)
            self.assertEqual(result.shutter_count, 31671)
            self.assertEqual(result.status, "unverified")

        with tempfile.TemporaryDirectory() as tmp:
            path, exiftool = self.make_fixture(
                tmp,
                model="Canon EOS R7",
                firmware="9.9.9",
                file_type="CR3",
                prefix=b"\xbb\xcc",
                offset=0x0C93,
                value=18694,
            )
            result = reader.inspect_file(path, exiftool)
            self.assertEqual(result.shutter_count, 18694)
            self.assertEqual(result.status, "unverified")

        with tempfile.TemporaryDirectory() as tmp:
            path, exiftool = self.make_fixture(
                tmp,
                model="Canon EOS R10",
                firmware=None,
                file_type="CR3",
                prefix=b"\xbb\xcc",
                offset=0x0C93,
                value=19140,
            )
            result = reader.inspect_file(path, exiftool)
            self.assertEqual(result.firmware, "unknown")
            self.assertEqual(result.status, "unverified")

    def test_unknown_model_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            path, exiftool = self.make_fixture(
                tmp,
                model="Canon EOS R50",
                firmware="1.0.0",
                file_type="JPEG",
                prefix=b"\xbb\xcc",
                offset=0x0C93,
                value=1,
            )
            with self.assertRaisesRegex(RuntimeError, "unsupported camera model"):
                reader.inspect_file(path, exiftool)

    def test_wrong_layout_and_size_are_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            path, exiftool = self.make_fixture(
                tmp,
                model="Canon EOS R100",
                firmware="1.0.0",
                file_type="JPEG",
                prefix=b"\xbb\xcc",
                offset=0x0ACF,
                value=1,
            )
            with self.assertRaisesRegex(RuntimeError, "prefix bb bb"):
                reader.inspect_file(path, exiftool)
        with tempfile.TemporaryDirectory() as tmp:
            path, exiftool = self.make_fixture(
                tmp,
                model="Canon EOS R10",
                firmware="1.5.0",
                file_type="JPEG",
                prefix=b"\xbb\xcc",
                offset=0x0C93,
                value=1,
                block_size=1024,
            )
            with self.assertRaisesRegex(RuntimeError, "4608 bytes"):
                reader.inspect_file(path, exiftool)

    def test_duplicate_blocks_must_agree(self):
        with tempfile.TemporaryDirectory() as tmp:
            path, exiftool = self.make_fixture(
                tmp,
                model="Canon EOS R10",
                firmware="1.5.0",
                file_type="CR3",
                prefix=b"\xbb\xcc",
                offset=0x0C93,
                value=19140,
                second_value=19141,
            )
            with self.assertRaisesRegex(RuntimeError, "conflicting counter"):
                reader.inspect_file(path, exiftool)

    def test_exiftool_error_is_reported(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "sample.jpg"
            path.write_bytes(b"not an image")
            fake_exiftool = Path(tmp) / "fake-exiftool"
            fake_exiftool.write_text("#!/bin/sh\necho broken >&2\nexit 1\n")
            fake_exiftool.chmod(0o755)
            with self.assertRaisesRegex(RuntimeError, "exiftool failed: broken"):
                reader.inspect_file(path, str(fake_exiftool))


if __name__ == "__main__":
    unittest.main()
