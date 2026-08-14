"""Renderiza o livro 3D do Meshy com a capa de cada publicacao.

O .blend vem CRU: 991k vertices, sem UV, sem material, sem textura. Entao o UV e
gerado aqui, por PROJECAO PLANAR guiada pela normal de cada face — o livro e
essencialmente um bloco (1.17 x 0.25 x 1.90), com a capa no plano XZ e normal em
+-Y. Um unwrap automatico (Smart UV Project) nao serve: ele fatia a malha num
atlas arbitrario e a capa nao cairia inteira na face da frente.

Cada face recebe seu tratamento:
  normal -Y  -> capa (imagem completa)
  normal +Y  -> contracapa, ou a capa espelhada quando nao houver arte de verso
  normal -X  -> lombada (faixa estreita da textura)
  resto      -> miolo, cor solida

Uso:
  blender --background --python build/render_livro3d.py -- --capa <img> --saida <png>
          [--contracapa <img>] [--fast] [--ratio 0.04]
"""
import math
import os
import sys

import bpy
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BLEND = os.path.join(ROOT, "assets", "livro 3D",
                     "Meshy_AI_O_Segredo_dos_Relacio_0812003527_generate.blend")

PAGE = (0.93, 0.91, 0.86)      # miolo


def log(m):
    print(f"[LIVRO3D] {m}")
    sys.stdout.flush()


def args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []

    def val(flag, default=None):
        return argv[argv.index(flag) + 1] if flag in argv else default

    def path(flag, default=None):
        # Caminho absoluto: o Blender resolve relativos contra o .blend aberto,
        # nao contra o diretorio de onde o script foi chamado.
        v = val(flag, default)
        return os.path.abspath(v) if v else v

    return {
        "capa": path("--capa"),
        "contracapa": path("--contracapa"),
        "saida": path("--saida", os.path.join(ROOT, "assets", "livros", "out.png")),
        "fast": "--fast" in argv,
        "ratio": float(val("--ratio", "0.04")),
    }


def build_uv(obj):
    """UV por projecao planar, escolhida pela normal de cada face.

    A malha do Meshy tem os cantos arredondados, entao a normal nao e exatamente
    um eixo: o teste usa o eixo DOMINANTE da normal, e nao igualdade.
    """
    mesh = obj.data
    uv = mesh.uv_layers.new(name="UVMap")
    lo = Vector((min(v.co.x for v in mesh.vertices),
                 min(v.co.y for v in mesh.vertices),
                 min(v.co.z for v in mesh.vertices)))
    hi = Vector((max(v.co.x for v in mesh.vertices),
                 max(v.co.y for v in mesh.vertices),
                 max(v.co.z for v in mesh.vertices)))
    size = hi - lo

    faces = {"capa": 0, "verso": 0, "lombada": 0, "outros": 0}
    for poly in mesh.polygons:
        n = poly.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        for li in poly.loop_indices:
            co = mesh.vertices[mesh.loops[li].vertex_index].co
            u = (co.x - lo.x) / size.x
            v = (co.z - lo.z) / size.z
            if ax == 1:                       # frente / verso
                if n.y < 0:
                    faces["capa"] += 1
                else:
                    u = 1.0 - u               # o verso e visto espelhado
                    faces["verso"] += 1
                uv.data[li].uv = (u, v)
            elif ax == 0:                     # lombada / corte: faixa estreita
                faces["lombada"] += 1
                uv.data[li].uv = (0.02 if n.x < 0 else 0.98, v)
            else:
                faces["outros"] += 1
                uv.data[li].uv = (u, v)
    log(f"UV por projecao: {faces}")


def material(obj, capa_path, contracapa_path):
    mat = bpy.data.materials.new("LivroCapa")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial"); out.location = (600, 0)
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled"); bsdf.location = (320, 0)
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    bsdf.inputs["Roughness"].default_value = 0.42
    bsdf.inputs["Specular IOR Level" if "Specular IOR Level" in bsdf.inputs else "Roughness"].default_value = 0.35

    tex = nt.nodes.new("ShaderNodeTexImage"); tex.location = (-40, 60)
    tex.image = bpy.data.images.load(capa_path)
    tex.extension = "EXTEND"

    if contracapa_path:
        # Verso proprio: a face +Y usa a segunda imagem. Separar as duas exige
        # misturar pela normal — o Geometry node entrega isso sem custo.
        tex_b = nt.nodes.new("ShaderNodeTexImage"); tex_b.location = (-40, -240)
        tex_b.image = bpy.data.images.load(contracapa_path)
        tex_b.extension = "EXTEND"
        geo = nt.nodes.new("ShaderNodeNewGeometry"); geo.location = (-600, -60)
        sep = nt.nodes.new("ShaderNodeSeparateXYZ"); sep.location = (-420, -60)
        nt.links.new(geo.outputs["Normal"], sep.inputs["Vector"])
        gt = nt.nodes.new("ShaderNodeMath"); gt.location = (-260, -60)
        gt.operation = "GREATER_THAN"
        gt.inputs[1].default_value = 0.0
        nt.links.new(sep.outputs["Y"], gt.inputs[0])
        mix = nt.nodes.new("ShaderNodeMix"); mix.location = (140, 0)
        mix.data_type = "RGBA"
        nt.links.new(gt.outputs["Value"], mix.inputs["Factor"])
        nt.links.new(tex.outputs["Color"], mix.inputs[6])
        nt.links.new(tex_b.outputs["Color"], mix.inputs[7])
        nt.links.new(mix.outputs[2], bsdf.inputs["Base Color"])
    else:
        nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])

    obj.data.materials.clear()
    obj.data.materials.append(mat)


def setup_scene(obj):
    obj.location = (0, 0, 0)
    bpy.context.view_layer.update()
    lo, hi = Vector(obj.bound_box[0]), Vector(obj.bound_box[6])
    obj.location -= (lo + hi) / 2 @ obj.matrix_world.to_3x3().transposed()
    obj.rotation_euler = (0, 0, math.radians(38))    # tres-quartos: mostra a lombada

    scene = bpy.context.scene
    world = bpy.data.worlds.new("W")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.05, 0.05, 0.06, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.35
    scene.world = world

    def area(name, loc, energy, size, color=(1, 1, 1)):
        d = bpy.data.lights.new(name, "AREA")
        d.energy = energy; d.size = size; d.color = color
        o = bpy.data.objects.new(name, d)
        o.location = loc
        bpy.context.collection.objects.link(o)
        o.rotation_euler = (Vector((0, 0, 0)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()

    area("Key", (-2.6, -3.4, 2.6), 900, 3.4, (1.0, 0.94, 0.86))
    area("Fill", (3.2, -2.2, 0.6), 260, 3.0, (1.0, 0.88, 0.72))
    area("Rim", (1.4, 3.0, 2.2), 420, 2.2, (1.0, 0.82, 0.55))

    cam_data = bpy.data.cameras.new("Cam")
    cam_data.lens = 85
    cam = bpy.data.objects.new("Cam", cam_data)
    bpy.context.collection.objects.link(cam)
    cam.location = (0.55, -6.2, 0.9)
    cam.rotation_euler = (Vector((0, 0, 0)) - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam


def setup_render(res, samples, out_path):
    scene = bpy.context.scene

    def try_engine(ident):
        try:
            scene.render.engine = ident
            return scene.render.engine == ident
        except TypeError:
            return False

    if try_engine("CYCLES"):
        prefs = bpy.context.preferences.addons["cycles"].preferences
        for backend in ("OPTIX", "CUDA"):
            try:
                prefs.compute_device_type = backend
            except TypeError:
                continue
            prefs.get_devices()
            if [d for d in prefs.devices if d.type == backend]:
                for d in prefs.devices:
                    d.use = d.type in (backend, "CPU")
                scene.cycles.device = "GPU"
                break
        scene.cycles.samples = samples
        scene.cycles.use_denoising = True
    scene.render.resolution_x = res
    scene.render.resolution_y = round(res * 1.42)
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.filepath = out_path
    try:
        scene.view_settings.view_transform = "AgX"
        scene.view_settings.look = "AgX - Base Contrast"
    except TypeError:
        pass


def main():
    o = args()
    if not o["capa"]:
        raise SystemExit("[LIVRO3D] faltou --capa")

    bpy.ops.wm.open_mainfile(filepath=BLEND)
    obj = next(x for x in bpy.data.objects if x.type == "MESH")
    log(f"malha original: {len(obj.data.vertices)} vertices")

    # Decima ANTES do UV: gerar UV em 991k vertices e desperdicio, e o decimate
    # posterior estragaria o mapeamento.
    dec = obj.modifiers.new("Decimate", "DECIMATE")
    dec.ratio = o["ratio"]
    with bpy.context.temp_override(object=obj, active_object=obj, selected_objects=[obj]):
        bpy.ops.object.modifier_apply(modifier=dec.name)
    log(f"apos decimate: {len(obj.data.vertices)} vertices")

    build_uv(obj)
    material(obj, o["capa"], o["contracapa"])
    setup_scene(obj)
    setup_render(700 if o["fast"] else 1200, 32 if o["fast"] else 160, o["saida"])

    os.makedirs(os.path.dirname(o["saida"]), exist_ok=True)
    bpy.ops.render.render(write_still=True)
    log(f"-> {os.path.relpath(o['saida'], ROOT)}")


if __name__ == "__main__":
    main()
