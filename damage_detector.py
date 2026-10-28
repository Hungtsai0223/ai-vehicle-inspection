import cv2
import numpy as np

def align_images(img_before, img_after):
    """
    使用 ORB 特徵點對齊，將還車照片 (img_after) 校正至取車照片 (img_before) 的視角
    """
    gray_before = cv2.cvtColor(img_before, cv2.COLOR_BGR2GRAY)
    gray_after = cv2.cvtColor(img_after, cv2.COLOR_BGR2GRAY)

    orb = cv2.ORB_create(nfeatures=2000)
    kp1, des1 = orb.detectAndCompute(gray_before, None)
    kp2, des2 = orb.detectAndCompute(gray_after, None)

    if des1 is None or des2 is None:
        return img_after, False

    matcher = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
    matches = matcher.match(des1, des2)
    matches = sorted(matches, key=lambda x: x.distance)
    good_matches = matches[:int(len(matches) * 0.15)]

    if len(good_matches) < 4:
        return img_after, False

    pts_before = np.float32([kp1[m.queryIdx].pt for m in good_matches]).reshape(-1, 1, 2)
    pts_after = np.float32([kp2[m.trainIdx].pt for m in good_matches]).reshape(-1, 1, 2)

    H, mask = cv2.findHomography(pts_after, pts_before, cv2.RANSAC, 5.0)
    if H is None or not np.isfinite(H).all() or mask is None or int(mask.sum()) < 4:
        return img_after, False
    height, width, _ = img_before.shape
    aligned_after = cv2.warpPerspective(img_after, H, (width, height))

    return aligned_after, True

def detect_car_damage(img_before, img_after, min_area=10):
    """
    直接比對兩張圖片的像素差異（不經由 ORB 強制對齊，確保塗鴉或車損能被抓到）
    """
    # Pixel differences include lighting, pose and background changes; not confirmed damage.
    if (img_before is None or img_after is None or img_before.ndim != 3 or img_after.ndim != 3):
        raise ValueError("Two decoded color images are required")
    # 移除 align_images，直接使用原圖大小進行比對
    # 確保兩張圖尺寸一致
    if img_before.shape != img_after.shape:
        img_after = cv2.resize(img_after, (img_before.shape[1], img_before.shape[0]))

    gray1 = cv2.cvtColor(img_before, cv2.COLOR_BGR2GRAY)
    gray2 = cv2.cvtColor(img_after, cv2.COLOR_BGR2GRAY)

    # 輕微模糊
    gray1 = cv2.GaussianBlur(gray1, (3, 3), 0)
    gray2 = cv2.GaussianBlur(gray2, (3, 3), 0)

    # 計算絕對差值
    diff = cv2.absdiff(gray1, gray2)
    _, thresh = cv2.threshold(diff, 15, 255, cv2.THRESH_BINARY)

    kernel = np.ones((3, 3), np.uint8)
    thresh = cv2.dilate(thresh, kernel, iterations=1)

    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    damage_results = []
    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area > min_area:
            x, y, w, h = cv2.boundingRect(cnt)
            center_x = x + w // 2
            center_y = y + h // 2

            damage_results.append({
                "pixel_x": float(center_x),
                "pixel_y": float(center_y),
                "bbox": [int(x), int(y), int(w), int(h)],
                "area": float(area)
            })

    return damage_results, img_after
