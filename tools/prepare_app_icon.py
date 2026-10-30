#!/usr/bin/env python3
"""Beágyazza a hivatalos Gatterka.ico fájlt a telepített HTML ablak faviconjaként."""
import base64
import pathlib
import struct
import sys

def main():
    if len(sys.argv) != 3:
        raise SystemExit("Usage: prepare_app_icon.py Gatterka.ico app/index.htm")
    icon_path, html_path = map(pathlib.Path, sys.argv[1:])
    ico = icon_path.read_bytes()
    if len(ico)<6 or struct.unpack_from('<HHH',ico)!=(0,1,8):
        raise ValueError("Hiányzó vagy eltérő Gatterka.ico fájl.")
    text = html_path.read_text(encoding='utf-8')
    tag = '<link rel="icon" type="image/x-icon" href="data:image/x-icon;base64,'+base64.b64encode(ico).decode('ascii')+'">'
    if '<link rel="icon"' in text:
        raise ValueError("A HTML már tartalmaz favicont; ellenőrizd a build beállításokat.")
    if '</head>' not in text:
        raise ValueError("Hiányzó </head> a Gatterka HTML fájlból.")
    text = text.replace('</head>', '  '+tag+'\n</head>', 1)
    html_path.write_text(text, encoding='utf-8')
    print(f"Gatterka.ico favicon: {len(ico)} bytes added to {html_path}")

if __name__=='__main__':
    main()
