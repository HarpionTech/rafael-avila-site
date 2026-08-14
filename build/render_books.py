"""Molde unico de livro 3D + render por textura.

Um so mesh de livro (capa, contracapa, lombada, miolo de paginas) com 4 slots de
material. Cada livro do config so troca as imagens aplicadas nesses slots.

Uso:
  "C:\\Program Files\\Blender Foundation\\Blender 5.1\\blender.exe" --background --python build/render_books.py

Saida:
  assets/livros/<slug>.png          render 3/4 estatico (e-books)
  assets/livros/fisico/<n>.webp     sequencia de 360 (livro fisico)
  build/livro-molde.blend           o molde, para inspecao na UI
"""
import math
import os
import sys

import bpy
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "assets")
OUT = os.path.join(ASSETS, "livros")

# proporcao real das capas extraidas: 800x1200 = 1:1.5
W, H, T = 0.160, 0.240, 0.030
BEVEL = 0.0018

TURNTABLE_FRAMES = 36

BOOKS = [
    {
        "slug": "mentalidade",
        "front": "capas/mentalidade.webp",
        "back": None,
        "spine_color": (0.88, 0.87, 0.85),
        "turntable": False,
    },
    {
        "slug": "relacionamentos",
        "front": "capas/relacionamentos.webp",
        "back": None,
        "spine_color": (0.90, 0.89, 0.87),
        "turntable": False,
    },
    {
        "slug": "autoterapia",
        "front": "capas/autoterapia.webp",
        "back": None,
        "spine_color": (0.91, 0.88, 0.83),
        "turntable": False,
    },
    {
        "slug": "fisico",
        "front": "frente do livro fisico.jpeg",
        "back": "capa do livro fisico.jpeg",
        "spine_color": (0.09, 0.08, 0.07),
        "turntable": True,
    },
]


def log(msg):
    print(f"[AVILA] {msg}")
    sys.stdout.flush()


def wipe_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


# ---------------------------------------------------------------- molde

def build_mold():
    """O molde: um livro com 4 grupos de face, cada um no seu slot de material.

    Orientacao: X = largura da capa, Y = espessura, Z = altura.
    A capa da frente olha para -Y (onde fica a camera), a lombada para -X.
    """
    import bmesh

    mesh = bpy.data.meshes.new("LivroMesh")
    obj = bpy.data.objects.new("Livro", mesh)
    bpy.context.collection.objects.link(obj)

    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= W
        v.co.y *= T
        v.co.z *= H

    bm.faces.ensure_lookup_table()
    uv_layer = bm.loops.layers.uv.verify()

    # slots: 0 capa, 1 contracapa, 2 lombada, 3 paginas
    for face in bm.faces:
        n = face.normal
        if n.y < -0.5:
            face.material_index = 0          # capa (frente, olha -Y)
        elif n.y > 0.5:
            face.material_index = 1          # contracapa
        elif n.x < -0.5:
            face.material_index = 2          # lombada
        else:
            face.material_index = 3          # corte de paginas (fore-edge, topo, base)

        for loop in face.loops:
            co = loop.vert.co
            if abs(n.y) > 0.5:
                # A capa da frente (olha -Y) mapeia direto; quem precisa do
                # espelho e a CONTRACAPA, que e vista pelo outro lado.
                u = (co.x + W / 2) / W
                if n.y > 0:
                    u = 1.0 - u
                loop[uv_layer].uv = (u, (co.z + H / 2) / H)
            elif abs(n.x) > 0.5:
                loop[uv_layer].uv = ((co.y + T / 2) / T, (co.z + H / 2) / H)
            else:
                loop[uv_layer].uv = ((co.x + W / 2) / W, (co.y + T / 2) / T)

    bm.to_mesh(mesh)
    bm.free()

    # Bevel pequeno: e o que faz a aresta pegar luz e o livro parar de parecer
    # um retangulo chapado.
    bev = obj.modifiers.new("Bevel", "BEVEL")
    bev.width = BEVEL
    bev.segments = 2
    bev.limit_method = "ANGLE"
    bev.angle_limit = math.radians(40)

    # Flat shading: livro e feito de planos, e o Bevel ja da o brilho na aresta.
    # (Object.shade_smooth() nao existe na API 5.1 — e operator ou por poligono.)
    for poly in mesh.polygons:
        poly.use_smooth = False

    return obj


def make_material(name, image_path=None, color=(0.9, 0.9, 0.9), roughness=0.34):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = 0.0
    # nome do socket mudou entre versoes; tenta os dois
    for key in ("Specular IOR Level", "Specular"):
        if key in bsdf.inputs:
            bsdf.inputs[key].default_value = 0.42
            break

    if image_path and os.path.exists(image_path):
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.image = bpy.data.images.load(image_path)
        tex.interpolation = "Cubic"
        tex.location = (-420, 240)
        nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
        log(f"  textura -> {name}: {os.path.basename(image_path)}")
    else:
        bsdf.inputs["Base Color"].default_value = (*color, 1.0)

    return mat


def apply_textures(obj, book):
    obj.data.materials.clear()
    front = os.path.join(ASSETS, book["front"]) if book["front"] else None
    back = os.path.join(ASSETS, book["back"]) if book["back"] else None

    obj.data.materials.append(make_material(f"Capa_{book['slug']}", front))
    obj.data.materials.append(
        make_material(f"Contracapa_{book['slug']}", back, color=book["spine_color"])
    )
    obj.data.materials.append(
        make_material(f"Lombada_{book['slug']}", None, color=book["spine_color"], roughness=0.38)
    )
    # Miolo levemente amarelado e mais fosco: papel nao reflete como capa.
    obj.data.materials.append(
        make_material(f"Paginas_{book['slug']}", None, color=(0.93, 0.91, 0.86), roughness=0.72)
    )


# ---------------------------------------------------------------- cena

def add_area(name, location, energy, size, target=Vector((0, 0, 0))):
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.size = size
    light = bpy.data.objects.new(name, data)
    light.location = location
    bpy.context.collection.objects.link(light)
    light.rotation_euler = (target - Vector(location)).to_track_quat("-Z", "Y").to_euler()
    return light


def setup_studio():
    # chave alta a esquerda, preenchimento frio a direita, contra-luz atras
    add_area("Key", (-0.42, -0.50, 0.46), 55, 0.9)
    add_area("Fill", (0.55, -0.38, 0.05), 18, 1.1)
    add_area("Rim", (0.28, 0.52, 0.34), 40, 0.7)

    world = bpy.data.worlds.new("W")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.05, 0.06, 0.05, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.35
    bpy.context.scene.world = world


def setup_camera(distance=0.70, height=0.10, angle_deg=26.0, fstop=6.0):
    data = bpy.data.cameras.new("Cam")
    data.lens = 85
    cam = bpy.data.objects.new("Cam", data)
    bpy.context.collection.objects.link(cam)

    a = math.radians(angle_deg)
    cam.location = (-math.sin(a) * distance, -math.cos(a) * distance, height)

    data.dof.use_dof = True
    data.dof.focus_distance = math.sqrt(distance ** 2 + height ** 2)
    data.dof.aperture_fstop = fstop

    # to_track_quat e o caminho canonico; euler manual erra por pi
    cam.rotation_euler = (Vector((0, 0, 0)) - cam.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam
    return cam


def enable_gpu():
    prefs = bpy.context.preferences.addons["cycles"].preferences
    for backend in ("OPTIX", "CUDA", "HIP", "ONEAPI"):
        try:
            prefs.compute_device_type = backend
        except TypeError:
            continue
        prefs.get_devices()
        gpus = [d for d in prefs.devices if d.type == backend]
        if gpus:
            for device in prefs.devices:
                device.use = device.type in (backend, "CPU")
            log(f"GPU: {backend} — {[g.name for g in gpus]}")
            return backend
    log("nenhuma GPU encontrada, render na CPU")
    return None


def setup_render(res_x, res_y, samples=64):
    scene = bpy.context.scene

    # Em --background o enum so lista BLENDER_EEVEE mesmo com Cycles ativo:
    # atribui e deixa o TypeError decidir, nunca consultar o enum antes.
    def try_engine(identifier):
        try:
            scene.render.engine = identifier
            return scene.render.engine == identifier
        except TypeError:
            return False

    if try_engine("CYCLES"):
        backend = enable_gpu()
        scene.cycles.device = "GPU" if backend else "CPU"
        scene.cycles.samples = samples
        scene.cycles.use_denoising = True
        scene.cycles.use_adaptive_sampling = True
        scene.cycles.max_bounces = 8
    else:
        for eevee in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE"):
            if try_engine(eevee):
                break
        ee = getattr(scene, "eevee", None)
        if ee and hasattr(ee, "taa_render_samples"):
            ee.taa_render_samples = samples
    log(f"engine: {scene.render.engine}")

    scene.render.resolution_x = res_x
    scene.render.resolution_y = res_y
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True          # alpha: o fundo e do CSS
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.compression = 15
    try:
        scene.view_settings.view_transform = "AgX"
    except TypeError:
        pass


def render_to(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


# ---------------------------------------------------------------- main

def parse_args():
    """Argumentos depois de '--' na linha de comando do Blender."""
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    only = None
    fast = "--fast" in argv
    if "--only" in argv:
        only = argv[argv.index("--only") + 1]
    return only, fast


def main():
    only, fast = parse_args()

    wipe_scene()
    obj = build_mold()
    setup_studio()
    setup_camera()

    bpy.ops.wm.save_as_mainfile(
        filepath=os.path.join(ROOT, "build", "livro-molde.blend")
    )
    log("molde salvo em build/livro-molde.blend")

    for book in BOOKS:
        if only and book["slug"] != only:
            continue
        log(f"--- {book['slug']} ---")
        apply_textures(obj, book)

        if book["turntable"] and not fast:
            setup_render(600, 900, samples=48)
            outdir = os.path.join(OUT, book["slug"])
            # Blender 5 mudou a API de Action: loop manual garante passo constante
            for i in range(TURNTABLE_FRAMES):
                obj.rotation_euler = (0, 0, (i / TURNTABLE_FRAMES) * 2 * math.pi)
                render_to(os.path.join(outdir, f"{i:02d}.png"))
            obj.rotation_euler = (0, 0, 0)
            log(f"{TURNTABLE_FRAMES} frames -> assets/livros/{book['slug']}/")
        else:
            setup_render(*( (480, 720) if fast else (900, 1350) ), samples=16 if fast else 72)
            render_to(os.path.join(OUT, f"{book['slug']}.png"))
            log(f"still -> assets/livros/{book['slug']}.png")

    log("concluido")


if __name__ == "__main__":
    main()
