"""按实际用到的字，从 fontsource 的切片字体里取出子集，生成内嵌 @font-face。"""
import re, os, io, base64, glob, sys
from fontTools.ttLib import TTFont
from fontTools import subset

ROOT = os.path.dirname(os.path.abspath(__file__))
NM = os.path.join(ROOT, 'node_modules', '@fontsource')

def collect_chars():
    txt = ''
    for p in glob.glob(os.path.join(ROOT, 'src', '**', '*.*'), recursive=True):
        if p.endswith(('.js', '.html', '.css')):
            txt += open(p, encoding='utf-8').read()
    chars = set(ch for ch in txt if ord(ch) >= 32)
    # 保证常用 ASCII 与符号都在
    chars |= set(chr(c) for c in range(32, 127))
    chars |= set('≈×−·…—“”‘’（），。、；：？！《》「」％°²³√Δμ′±→⇒≤≥')
    return chars

def parse_css(path):
    css = open(path, encoding='utf-8').read()
    faces = []
    for m in re.finditer(r'@font-face\s*\{(.*?)\}', css, re.S):
        body = m.group(1)
        src = re.search(r"url\(\./files/([^)]+\.woff2)\)", body).group(1)
        rng = re.search(r'unicode-range:\s*([^;]+);', body)
        cps = set()
        if rng:
            for part in rng.group(1).split(','):
                part = part.strip().upper().replace('U+', '')
                if '-' in part:
                    a, b = part.split('-'); cps.update(range(int(a, 16), int(b, 16) + 1))
                elif '?' in part:
                    a = int(part.replace('?', '0'), 16); b = int(part.replace('?', 'F'), 16); cps.update(range(a, b + 1))
                else:
                    cps.add(int(part, 16))
        faces.append((src, cps))
    return faces

def ranges(cps):
    cps = sorted(cps); out = []; i = 0
    while i < len(cps):
        j = i
        while j + 1 < len(cps) and cps[j + 1] == cps[j] + 1: j += 1
        out.append(f'U+{cps[i]:X}' if i == j else f'U+{cps[i]:X}-{cps[j]:X}')
        i = j + 1
    return ','.join(out)

def build_face(pkg, css_file, family, weight, style, need, outdir=None):
    base = os.path.join(NM, pkg)
    out = []
    total = 0
    parts = []  # (TTFont, set)
    for src, cps in parse_css(os.path.join(base, css_file)):
        want = need & cps if cps else need
        if not want: continue
        f = TTFont(os.path.join(base, 'files', src))
        have = set(f.getBestCmap().keys())
        want &= have
        if not want: continue
        opts = subset.Options(); opts.flavor = 'woff2'; opts.layout_features = ['*']; opts.name_IDs = []; opts.notdef_outline = False; opts.hinting = False
        sub = subset.Subsetter(opts); sub.populate(unicodes=sorted(want)); sub.subset(f)
        if outdir:
            f.flavor = None; parts.append((f, want)); continue
        buf = io.BytesIO(); f.flavor = 'woff2'; f.save(buf)
        data = buf.getvalue(); total += len(data)
        if outdir:
            import hashlib
            name = '%s-%s-%s-%s.woff2' % (family.lower().replace(' ', ''), weight, style, hashlib.sha1(data).hexdigest()[:10])
            open(os.path.join(outdir, name), 'wb').write(data)
            src = 'assets/fonts/' + name
        else:
            src = 'data:font/woff2;base64,' + base64.b64encode(data).decode()
        out.append("@font-face{font-family:'%s';font-style:%s;font-weight:%s;font-display:block;src:url(%s) format('woff2');unicode-range:%s}" % (family, style, weight, src, ranges(want)))
    if outdir and parts:
        import hashlib, tempfile
        from fontTools.merge import Merger, Options
        allw = set()
        for _, w in parts: allw |= w
        if len(parts) == 1:
            merged = parts[0][0]
        else:
            paths = []
            for i, (fnt, _) in enumerate(parts):
                pth = os.path.join(tempfile.gettempdir(), f'_m_{i}.ttf'); fnt.save(pth); paths.append(pth)
            try:
                merged = Merger(options=Options(drop_tables=['vhea', 'vmtx', 'VORG'])).merge(paths)
            except Exception:
                # 有的切片排版表是空的：去掉 GSUB/GPOS/GDEF 再合并（中文和数字用不到这些特性）
                for i, (fnt, _) in enumerate(parts):
                    for tag in ('GSUB', 'GPOS', 'GDEF'):
                        if tag in fnt: del fnt[tag]
                    fnt.save(paths[i])
                merged = Merger(options=Options(drop_tables=['vhea', 'vmtx', 'VORG'])).merge(paths)
        merged.flavor = 'woff2'
        buf = io.BytesIO(); merged.save(buf); data = buf.getvalue(); total = len(data)
        name = '%s-%s-%s-%s.woff2' % (family.lower().replace(' ', ''), weight, style, hashlib.sha1(data).hexdigest()[:10])
        open(os.path.join(outdir, name), 'wb').write(data)
        out = ["@font-face{font-family:'%s';font-style:%s;font-weight:%s;font-display:block;src:url(assets/fonts/%s) format('woff2');unicode-range:%s}" % (family, style, weight, name, ranges(allw))]
    print(f'{family} {weight} {style}: {len(out)} faces, {total/1024:.0f} KB', file=sys.stderr)
    return out, total

if __name__ == '__main__':
    outdir = None
    if len(sys.argv) > 2 and sys.argv[1] == '--files':
        outdir = sys.argv[2]; os.makedirs(outdir, exist_ok=True)
        for f in glob.glob(os.path.join(outdir, '*.woff2')): os.remove(f)
    chars = collect_chars()
    cjk = set(ord(c) for c in chars)
    latin = set(ord(c) for c in chars if ord(c) < 0x2100 or c in '≈−⇒→≤≥√Δμ')
    title = set(ord(c) for c in '运动的理由目录三句话我的印章尾声力有多大越滑远惯性二平衡改变同时落地互相推水火箭第课0123456789 ')
    css = []
    tot = 0
    for args in [
        ('noto-serif-sc', '400.css', 'Noto Serif SC', 400, 'normal', cjk),
        ('noto-serif-sc', '700.css', 'Noto Serif SC', 700, 'normal', cjk),
        ('noto-serif-sc', '900.css', 'Noto Serif SC', 900, 'normal', title),
        ('long-cang', '400.css', 'Long Cang', 400, 'normal', cjk),
        ('caveat', '500.css', 'Caveat', 500, 'normal', latin),
        ('caveat', '600.css', 'Caveat', 600, 'normal', latin),
        ('eb-garamond', '500.css', 'EB Garamond', 500, 'normal', latin),
        ('eb-garamond', '500-italic.css', 'EB Garamond', 500, 'italic', latin),
    ]:
        faces, t = build_face(*args, outdir=outdir)
        css += faces; tot += t
    os.makedirs(os.path.join(ROOT, 'dist'), exist_ok=True)
    open(os.path.join(ROOT, 'dist', 'fonts-files.css' if outdir else 'fonts.css'), 'w').write('\n'.join(css))
    open(os.path.join(ROOT, 'dist', 'chars.txt'), 'w').write(''.join(sorted(chars)))
    print(f'total {tot/1024:.0f} KB raw, {len(chars)} chars', file=sys.stderr)
