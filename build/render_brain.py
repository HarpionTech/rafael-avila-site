"""Renderiza o cerebro (mesh Meshy) em dourado, com fundo transparente, para
entrar no palco circular do hero.png.

O .blend nao tem camera nem luz: a cena e montada aqui. O material vem com mapa
emissive — e ele que desenha a rede; a iluminacao so preenche o volume.

Uso:
  blender --background --python build/render_brain.py -- [--fast] [--turntable]
"""
import math
import os
import sys

import bpy
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BLEND = os.path.join(ROOT, "assets", "3D-blender",
                     "Meshy_AI_Azure_Brain_Network_0810212952_texture.blend")
OUT = os.path.join(ROOT, "assets", "cerebro")

GOLD = (1.0, 0.72, 0.30)          # dourado quente do mockup
GOLD_DEEP = (0.052, 0.032, 0.013)  # corpo escuro: e o contraste que faz os pontos saltarem

TURNTABLE_FRAMES = 48


def log(m):
    print(f"[BRAIN] {m}")
    sys.stdout.flush()


def args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []

    def num(flag, default):
        return float(argv[argv.index(flag) + 1]) if flag in argv else default

    return {
        "fast": "--fast" in argv,
        "turntable": "--turntable" in argv,
        "mode": argv[argv.index("--mode") + 1] if "--mode" in argv else "points",
        "ratio": num("--ratio", 0.004),      # decimacao da copia que vira a rede
        "thick": num("--thick", 0.006),      # espessura dos tubos da rede
        "glow": num("--glow", 4.0),          # emissao da rede/pontos
        "density": num("--density", 9000),   # pontos por m² da superficie
        "dot": num("--dot", 0.0035),         # raio de cada ponto
    }


def gold_body(obj):
    """Corpo do cerebro: ouro escuro e polido, so para dar volume e reflexo.

    Armadilha do asset "Azure": a textura base_color pinta tudo de azul e vence
    qualquer default_value — por isso o material e reconstruido do zero, mantendo
    apenas o normal map (que carrega os sulcos).
    """
    mat = obj.data.materials[0]
    mat.use_nodes = True
    nt = mat.node_tree

    normal_img = next((n.image for n in nt.nodes
                       if n.type == "TEX_IMAGE" and n.image and "normal" in n.image.name), None)

    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial"); out.location = (420, 0)
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled"); bsdf.location = (120, 0)
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])

    bsdf.inputs["Base Color"].default_value = (*GOLD_DEEP, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.3
    bsdf.inputs["Metallic"].default_value = 0.85

    if normal_img:
        tex_n = nt.nodes.new("ShaderNodeTexImage")
        tex_n.image = normal_img
        tex_n.image.colorspace_settings.name = "Non-Color"
        tex_n.location = (-620, -320)
        nmap = nt.nodes.new("ShaderNodeNormalMap"); nmap.location = (-320, -320)
        nmap.inputs["Strength"].default_value = 1.0
        nt.links.new(tex_n.outputs["Color"], nmap.inputs["Color"])
        nt.links.new(nmap.outputs["Normal"], bsdf.inputs["Normal"])
    log("corpo: ouro escuro metalico com os sulcos vindos do normal map")


def gold_emitter(name, glow):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial"); out.location = (300, 0)
    emit = nt.nodes.new("ShaderNodeEmission"); emit.location = (60, 0)
    emit.inputs["Color"].default_value = (*GOLD, 1.0)
    emit.inputs["Strength"].default_value = glow
    nt.links.new(emit.outputs["Emission"], out.inputs["Surface"])
    return mat


def points_overlay(src, density, dot, glow):
    """Pontilhado dourado sobre a superficie, via Geometry Nodes.

    Preferido ao Wireframe: decimar a malha para conseguir arestas visiveis produz
    triangulos degenerados, e o modificador Wireframe transforma cada um deles num
    espinho. Distribuir pontos nao depende da topologia.
    """
    obj = src.copy()
    obj.data = src.data.copy()
    obj.name = "BrainPoints"
    bpy.context.collection.objects.link(obj)
    obj.data.materials.clear()

    ng = bpy.data.node_groups.new("BrainPointsNG", "GeometryNodeTree")
    ng.interface.new_socket("Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
    ng.interface.new_socket("Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")

    gin = ng.nodes.new("NodeGroupInput"); gin.location = (-600, 0)
    gout = ng.nodes.new("NodeGroupOutput"); gout.location = (400, 0)
    dist = ng.nodes.new("GeometryNodeDistributePointsOnFaces"); dist.location = (-380, 0)
    dist.inputs["Density"].default_value = density
    ico = ng.nodes.new("GeometryNodeMeshIcoSphere"); ico.location = (-380, -240)
    ico.inputs["Radius"].default_value = dot
    ico.inputs["Subdivisions"].default_value = 1
    inst = ng.nodes.new("GeometryNodeInstanceOnPoints"); inst.location = (-120, 0)
    setm = ng.nodes.new("GeometryNodeSetMaterial"); setm.location = (140, 0)
    setm.inputs["Material"].default_value = gold_emitter("BrainDotGold", glow)

    ng.links.new(gin.outputs[0], dist.inputs["Mesh"])
    ng.links.new(dist.outputs["Points"], inst.inputs["Points"])
    ng.links.new(ico.outputs["Mesh"], inst.inputs["Instance"])
    ng.links.new(inst.outputs["Instances"], setm.inputs["Geometry"])
    ng.links.new(setm.outputs["Geometry"], gout.inputs[0])

    obj.modifiers.new("Points", "NODES").node_group = ng
    log(f"pontos: densidade={density}/m² raio={dot} emissao={glow}")
    return obj


def wire_overlay(src, ratio, thick, glow):
    """Rede luminosa: copia decimada + modificador Wireframe (tubos reais).

    O no Wireframe do shader nao serve aqui: com 867k vertices as arestas ficam
    sub-pixel, o Fac satura em 1 no frame inteiro e o render sai branco. Decimar
    primeiro e o que transforma a malha numa MALHA VISIVEL.
    """
    wire = src.copy()
    wire.data = src.data.copy()
    wire.name = "BrainWire"
    bpy.context.collection.objects.link(wire)
    wire.data.materials.clear()

    dec = wire.modifiers.new("Decimate", "DECIMATE")
    dec.ratio = ratio
    wf = wire.modifiers.new("Wireframe", "WIREFRAME")
    wf.thickness = thick
    wf.use_replace = True
    # use_even_offset (ligado por padrao) estica a junta em angulos agudos e a malha
    # decimada e cheia deles: era isso que virava espinho em cada no.
    wf.use_even_offset = False
    wf.use_boundary = True

    mat = bpy.data.materials.new("BrainWireGold")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial"); out.location = (300, 0)
    emit = nt.nodes.new("ShaderNodeEmission"); emit.location = (60, 0)
    emit.inputs["Color"].default_value = (*GOLD, 1.0)
    emit.inputs["Strength"].default_value = glow
    nt.links.new(emit.outputs["Emission"], out.inputs["Surface"])
    wire.data.materials.append(mat)

    log(f"rede: decimate={ratio} thickness={thick} emissao={glow}")
    return wire


def setup_scene(obj):
    # centraliza na origem para o turntable girar no proprio eixo
    obj.location = (0, 0, 0)
    bpy.context.view_layer.update()
    lo, hi = Vector(obj.bound_box[0]), Vector(obj.bound_box[6])
    obj.location -= (lo + hi) / 2 @ obj.matrix_world.to_3x3().transposed()

    scene = bpy.context.scene
    world = bpy.data.worlds.new("W")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.02, 0.017, 0.012, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.06
    scene.world = world

    def area(name, loc, energy, size, color=(1, 1, 1)):
        d = bpy.data.lights.new(name, "AREA")
        d.energy = energy
        d.size = size
        d.color = color
        o = bpy.data.objects.new(name, d)
        o.location = loc
        bpy.context.collection.objects.link(o)
        o.rotation_euler = (Vector((0, 0, 0)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()

    area("Key", (-2.4, -2.2, 1.8), 26, 3.0, (1.0, 0.84, 0.6))
    area("Rim", (2.6, 2.0, 1.2), 44, 2.4, (1.0, 0.72, 0.35))
    area("Under", (0, -0.6, -2.4), 18, 2.0, (1.0, 0.66, 0.28))
    area("Fill", (-3.2, 1.6, -0.4), 12, 3.4, (1.0, 0.78, 0.44))

    cam_data = bpy.data.cameras.new("Cam")
    cam_data.lens = 72
    cam = bpy.data.objects.new("Cam", cam_data)
    bpy.context.collection.objects.link(cam)
    cam.location = (-4.5, -0.9, 0.5)
    cam.rotation_euler = (Vector((0, 0, 0)) - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam
    return cam


def setup_render(res, samples):
    scene = bpy.context.scene

    # em --background o enum so lista EEVEE mesmo com Cycles ativo:
    # atribui e deixa o TypeError decidir
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
                log(f"GPU: {backend}")
                break
        scene.cycles.samples = samples
        scene.cycles.use_denoising = True
        scene.cycles.max_bounces = 6
    else:
        for e in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE"):
            if try_engine(e):
                break
    log(f"engine: {scene.render.engine}")

    scene.render.resolution_x = scene.render.resolution_y = res
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True        # o palco circular vem do hero.png
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    # Standard, nao AgX: o AgX comprime os realces e o dourado saturado dos pontos
    # sai bege lavado. O contraste vem do bloom aplicado depois.
    try:
        scene.view_settings.view_transform = "Standard"
        scene.view_settings.look = "None"
    except TypeError:
        pass


def main():
    o = args()
    log(f"abrindo {os.path.basename(BLEND)} ({os.path.getsize(BLEND)/1048576:.0f} MB)")
    bpy.ops.wm.open_mainfile(filepath=BLEND)

    obj = next(x for x in bpy.data.objects if x.type == "MESH")
    gold_body(obj)
    wire = (points_overlay(obj, o["density"], o["dot"], o["glow"])
            if o["mode"] == "points" else
            wire_overlay(obj, o["ratio"], o["thick"], o["glow"]))
    setup_scene(obj)
    wire.location = obj.location
    setup_render(600 if o["fast"] else 1400, 24 if o["fast"] else 128)

    os.makedirs(OUT, exist_ok=True)
    if o["turntable"]:
        for i in range(TURNTABLE_FRAMES):
            ang = (i / TURNTABLE_FRAMES) * 2 * math.pi
            obj.rotation_euler = wire.rotation_euler = (0, 0, ang)
            bpy.context.scene.render.filepath = os.path.join(OUT, "giro", f"{i:02d}.png")
            bpy.ops.render.render(write_still=True)
        log(f"{TURNTABLE_FRAMES} frames -> assets/cerebro/giro/")
    else:
        bpy.context.scene.render.filepath = os.path.join(OUT, "cerebro.png")
        bpy.ops.render.render(write_still=True)
        log("still -> assets/cerebro/cerebro.png")


if __name__ == "__main__":
    main()
