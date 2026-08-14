"""Extrai as texturas do .blend do cerebro (Meshy) reduzidas a 512.

Caminhos RELATIVOS a este arquivo, de proposito: a versao anterior apontava para
uma pasta temporaria de sessao, cujo nome e um UUID — e o secret scanning do
GitHub casa UUID solto com o padrao de token do OpenVSX e abre alerta de
vazamento. Nao era credencial nenhuma, mas caminho de maquina tambem nao tem o
que fazer em arquivo versionado.

O .blend nao vem no repositorio (172 MB, acima do limite do GitHub).
"""
import bpy, os
AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
BLEND = os.path.join(RAIZ, "assets", "3D-blender",
                     "Meshy_AI_Azure_Brain_Network_0810212952_texture.blend")
OUT = os.path.join(AQUI, "_tex")
os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=BLEND)
for img in bpy.data.images:
    if img.name in ("emissive", "base_color"):
        img.scale(512, 512)
        img.filepath_raw = os.path.join(OUT, f"tex_{img.name}.png")
        img.file_format = "PNG"
        img.save()
        print(f"[TEX] {img.name} salvo")
