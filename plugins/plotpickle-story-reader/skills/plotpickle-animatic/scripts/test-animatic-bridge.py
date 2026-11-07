import importlib.util
import hashlib
import json
import shutil
import tempfile
import unittest
from pathlib import Path
import struct
import zlib

script=Path(__file__).with_name('animatic-bridge.py')
spec=importlib.util.spec_from_file_location('animatic_bridge',script)
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class AnimaticTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name)
        self.assets=self.root/'assets';self.assets.mkdir()
        for color,name in [((200,20,20),'one.png'),((20,20,200),'two.png')]:
            def chunk(kind,data):
                return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data)&0xffffffff)
            rgb=bytes(color)
            scan=b''.join(b'\x00'+rgb*32 for _ in range(18))
            png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',32,18,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(scan))+chunk(b'IEND',b'')
            (self.assets/name).write_bytes(png)
        self.a={'actNumber':1,'sequenceNumber':1,'blockNumber':1,'miniBlockNumber':1,'shotNumber':1}
        self.b={**self.a,'shotNumber':2}
        self.c={**self.a,'shotNumber':3}
        def mapping(a,name):
            return {'address':a,'portablePath':'assets/'+name,'sha256':m.sha256(self.assets/name),'artifactId':name,
                    'passageIds':['sp1']}
        self.ppf={'id':'proj-1','revision':8,'title':'Test',
                  'structure':{'blocks':[{}]*24},
                  'sourceEvidence':{'screenplay':{'passages':[{'id':'sp1','text':'Look over there!','type':'dialogue'}]}},
                  'assetRegistry':{'extensions':{'artworkMapping':{'entries':[mapping(self.a,'one.png'),mapping(self.b,'two.png')]},
                    'storyWorkflow':{'imageMappings':[]},
                    'projectModel':{'runtimePlan':{'project':{'id':'proj-1','revision':7},'framesPerSecond':24,
                            'physicalShots':[{'id':f'shot-{i}','slotRefs':[a], 'durationSeconds':dur}
                                for i,a,dur in [(1,self.a,0.5),(2,self.b,0.75),(3,self.c,0.25)]]}}}}}
        self.ppf_path=self.root/'test.ppf.json';m.write_json(self.ppf_path,self.ppf)
        self.cues=self.root/'cues.json'
        m.write_json(self.cues,{'schema':'plotpickle.animatic-cues.v1','captions':{'shot-1':['sp1']},
                 'cards':[{'shotId':'shot-1','position':'before','text':'ACT I','frames':12}]})

    def manifest(self):
        x=m.build_manifest(self.ppf_path,self.cues)
        x['video']['width']=320;x['video']['height']=180
        return x

    def test_real_frame_count_and_revisions(self):
        x=self.manifest()
        self.assertEqual(x['video']['frameCount'],48)
        self.assertEqual(x['video']['durationSeconds'],2)
        self.assertTrue(x['editorialPlan']['staleRelativeToProject'])
        self.assertEqual(x['shots'][0]['captionPassageIds'],['sp1'])
        self.assertIsNone(x['shots'][2]['media'])
        self.assertEqual(m.validate(x,self.root,True)['gapCount'],1)

    def test_missing_fails_closed(self):
        x=self.manifest()
        with self.assertRaisesRegex(ValueError,'missing images'):m.validate(x,self.root)

    def test_mismatch_fails_closed(self):
        x=self.manifest();(self.assets/'two.png').write_bytes(b'tampered')
        with self.assertRaisesRegex(ValueError,'hash mismatch'):m.validate(x,self.root,True)

    def test_project_revision_binding_fails_closed(self):
        x=self.manifest()
        self.ppf['revision']=9;m.write_json(self.ppf_path,self.ppf)
        with self.assertRaisesRegex(ValueError,'revision/hash'):m.validate(x,self.root,True,project_path=self.ppf_path)

    def test_path_escape_fails_closed(self):
        x=self.manifest();x['shots'][0]['media']['path']='assets/../../secret.png'
        with self.assertRaisesRegex(ValueError,'unsafe'):m.validate(x,self.root,True)

    def test_bad_caption_rejected(self):
        cues=m.load_json(self.cues);cues['captions']={'shot-1':['wrong']}
        m.write_json(self.cues,cues)
        with self.assertRaisesRegex(ValueError,'retained screenplay'):m.build_manifest(self.ppf_path,self.cues)

    @unittest.skipUnless(shutil.which('ffmpeg') and shutil.which('ffprobe'),'FFmpeg/ffprobe unavailable')
    def test_render_exact_frames_and_decode(self):
        x=self.manifest()
        output=self.root/'test.mp4'
        receipt=m.render(x,self.root,output,allow_gaps=True,project_path=self.ppf_path)
        self.assertEqual(receipt['measuredFrames'],48)
        self.assertTrue(receipt['verifiedDecode'])
        self.assertTrue(output.is_file())
        self.assertEqual(receipt['class'],'draft-preview-only')
        self.assertFalse(receipt['approvedMaster'])
        self.assertAlmostEqual(receipt['durationSeconds'],2,places=2)
        with self.assertRaisesRegex(ValueError,'overwrite'):m.render(x,self.root,output,True,project_path=self.ppf_path)

if __name__=='__main__':unittest.main(verbosity=2)
