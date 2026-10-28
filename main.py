"""Experimental image-difference API. Not the /api/v1 inspection service or damage AI."""
import io
import os
import warnings
from pathlib import Path
from fastapi.responses import FileResponse
from typing import List
import cv2
import numpy as np
from PIL import Image, UnidentifiedImageError
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool
from damage_detector import detect_car_damage

MAX_FILE_BYTES = 8 * 1024 * 1024
MAX_IMAGE_PIXELS = 16_000_000
MAX_PAIRS = 12
app = FastAPI(title="Experimental photo-difference API")
app.add_middleware(CORSMiddleware,
    allow_origins=[origin.strip() for origin in os.getenv("POC_ALLOWED_ORIGINS", "http://localhost:8080,http://127.0.0.1:8080").split(",") if origin.strip()],
    allow_credentials=False, allow_methods=["GET", "POST"], allow_headers=["Content-Type"])

@app.get("/health")
def health():
    return {"status": "ok", "service": "photo-difference-poc", "inspection_api_compatible": False}

def decode_image(payload):
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(payload)) as image:
                if image.format not in {"JPEG", "PNG", "WEBP"}:
                    raise HTTPException(415, "Only JPEG, PNG or WebP images are supported")
                if image.width * image.height > MAX_IMAGE_PIXELS:
                    raise HTTPException(413, "Image dimensions exceed the prototype limit")
                image.verify()
    except HTTPException:
        raise
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise HTTPException(422, "Invalid image") from None
    frame = cv2.imdecode(np.frombuffer(payload, np.uint8), cv2.IMREAD_COLOR)
    if frame is None:
        raise HTTPException(422, "Cannot decode image")
    return frame

def compare_pair(before_bytes, after_bytes, index):
    before, after = decode_image(before_bytes), decode_image(after_bytes)
    damages, _ = detect_car_damage(before, after)
    h, w = before.shape[:2]
    # Source images must already share a viewpoint. Resizing is not calibration.
    return {"image_index": index, "image_width": w, "image_height": h,
            "coordinate_space": "before_image", "resized": before.shape != after.shape,
            "damage_count": len(damages), "damages": damages}

@app.post("/api/compare-damage-batch")
async def compare_batch_photos(before_files: List[UploadFile] = File(...), after_files: List[UploadFile] = File(...)):
    try:
        if not before_files or len(before_files) != len(after_files):
            raise HTTPException(422, "Before and after image counts must match")
        if len(before_files) > MAX_PAIRS:
            raise HTTPException(413, "At most 12 image pairs are supported")
        results = []
        for index, (before, after) in enumerate(zip(before_files, after_files)):
            before_bytes, after_bytes = await before.read(MAX_FILE_BYTES + 1), await after.read(MAX_FILE_BYTES + 1)
            if len(before_bytes) > MAX_FILE_BYTES or len(after_bytes) > MAX_FILE_BYTES:
                raise HTTPException(413, "Each image must be at most 8 MiB")
            results.append(await run_in_threadpool(compare_pair, before_bytes, after_bytes, index))
        return {"status": "success", "algorithm": "pixel_difference", "calibrated": False,
                "total_processed": len(results), "results": results}
    finally:
        for upload in [*before_files, *after_files]:
            await upload.close()


@app.get("/", include_in_schema=False)
def prototype_page():
    return FileResponse(Path(__file__).with_name("index.html"), media_type="text/html")

@app.get("/assets/yaris_poc.glb", include_in_schema=False)
def prototype_model():
    return FileResponse(Path(__file__).with_name("yaris_poc.glb"), media_type="model/gltf-binary")

@app.get("/assets/poc-mapping.mjs", include_in_schema=False)
def prototype_mapping():
    return FileResponse(Path(__file__).with_name("poc-mapping.mjs"), media_type="text/javascript")
