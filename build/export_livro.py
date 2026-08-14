"""Exporta a malha do livro 3D com UV, para o navegador desenhar em WebGL.

O .blend do Meshy vem sem UV nenhuma, e o livro e um bloco (1.17 x 0.25 x 1.90)
com a capa no plano XZ. A normal dominante de cada face decide o que ela recebe,
e cada vertice carrega um ID de face para o shader saber o que desenhar ali.

A UV da capa e normalizada pela extensao da PROPRIA face frontal, nao pelo
bounding box do modelo: o bbox inclui a lombada arredondada e o corte das
paginas, entao normalizar por ele estica a arte para fora da face.

Mesmo formato de malha-uv.bin (o loader do WebGL ja sabe ler):
  header : uint32 vertCount, uint32 indexCount
  pos    : int16  x,y,z * vertCount
  nrm    : int8   x,y,z * vertCount
  uv     : uint16 u,v   * vertCount
  face   : uint8        * vertCount   (0 capa, 1 contracapa, 2 lombada, 3 paginas)
  idx    : uint16 * indexCount

Como a UV vive no loop e nao no vertice, cada par (vertice, uv) vira um vertice
proprio — o que infla a contagem e obriga a decimar mais do que pareceria
necessario, por causa do teto de 65.535 do indice uint16.

Uso:
  blender --background --python build/export_livro.py -- [--target 9000]
"""
import os
import struct
import sys

import bpy
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BLEND = os.path.join(ROOT, "assets", "livro 3D",
                     "Meshy_AI_O_Segredo_dos_Relacio_0812003527_generate.blend")
OUT = os.path.join(ROOT, "assets", "livros", "livro.bin")

MAX_VERTS = 65535


def log(m):
    print(f"[LIVRO] {m}")
    sys.stdout.flush()


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    target = int(argv[argv.index("--target") + 1]) if "--target" in argv else 9000

    bpy.ops.wm.open_mainfile(filepath=BLEND)
    src = next(o for o in bpy.data.objects if o.type == "MESH")
    log(f"origem: {len(src.data.vertices)} vertices")

    obj = src.copy()
    obj.data = src.data.copy()
    obj.name = "LivroExport"
    bpy.context.collection.objects.link(obj)
    dec = obj.modifiers.new("Decimate", "DECIMATE")
    dec.ratio = min(1.0, target / max(1, len(src.data.vertices)))
    obj.modifiers.new("Triangulate", "TRIANGULATE")

    dg = bpy.context.evaluated_depsgraph_get()
    mesh = obj.evaluated_get(dg).to_mesh()
    mesh.calc_loop_triangles()

    lo = Vector((min(v.co.x for v in mesh.vertices),
                 min(v.co.y for v in mesh.vertices),
                 min(v.co.z for v in mesh.vertices)))
    hi = Vector((max(v.co.x for v in mesh.vertices),
                 max(v.co.y for v in mesh.vertices),
                 max(v.co.z for v in mesh.vertices)))
    mid = (lo + hi) / 2
    size = hi - lo
    scale = 1.0 / max(size.x, size.y, size.z)

    vnormals = [Vector((0.0, 0.0, 0.0)) for _ in mesh.vertices]
    for t in mesh.loop_triangles:
        n = Vector(t.normal)
        for vi in t.vertices:
            vnormals[vi] += n

    def face_of(n):
        """0 = capa, 1 = contracapa, 2 = lombada, 3 = corte/paginas e bordas."""
        ax = max(range(3), key=lambda i: abs(n[i]))
        if ax == 1:
            return 0 if n.y < 0 else 1
        if ax == 0:
            return 2 if n.x < 0 else 3
        return 3

    # Extensao REAL da face da capa, medida so nos vertices dela. Normalizar pelo
    # bounding box inteiro (que inclui a lombada arredondada e o corte) esticava a
    # arte para fora da face e cortava as bordas — era esse o desencaixe.
    front = [mesh.vertices[vi].co for t in mesh.loop_triangles
             if face_of(Vector(t.normal)) == 0 for vi in t.vertices]
    if not front:
        raise SystemExit("[LIVRO] nenhuma face frontal encontrada")
    fx0, fx1 = min(c.x for c in front), max(c.x for c in front)
    fz0, fz1 = min(c.z for c in front), max(c.z for c in front)
    log(f"face da capa: x[{fx0:.3f},{fx1:.3f}] z[{fz0:.3f},{fz1:.3f}] "
        f"(bbox inteiro x[{lo.x:.3f},{hi.x:.3f}])")

    def uv_for(face, co):
        if face in (0, 1):
            u = (co.x - fx0) / max(1e-6, fx1 - fx0)
            v = (co.z - fz0) / max(1e-6, fz1 - fz0)
            return (u, v) if face == 0 else (1.0 - u, v)   # o verso e visto espelhado
        return (0.5, (co.z - fz0) / max(1e-6, fz1 - fz0))

    unique = {}
    positions, normals, uvs, faces, indices = [], [], [], [], []
    conta = {0: 0, 1: 0, 2: 0, 3: 0}
    for t in mesh.loop_triangles:
        face = face_of(Vector(t.normal))
        conta[face] += 1
        for vi in t.vertices:
            co = mesh.vertices[vi].co
            uv = uv_for(face, co)
            key = (vi, face)
            idx = unique.get(key)
            if idx is None:
                idx = len(positions)
                unique[key] = idx
                positions.append(co.copy())
                n = vnormals[vi]
                normals.append(n.normalized() if n.length > 1e-6 else Vector((0, 0, 1)))
                uvs.append(uv)
                faces.append(face)
            indices.append(idx)
    log(f"triangulos por face: capa={conta[0]} contracapa={conta[1]} "
        f"lombada={conta[2]} paginas={conta[3]}")

    if len(positions) > MAX_VERTS:
        raise SystemExit(f"[LIVRO] {len(positions)} vertices excede o limite uint16; baixe --target")

    with open(OUT, "wb") as fh:
        fh.write(struct.pack("<II", len(positions), len(indices)))
        for v in positions:
            p = (v - mid) * scale
            fh.write(struct.pack("<hhh", *(max(-32767, min(32767, round(c * 32767))) for c in p)))
        for n in normals:
            fh.write(struct.pack("<bbb", *(max(-127, min(127, round(c * 127))) for c in n)))
        for u, v in uvs:
            fh.write(struct.pack("<HH", max(0, min(65535, round(max(0.0, min(1.0, u)) * 65535))),
                                 max(0, min(65535, round(max(0.0, min(1.0, v)) * 65535)))))
        for f in faces:
            fh.write(struct.pack("<B", f))
        for i in indices:
            fh.write(struct.pack("<H", i))

    log(f"{len(positions)} vertices, {len(indices)//3} triangulos")
    log(f"{os.path.relpath(OUT, ROOT)}  {os.path.getsize(OUT)/1024:.0f} KB")


if __name__ == "__main__":
    main()
