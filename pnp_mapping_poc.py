import cv2
import numpy as np

def run_pnp_mapping_poc():
    print("=== 合成對應點 PnP 算法示意：未經實車校正 ===")

    # 1. 定義 3D 車體參考特徵點 (單位：公尺，以車體中心為原點)
    # 這裡選取 Toyota GR Yaris 容易辨識的 6 個特徵點
    model_3d_points = np.array([
        [ 0.0,    1.9,  0.4],   # 0: 前保桿中心 (Front Bumper Center)
        [-0.7,    1.6,  0.7],   # 1: 左大燈 (Left Headlight)
        [ 0.7,    1.6,  0.7],   # 2: 右大燈 (Right Headlight)
        [-0.8,    0.0,  0.8],   # 3: 左後視鏡 (Left Side Mirror)
        [ 0.8,    0.0,  0.8],   # 4: 右後視鏡 (Right Side Mirror)
        [ 0.0,   -1.8,  0.6],   # 5: 後保桿中心 (Rear Bumper Center)
    ], dtype=np.float32)

    # 2. 假設從 YOLO / 影像中偵測到的 2D 像素座標 (對應上面的 6 個特徵點)
    # 影像解析度假設為 1920x1080
    image_2d_points = np.array([
        [960,  650],   # 前保桿
        [680,  580],   # 左大燈
        [1240, 580],   # 右大燈
        [450,  420],   # 左後視鏡
        [1470, 420],   # 右後視鏡
        [960,  880],   # 後保桿
    ], dtype=np.float32)

    # 3. 相機內參矩陣 (Camera Matrix) 與 畸變係數 (Distortion Coefficients)
    img_h, img_w = 1080, 1920
    focal_length = img_w  # 粗估焦距
    center = (img_w / 2, img_h / 2)

    camera_matrix = np.array([
        [focal_length, 0,            center[0]],
        [0,            focal_length, center[1]],
        [0,            0,            1]
    ], dtype=np.float32)

    dist_coeffs = np.zeros((4, 1), dtype=np.float32) # 假設無鏡頭畸變

    # 4. 執行 SolvePnP 計算相機姿態 (Pose Estimation)
    success, rvec, tvec = cv2.solvePnP(
        model_3d_points,
        image_2d_points,
        camera_matrix,
        dist_coeffs,
        flags=cv2.SOLVEPNP_ITERATIVE
    )

    if not success:
        print("❌ PnP 求解失敗，請檢查 2D/3D 對應點。")
        return

    print("✅ PnP 姿態求解成功！")
    print(f"旋轉向量 (rvec):\n{rvec.ravel()}")
    print(f"平移向量 (tvec, 公尺):\n{tvec.ravel()}")

    # 5. 轉換旋轉向量為旋轉矩陣 (Rotation Matrix R)
    R, _ = cv2.Rodrigues(rvec)

    # 6. 模擬 YOLO 偵測到的「車損區域」2D 像素 (例如：引擎蓋上的擦傷)
    yolo_damage_2d_pixel = np.array([[900.0, 520.0]], dtype=np.float32)

    print(f"\n[模擬 YOLO 輸入] 2D 車損像素座標: {yolo_damage_2d_pixel[0]}")

    # 7. 反向投影 (2D Ray Unprojection): 將 2D 像素轉為相機座標系下的 3D 射線方向
    pixel_x, pixel_y = yolo_damage_2d_pixel[0]
    fx, fy = camera_matrix[0, 0], camera_matrix[1, 1]
    cx, cy = camera_matrix[0, 2], camera_matrix[1, 2]

    # 相機座標系下的方向向量 d_cam
    d_cam = np.array([(pixel_x - cx) / fx, (pixel_y - cy) / fy, 1.0])
    d_cam = d_cam / np.linalg.norm(d_cam)

    # 轉換射線方向到世界/模型座標系 (World/Model Coordinates)
    d_world = R.T @ d_cam
    cam_pos_world = -R.T @ tvec.ravel()

    print(f"計算出的相機世界位置 (Cam Pos in 3D Space): {cam_pos_world}")
    print(f"車損 3D 視線射線方向 (Damage Ray Direction): {d_world}")

    print("\n🎯 [對接說明]")
    print("此 3D 視線 (Origin + Direction) 可直接送入 PyTrimesh 或 Three.js Raycaster，")
    print("完成相機與車型校正、驗證對應點後，才可嘗試打中 'yaris_poc.glb' 的 'hood' 或 'car_body' Mesh，估計表面點（此腳本沒有實際驗證位置精度）！")

if __name__ == "__main__":
    run_pnp_mapping_poc()
