import cv2
import numpy as np


def extract(gray, mask, config):
    keypoints, descriptors = cv2.ORB_create(nfeatures=config.features).detectAndCompute(gray, mask)
    return np.asarray([k.pt for k in keypoints], np.float32).reshape(-1, 2), descriptors


def compare(reference, current, shape, config):
    p1, d1 = reference
    p2, d2 = current
    result = {"matches": 0, "inliers": 0, "inlier_ratio": 0.0,
              "grid_coverage": 0.0, "motion": 0.0, "homography_fraction": 0.0}
    if d1 is None or d2 is None or len(d1) < 2 or len(d2) < 2:
        return result, "tracking_lost"
    matcher = cv2.BFMatcher(cv2.NORM_HAMMING)
    def good(a, b):
        return {m.queryIdx: m.trainIdx for pair in matcher.knnMatch(a, b, k=2)
                if len(pair) == 2 for m, n in [pair] if m.distance < config.ratio*n.distance}
    forward, backward = good(d1, d2), good(d2, d1)
    pairs = [(a, b) for a, b in forward.items() if backward.get(b) == a]
    result["matches"] = len(pairs)
    if len(pairs) < 8:
        return result, "tracking_lost"
    a = np.float32([p1[i] for i, _ in pairs])
    b = np.float32([p2[j] for _, j in pairs])
    _, fmask = cv2.findFundamentalMat(a, b, cv2.FM_RANSAC, config.ransac_px, 0.99)
    if fmask is None or len(fmask) != len(a):
        return result, "tracking_lost"
    valid = fmask.ravel().astype(bool)
    count = int(valid.sum())
    result.update(inliers=count, inlier_ratio=count/len(a))
    if count:
        h, w = shape
        def coverage(points):
            cells = np.clip((points / [w, h] * 4).astype(int), 0, 3)
            return len(set(map(tuple, cells))) / 16
        result["grid_coverage"] = min(coverage(a[valid]), coverage(b[valid]))
        result["motion"] = float(np.median(np.linalg.norm(b[valid]-a[valid], axis=1))/np.hypot(w,h))
    _, hmask = cv2.findHomography(a, b, cv2.RANSAC, config.ransac_px)
    if hmask is not None and count:
        result["homography_fraction"] = float((hmask.ravel().astype(bool) & valid).sum()/count)
    if (count < config.min_inliers or result["inlier_ratio"] < config.min_inlier_ratio
            or result["grid_coverage"] < config.min_grid_coverage):
        return result, "tracking_lost"
    if result["motion"] < config.min_motion:
        return result, "redundant"
    if result["homography_fraction"] >= config.homography_ratio:
        return result, "planar_or_rotation"
    return result, "geometry_novel"
