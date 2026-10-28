from dataclasses import dataclass
import math


@dataclass
class Config:
    backend: str = "opencv"          # Video decoder
    sample_seconds: float = 0.1     # Minimum interval between candidates
    analysis_width: int = 960        # Maximum image width during analysis
    blur_min: float = 60.0           # Minimum sharpness score
    clipped_max: float = 0.35        # Maximum proportion of nearly black/white pixels
    features: int = 3000             # Maximum ORB feature count
    ratio: float = 0.75              # Threshold for rejecting ambiguous matches
    min_inliers: int = 30            # Minimum geometrically consistent matches
    min_inlier_ratio: float = 0.35   # Minimum proportion of consistent matches
    min_grid_coverage: float = 0.25  # Minimum spatial distribution of matches
    min_motion: float = 0.025        # Minimum normalized pixel displacement
    homography_ratio: float = 0.90   # Threshold for planar/rotation classification
    ransac_px: float = 2.0           # Geometric error tolerance in analysis pixels
    roi: tuple | None = None         # Optional rectangular analysis region
    preprocess: bool = True          # Denoise + luminance equalization before selection
    denoise_sigma: float = 15.0      # Bilateral range sigma on Lab luminance; 0 disables
    clahe_clip: float = 2.0          # CLAHE contrast limit 
    clahe_grid: int = 8              # CLAHE tiles per axis

    save_rejected: bool = True       # Disable diagnostic JPEG writes for long scans

    def __post_init__(self):
        numeric = [getattr(self, name) for name in self.__dataclass_fields__
                   if isinstance(getattr(self, name), (int, float))]
        if not all(math.isfinite(value) for value in numeric):
            raise ValueError("Numeric parameters must be finite")
        for name in ("analysis_width", "features", "min_inliers", "clahe_grid"):
            if not isinstance(getattr(self, name), int) or isinstance(getattr(self, name), bool):
                raise ValueError(f"{name} must be an integer")
        if (self.backend not in ("opencv", "pyav") or self.sample_seconds <= 0
                or self.analysis_width < 32 or self.features < 8 or self.min_inliers < 8
                or self.blur_min < 0 or self.min_motion < 0 or self.ransac_px <= 0
                or self.denoise_sigma < 0 or self.clahe_clip <= 0 or self.clahe_grid < 1):
            raise ValueError("Invalid sampling, decoder or quality configuration")
        for name in ("clipped_max", "min_inlier_ratio", "min_grid_coverage", "homography_ratio"):
            if not 0 <= getattr(self, name) <= 1:
                raise ValueError(f"{name} must be in [0,1]")
        if not 0 < self.ratio < 1:
            raise ValueError("ratio must be between 0 and 1")
        if self.roi is not None:
            if len(self.roi) != 4 or not all(math.isfinite(value) for value in self.roi):
                raise ValueError("ROI requires four finite normalized coordinates")
            x, y, w, h = self.roi
            if x < 0 or y < 0 or w <= 0 or h <= 0 or x+w > 1 or y+h > 1:
                raise ValueError("ROI must lie inside [0,1]")
