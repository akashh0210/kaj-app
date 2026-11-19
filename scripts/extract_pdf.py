import sys
import pypdf

if len(sys.argv) < 2:
    sys.exit(1)

try:
    reader = pypdf.PdfReader(sys.argv[1])
    text = '\n'.join(p.extract_text() or '' for p in reader.pages)
    print(text)
except Exception as e:
    sys.stderr.write(str(e))
    sys.exit(1)
