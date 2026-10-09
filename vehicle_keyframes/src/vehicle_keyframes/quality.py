import cv2
import numpy as np


def analyze(frame, config):
    height, width = frame.shape[:2]
    scale = min(1.0, config.analysis_width / width)
    small = cv2.resize(frame, (round(width * scale), round(height * scale)))
    gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
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
