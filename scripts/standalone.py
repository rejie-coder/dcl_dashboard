"""Bundle the built app into one portable HTML file. Run after npm run build."""
from pathlib import Path
import base64
import re
import sys
root = Path(__file__).resolve().parents[1]
dist = root / 'dist'
html = (dist / 'index.html').read_text()
logo = 'data:image/svg+xml;base64,' + base64.b64encode((dist / 'dcl-logo.svg').read_bytes()).decode()
js_path = re.search(r'<script type="module" crossorigin src="\./([^\"]+)"', html).group(1)
css_path = re.search(r'<link rel="stylesheet" crossorigin href="\./([^\"]+)"', html).group(1)
js = (dist / js_path).read_text().replace('./dcl-logo.svg', logo).replace('</script', '<\\/script')
css = (dist / css_path).read_text()
html = re.sub(r'<script type="module" crossorigin src="[^\"]+"></script>', lambda _: '<script type="module">'+js+'</script>', html)
html = re.sub(r'<link rel="stylesheet" crossorigin href="[^\"]+">', lambda _: '<style>'+css+'</style>', html)
html = re.sub(r'<link[^>]+(?:rel="manifest"|rel="apple-touch-icon"|rel="preconnect")[^>]*>', '', html)
html = re.sub(r'<link\s+href="https://fonts.googleapis.com[^>]*>', '', html)
html = re.sub(r'<script id="vite-plugin-pwa:register-sw"[^>]*></script>', '', html)
html = html.replace('./dcl-logo.svg', logo)
out = Path(sys.argv[1]) if len(sys.argv)>1 else root.parent / 'DCL_Pulse_Improved.html'
out.write_text(html)
print(out)
