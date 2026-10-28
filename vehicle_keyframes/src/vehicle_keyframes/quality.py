import cv2
import numpy as np


def analyze(frame, config):
    # An image wider than analysis_width pixels is reduced proportionally.
    height, width = frame.shape[:2]
    scale = min(1.0, config.analysis_width / width)
    small = cv2.resize(frame, (round(width * scale), round(height * scale)))

    # Converts the image to grayscale
    gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)

    # Creates a mask. White pixels identify the analysis region:
    mask = np.full(gray.shape, 255, np.uint8)
    if config.roi:
        x, y, w, h = config.roi
        sh, sw = gray.shape
        mask[:] = 0
        mask[int(y*sh):max(int((y+h)*sh), int(y*sh)+1),
             int(x*sw):max(int((x+w)*sw), int(x*sw)+1)] = 255
    pixels = gray[mask > 0]
    laplacian = cv2.Laplacian(gray, cv2.CV_64F)
    metrics = {"blur_score": float(laplacian[mask > 0].var()),
               "clipped_fraction": float(np.mean((pixels <= 5) | (pixels >= 250))),
               "mean_luma": float(pixels.mean())}
    
    passed = (metrics["blur_score"] >= config.blur_min and
              metrics["clipped_fraction"] <= config.clipped_max)
    return gray, mask, metrics, passed

'''
| Metric            | Calculation                   | Interpretation |
| blur_score        | Variance of the Laplacian     | Higher usually means more sharp detail |
| clipped_fraction  | Fraction of pixels ≤5 or ≥250 | Measures near-black/near-white regions |
| mean_luma         | Average grayscale intensity   | Recorded for inspection |
'''
