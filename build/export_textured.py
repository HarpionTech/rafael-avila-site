"""Exporta a malha COM UVs e salva a textura base_color, para o WebGL usar o
detalhe original do asset e so trocar a cor.

Duas armadilhas que definem o formato:

1. UV vive no LOOP, nao no vertice. Um vertice numa costura de UV tem duas (ou
   mais) coordenadas diferentes, entao aqui cada par (vertice, uv) vira um
   vertice proprio. Isso infla a contagem — por isso o --target precisa ser
   menor do que o usado no export sem textura.
2. A textura do asset e AZUL. Nao da para "tingir" multiplicando por dourado: o
   canal vermelho e quase zero e o resultado sai preto esverdeado. O shader usa
   a LUMINANCIA da textura como mapa de detalhe e aplica o dourado por cima —
   por isso aqui a imagem e salva como esta, sem correcao de cor.

Layout do .bin (little-endian):
  header : uint32 vertCount, uint32 indexCount
  pos    : int16  x,y,z * vertCount
  nrm    : int8   x,y,z * vertCount
  uv     : uint16 u,v   * vertCount   (0..65535 -> 0..1)
  idx    : uint16 * indexCount

Uso:
  blender --background --python build/export_textured.py -- [--target 20000]
"""
import os
import struct
import sys

import bpy
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BLEND = os.path.join(ROOT, "assets", "3D-blender",
                     "Meshy_AI_Azure_Brain_Network_0810212952_texture.blend")
OUT = os.path.join(ROOT, "assets", "cerebro", "malha-uv.bin")
TEX = os.path.join(ROOT, "assets", "cerebro", "textura.png")

MAX_VERTS = 65535


def log(m):
    print(f"[TEX] {m}")
    sys.stdout.flush()


def save_texture():
    img = bpy.data.images.get("base_color")
    if img is None:
        img = next((i for i in bpy.data.images if "base" in i.name.lower()), None)
    if img is None:
        log("base_color nao encontrada")
        return None
    img.filepath_raw = TEX
    img.file_format = "PNG"
    img.save()
    log(f"textura {img.size[0]}x{img.size[1]} -> {os.path.relpath(TEX, ROOT)}")
    return img


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    target = int(argv[argv.index("--target") + 1]) if "--target" in argv else 20000

    bpy.ops.wm.open_mainfile(filepath=BLEND)
    src = next(o for o in bpy.data.objects if o.type == "MESH")
    save_texture()

    # Normalizacao a partir do ORIGINAL, igual aos outros exports — e o que mantem
    # malha, arestas e pontos alinhados entre si.
    orig = [Vector(v.co) for v in src.data.vertices]
    lo = Vector((min(v.x for v in orig), min(v.y for v in orig), min(v.z for v in orig)))
    hi = Vector((max(v.x for v in orig), max(v.y for v in orig), max(v.z for v in orig)))
    mid = (lo + hi) / 2
    scale = 1.0 / max((hi - lo).x, (hi - lo).y, (hi - lo).z)

    obj = src.copy()
    obj.data = src.data.copy()
    obj.name = "TexExport"
    bpy.context.collection.objects.link(obj)
    dec = obj.modifiers.new("Decimate", "DECIMATE")
    dec.ratio = min(1.0, target / max(1, len(src.data.vertices)))
    obj.modifiers.new("Triangulate", "TRIANGULATE")

    dg = bpy.context.evaluated_depsgraph_get()
    mesh = obj.evaluated_get(dg).to_mesh()
    mesh.calc_loop_triangles()
    uv_layer = mesh.uv_layers.active
    if uv_layer is None:
        raise SystemExit("[TEX] mesh sem UV")

    # Normais suaves acumuladas por vertice original, antes da duplicacao por UV.
    vnormals = [Vector((0.0, 0.0, 0.0)) for _ in mesh.vertices]
    for t in mesh.loop_triangles:
        n = Vector(t.normal)
        for vi in t.vertices:
            vnormals[vi] += n

    unique = {}
    positions, normals, uvs, indices = [], [], [], []
    for t in mesh.loop_triangles:
        for vi, li in zip(t.vertices, t.loops):
            uv = uv_layer.data[li].uv
            key = (vi, round(uv.x, 5), round(uv.y, 5))
            idx = unique.get(key)
            if idx is None:
                idx = len(positions)
                unique[key] = idx
                positions.append(Vector(mesh.vertices[vi].co))
                n = vnormals[vi]
                normals.append(n.normalized() if n.length > 1e-6 else Vector((0, 0, 1)))
                uvs.append((uv.x, uv.y))
            indices.append(idx)

    if len(positions) > MAX_VERTS:
        raise SystemExit(f"[TEX] {len(positions)} vertices (apos separar costuras de UV) "
                         f"excede o limite uint16; baixe --target")

    with open(OUT, "wb") as fh:
        fh.write(struct.pack("<II", len(positions), len(indices)))
        for v in positions:
            p = (v - mid) * scale
            fh.write(struct.pack("<hhh", *(max(-32767, min(32767, round(c * 32767))) for c in p)))
        for n in normals:
            fh.write(struct.pack("<bbb", *(max(-127, min(127, round(c * 127))) for c in n)))
        for u, v in uvs:
            fh.write(struct.pack("<HH", max(0, min(65535, round(u * 65535))),
                                 max(0, min(65535, round(v * 65535)))))
        for i in indices:
            fh.write(struct.pack("<H", i))

    log(f"{len(positions)} vertices ({len(mesh.vertices)} antes de separar UV), "
        f"{len(indices)//3} triangulos")
    log(f"{os.path.relpath(OUT, ROOT)}  {os.path.getsize(OUT)/1024:.0f} KB")


if __name__ == "__main__":
    main()
