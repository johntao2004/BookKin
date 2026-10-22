#!/usr/bin/env python3
"""Create four original, deterministic EPUB fixtures outside the managed library.
Import through BookKin's upload/review flow; never insert knowledge results directly.
"""
import hashlib
import json
from pathlib import Path
import sys
import zipfile
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parents[1]
TARGET = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else ROOT / '.local/knowledge-test-books'
BOOKS = [
    ('生态系统与碳循环', 'botanical-window.jpg', [
        ('光合作用', '光合作用是植物利用光能，将二氧化碳和水转化为有机物并释放氧气的过程。植物通过叶片中的叶绿体进行光合作用，有机物中的碳来自环境中的二氧化碳。光照强度、水分和二氧化碳供应会影响光合作用的速率。'),
        ('碳循环', '碳循环是碳在大气、生物、水体和岩石之间迁移的过程。光合作用使大气中的碳进入生物体，呼吸作用和分解作用又使部分碳返回环境。森林的碳储存量反映碳的存量，不能直接等同于一年内吸收的碳量。'),
        ('生物多样性', '生物多样性包含遗传多样性、物种多样性和生态系统多样性。不同物种承担不同的生态功能，生物多样性的变化可能影响生态系统的稳定性。保护栖息地和维持生态连通性是保护生物多样性的重要措施。'),
    ]),
    ('森林修复与生态监测', 'mountains-autumn.jpg', [
        ('光合作用与森林', '光合作用是植物利用光能，将二氧化碳和水转化为有机物并释放氧气的过程。森林修复初期应关注幼苗获得的光照和水分。光合作用形成的有机物为植物生长提供物质基础，但植物也通过呼吸作用消耗有机物。'),
        ('碳循环与恢复', '碳循环是碳在大气、生物、水体和岩石之间迁移的过程。修复森林时，树木生长可以增加生物量中的碳储存，土壤有机质也参与碳循环。评估修复效果需要同时观察植被和土壤，不能只记录树木数量。'),
        ('生物多样性与样方调查', '生物多样性包含遗传多样性、物种多样性和生态系统多样性。样方调查是在划定的样地内记录物种及其数量的方法。设置多个重复样方并记录样方面积，有助于比较不同修复地块的物种组成。'),
    ]),
    ('河流生态与水质观察', 'whale-sky.jpg', [
        ('生物多样性与河流', '生物多样性包含遗传多样性、物种多样性和生态系统多样性。河流中水生植物、鱼类和底栖动物构成多样的生物群落。保持河岸植被和河流连通性，有助于维持生物多样性。'),
        ('富营养化', '富营养化是水体中氮、磷等营养盐过量积累，引发藻类大量繁殖等变化的现象。藻类死亡后的分解过程消耗溶解氧，可能造成鱼类缺氧。控制营养盐的外部输入是治理富营养化的重要措施。'),
        ('溶解氧', '溶解氧是溶解在水中的氧气，其浓度是描述水质的重要指标之一。水中生物的呼吸和有机物分解消耗溶解氧，水生植物的光合作用在有光条件下可以补充溶解氧。测量时应同时记录水温、时刻和采样位置。'),
    ]),
    ('古籍装帧与纸张保护', 'bell-tower.jpg', [
        ('线装', '线装是将书页折叠、按次序叠放后，在书脊一侧打孔并穿线订合的装帧方法。线装书的装订线承受开合过程中的拉力，检查时应观察线孔附近是否出现撕裂和松脱。'),
        ('纸张酸化', '纸张酸化指纸张中的酸性物质促进纤维素降解，使纸张逐渐变脆的变化过程。纸张酸化与原料、制造过程和保存环境有关。保护工作应先记录纸张状况，再由专业人员判断是否适合进行脱酸处理。'),
        ('温湿度监测', '温湿度监测是持续记录保存环境温度和相对湿度的方法。温湿度剧烈波动可能加剧纸张和装订材料的变形。记录连续数据并关注波动幅度，比只记录某一次的温湿度数值更能帮助评估保存环境。'),
    ]),
]
TARGET.mkdir(parents=True, exist_ok=True)
manifest = []
for number, (subject, cover, chapters) in enumerate(BOOKS, 1):
    title = f'图谱测试{number:02d}·{subject}'
    path = TARGET / f'{title}.epub'
    files = {'mimetype': b'application/epub+zip'}
    files['META-INF/container.xml'] = b'<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>'
    items = ''.join(f'<item id="c{i}" href="c{i}.xhtml" media-type="application/xhtml+xml"/>' for i in range(1, 4))
    spine = ''.join(f'<itemref idref="c{i}"/>' for i in range(1, 4))
    files['OEBPS/content.opf'] = f'''<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" unique-identifier="id" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">urn:bookkin:knowledge-test:v1:{number}</dc:identifier><dc:title>{title}</dc:title><dc:creator>BookKin 图谱测试</dc:creator><dc:language>zh-CN</dc:language><dc:description>原创知识图谱验收样本；仅供功能测试，共三章，不预置分析结果或阅读数据。</dc:description><dc:subject>图谱测试</dc:subject><meta property="dcterms:modified">2026-10-22T00:00:00Z</meta><meta name="cover" content="cover"/></metadata><manifest><item id="cover" href="cover.jpg" media-type="image/jpeg" properties="cover-image"/><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>{items}</manifest><spine>{spine}</spine></package>'''.encode()
    nav = ''.join(f'<li><a href="c{i}.xhtml">{escape(name)}</a></li>' for i, (name, _) in enumerate(chapters, 1))
    files['OEBPS/nav.xhtml'] = f'<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>目录</title></head><body><nav epub:type="toc"><ol>{nav}</ol></nav></body></html>'.encode()
    for i, (name, body) in enumerate(chapters, 1):
        files[f'OEBPS/c{i}.xhtml'] = f'<html xmlns="http://www.w3.org/1999/xhtml" lang="zh-CN"><head><title>{escape(name)}</title></head><body><h1>{escape(name)}</h1><p>{escape(body)}</p></body></html>'.encode()
    files['OEBPS/cover.jpg'] = (ROOT / 'apps/web/public/covers' / cover).read_bytes()
    # Deterministic bytes, exclusive creation, and repeat runs preserve existing books.
    from io import BytesIO
    buffer = BytesIO()
    with zipfile.ZipFile(buffer, 'w') as archive:
        for name, data in files.items():
            info = zipfile.ZipInfo(name, date_time=(2026, 10, 22, 0, 0, 0))
            info.compress_type = zipfile.ZIP_STORED if name == 'mimetype' else zipfile.ZIP_DEFLATED
            archive.writestr(info, data)
    content = buffer.getvalue()
    if path.exists():
        if path.read_bytes() != content:
            raise SystemExit(f'Refusing to overwrite different file: {path}')
    else:
        with path.open('xb') as output:
            output.write(content)
    manifest.append({'title': title, 'file': str(path), 'sha256': hashlib.sha256(content).hexdigest(), 'chapters': [name for name, _ in chapters]})
(TARGET / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(manifest, ensure_ascii=False, indent=2))
