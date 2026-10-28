import io
import unittest
from unittest.mock import patch
import numpy as np
from PIL import Image
from fastapi.testclient import TestClient
import main
from damage_detector import align_images

def image_bytes(mark=False, size=(160, 100)):
    pixels = np.full((size[1], size[0], 3), 120, np.uint8)
    if mark:
        pixels[30:50, 50:80] = 20
    out = io.BytesIO()
    Image.fromarray(pixels).save(out, format="PNG")
    return out.getvalue()

class PhotoApiTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(main.app)
    def post(self, before, after):
        return self.client.post("/api/compare-damage-batch", files=[*(('before_files', ('before.png', b, 'image/png')) for b in before), *(('after_files', ('after.png', b, 'image/png')) for b in after)])
    def test_health_is_explicitly_not_inspection_api(self):
        self.assertFalse(self.client.get('/health').json()['inspection_api_compatible'])
        self.assertEqual(self.client.post('/api/v1/inspections').status_code,404)
    def test_multiple_pairs_nested_results_and_real_dimensions(self):
        response=self.post([image_bytes(),image_bytes(size=(80,60))],[image_bytes(True),image_bytes(size=(80,60))])
        self.assertEqual(response.status_code,200,response.text)
        result=response.json()
        self.assertEqual(result['total_processed'],2)
        self.assertFalse(result['calibrated'])
        self.assertEqual(result['algorithm'],'pixel_difference')
        first, second=result['results']
        self.assertEqual((first['image_width'],first['image_height']),(160,100))
        self.assertGreater(first['damage_count'],0)
        self.assertEqual(second['damages'],[])
        self.assertIn('pixel_x',first['damages'][0])
    def test_no_silent_zip_truncation(self):
        self.assertEqual(self.post([image_bytes(),image_bytes()],[image_bytes()]).status_code,422)
    def test_invalid_empty_or_unsupported_images_fail_instead_of_no_damage(self):
        for value in [b'',b'not an image']:
            self.assertEqual(self.post([value],[image_bytes()]).status_code,422)
        out=io.BytesIO();Image.new('RGB',(10,10)).save(out,format='BMP')
        self.assertEqual(self.post([out.getvalue()],[image_bytes()]).status_code,415)
    def test_upload_pixel_and_pair_limits(self):
        with patch.object(main,'MAX_FILE_BYTES',10):
            self.assertEqual(self.post([image_bytes()],[image_bytes()]).status_code,413)
        with patch.object(main,'MAX_IMAGE_PIXELS',10):
            self.assertEqual(self.post([image_bytes()],[image_bytes()]).status_code,413)
        values=[image_bytes()]*13
        self.assertEqual(self.post(values,values).status_code,413)
    def test_resize_is_reported_and_coordinates_use_before_image(self):
        result=self.post([image_bytes()],[image_bytes(size=(80,60))]).json()['results'][0]
        self.assertTrue(result['resized']);self.assertEqual(result['coordinate_space'],'before_image')
    def test_exact_assets_and_local_only_cors(self):
        self.assertEqual(self.client.get('/').status_code,200)
        self.assertEqual(self.client.get('/assets/yaris_poc.glb').status_code,200)
        self.assertEqual(self.client.get('/assets/poc-mapping.mjs').status_code,200)
        self.assertEqual(self.client.get('/.env.local').status_code,404)
        self.assertEqual(self.client.get('/health',headers={'Origin':'https://untrusted.example'}).headers.get('access-control-allow-origin'),None)
        self.assertEqual(self.client.get('/health',headers={'Origin':'http://localhost:8080'}).headers.get('access-control-allow-origin'),'http://localhost:8080')
    def test_failed_homography_is_guarded(self):
        rng=np.random.default_rng(88);frame=rng.integers(0,255,(240,320,3),dtype=np.uint8)
        with patch('damage_detector.cv2.findHomography',return_value=(None,None)):
            returned, success=align_images(frame,frame.copy())
            self.assertFalse(success);self.assertEqual(returned.shape,frame.shape)
