# 生成 PRISMX Bridge 应用图标（.ico）
# Generate the PRISMX Bridge app icon (.ico), matching the web Logo:
# black rounded square + neon-violet gradient triangle outline (hollow center).
from PIL import Image, ImageDraw

SS = 8  # 超采样倍率 / supersampling factor for smooth edges
BASE = 256
S = BASE * SS


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


# 渐变三角描边配色（与网页 Logo 一致）/ gradient stops from the web logo
TOP = (200, 168, 255)   # #c8a8ff
MID = (167, 121, 255)   # #a779ff
BOT = (122, 47, 255)    # #7a2fff


def draw_icon() -> Image.Image:
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # 纯黑圆角底 / pure black rounded base
    radius = int(S * 0.25)
    d.rounded_rectangle([2 * SS, 2 * SS, S - 2 * SS, S - 2 * SS],
                        radius=radius, fill=(0, 0, 0, 255),
                        outline=(167, 121, 255, 64), width=max(1, SS))

    # 荧光紫三角形描边（中间镂空），按 y 做竖直渐变
    # neon-violet hollow triangle outline, vertical gradient by y
    apex = (S * 0.5, S * 0.18)
    bl = (S * 0.16, S * 0.78)
    br = (S * 0.84, S * 0.78)
    width = int(S * 0.055)
    edges = [(apex, br), (br, bl), (bl, apex)]
    steps = 220
    y_min, y_max = apex[1], bl[1]
    for (p0, p1) in edges:
        for i in range(steps + 1):
            t = i / steps
            x = p0[0] + (p1[0] - p0[0]) * t
            y = p0[1] + (p1[1] - p0[1]) * t
            ty = (y - y_min) / (y_max - y_min)
            ty = min(1.0, max(0.0, ty))
            color = lerp(TOP, MID, ty / 0.5) if ty < 0.5 else lerp(MID, BOT, (ty - 0.5) / 0.5)
            r = width / 2
            d.ellipse([x - r, y - r, x + r, y + r], fill=(*color, 255))

    img = img.resize((BASE, BASE), Image.LANCZOS)
    return img


if __name__ == "__main__":
    icon = draw_icon()
    sizes = [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)]
    icon.save("app.ico", sizes=sizes)
    icon.save("app.png")
    print("OK app.ico")
