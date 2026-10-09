"""Sequential decoding preserves timestamps; sampling does not imply random seeking."""
import math
import cv2


def decode(path, backend):
    if backend == "pyav":
        import av
        with av.open(str(path)) as container:
            stream = container.streams.video[0]
            for index, frame in enumerate(container.decode(stream)):
                if frame.time is None:
                    raise ValueError("Frame has no presentation timestamp")
                yield index, float(frame.time), frame.to_ndarray(format="bgr24")
        return
    cap = cv2.VideoCapture(str(path))
    if not cap.isOpened():
        raise ValueError(f"Cannot open video: {path}")
    fps = cap.get(cv2.CAP_PROP_FPS)
    last_time = -1.0
    try:
        index = 0
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            timestamp = cap.get(cv2.CAP_PROP_POS_MSEC) / 1000
            if not math.isfinite(timestamp) or timestamp <= last_time:
                if not math.isfinite(fps) or fps <= 0:
                    raise ValueError("No usable timestamp/FPS; use --backend pyav")
                timestamp = max(index / fps, last_time + 1 / fps)
            last_time = timestamp
            yield index, timestamp, frame
            index += 1
    finally:
        cap.release()


def candidates(path, config):
    next_time = None
    for index, timestamp, frame in decode(path, config.backend):
        if next_time is None or timestamp + 1e-6 >= next_time:
            yield index, timestamp, frame
            next_time = timestamp + config.sample_seconds
