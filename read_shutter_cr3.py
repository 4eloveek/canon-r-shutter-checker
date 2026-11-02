#!/usr/bin/env python3
"""Compatibility entry point for the former script name."""

from canon_r_shutter_count import *  # noqa: F403
from canon_r_shutter_count import __version__, main


if __name__ == "__main__":
    raise SystemExit(main())
