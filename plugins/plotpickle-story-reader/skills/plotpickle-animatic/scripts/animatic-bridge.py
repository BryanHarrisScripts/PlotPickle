#!/usr/bin/env python3
"""PlotPickle draft animatic bridge: saved PPF -> portable manifest -> verified render.

Stdlib + separately installed FFmpeg/ffprobe only. This program never mutates PPF.
"""
import argparse
import hashlib
import json
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

SCHEMA = 'plotpickle.animatic-draft.v1'
HEX64 = re.compile(r'^[a-f0-9]{64}$')
SAFE_ID = re.compile(r'^[A-Za-z0-9_.-]{1,100}$')


def fail(msg):
    raise ValueError(msg)


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def load_json(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def write_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + '.partial')
    tmp.write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    os.replace(tmp, path)


def address_key(addr):
    if not isinstance(addr, dict):
        return None
    try:
        n = tuple(int(addr[k]) for k in ('actNumber', 'sequenceNumber', 'blockNumber', 'miniBlockNumber', 'shotNumber'))
    except (KeyError, TypeError, ValueError):
        return None
    act, seq, block, mini, shot = n
    if not (1 <= act <= 4 and 1 <= seq <= 12 and 1 <= block <= 24 and 1 <= mini <= 4 and 1 <= shot <= 25):
        return None
    if act != (block - 1)//6 + 1 or seq != (block - 1)//2 + 1:
        return None
    return n


def portable_path(s):
    if not isinstance(s, str) or '\\' in s or '\0' in s:
        fail('invalid portable asset path')
    p = Path(s)
    if p.is_absolute() or len(p.parts) < 2 or p.parts[0] != 'assets' or any(q in ('.', '..') for q in p.parts):
        fail('unsafe asset path: ' + str(s))
    if p.suffix.lower() not in ('.png', '.jpg', '.jpeg', '.webp'):
        fail('unsupported image extension')
    return p.as_posix()


def get_candidates(project):
    """Current mapping wins over historical artwork; no implicit approval."""
    ext = project.get('assetRegistry', {}).get('extensions', {})
    mapping = {}
    def insert(item, origin):
        if item.get('status') in ('superseded', 'rejected'):
            return
        key = address_key(item.get('address'))
        if not key:
            return
        h = str(item.get('sha256', '')).lower().removeprefix('sha256:')
        if not HEX64.fullmatch(h):
            fail('missing asset hash at address ' + str(key))
        entry = {
            'artifactId': str(item.get('artifactId', '')),
            'path': portable_path(item.get('portablePath')),
            'sha256': h,
            'passageIds': list(item.get('passageIds') or []),
            'approval': (item.get('visualApproval') or {}).get('state', 'unreviewed'),
            'savedMarkerPresent': bool(item.get('savedMarkerPresent', False)),
            'locked': bool(item.get('locked', False)),
            'source': origin,
        }
        mapping[key] = entry
    for item in ext.get('artworkMapping', {}).get('entries', []):
        insert(item, 'artworkMapping')
    for item in ext.get('storyWorkflow', {}).get('imageMappings', []):
        insert(item, 'storyWorkflow')
    return mapping


def build_manifest(ppf_path, cues_path=None):
    ppf = load_json(ppf_path)
    revision = ppf.get('revision')
    project_id = ppf.get('id')
    if not isinstance(revision, int) or not project_id:
        fail('PPF missing project identity/revision')
    runtime = (ppf.get('assetRegistry', {}).get('extensions', {})
               .get('projectModel', {}).get('runtimePlan', {}))
    shots = runtime.get('physicalShots', [])
    if not shots or runtime.get('framesPerSecond') != 24:
        fail('PPF has no 24 fps editorial runtime plan')
    if runtime.get('project', {}).get('id') != project_id:
        fail('runtime plan belongs to a different project')
    base_rev = runtime.get('project', {}).get('revision')
    if not isinstance(base_rev, int) or base_rev > revision:
        fail('invalid runtime plan revision')
    candidates = get_candidates(ppf)
    source_passages = {s['id']:s for s in ppf.get('sourceEvidence', {}).get('screenplay', {}).get('passages', []) if isinstance(s, dict) and s.get('id')}
    acts = ppf.get('structure', {}).get('blocks', [])
    items=[]
    seen_ids=set()
    warnings=[]
    if base_rev < revision:
        warnings.append(f'Editorial timing was based on revision {base_rev}; current PPF is revision {revision}. Re-review before final approval.')
    for shot in shots:
        sid = shot.get('id')
        if not isinstance(sid,str) or not SAFE_ID.fullmatch(sid) or sid in seen_ids:
            fail('invalid or duplicate shot id')
        seen_ids.add(sid)
        slots = shot.get('slotRefs', [])
        if len(slots) != 1 or not address_key(slots[0]):
            fail('shot has no unique canonical address: ' + sid)
        addr=slots[0]
        key=address_key(addr)
        duration=float(shot.get('durationSeconds', 0))
        frames=round(duration * 24)
        if not math.isfinite(duration) or duration <= 0 or abs(frames / 24 - duration)>1e-7:
            fail('shot duration must resolve to whole frames: '+sid)
        media=candidates.get(key)
        if not media:
            warnings.append('Explicit missing-image gap at '+sid)
        elif any(pid not in source_passages and not str(pid).startswith('author-') for pid in media['passageIds']):
            fail('asset contains unknown screenplay passage reference at '+sid)
        items.append({'id': sid, 'kind':'shot', 'address':addr, 'frames':frames,
                      'durationSeconds':duration, 'media':media,
                      'captionPassageIds': [], 'reviewState':'draft-candidate' if media else 'missing-image-gap'})
    if len(acts) != 24:
        warnings.append('Canonical block scaffold has unexpected length; review structure separately.')
    # Optional explicit editorial cue sheet; never invent dialogue or title cards.
    # Events are placed before/after a named shot. All timing is whole frames.
    events=[]
    if cues_path:
        cues=load_json(cues_path)
        if cues.get('schema') != 'plotpickle.animatic-cues.v1':
            fail('invalid cue-sheet schema')
        item_by_id={item['id']:item for item in items}
        for sh, ids in cues.get('captions', {}).items():
            if sh not in item_by_id or not isinstance(ids, list):
                fail('unknown shot / invalid caption ids: '+sh)
            for pid in ids:
                passage=source_passages.get(pid)
                if not passage or passage.get('type') != 'dialogue':
                    fail('caption must reference retained screenplay dialogue: '+str(pid))
                item_by_id[sh]['captionPassageIds'].append(pid)
        for index,e in enumerate(cues.get('cards',[])):
            if not isinstance(e,dict) or e.get('position') not in ('before','after') or e.get('shotId') not in item_by_id:
                fail('card must identify a valid shot and position')
            frames=e.get('frames')
            if not isinstance(frames,int) or not 1<=frames<=24*60:
                fail('card duration must be 1..1440 frames')
            title=e.get('text','')
            if not isinstance(title,str) or not title.strip() or len(title)>200:
                fail('invalid title card text')
            events.append({'id':'card-'+str(index+1), 'kind':'card','shotId':e['shotId'],
                           'position':e['position'], 'text':title,'frames':frames})
    frames=sum(e['frames'] for e in items)+sum(e['frames'] for e in events)
    manifest={'schema':SCHEMA, 'project':{'id':project_id,'title':ppf.get('title'),
                 'revision':revision,'sha256':sha256(ppf_path),'sourceBasename':Path(ppf_path).name},
              'editorialPlan':{'basedOnRevision':base_rev,'staleRelativeToProject':base_rev<revision,
                               'status':runtime.get('status','unknown')},
              'video':{'width':1920,'height':1080,'fps':24,'frameCount':frames,
                       'durationSeconds':frames/24,'audio':'silent'},
              'renderClass':'draft-preview-only', 'shots':items,'cards':events,
              'sourceCaptions':{pid:{'text':v['text'],'type':v['type']} for pid,v in source_passages.items()
                                if any(pid in i['captionPassageIds'] for i in items)},
              'warnings':warnings}
    return manifest


def validate(manifest, assets_root, allow_gaps=False, project_path=None):
    if manifest.get('schema')!=SCHEMA or manifest.get('renderClass')!='draft-preview-only':
        fail('invalid or unapproved manifest type')
    if project_path and (sha256(project_path) != manifest.get('project',{}).get('sha256') or load_json(project_path).get('revision') != manifest.get('project',{}).get('revision')):
        fail('source project revision/hash no longer matches manifest')
    v=manifest['video']
    fps=v.get('fps'); width=v.get('width'); height=v.get('height')
    if not all(isinstance(k,int) for k in (fps,width,height)) or not (1<=fps<=60 and 64<=width<=4096 and 64<=height<=2160):
        fail('unsafe video settings')
    ids=set(); missing=[]; total_frames=0; resolved={}
    root=Path(assets_root).resolve()
    for shot in manifest['shots']:
        sid=shot['id']; frames=shot['frames']
        if not SAFE_ID.fullmatch(sid) or sid in ids or not isinstance(frames,int) or not 1<=frames<=fps*3600:
            fail('invalid shot id/frames')
        ids.add(sid); total_frames+=frames
        media=shot.get('media')
        if not media:
            missing.append({'shotId':sid,'reason':'unmapped'});continue
        rel=portable_path(media['path'])
        h=media['sha256']
        if not HEX64.fullmatch(h):
            fail('invalid image checksum at '+sid)
        path=(root/rel).resolve()
        if root not in path.parents:
            fail('asset escapes root at '+sid)
        if not path.is_file():
            missing.append({'shotId':sid,'reason':'absent','path':rel});continue
        if sha256(path)!=h:
            fail('image hash mismatch at '+sid+': '+rel)
        resolved[sid]=str(path)
    for e in manifest.get('cards',[]):
        if e['shotId'] not in ids or e['position'] not in ('before','after') or not isinstance(e['frames'],int) or not 1<=e['frames']<=fps*60:
            fail('invalid title card')
        total_frames+=e['frames']
    if total_frames != v['frameCount'] or abs(total_frames/fps-v['durationSeconds'])>0.000001:
        fail('manifest frame sum mismatch')
    if missing and not allow_gaps:
        fail(str(len(missing))+' missing images; pass --allow-gaps for labelled draft slates')
    return {'shotCount':len(ids),'gapCount':len(missing),'gaps':missing,'resolvedImageCount':len(resolved),
            'frameCount':total_frames,'durationSeconds':total_frames/fps,'resolved':resolved}


def ffmpeg_text_escape(value):
    # Used only in filtergraph; literal backslashes and reserved separators escaped.
    return value.replace('\\','\\\\').replace(':','\\:').replace("'", "\\'").replace('%','\\%').replace(',','\\,').replace('[','\\[').replace(']','\\]').replace(';','\\;')


def make_segment(ffmpeg, path, frames, fps, width, height, output, caption=None, card=None):
    args=[ffmpeg,'-nostdin','-hide_banner','-loglevel','error','-y']
    if path:
        args+=['-loop','1','-framerate',str(fps),'-i',str(path)]
        vf=f'scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2,setsar=1'
    else:
        args+=['-f','lavfi','-i',f'color=c=0x181820:s={width}x{height}:r={fps}']
        vf='setsar=1'
    if caption or card:
        text_value=(card or caption or '').strip()
        if card:
            vf+=f",drawtext=text='{ffmpeg_text_escape(text_value)}':fontcolor=white:fontsize={max(14,width//24)}:x=(w-text_w)/2:y=(h-text_h)/2"
        else:
            vf+=f",drawbox=x=0:y=ih*0.79:w=iw:h=ih*0.21:color=black@0.65:t=fill,drawtext=text='{ffmpeg_text_escape(text_value)}':fontcolor=white:fontsize={max(14,width//40)}:x=(w-text_w)/2:y=h*0.85"
    vf+=',format=yuv420p'
    args+=['-vf',vf,'-frames:v',str(frames),'-an','-c:v','libx264','-preset','veryfast','-crf','22','-pix_fmt','yuv420p',str(output)]
    run(args)


def run(cmd):
    p=subprocess.run(cmd,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    if p.returncode:
        fail('External command failed: '+str(cmd[0])+': '+p.stderr[-1200:])
    return p.stdout


def render(manifest, root, output, allow_gaps=False, ffmpeg='ffmpeg', ffprobe='ffprobe', project_path=None):
    report=validate(manifest,root,allow_gaps=allow_gaps,project_path=project_path)
    if not shutil.which(ffmpeg) or not shutil.which(ffprobe):
        fail('ffmpeg and ffprobe must be installed on the execution host')
    output=Path(output).resolve()
    if output.suffix.lower()!='.mp4':
        fail('output must end in .mp4')
    if output.exists():
        fail('refusing to overwrite existing output')
    output.parent.mkdir(parents=True,exist_ok=True)
    fps=manifest['video']['fps']; width=manifest['video']['width']; height=manifest['video']['height']
    captions=manifest.get('sourceCaptions',{})
    before={};after={}
    for card in manifest.get('cards',[]):
        (before if card['position']=='before' else after).setdefault(card['shotId'],[]).append(card)
    with tempfile.TemporaryDirectory(prefix='plotpickle-animatic-') as temp:
        temp=Path(temp); segments=[]
        def make(frames,path=None,caption=None,card=None):
            i=len(segments)
            seg=temp/f'{i:05d}.mp4'
            make_segment(ffmpeg,path,frames,fps,width,height,seg,caption=caption,card=card)
            segments.append(seg)
        for shot in manifest['shots']:
            for card in before.get(shot['id'],[]):
                make(card['frames'],card=card['text'])
            src=report['resolved'].get(shot['id'])
            caption='  '.join(captions[pid]['text'] for pid in shot['captionPassageIds']) if shot.get('captionPassageIds') else None
            if caption and (len(caption)>180 or '\n' in caption):
                fail('caption too long for single-line draft preview: '+shot['id'])
            make(shot['frames'],path=src,caption=caption,card=None if src else 'MISSING IMAGE — '+shot['id'])
            for card in after.get(shot['id'],[]):
                make(card['frames'],card=card['text'])
        concat=temp/'segments.txt'
        concat.write_text(''.join("file '"+str(p).replace("'", "'\\''")+"'\n" for p in segments),encoding='utf-8')
        video=temp/'joined.mp4'
        run([ffmpeg,'-nostdin','-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',str(concat),'-f','lavfi','-i','anullsrc=r=48000:cl=stereo',
             '-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','128k','-ar','48000','-ac','2','-frames:a',str(math.ceil(report['durationSeconds']*48000/1024)+2),'-t',str(report['durationSeconds']),'-movflags','+faststart',str(video)])
        probe=json.loads(run([ffprobe,'-v','error','-count_frames','-show_entries','stream=codec_type,nb_read_frames,width,height,avg_frame_rate:format=duration','-of','json',str(video)]))
        streams=probe.get('streams',[])
        vs=next((s for s in streams if s.get('codec_type')=='video'),None)
        audio=next((s for s in streams if s.get('codec_type')=='audio'),None)
        if not vs or not audio or int(vs.get('nb_read_frames',-1))!=report['frameCount'] or vs.get('width')!=width or vs.get('height')!=height:
            fail('render ffprobe validation failed')
        measured=float(probe['format']['duration'])
        if abs(measured-report['durationSeconds'])>0.06:
            fail('render duration mismatch')
        run([ffmpeg,'-v','error','-i',str(video),'-f','null','-'])
        os.replace(video,output)
    return {'output':str(output),'sha256':sha256(output),'verifiedDecode':True,'expectedFrames':report['frameCount'],
            'measuredFrames':int(vs['nb_read_frames']),'durationSeconds':measured, 'gaps':report['gaps'],
            'audio':'silent-aac','class':'draft-preview-only','approvedMaster':False,'projectRevision':manifest['project']['revision'],'projectSha256':manifest['project']['sha256']}


def main(argv=None):
    ap=argparse.ArgumentParser(description=__doc__)
    sub=ap.add_subparsers(dest='command',required=True)
    p=sub.add_parser('manifest');p.add_argument('--project',required=True);p.add_argument('--out',required=True);p.add_argument('--cues')
    p=sub.add_parser('validate');p.add_argument('--manifest',required=True);p.add_argument('--project',required=True);p.add_argument('--assets-root',required=True);p.add_argument('--allow-gaps',action='store_true')
    p=sub.add_parser('render');p.add_argument('--manifest',required=True);p.add_argument('--project',required=True);p.add_argument('--assets-root',required=True);p.add_argument('--out',required=True);p.add_argument('--allow-gaps',action='store_true');p.add_argument('--ffmpeg',default='ffmpeg');p.add_argument('--ffprobe',default='ffprobe')
    a=ap.parse_args(argv)
    try:
        if a.command=='manifest':
            result=build_manifest(a.project,a.cues);write_json(a.out,result)
            brief={'manifest':str(a.out),'shots':len(result['shots']), 'cards':len(result['cards']), 'video':result['video'],'warnings':result['warnings']}
        elif a.command=='validate':
            v=validate(load_json(a.manifest),a.assets_root,a.allow_gaps,project_path=a.project)
            brief={k:value for k,value in v.items() if k!='resolved'}
        else:
            brief=render(load_json(a.manifest),a.assets_root,a.out,a.allow_gaps,a.ffmpeg,a.ffprobe,project_path=a.project)
        print(json.dumps(brief,indent=2,ensure_ascii=False))
        return 0
    except (ValueError,KeyError,TypeError,OSError) as e:
        print(json.dumps({'error':str(e),'status':'failed-closed'}),file=sys.stderr)
        return 2

if __name__=='__main__':
    sys.exit(main())
