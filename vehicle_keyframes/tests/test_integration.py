import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import cv2
import numpy as np
from vehicle_keyframes.config import Config
from vehicle_keyframes.pipeline import run

class IntegrationTests(unittest.TestCase):
    def test_library_config_rejects_invalid_values_as_cli_does(self):
        for values in [{'sample_seconds':0},{'ratio':1},{'roi':(-.1,0,.5,.5)},{'roi':(0,0,float('nan'),.5)},{'backend':'bad'},{'clahe_clip':0},{'analysis_width':1.5},{'blur_min':float('nan')}]:
            with self.subTest(values=values),self.assertRaises(ValueError):
                Config(**values)
    def test_rejected_images_can_be_disabled_without_losing_audit_metadata(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);video=root/'white.avi'
            writer=cv2.VideoWriter(str(video),cv2.VideoWriter_fourcc(*'MJPG'),10,(128,96))
            self.assertTrue(writer.isOpened());writer.write(np.full((96,128,3),255,np.uint8));writer.release()
            result=run(video,root/'out',Config(save_rejected=False))
            self.assertEqual(result['status'],'no_keyframes')
            self.assertEqual(result['candidates'][0]['reason'],'quality_rejected')
            self.assertNotIn('rejected_image',result['candidates'][0])
            self.assertEqual(list((root/'out/output_delete').glob('*.jpg')),[])
    def test_no_preprocessing_analyzes_source_only_once(self):
        frame=np.random.default_rng(5).integers(20,230,(96,128,3),dtype=np.uint8)
        from vehicle_keyframes.quality import analyze
        with tempfile.TemporaryDirectory() as folder:
            video=Path(folder)/'input.avi';video.touch()
            with patch('vehicle_keyframes.pipeline.candidates',return_value=iter([(0,0,frame)])),patch('vehicle_keyframes.pipeline.analyze',wraps=analyze) as spy:
                run(video,Path(folder)/'out',Config(preprocess=False,min_inliers=8))
                self.assertEqual(spy.call_count,1)
