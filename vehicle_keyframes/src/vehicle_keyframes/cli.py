import argparse
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
        elif isinstance(value, bool):
            parser.add_argument("--"+name.replace("_", "-"),
                                action=argparse.BooleanOptionalAction, default=value)
        else:
            parser.add_argument("--"+name.replace("_", "-"), type=type(value), default=value)
    args = parser.parse_args()
    values = {name: getattr(args, name) for name in defaults.__dataclass_fields__}
    try:
        config = Config(**values)
    except ValueError as error:
        parser.error(str(error))
    try:
        result = run(args.video, args.output, config)
    except (ValueError, OSError, ImportError) as error:
        parser.exit(1, f"Error: {error}\n")
    print(f"Selected {len(result['keyframes'])}/{len(result['candidates'])} candidates; {args.output}")
    if not result["keyframes"]:
        parser.exit(2, "No usable keyframes; inspect metadata.json\n")


if __name__ == "__main__":
    main()
