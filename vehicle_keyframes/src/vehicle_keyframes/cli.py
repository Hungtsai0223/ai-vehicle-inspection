import argparse
import math
from .config import Config
from .pipeline import run


def main():
    parser = argparse.ArgumentParser(description="Geometry-aware vehicle video keyframes")
    parser.add_argument("video")
    parser.add_argument("--output", required=True, help="New output directory (must not exist)")
    defaults = Config()
    for name in defaults.__dataclass_fields__:
        value = getattr(defaults, name)
        if name == "backend":
            parser.add_argument("--backend", choices=["opencv", "pyav"], default=value)
        elif name == "roi":
            parser.add_argument("--roi", nargs=4, type=float, metavar=("X", "Y", "W", "H"))
        else:
            parser.add_argument("--"+name.replace("_", "-"), type=type(value), default=value)
    args = parser.parse_args()
    values = {name: getattr(args, name) for name in defaults.__dataclass_fields__}
    config = Config(**values)
    if any(not math.isfinite(value) for value in values.values() if isinstance(value, (int, float))):
        parser.error("Numeric parameters must be finite")
    if (config.sample_seconds <= 0 or config.analysis_width < 32 or config.features < 8
            or config.min_inliers < 8 or config.blur_min < 0 or config.min_motion < 0
            or config.ransac_px <= 0):
        parser.error("Invalid positive/count threshold")
    for name in ("clipped_max", "min_inlier_ratio", "min_grid_coverage", "homography_ratio"):
        if not 0 <= getattr(config, name) <= 1:
            parser.error(f"{name} must be in [0, 1]")
    if not 0 < config.ratio < 1:
        parser.error("ratio must be between 0 and 1")
    if config.roi:
        x, y, w, h = config.roi
        if (not all(math.isfinite(v) for v in config.roi) or
                x < 0 or y < 0 or w <= 0 or h <= 0 or x+w > 1 or y+h > 1):
            parser.error("ROI uses normalized X Y W H inside [0,1]")
    try:
        result = run(args.video, args.output, config)
    except (ValueError, OSError, ImportError) as error:
        parser.exit(1, f"Error: {error}\n")
    print(f"Selected {len(result['keyframes'])}/{len(result['candidates'])} candidates; {args.output}")
    if not result["keyframes"]:
        parser.exit(2, "No usable keyframes; inspect metadata.json\n")


if __name__ == "__main__":
    main()
