from dataclasses import dataclass


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
