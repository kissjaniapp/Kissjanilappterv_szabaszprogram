#!/usr/bin/env python3
"""Create an amd64 Windows icon .syso resource for Go builds; Python stdlib only."""
import pathlib
import struct
import sys

# UAC- és Windows 10/11-kompatibilis alkalmazásazonosító. Ez az
# alkalmazásra vonatkozik, nem kapcsolja ki a Windows kompatibilitási védelmét.
APP_MANIFEST = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0"
          xmlns:asmv3="urn:schemas-microsoft-com:asm.v3">
  <assemblyIdentity type="win32" name="Gatterka.Desktop" version="1.0.9.0"
                    processorArchitecture="amd64"/>
  <description>Gatterka furniture cutting planner</description>
  <trustInfo xmlns="urn:schemas-microsoft-com:asm.v2">
    <security>
      <requestedPrivileges xmlns="urn:schemas-microsoft-com:asm.v3">
        <requestedExecutionLevel level="asInvoker" uiAccess="false"/>
      </requestedPrivileges>
    </security>
  </trustInfo>
  <compatibility xmlns="urn:schemas-microsoft-com:compatibility.v1">
    <application>
      <supportedOS Id="{8e0f7a12-bfb3-4fe8-b9a5-48fd50a15a9a}"/>
    </application>
  </compatibility>
</assembly>
""".encode("utf-8")

def align4(n):
    return (n + 3) & ~3

def make_resource(ico):
    if len(ico) < 6:
        raise ValueError('The ICO file is too short')
    reserved, kind, count = struct.unpack_from('<HHH', ico)
    if (reserved, kind) != (0, 1) or not 1 <= count <= 64:
        raise ValueError('Not a Windows .ico file')
    images = []
    for i in range(count):
        pos = 6 + i * 16
        if pos + 16 > len(ico):
            raise ValueError('Truncated ICO directory')
        width, height, colors, spare, planes, bpp, size, off = struct.unpack_from('<BBBBHHII', ico, pos)
        if spare or not size or off + size > len(ico):
            raise ValueError('Invalid ICO image data')
        images.append((width, height, colors, planes, bpp, ico[off:off+size]))

    group = bytearray(struct.pack('<HHH', 0, 1, count))
    for i, (w, h, colors, planes, bpp, data) in enumerate(images):
        group.extend(struct.pack('<BBBBHHIH', w, h, colors, 0, planes, bpp, len(data), i+1))
    records = [(3, i+1, image[5]) for i, image in enumerate(images)]
    records.append((14, 1, bytes(group)))
    records.append((24, 1, APP_MANIFEST))  # RT_MANIFEST

    section = bytearray()
    def directory(keys):
        pos = len(section)
        section.extend(struct.pack('<IIHHHH', 0, 0, 0, 0, 0, len(keys)))
        for key in keys:
            section.extend(struct.pack('<II', key, 0))
        return pos
    resource_kinds = [3, 14, 24]
    root = directory(resource_kinds)
    subdirs = {}
    for index, kind in enumerate(resource_kinds):
        d = directory([record[1] for record in records if record[0] == kind])
        struct.pack_into('<I', section, root + 16 + index*8 + 4, 0x80000000 | d)
        subdirs[kind] = d

    langdirs = []
    for kind, rid, data in records:
        ids = [record[1] for record in records if record[0] == kind]
        pos = directory([1033])
        struct.pack_into('<I', section, subdirs[kind] + 16 + ids.index(rid)*8 + 4, 0x80000000 | pos)
        langdirs.append((pos, data))

    section.extend(bytes(align4(len(section)) - len(section)))
    entries = []
    for langdir, data in langdirs:
        entry = len(section)
        section.extend(bytes(16))
        struct.pack_into('<I', section, langdir + 20, entry)
        entries.append((entry, data))
    section.extend(bytes(align4(len(section)) - len(section)))

    relocations = []
    for entry, data in entries:
        offset = len(section)
        struct.pack_into('<IIII', section, entry, offset, len(data), 0, 0)
        relocations.append(entry)
        section.extend(data)
        section.extend(bytes(align4(len(section)) - len(section)))

    raw = 60
    rel = raw + len(section)
    sym = rel + 10 * len(relocations)
    obj = bytearray(struct.pack('<HHIIIHH', 0x8664, 1, 0, sym, 1, 0, 0))
    obj.extend(struct.pack('<8sIIIIIIHHI', b'.rsrc\0\0\0',
                 len(section), 0, len(section), raw, rel, 0,
                 len(relocations), 0, 0x40000040))
    obj.extend(section)
    for off in relocations:
        obj.extend(struct.pack('<IIH', off, 0, 3))  # IMAGE_REL_AMD64_ADDR32NB
    obj.extend(struct.pack('<8sIhHBB', b'.rsrc\0\0\0', 0, 1, 0, 3, 0))
    obj.extend(struct.pack('<I', 4))
    return bytes(obj)

if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit('Usage: python embed_win_icon.py input.ico output.syso')
    src, dest = map(pathlib.Path, sys.argv[1:3])
    data = make_resource(src.read_bytes())
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    print(f'Windows icon added: {src} -> {dest} ({len(data)} bytes)')
