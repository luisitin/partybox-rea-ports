"""Read-only actual PNG/body geometry check. No image pixels are modified."""
import hashlib
import json
import math
import sys
from collections import deque
from pathlib import Path

from PIL import Image


def inspect(path, expected):
    image = Image.open(path).convert("RGB")
    left, top, right, bottom = expected["roi"]
    left, top = max(0, math.ceil(left)), max(0, math.ceil(top))
    right, bottom = min(image.width, math.floor(right)), min(image.height, math.floor(bottom))
    colours = [expected["fillRgb"][:3], expected["strokeRgb"][:3]]
    pixels = image.load()
    candidates = set()
    for y in range(top, bottom):
        for x in range(left, right):
            rgb = pixels[x, y]
            if min(sum((rgb[i] - colour[i]) ** 2 for i in range(3)) for colour in colours) <= 18**2:
                candidates.add((x, y))
    largest = []
    while candidates:
        seed = candidates.pop()
        component = [seed]
        queue = deque([seed])
        while queue:
            x, y = queue.popleft()
            for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (-1, 1), (1, -1), (1, 1)):
                neighbour = (x + dx, y + dy)
                if neighbour in candidates:
                    candidates.remove(neighbour)
                    component.append(neighbour)
                    queue.append(neighbour)
        if len(component) > len(largest):
            largest = component
    if len(largest) < 100:
        raise ValueError("No substantial connected Ben body mask")
    bbox = [min(x for x, y in largest), min(y for x, y in largest), max(x for x, y in largest) + 1, max(y for x, y in largest) + 1]
    expected_bbox = expected["bbox"]
    edge_errors = [abs(a - b) for a, b in zip(bbox, expected_bbox)]
    center = [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2]
    expected_center = [(expected_bbox[0] + expected_bbox[2]) / 2, (expected_bbox[1] + expected_bbox[3]) / 2]
    center_errors = [abs(a - b) for a, b in zip(center, expected_center)]
    worst = max(edge_errors + center_errors)
    return {
        "pngSha256": hashlib.sha256(Path(path).read_bytes()).hexdigest(),
        "selection": "Largest 8-connected fill/stroke colour component inside the public arena rect",
        "colourDistanceLimit": 18,
        "bodyPixels": len(largest),
        "paintedBBox": bbox,
        "expectedBBox": expected_bbox,
        "edgeErrorsPx": edge_errors,
        "centerErrorsPx": center_errors,
        "worstErrorPx": worst,
        "limitPx": 2,
        "passed": worst <= 2,
    }


if __name__ == "__main__":
    try:
        result = inspect(sys.argv[1], json.loads(sys.argv[2]))
        print(json.dumps(result))
        sys.exit(0 if result["passed"] else 1)
    except Exception as error:
        print(json.dumps({"passed": False, "error": str(error)}))
        sys.exit(1)
