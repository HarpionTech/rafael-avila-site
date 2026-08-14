"""Exporta a nuvem de pontos do cerebro para o navegador.

O .blend tem 867k vertices — pesado demais para mandar ao cliente. Aqui os pontos
sao distribuidos na superficie (mesmo Geometry Nodes do render), o modificador e
aplicado e so as POSICOES saem, como Float32 cru. 40k pontos = 480 KB, contra os
173 MB do arquivo original.

Formato do .bin: [x, y, z] * N em Float32 little-endian, ja centrado na origem e
normalizado para caber num raio 1. O JS so precisa de N = tamanho / 12.

Uso:
  blender --background --python build/export_points.py -- [--count 40000]
"""
import os
import struct
import sys

import bpy
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BLEND = os.path.join(ROOT, "assets", "3D-blender",
                     "Meshy_AI_Azure_Brain_Network_0810212952_texture.blend")
OUT = os.path.join(ROOT, "assets", "cerebro", "pontos.bin")


def log(m):
    print(f"[POINTS] {m}")
    sys.stdout.flush()


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    count = int(argv[argv.index("--count") + 1]) if "--count" in argv else 40000

    bpy.ops.wm.open_mainfile(filepath=BLEND)
    src = next(o for o in bpy.data.objects if o.type == "MESH")

    obj = src.copy()
    obj.data = src.data.copy()
    obj.name = "PointSource"
    bpy.context.collection.objects.link(obj)

    ng = bpy.data.node_groups.new("ExportPointsNG", "GeometryNodeTree")
    ng.interface.new_socket("Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
    ng.interface.new_socket("Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
    gin = ng.nodes.new("NodeGroupInput")
    gout = ng.nodes.new("NodeGroupOutput")
    dist = ng.nodes.new("GeometryNodeDistributePointsOnFaces")
    # POISSON espaca os pontos: com RANDOM aparecem grumos e buracos, que em
    # rotacao ficam obvios (o olho enxerga o padrao girando).
    dist.distribute_method = "POISSON"
    dist.inputs["Distance Min"].default_value = 0.006
    dist.inputs["Density Max"].default_value = 90000
    pts = ng.nodes.new("GeometryNodePointsToVertices")
    ng.links.new(gin.outputs[0], dist.inputs["Mesh"])
    ng.links.new(dist.outputs["Points"], pts.inputs["Points"])
    ng.links.new(pts.outputs["Mesh"], gout.inputs[0])

    obj.modifiers.new("Points", "NODES").node_group = ng

    dg = bpy.context.evaluated_depsgraph_get()
    mesh = obj.evaluated_get(dg).to_mesh()
    verts = [Vector(v.co) for v in mesh.vertices]
    log(f"gerados {len(verts)} pontos")

    if len(verts) > count:
        step = len(verts) / count
        verts = [verts[int(i * step)] for i in range(count)]
        log(f"reduzidos para {len(verts)}")

    lo = Vector((min(v.x for v in verts), min(v.y for v in verts), min(v.z for v in verts)))
    hi = Vector((max(v.x for v in verts), max(v.y for v in verts), max(v.z for v in verts)))
    mid = (lo + hi) / 2
    scale = 1.0 / max((hi - lo).x, (hi - lo).y, (hi - lo).z)

    with open(OUT, "wb") as fh:
        for v in verts:
            p = (v - mid) * scale
            fh.write(struct.pack("<fff", p.x, p.y, p.z))

    log(f"{os.path.relpath(OUT, ROOT)}  {len(verts)} pontos  {os.path.getsize(OUT)/1024:.0f} KB")


if __name__ == "__main__":
    main()
