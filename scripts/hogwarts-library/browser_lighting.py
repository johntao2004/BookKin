# 根据每层真实窗洞生成浏览器面光源配置；不修改几何，也不复用 Blender 预览灯光。
# Derives browser area lights from each storey’s window openings without changing geometry or reusing Blender preview lighting.
"""Browser-only overcast daylight; geometry and Blender preview are independent."""


def browser_lighting(windows, height_scale):
    # Mount a luminous opening just inside each real window. The straight-sided
    # portion fits inside the lancets; no rectangular emitter protrudes above them.
    areas = []
    storeys = windows.get('storeys', [{'sides': [-1, 1], **windows}])
    for storey in storeys:
        window_y = (storey['bottomY'] + storey['springY']) / 2
        for side in storey['sides']:
            for z in (-12.5, -7.5, -2.5, 2.5, 7.5, 12.5):
                areas.append({
                    'position': [side * (windows['glassX'] - .24), window_y, z],
                    'target': [0, window_y, z],
                    'width': windows['width'] - .20,
                    'height': storey['springY'] - storey['bottomY'],
                    'color': '#dbe9f1', 'intensity': 4.0,
                })
    return {
        'revision': 'bilateral-storey-window-daylight-r37',
        'exposure': 1.45,
        'hemisphere': {'sky': '#b5c5cf', 'ground': '#634d37', 'intensity': .9},
        'ambient': {'color': '#fff0d7', 'intensity': .18},
        # Overcast sky: no indoor "sun" and no competing opposite sun shadows.
        'directional': [], 'areas': areas,
        'points': [{'position': [0, 12 * height_scale, z], 'color': '#ffd399',
                    'intensity': 70, 'distance': 21, 'shadow': z == 1}
                   for z in (-8, 1, 10)],
    }
