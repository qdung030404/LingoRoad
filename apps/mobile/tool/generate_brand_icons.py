"""Generate Android/iOS icons from Components / Logo (2133:3907).

Run from apps/mobile with Python + Pillow after render_brand_assets_test.dart.
"""
import json
from pathlib import Path
import re
import xml.etree.ElementTree as ET
from PIL import Image

root = Path(__file__).resolve().parents[1]
source = root / 'assets/figma/logo.svg'
logo = Image.open(root / 'assets/figma/logo_1024.png').convert('RGB')
res = root / 'android/app/src/main/res'
for density, size in [('mdpi',48),('hdpi',72),('xhdpi',96),('xxhdpi',144),('xxxhdpi',192)]:
    logo.resize((size,size),Image.Resampling.LANCZOS).save(res / f'mipmap-{density}/ic_launcher.png')
paths = ET.fromstring(source.read_text()).findall('.//{http://www.w3.org/2000/svg}path')
def vector(size, adaptive=False):
    group = '<group android:scaleX="0.7" android:scaleY="0.7" android:translateX="36.3" android:translateY="36.3">' if adaptive else ''
    body = ''.join(f'<path android:fillColor="{p.attrib.get("fill", "#418A54")}" android:pathData="{p.attrib["d"]}" />' for p in paths)
    return (f'<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="{size}dp" android:height="{size}dp" android:viewportWidth="242" android:viewportHeight="242">'
        + group + body + ('</group>' if adaptive else '') + '</vector>\n')
(res/'drawable/brand_logo.xml').write_text(vector(96),encoding='utf-8')
(res/'drawable/brand_logo_foreground.xml').write_text(vector(108,True),encoding='utf-8')
adaptive=res/'mipmap-anydpi-v26'
adaptive.mkdir(exist_ok=True)
(adaptive/'ic_launcher.xml').write_text('''<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@android:color/white" />
    <foreground android:drawable="@drawable/brand_logo_foreground" />
    <monochrome android:drawable="@drawable/brand_logo_foreground" />
</adaptive-icon>
''',encoding='utf-8')
ios=root/'ios/Runner/Assets.xcassets'
icons=ios/'AppIcon.appiconset'
for item in json.loads((icons/'Contents.json').read_text())['images']:
    size=round(float(item['size'].split('x')[0])*float(item['scale'][:-1]))
    logo.resize((size,size),Image.Resampling.LANCZOS).save(icons/item['filename'])
for multiplier in [1,2,3]:
    name='LaunchImage'+(f'@{multiplier}x' if multiplier>1 else '')+'.png'
    size=96*multiplier
    logo.resize((size,size),Image.Resampling.LANCZOS).save(ios/'LaunchImage.imageset'/name)
svg=re.sub(r'<rect\b[^>]*/>','',source.read_text())
svg=svg.replace('width="242" height="242" viewBox="0 0 242 242"','width="212" height="178" viewBox="15 32 212 178"')
(root/'assets/figma/brand_mark.svg').write_text(svg,encoding='utf-8')
print('Generated Android adaptive/legacy icons, splash vectors, iOS icons and brand mark.')
