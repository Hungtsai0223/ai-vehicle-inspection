import tempfile
import unittest
from pathlib import Path
import cv2
import numpy as np
from vehicle_keyframes.config import Config
from vehicle_keyframes.preprocess import enhance
from vehicle_keyframes.pipeline import run


class PreprocessTests(unittest.TestCase):
    def test_disabled_preserves_pixels(self):
        frame = np.random.default_rng(1).integers(0, 256, (64, 96, 3), dtype=np.uint8)
        np.testing.assert_array_equal(enhance(frame, Config(preprocess=False)), frame)

    def test_bright_low_contrast_detail(self):
        gray = np.tile(np.linspace(190, 235, 128).astype(np.uint8), (96, 1))
        gray[30:60, 40:80] -= 15
        frame = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)
        result = enhance(frame, Config(denoise_sigma=0))
        self.assertEqual(result.shape, frame.shape)
        self.assertEqual(result.dtype, np.uint8)
        corrected = cv2.cvtColor(result, cv2.COLOR_BGR2GRAY)
        self.assertGreater(float(np.std(corrected)), float(np.std(gray)))

    def test_denoise_reduces_flat_region_noise(self):
        gray = np.clip(120 + np.random.default_rng(2).normal(0, 4, (128,128)), 0,255).astype(np.uint8)
        frame = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)
        noisy = enhance(frame, Config(denoise_sigma=0))
        filtered = enhance(frame, Config(denoise_sigma=15))
        self.assertLess(float(filtered[16:-16,16:-16].std()), float(noisy[16:-16,16:-16].std()))

    def test_source_clipping_remains_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            writer = cv2.VideoWriter(str(root/'white.avi'), cv2.VideoWriter_fourcc(*'MJPG'), 10, (128,96))
            self.assertTrue(writer.isOpened())
            writer.write(np.full((96,128,3),255,np.uint8))
            writer.release()
            result = run(root/'white.avi', root/'out', Config(blur_min=0))
            self.assertEqual(result['status'], 'no_keyframes')
            self.assertEqual(result['candidates'][0]['reason'], 'quality_rejected')
            self.assertEqual(result['candidates'][0]['original_quality']['clipped_fraction'], 1.0)
