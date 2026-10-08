"""Independent check of suspension limits from saved editable mesh vertices."""
from pathlib import Path
import bpy, json, hashlib
source=Path(bpy.data.filepath)
assert source.is_file(), 'Load the saved source .blend before this verifier'
modules={ob.get('module') for ob in bpy.data.objects if ob.type=='MESH' and ob.get('module','').startswith('16_Chandelier_')}
small=[];main=[]
for name in sorted(modules):
    points=[(ob.matrix_world @ v.co).z for ob in bpy.data.objects if ob.type=='MESH' and ob.get('module')==name for v in ob.data.vertices]
    top=max(points)
    if name.startswith('16_Chandelier_0_'):
        assert abs(top-18.58)<.00001, (name,top)
        main.append({'module':name,'maximumY':top})
    else:
        assert abs(top-5.74)<.00001 and top<=5.74001, (name,top)
        small.append({'module':name,'maximumY':top})
assert len(small)==12 and len(main)==3
root=Path(__file__).resolve().parents[2]
report={'passed':True,'sourceBlendSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'galleryUndersideY':5.74,'smallFixtureCount':len(small),'mainFixtureCount':len(main),'smallFixtures':small,'mainFixtures':main,'scope':'Measured from saved mesh vertices; no lower fixture extends through the gallery floor, and all three main suspensions still reach 18.58'}
(root/'scripts/hogwarts-library/verification-round3').mkdir(exist_ok=True)
(root/'scripts/hogwarts-library/verification-round3/fixture-suspension.json').write_text(json.dumps(report,indent=2))
print('FIXTURE_SUSPENSION_VERIFIED',json.dumps(report),flush=True)
