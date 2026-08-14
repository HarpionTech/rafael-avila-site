import bpy, sys, os
p = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                 "assets", "livro 3D", "Meshy_AI_O_Segredo_dos_Relacio_0812003527_generate.blend")
bpy.ops.wm.open_mainfile(filepath=p)
def log(m): print(f"[LIVRO] {m}"); sys.stdout.flush()
for o in bpy.data.objects:
    extra = ""
    if o.type == "MESH":
        d = o.dimensions
        uv = [l.name for l in o.data.uv_layers]
        extra = f" verts={len(o.data.vertices)} tris~{len(o.data.polygons)} dims=({d.x:.2f},{d.y:.2f},{d.z:.2f}) uv={uv} mats={[m.name for m in o.data.materials if m]}"
    log(f"{o.type:8} {o.name}{extra}")
log(f"imagens: {[(i.name, tuple(i.size)) for i in bpy.data.images if i.name != 'Render Result']}")
for m in bpy.data.materials:
    if m.use_nodes:
        texs = [n.image.name for n in m.node_tree.nodes if n.type=='TEX_IMAGE' and n.image]
        log(f"material {m.name}: texturas={texs}")
