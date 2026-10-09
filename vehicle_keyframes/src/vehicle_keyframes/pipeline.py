import json
from dataclasses import asdict
from pathlib import Path
import cv2
from .video import candidates
from .quality import analyze
from .geometry import extract, compare


def run(video, output, config, validator=None, optimizer=None):
    video, output = Path(video).resolve(), Path(output).resolve()
    if not video.is_file():
        raise ValueError(f"Video does not exist: {video}")
    output.mkdir(parents=True, exist_ok=False)
    images = output / "images"
    images.mkdir()
    rejected = output / "output_delete"
    rejected.mkdir()

    def save_rejected(frame, row):
        filename = f"frame_{row['frame_index']:08d}_{row['reason']}.jpg"
        if not cv2.imwrite(str(rejected / filename), frame, [cv2.IMWRITE_JPEG_QUALITY, 95]):
            raise OSError(f"Cannot save rejected frame {filename}")
        row["rejected_image"] = f"output_delete/{filename}"

    metadata = {"schema_version": 1, "video": str(video), "config": asdict(config),
                "candidates": [], "keyframes": [], "warnings": [], "status": "running"}
    reference = None
    segment = 0
    last_shape = None
    cv2.setRNGSeed(0)
    try:
        for index, timestamp, frame in candidates(video, config):
            gray, mask, quality, passed = analyze(frame, config)
            row = {"frame_index": index, "timestamp_seconds": timestamp,
                   "quality": quality, "selected": False, "segment": segment}
            metadata["candidates"].append(row)
            if not passed:
                row["reason"] = "quality_rejected"
                save_rejected(frame, row)
                continue
            features = extract(gray, mask, config)
            if len(features[0]) < config.min_inliers:
                row["reason"] = "insufficient_features"
                save_rejected(frame, row)
                continue
            if reference is None:
                reason = "initial"
            elif gray.shape != last_shape:
                reason = "tracking_lost"
            else:
                metrics, reason = compare(reference, features, gray.shape, config)
                row["geometry"] = metrics
            row["reason"] = reason
            if reason in ("redundant", "planar_or_rotation"):
                save_rejected(frame, row)
                continue
            if reason == "tracking_lost":
                segment += 1
                row["segment"] = segment
                metadata["warnings"].append(f"Frame {index}: overlap unverified; started segment {segment}")
            filename = f"frame_{index:08d}.jpg"
            if not cv2.imwrite(str(images / filename), frame, [cv2.IMWRITE_JPEG_QUALITY, 95]):
                raise OSError(f"Cannot save {filename}")
            row.update(selected=True, image=f"images/{filename}")
            metadata["keyframes"].append(dict(row))
            reference, last_shape = features, gray.shape
        metadata["status"] = "complete" if metadata["keyframes"] else "no_keyframes"
        if not metadata["keyframes"]:
            metadata["warnings"].append("No usable frames: inspect video, ROI and quality thresholds")
        metadata["coverage_verified"] = False
        if validator:
            metadata["sfm"] = validator.validate(images, metadata)
        if optimizer:
            if "sfm" not in metadata:
                raise ValueError("Coverage optimization requires SfM validation")
            metadata["optimized_indices"] = optimizer.optimize(metadata, metadata["sfm"])
    except Exception as error:
        metadata.update(status="failed", error=str(error))
        raise
    finally:
        (output / "metadata.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
    return metadata
