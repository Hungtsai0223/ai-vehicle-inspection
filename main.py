from typing import List
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import cv2
import numpy as np
from damage_detector import detect_car_damage

app = FastAPI(title="AI 車損自動比對 API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/compare-damage-batch")
async def compare_batch_photos(
    before_files: List[UploadFile] = File(...), 
    after_files: List[UploadFile] = File(...)
):
    results = []
    
    # 依照順序把前後照片兩兩配對進行比對
    for idx, (b_file, a_file) in enumerate(zip(before_files, after_files)):
        b_bytes = await b_file.read()
        a_bytes = await a_file.read()

        np_before = np.frombuffer(b_bytes, np.uint8)
        np_after = np.frombuffer(a_bytes, np.uint8)

        img_before = cv2.imdecode(np_before, cv2.IMREAD_COLOR)
        img_after = cv2.imdecode(np_after, cv2.IMREAD_COLOR)

        # 執行你們寫的影像比對
        damage_list, _ = detect_car_damage(img_before, img_after)

        results.append({
            "image_index": idx,
            "damage_count": len(damage_list),
            "damages": damage_list  # 回傳 pixel_x 與 pixel_y 座標
        })

    return {
        "status": "success",
        "total_processed": len(results),
        "results": results
    }