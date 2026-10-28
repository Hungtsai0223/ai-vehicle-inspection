import json
import tempfile
import unittest
from pathlib import Path
import cv2
import numpy as np
from vehicle_keyframes.config import Config
from vehicle_keyframes.pipeline import run
from vehicle_keyframes.quality import analyze
from vehicle_keyframes.geometry import compare


class BaselineTests(unittest.TestCase):
    def test_quality(self):
        config = Config()
        self.assertFalse(analyze(np.full((240,320,3),255,np.uint8), config)[3])
        self.assertFalse(analyze(np.full((240,320,3),100,np.uint8), config)[3])

    def test_geometry(self):
        rng = np.random.default_rng(7)
        xyz = rng.uniform([-2,-1,4], [2,1,12], (180,3))
        def project(offset):
            p = xyz.copy()
            p[:,0] -= offset
            return (p[:,:2]/p[:,2:]*450 + [320,240]).astype(np.float32)
        descriptors = rng.integers(0,256,(180,32),dtype=np.uint8)
        ref = (project(0), descriptors)
        metrics, reason = compare(ref, (project(0.8),descriptors.copy()), (480,640), Config(min_motion=0.01))
        self.assertEqual(reason, "geometry_novel", metrics)
        self.assertGreater(metrics['inliers'], 100)
        self.assertEqual(compare(ref, ref, (480,640), Config())[1], 'redundant')
        self.assertEqual(compare(ref, (np.empty((0,2)),None), (480,640), Config())[1], 'tracking_lost')
        planar = project(0) + [35, 0]
        self.assertEqual(compare(ref, (planar.astype(np.float32), descriptors.copy()),
                                 (480,640), Config(min_motion=0.01))[1], 'planar_or_rotation')

    def test_video_outputs(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            video = root/'synthetic.avi'
            rng = np.random.default_rng(12)
            frame = rng.integers(25,230,(240,320,3),dtype=np.uint8)
            writer = cv2.VideoWriter(str(video),cv2.VideoWriter_fourcc(*'MJPG'),10,(320,240))
            self.assertTrue(writer.isOpened())
            for _ in range(12):
                writer.write(frame)
            writer.release()
            result = run(video,root/'output',Config(sample_seconds=0.2))
            self.assertEqual(result['status'],'complete')
            self.assertEqual(len(result['keyframes']),1)
            self.assertTrue(any(r['reason']=='redundant' for r in result['candidates']))
            self.assertTrue((root/'output'/result['keyframes'][0]['image']).is_file())
            self.assertTrue((root/'output'/result['keyframes'][0]['original_image']).is_file())
            self.assertTrue(result['keyframes'][0]['preprocessed'])
            rejected = [r for r in result['candidates'] if not r['selected']]
            self.assertEqual(len(list((root/'output/output_delete').glob('*.jpg'))), len(rejected))
            for row in rejected:
                self.assertIn(row['reason'], row['rejected_image'])
                saved = cv2.imread(str(root/'output'/row['rejected_image']))
                self.assertIsNotNone(saved)
                self.assertEqual(saved.shape, frame.shape)
            self.assertEqual(json.loads((root/'output/metadata.json').read_text())['schema_version'],1)
            with self.assertRaises(FileExistsError):
                run(video,root/'output',Config())

    def test_segments_and_empty(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            rng = np.random.default_rng(99)
            video = root/'cuts.avi'
            writer = cv2.VideoWriter(str(video),cv2.VideoWriter_fourcc(*'MJPG'),10,(320,240))
            self.assertTrue(writer.isOpened())
            for _ in range(3):
                writer.write(rng.integers(25,230,(240,320,3),dtype=np.uint8))
            writer.release()
            result = run(video,root/'segments',Config(sample_seconds=0.05))
            self.assertGreater(len(result['keyframes']),1)
            self.assertTrue(result['warnings'])
            self.assertGreater(result['keyframes'][-1]['segment'],0)
            result = run(video,root/'empty',Config(blur_min=1e12))
            self.assertEqual(result['status'],'no_keyframes')
            self.assertTrue(all((root/'empty'/r['rejected_image']).is_file() for r in result['candidates']))


if __name__ == '__main__':
    unittest.main()
