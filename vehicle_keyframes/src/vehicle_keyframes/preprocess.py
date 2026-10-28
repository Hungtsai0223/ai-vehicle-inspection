"""Photometric enhancement, not recovery of sensor-clipped detail."""
import cv2
import numpy as np

def enhance(frame, config):
    if not config.preprocess:
        return frame
    # Modify luminance only to avoid independently equalizing B, G and R.
    lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
    light, a, b = cv2.split(lab)
    if config.denoise_sigma > 0:
        light = cv2.bilateralFilter(light, 5, config.denoise_sigma, 3.0) 
    # Bilateral Filter: delete noise
    # - Spatial distance: The closer the pixels, the higher the weight.
    # - Brightness difference: The more similar the brightness, the higher the weight.

    # Normalize the observed range; avoid amplifying nearly uniform/no-detail frames.
    low, high = np.percentile(light, (1, 99))
    if high - low >= 10:
        light = np.clip(16 + (light.astype(np.float32)-low) * 219 / (high-low),
                        0, 255).astype(np.uint8)
        
    clahe = cv2.createCLAHE(clipLimit=config.clahe_clip,
                            tileGridSize=(config.clahe_grid, config.clahe_grid))
    light = clahe.apply(light)
    return cv2.cvtColor(cv2.merge((light, a, b)), cv2.COLOR_LAB2BGR)
    # Contrast Limited Adaptive Histogram Equalizatio   
    # - Local processing: It segments the image into small blocks, adjusts the contrast of each block, and then smoothly connects them.
    # - Limiting enhancement: It prevents certain brightness levels from dominating the result and reduces the risk of noise being over-amplified.