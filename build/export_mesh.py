"""Exporta a malha do cerebro como binario compacto para o WebGL da pagina.

Nao usa GLTF/GLB de proposito: o renderer da pagina e WebGL cru, e carregar um
parser de GLTF (ou three.js inteiro) para desenhar UM mesh estatico custaria mais
banda do que o proprio mesh. O formato aqui e o minimo que o shader consome.

Layout do .bin (little-endian):
  header : uint32 vertCount, uint32 indexCount
  pos    : int16  x,y,z  * vertCount   (normalizado para [-32767, 32767])
  nrm    : int8   x,y,z  * vertCount   (normal unitaria em [-127, 127])
  idx    : uint16 * indexCount

Posicao em int16 e normal em int8 porque o mesh cabe num cubo unitario: float32
seria 4x o peso sem ganho visivel. Os indices sao uint16, e por isso o alvo de
decimacao precisa ficar abaixo de 65.535 vertices — o script aborta se passar.

Uso:
  blender --background --python build/export_mesh.py -- [--target 30000]
"""
import os
import struct
import sys

import bpy
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BLEND = os.path.join(ROOT, "assets", "3D-blender",
                     "Meshy_AI_Azure_Brain_Network_0810212952_texture.blend")
OUT = os.path.join(ROOT, "assets", "cerebro", "malha.bin")

MAX_VERTS = 65535   # limite do indice uint16


def log(m):
    print(f"[MESH] {m}")
    sys.stdout.flush()


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    target = int(argv[argv.index("--target") + 1]) if "--target" in argv else 30000

    bpy.ops.wm.open_mainfile(filepath=BLEND)
    src = next(o for o in bpy.data.objects if o.type == "MESH")
    log(f"origem: {len(src.data.vertices)} vertices")

    obj = src.copy()
    obj.data = src.data.copy()
    obj.name = "MeshExport"
    bpy.context.collection.objects.link(obj)

    dec = obj.modifiers.new("Decimate", "DECIMATE")
    dec.ratio = min(1.0, target / max(1, len(src.data.vertices)))
    tri = obj.modifiers.new("Triangulate", "TRIANGULATE")
    tri.keep_custom_normals = True

    dg = bpy.context.evaluated_depsgraph_get()
    mesh = obj.evaluated_get(dg).to_mesh()
    mesh.calc_loop_triangles()

    # Normais suaves por vertice: o decimate deixa facetas grandes e, com normal
    # por face, o cerebro fica com cara de low-poly em vez de organico.
    normals = [Vector((0.0, 0.0, 0.0)) for _ in mesh.vertices]
    for t in mesh.loop_triangles:
        n = Vector(t.normal)
        for vi in t.vertices:
            normals[vi] += n

    verts = [Vector(v.co) for v in mesh.vertices]
    if len(verts) > MAX_VERTS:
        raise SystemExit(f"[MESH] {len(verts)} vertices excede o limite uint16 "
                         f"({MAX_VERTS}); baixe --target")

    lo = Vector((min(v.x for v in verts), min(v.y for v in verts), min(v.z for v in verts)))
    hi = Vector((max(v.x for v in verts), max(v.y for v in verts), max(v.z for v in verts)))
    mid = (lo + hi) / 2
    scale = 1.0 / max((hi - lo).x, (hi - lo).y, (hi - lo).z)

    indices = [vi for t in mesh.loop_triangles for vi in t.vertices]

    with open(OUT, "wb") as fh:
        fh.write(struct.pack("<II", len(verts), len(indices)))
        for v in verts:
            p = (v - mid) * scale
            fh.write(struct.pack("<hhh", *(max(-32767, min(32767, round(c * 32767))) for c in p)))
        for n in normals:
            n = n.normalized() if n.length > 1e-6 else Vector((0.0, 0.0, 1.0))
            fh.write(struct.pack("<bbb", *(max(-127, min(127, round(c * 127))) for c in n)))
        for i in indices:
            fh.write(struct.pack("<H", i))

    log(f"{len(verts)} vertices, {len(indices)//3} triangulos")
    log(f"{os.path.relpath(OUT, ROOT)}  {os.path.getsize(OUT)/1024:.0f} KB")


if __name__ == "__main__":
    main()
