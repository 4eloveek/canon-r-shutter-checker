import os
import sys
import tempfile
import textwrap
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import read_shutter_cr3


class CounterTest(unittest.TestCase):
    def test_reads_little_endian_u16(self):
        data = bytearray(4608)
        data[0x0C93:0x0C95] = (19140).to_bytes(2, "little")
        self.assertEqual(read_shutter_cr3.read_counter(bytes(data)), 19140)

    def test_uses_offset_0x0c93(self):
        data = bytearray(4608)
        data[0x0C90:0x0C92] = (1).to_bytes(2, "little")
        data[0x0C93:0x0C95] = (2).to_bytes(2, "little")
        self.assertEqual(read_shutter_cr3.read_counter(bytes(data)), 2)

    def test_counter_wraps_at_u16(self):
        data = bytearray(4608)
        data[0x0C93:0x0C95] = (65535).to_bytes(2, "little")
        self.assertEqual(read_shutter_cr3.read_counter(bytes(data)), 65535)

    def test_too_small_block_rejected(self):
        with self.assertRaises(ValueError):
            read_shutter_cr3.read_counter(b"\0" * 16)

    def test_file_number(self):
        self.assertEqual(
            read_shutter_cr3.file_number(Path("IMG_7641.CR3")), 7641
        )
        self.assertIsNone(read_shutter_cr3.file_number(Path("photo.CR3")))


@unittest.skipIf(os.name == "nt", "fake exiftool wrapper is a POSIX script")
class ExtractionTest(unittest.TestCase):
    def test_block_is_located_from_exiftool_verbose_output(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            camera_info = bytearray(4608)
            camera_info[0x0C93:0x0C95] = (4242).to_bytes(2, "little")
            image = tmp_path / "IMG_0001.CR3"
            image.write_bytes(camera_info)

            fake_exiftool = tmp_path / "fake-exiftool"
            fake_exiftool.write_text(
                textwrap.dedent(
                    """\
                    #!/bin/sh
                    echo '| | | | CanonCameraInfoUnknown (SubDirectory) -->'
                    echo '| | | |     - Tag 0x000d (4608 bytes, undef[4608]):'
                    echo '| | | |      0: bb cc 00 00'
                    """
                )
            )
            fake_exiftool.chmod(0o755)

            info = read_shutter_cr3.extract_camera_info(
                image, str(fake_exiftool)
            )
            self.assertEqual(len(info), 4608)
            self.assertEqual(read_shutter_cr3.read_counter(info), 4242)


if __name__ == "__main__":
    unittest.main()
