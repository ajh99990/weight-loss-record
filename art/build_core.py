"""FUEL kinetic energy core. Run with Blender --background --factory-startup.
Original procedural model; all source parts remain editable in fuel-core.blend.
"""
import bpy, math
from mathutils import Vector
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def material(name,color,metal=0,rough=.3,emission=0,transmission=0):
    m=bpy.data.materials.new(name);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Metallic'].default_value=metal
    p.inputs['Roughness'].default_value=rough
    p.inputs['Coat Weight'].default_value=.6
    if transmission:p.inputs['Transmission Weight'].default_value=transmission;p.inputs['IOR'].default_value=1.42
    if emission:p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=emission
    return m
chrome=material('Graphite titanium',(.16,.20,.13),.88,.24)
silver=material('Brushed platinum',(.67,.74,.60),.94,.23)
green=material('Fuel luminescence',(.57,1,.10),.15,.22,2)
glass=material('Optical shell',(.56,.87,.32),.13,.13,0,.65)
black=material('Recessed ceramic',(.011,.018,.007),.38,.34)
blue=material('Cool optical node',(.12,.44,1),.30,.16,1.2)
orange=material('Warm optical node',(1,.24,.07),.30,.16,1.2)

def mesh(name,mat):
    obj=bpy.context.object;obj.name=name;obj.data.materials.append(mat);return obj

def torus(name,r,t,mat,rotation=(0,0,0)):
    bpy.ops.mesh.primitive_torus_add(major_segments=96,minor_segments=12,location=(0,0,0),major_radius=r,minor_radius=t,rotation=rotation)
    obj=mesh(name,mat)
    for p in obj.data.polygons:p.use_smooth=True
    return obj

# Faceted inner energy cell and a larger hexagonal optical jacket.
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=.36)
core=mesh('HEART | luminous energy cell',green);core.scale=(.85,.85,1.3)
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=.59)
shell=mesh('SHELL | floating crystal',glass);shell.scale=(1,1,1.22)
# Interrupted protective ribs, built as individual beveled pieces.
for i in range(8):
    a=i*math.tau/8
    bpy.ops.mesh.primitive_cube_add(size=1,location=(math.cos(a)*.58,math.sin(a)*.58,0))
    o=mesh('RIB %02d | floating graphite'%i,chrome);o.dimensions=(.09,.12,.62);o.rotation_euler=(0,0,a)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    mod=o.modifiers.new('Machined edges','BEVEL');mod.width=.025;mod.segments=3
    o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    for z in [-.20,.20]:
        bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=8,radius=.038,location=(math.cos(a)*.644,math.sin(a)*.644,z))
        mesh('FASTENER %02d'%i,silver)
for z in [-.37,.37]:
    o=torus('COLLAR | machined titanium',.50,.038,silver);o.location.z=z
    o=torus('COLLAR | emissive seam',.49,.010,green);o.location.z=z+.032
# Two gimbal rings leave space around the faceted heart.
for name,r,rot in [('GIMBAL A',.80,(math.radians(66),math.radians(14),0)),('GIMBAL B',.88,(math.radians(-28),math.radians(70),0))]:
    torus(name,r,.027,chrome,rot)
    torus(name+' light trace',r+.008,.006,green,rot)
for i in range(3):
    a=i*math.tau/3+.30
    loc=(math.cos(a)*.97,math.sin(a)*.97,.08)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=.105,location=loc)
    o=mesh('SATELLITE %d'%i,[green,blue,orange][i]);o.scale=(1,1,1.5)
# Save the model before adding preview-only studio elements.
for o in bpy.context.scene.objects:
    if o.type=='MESH':o['fuelPart']='core'
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art/fuel-core.blend'))
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/fuel-core.glb'),export_format='GLB',export_apply=True,export_extras=True)
# Render a verifiable preview, not included in the glTF.
bpy.ops.object.camera_add(location=(2.9,-4.5,2.6))
cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,0))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=3.1;bpy.context.scene.camera=cam
for pos,energy,size,col in [((2,-3,4),600,4,(.86,1,.65)),((-3,-1,2),700,3,(.35,.6,1)),((0,3,1),900,2,(.8,1,.4))]:
    bpy.ops.object.light_add(type='AREA',location=pos);l=bpy.context.object;l.data.energy=energy;l.data.shape='DISK';l.data.size=size;l.data.color=col;l.rotation_euler=(-l.location).to_track_quat('-Z','Y').to_euler()
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24
scene.world.color=(.015,.022,.011);scene.render.resolution_x=800;scene.render.resolution_y=800;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.filepath=str(ROOT/'art/core-preview.png')
bpy.ops.render.render(write_still=True)
print('FUEL core model, Blender source and preview complete')
