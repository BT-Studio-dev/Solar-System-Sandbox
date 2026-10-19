"""Expose a bounded, escaped build-error excerpt in GitHub check annotations."""
from pathlib import Path
import sys

log = Path(sys.argv[1])
text = log.read_text(errors='replace') if log.exists() else 'Build log unavailable'
# Include both the failure heading and tail without attaching credentials or environment dumps.
lines = text.splitlines()
start = next((i for i, line in enumerate(lines) if 'FAILURE:' in line), max(0, len(lines) - 35))
excerpt = '\n'.join(lines[start:start + 60])[-12000:]
for old, new in [('%', '%25'), ('\r', '%0D'), ('\n', '%0A')]:
    excerpt = excerpt.replace(old, new)
print('::error title=Android build failed::' + excerpt)
