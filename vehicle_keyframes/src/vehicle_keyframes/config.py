from dataclasses import dataclass


@dataclass
class Config:
    backend: str = "opencv"
    sample_seconds: float = 0.3
    analysis_width: int = 960
    blur_min: float = 60.0
    clipped_max: float = 0.35
    features: int = 3000
    ratio: float = 0.75
    min_inliers: int = 30
    min_inlier_ratio: float = 0.35
    min_grid_coverage: float = 0.25
    min_motion: float = 0.025
    homography_ratio: float = 0.90
    ransac_px: float = 2.0
    roi: tuple | None = None
