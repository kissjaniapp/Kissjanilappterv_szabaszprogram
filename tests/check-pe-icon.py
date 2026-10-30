"""Check that all Windows executables embed all images from the uploaded .ico."""
import hashlib
import pathlib
import struct
import sys

import pefile

def ico_images(file):
    data = pathlib.Path(file).read_bytes()
    if len(data) < 6:
        raise ValueError("ICO is too short")
    reserved, typ, count = struct.unpack_from("<HHH", data)
    if reserved != 0 or typ != 1 or count == 0:
        raise ValueError("Invalid ICO header")
    images = []
    for i in range(count):
        offset = 6 + i * 16
        size, position = struct.unpack_from("<II", data, offset + 8)
        if position + size > len(data):
            raise ValueError("Truncated ICO")
        images.append(hashlib.sha256(data[position:position+size]).hexdigest())
    return sorted(images)

def pe_icon_images(file):
    pe = pefile.PE(str(file), fast_load=False)
    icons = []
    groups = 0
    if not hasattr(pe, "DIRECTORY_ENTRY_RESOURCE"):
        raise ValueError(f"{file}: no Windows resources")
    for resource in pe.DIRECTORY_ENTRY_RESOURCE.entries:
        if resource.id not in (3, 14):
            continue
        if resource.id == 14:
            groups += len(resource.directory.entries)
        for item in resource.directory.entries:
            if resource.id != 3:
                continue
            for language in item.directory.entries:
                detail = language.data.struct
                blob = pe.get_data(detail.OffsetToData, detail.Size)
                icons.append(hashlib.sha256(blob).hexdigest())
    pe.close()
    if not groups:
        raise ValueError(f"{file}: no RT_GROUP_ICON")
    return sorted(icons)

def pe_manifest(file):
    """Read an embedded RT_MANIFEST without altering Windows security settings."""
    pe = pefile.PE(str(file), fast_load=False)
    try:
        if not hasattr(pe, "DIRECTORY_ENTRY_RESOURCE"):
            raise ValueError(f"{file}: no Windows resources")
        for resource in pe.DIRECTORY_ENTRY_RESOURCE.entries:
            if resource.id != 24:
                continue
            for item in resource.directory.entries:
                for language in item.directory.entries:
                    detail = language.data.struct
                    return pe.get_data(detail.OffsetToData, detail.Size)
        raise ValueError(f"{file}: no embedded RT_MANIFEST")
    finally:
        pe.close()

if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit("Usage: check-pe-icon.py Gatterka.ico launcher.exe installer.exe ...")
    expected = ico_images(sys.argv[1])
    for path in sys.argv[2:]:
        got = pe_icon_images(path)
        if got != expected:
            raise SystemExit(
                f"ICON MISMATCH: {path}: {len(got)} resources vs {len(expected)} original images"
            )
        manifest=pe_manifest(path)
        for required in (b'requestedExecutionLevel level="asInvoker"',
                         b'8e0f7a12-bfb3-4fe8-b9a5-48fd50a15a9a'):
            if required not in manifest:
                raise SystemExit(f"MANIFEST MISMATCH: {path}: {required!r}")
        print(f"Verified icon and Windows compatibility manifest: {path} — {len(got)} ICO images")
