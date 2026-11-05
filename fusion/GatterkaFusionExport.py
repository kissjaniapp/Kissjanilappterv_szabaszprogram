# Gatterka Fusion 360 exportáló – Fusion Scripts and Add-Ins / Python.
# Open the F3D design in Fusion first. Fusion API internal distance unit: cm.
import adsk.core
import adsk.fusion
import json
import os
import traceback
from datetime import datetime, timezone

SCHEMA = "gatterka-fusion-v1"

def mm(value):
    return round(float(value) * 10.0, 5)

def v3(v):
    return [round(float(v[0]), 9), round(float(v[1]), 9), round(float(v[2]), 9)]

def get_point(p):
    return [mm(p.x), mm(p.y), mm(p.z)]

def multiply_point(m, xyz_cm):
    xyz = list(xyz_cm)
    return [mm(sum(m.getCell(row, col) * xyz[col] for col in range(3)) + m.getCell(row, 3)) for row in range(3)]

def basis(m, axis):
    return v3([m.getCell(r, axis) for r in range(3)])

def export_body(body, name, component_name, occurrence_path, matrix):
    if not body.isSolid:
        return None
    # This is the *component-local axis-aligned* bounding box, not a machining-ready contour.
    box = body.boundingBox
    mn = [box.minPoint.x, box.minPoint.y, box.minPoint.z]
    mx = [box.maxPoint.x, box.maxPoint.y, box.maxPoint.z]
    lengths = [mx[i] - mn[i] for i in range(3)]
    axes = sorted(range(3), key=lambda i: lengths[i], reverse=True)
    length_axis, width_axis, thickness_axis = axes
    if min(lengths) <= 0:
        return None
    return {
        "id": str(body.entityToken),
        "name": name or body.name or "Alkatrész",
        "bodyName": body.name,
        "component": component_name,
        "occurrence": occurrence_path,
        "dimensions": [mm(lengths[i]) for i in axes],
        "localBoundsMin": [mm(p) for p in mn],
        "localBoundsMax": [mm(p) for p in mx],
        "originMm": multiply_point(matrix, mn),
        "axes": {
            "length": basis(matrix, length_axis),
            "width": basis(matrix, width_axis),
            "thickness": basis(matrix, thickness_axis)
        },
        "transform": [[round(float(matrix.getCell(row, col)) * (10 if col == 3 else 1), 9)
                       for col in range(4)] for row in range(4)],
        "geometryBasis": "local-axis-aligned-bounding-box",
        "machiningVerified": False,
        "operations": []
    }

def run(context):
    ui = None
    try:
        app = adsk.core.Application.get()
        ui = app.userInterface
        design = adsk.fusion.Design.cast(app.activeProduct)
        if not design:
            ui.messageBox("Nyiss meg egy Fusion 360 szilárdtestmodellt a Design munkaterületen.")
            return
        dialog = ui.createFileDialog()
        dialog.title = "Gatterka 3D export (JSON)"
        dialog.filter = "JSON (*.json)"
        dialog.initialFilename = "gatterka_fusion_export.json"
        if dialog.showSave() != adsk.core.DialogResults.DialogOK:
            return

        root = design.rootComponent
        records = []
        identity = adsk.core.Matrix3D.create()
        for body in root.bRepBodies:
            record = export_body(body, body.name, root.name, "Root", identity)
            if record:
                records.append(record)
        # allOccurrences provides assembly-context occurrences, including nested ones.
        for occ in root.allOccurrences:
            matrix = occ.transform2
            for body in occ.component.bRepBodies:
                record = export_body(body, occ.component.name or body.name,
                                     occ.component.name, occ.fullPathName, matrix)
                if record:
                    records.append(record)

        if not records:
            ui.messageBox("Nem található exportálható szilárdtest.")
            return
        payload = {
            "schema": SCHEMA,
            "units": "mm",
            "source": "Autodesk Fusion 360 API",
            "designName": root.name,
            "exportedAt": datetime.now(timezone.utc).isoformat(),
            "coordinateSystem": "fusion-design-world",
            "parts": records
        }
        target = dialog.filename
        if not target.lower().endswith(".json"):
            target += ".json"
        with open(target, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
        ui.messageBox("Gatterka export kész: {} szilárdtest\n{}".format(len(records), target))
    except Exception:
        if ui:
            ui.messageBox("Gatterka export hiba:\n" + traceback.format_exc())

def stop(context):
    pass
