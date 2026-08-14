"""Inspeciona o .blend do cerebro antes de montar o render."""
import bpy, sys

path = r"C:\Users\VICTOR\Desktop\avila-pagina de vendas\assets\3D-blender\Meshy_AI_Azure_Brain_Network_0810212952_texture.blend"
bpy.ops.wm.open_mainfile(filepath=path)

def log(m):
    print(f"[INSPECT] {m}"); sys.stdout.flush()

log(f"objetos: {len(bpy.data.objects)}")
for o in bpy.data.objects:
    extra = ""
    if o.type == "MESH":
        d = o.dimensions
        extra = f" verts={len(o.data.vertices)} dims=({d.x:.2f},{d.y:.2f},{d.z:.2f}) mats={[m.name for m in o.data.materials if m]}"
    log(f"  {o.type:10} {o.name}{extra}")

log(f"materiais: {[m.name for m in bpy.data.materials]}")
log(f"imagens: {[(i.name, tuple(i.size)) for i in bpy.data.images if i.name != 'Render Result']}")
log(f"cameras: {[c.name for c in bpy.data.cameras]}")
log(f"luzes: {[(l.name, l.type) for l in bpy.data.lights]}")
log(f"engine: {bpy.context.scene.render.engine}")
