#!/usr/bin/env python3
"""Create an amd64 Windows icon .syso resource for Go builds; Python stdlib only."""
import pathlib
import struct
import sys

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

    section = bytearray()
    def directory(keys):
        pos = len(section)
        section.extend(struct.pack('<IIHHHH', 0, 0, 0, 0, 0, len(keys)))
        for key in keys:
            section.extend(struct.pack('<II', key, 0))
        return pos
    root = directory([3, 14])
    subdirs = {}
    for kind, index in ((3, 0), (14, 1)):
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
