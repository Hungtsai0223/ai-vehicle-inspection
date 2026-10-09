"""Replace these hooks with SfM and global coverage implementations."""
from typing import Protocol


class SfMValidator(Protocol):
    def validate(self, images_dir, metadata: dict) -> dict:
        """Return registered images, tracks, reprojection errors, poses, etc."""
        ...


class CoverageOptimizer(Protocol):
    def optimize(self, metadata: dict, sfm_result: dict) -> list[int]:
        """Return selected source frame indices from reconstructed camera coverage."""
        ...
