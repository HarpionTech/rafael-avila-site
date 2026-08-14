"""Exporta a REDE de arestas do cerebro — as linhas douradas do mockup.

Nao e o wireframe inteiro: um wireframe cobre a superficie toda por igual e sai
uma malha uniforme, nao os filamentos do mockup. Aqui as arestas sao FILTRADAS
por angulo diedro — so passam as que ficam numa dobra da superficie, e essas sao
justamente as que desenham os sulcos e o contorno.

A normalizacao (centro e escala) e calculada a partir do mesh ORIGINAL, nao do
decimado. Se cada export usasse o proprio bounding box, a rede ficaria alguns
milesimos deslocada da superficie e apareceria flutuando fora do cerebro.

A normal por vertice viaja junto: o shader usa ela para o fresnel, que acende as
arestas na silhueta e apaga as que estao de frente para a camera.

Layout do .bin (little-endian):
  header : uint32 vertCount, uint32 indexCount
  pos    : int16 x,y,z * vertCount
  nrm    : int8  x,y,z * vertCount
  idx    : uint16 * indexCount   (pares, para gl.LINES)

Uso:
  blender --background --python build/export_edges.py -- [--target 4200] [--angle 22]
"""
import math
import os
import struct
import sys

import bmesh
import bpy
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BLEND = os.path.join(ROOT, "assets", "3D-blender",
                     "Meshy_AI_Azure_Brain_Network_0810212952_texture.blend")
OUT = os.path.join(ROOT, "assets", "cerebro", "arestas.bin")

MAX_VERTS = 65535


def log(m):
    print(f"[EDGES] {m}")
    sys.stdout.flush()


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    target = int(argv[argv.index("--target") + 1]) if "--target" in argv else 4200
    angle_min = float(argv[argv.index("--angle") + 1]) if "--angle" in argv else 22.0

    bpy.ops.wm.open_mainfile(filepath=BLEND)
    src = next(o for o in bpy.data.objects if o.type == "MESH")

    # Normalizacao a partir do ORIGINAL — a mesma que export_mesh.py aplica.
    orig = [Vector(v.co) for v in src.data.vertices]
    lo = Vector((min(v.x for v in orig), min(v.y for v in orig), min(v.z for v in orig)))
    hi = Vector((max(v.x for v in orig), max(v.y for v in orig), max(v.z for v in orig)))
    mid = (lo + hi) / 2
    scale = 1.0 / max((hi - lo).x, (hi - lo).y, (hi - lo).z)

    obj = src.copy()
    obj.data = src.data.copy()
    obj.name = "EdgeExport"
    bpy.context.collection.objects.link(obj)
    dec = obj.modifiers.new("Decimate", "DECIMATE")
    dec.ratio = min(1.0, target / max(1, len(src.data.vertices)))

    dg = bpy.context.evaluated_depsgraph_get()
    mesh = obj.evaluated_get(dg).to_mesh()

    verts = [Vector(v.co) for v in mesh.vertices]
    if len(verts) > MAX_VERTS:
        raise SystemExit(f"[EDGES] {len(verts)} vertices excede o limite uint16; baixe --target")

    bm = bmesh.new()
    bm.from_mesh(mesh)
    bm.edges.ensure_lookup_table()

    limit = math.radians(angle_min)
    edges = []
    for e in bm.edges:
        if len(e.link_faces) < 2:
            edges.append((e.verts[0].index, e.verts[1].index))   # borda aberta
            continue
        if e.calc_face_angle(0.0) >= limit:
            edges.append((e.verts[0].index, e.verts[1].index))
    log(f"filtro >= {angle_min:.0f} graus: {len(edges)} de {len(bm.edges)} arestas")

    normals = [Vector(v.normal) for v in bm.verts]
    bm.free()

    with open(OUT, "wb") as fh:
        fh.write(struct.pack("<II", len(verts), len(edges) * 2))
        for v in verts:
            p = (v - mid) * scale
            fh.write(struct.pack("<hhh", *(max(-32767, min(32767, round(c * 32767))) for c in p)))
        for n in normals:
            n = n.normalized() if n.length > 1e-6 else Vector((0.0, 0.0, 1.0))
            fh.write(struct.pack("<bbb", *(max(-127, min(127, round(c * 127))) for c in n)))
        for a, b in edges:
            fh.write(struct.pack("<HH", a, b))

    log(f"{len(verts)} vertices, {len(edges)} arestas")
    log(f"{os.path.relpath(OUT, ROOT)}  {os.path.getsize(OUT)/1024:.0f} KB")


if __name__ == "__main__":
    main()
