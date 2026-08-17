import { useEffect, useRef, useState } from "react";
import { Box, Cpu, FileUp, RotateCcw, ShieldCheck } from "lucide-react";
import "@kitware/vtk.js/Rendering/Profiles/Volume";
import vtkGenericRenderWindow from "@kitware/vtk.js/Rendering/Misc/GenericRenderWindow";
import vtkVolume from "@kitware/vtk.js/Rendering/Core/Volume";
import vtkVolumeMapper from "@kitware/vtk.js/Rendering/Core/VolumeMapper";
import vtkColorTransferFunction from "@kitware/vtk.js/Rendering/Core/ColorTransferFunction";
import vtkPiecewiseFunction from "@kitware/vtk.js/Common/DataModel/PiecewiseFunction";
import vtkImageData from "@kitware/vtk.js/Common/DataModel/ImageData";
import vtkDataArray from "@kitware/vtk.js/Common/Core/DataArray";
import * as nifti from "nifti-reader-js";

type VtkImage = ReturnType<typeof vtkImageData.newInstance>;

function syntheticVolume(): VtkImage {
  const size=48, values=new Uint8Array(size*size*size);
  for(let z=0;z<size;z++) for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
    const dx=(x-size/2)/18,dy=(y-size/2)/22,dz=(z-size/2)/16,d=Math.sqrt(dx*dx+dy*dy+dz*dz);
    values[x+y*size+z*size*size]=d<.38?230:d<.72?135:d<1?48:0;
  }
  const image=vtkImageData.newInstance({spacing:[1,1,1],origin:[0,0,0]}); image.setDimensions(size,size,size);
  image.getPointData().setScalars(vtkDataArray.newInstance({name:"צפיפות",numberOfComponents:1,values})); return image;
}

function niftiToVtk(buffer:ArrayBuffer): VtkImage {
  const data=(nifti.isCompressed(buffer)?nifti.decompress(buffer):buffer) as ArrayBuffer;
  if(!nifti.isNIFTI(data)) throw new Error("קובץ NIfTI אינו תקין");
  const header=nifti.readHeader(data); const raw=nifti.readImage(header,data);
  const dims=[header.dims[1],header.dims[2],header.dims[3]] as [number,number,number]; const count=dims[0]*dims[1]*dims[2];
  let source: ArrayLike<number>;
  if(header.numBitsPerVoxel===8) source=new Uint8Array(raw); else if(header.numBitsPerVoxel===16) source=new Int16Array(raw); else source=new Float32Array(raw);
  const values=new Float32Array(count); for(let i=0;i<count;i++) values[i]=Number(source[i]||0);
  const image=vtkImageData.newInstance({spacing:[header.pixDims[1]||1,header.pixDims[2]||1,header.pixDims[3]||1]}); image.setDimensions(...dims);
  image.getPointData().setScalars(vtkDataArray.newInstance({name:"עוצמה",numberOfComponents:1,values})); return image;
}

export default function MedicalVolumeWorkbench(){
  const container=useRef<HTMLDivElement>(null); const api=useRef<{generic:ReturnType<typeof vtkGenericRenderWindow.newInstance>;actor:ReturnType<typeof vtkVolume.newInstance>}|null>(null);
  const [status,setStatus]=useState("דגימת נפח לימודית מקומית"); const [preset,setPreset]=useState<"soft"|"bone"|"lung">("soft");
  const apply=(image:VtkImage) => {
    if(!container.current) return; api.current?.generic.delete();
    const generic=vtkGenericRenderWindow.newInstance({background:[0.025,0.045,0.075]}); generic.setContainer(container.current); generic.resize();
    const mapper=vtkVolumeMapper.newInstance({sampleDistance:.7}); mapper.setInputData(image); const actor=vtkVolume.newInstance(); actor.setMapper(mapper);
    const range=image.getPointData().getScalars().getRange(); const min=range[0],max=range[1],span=Math.max(1,max-min);
    const color=vtkColorTransferFunction.newInstance(); color.addRGBPoint(min,0,0,0); color.addRGBPoint(min+span*.35,.35,.12,.1); color.addRGBPoint(max,1,.86,.72);
    const opacity=vtkPiecewiseFunction.newInstance(); opacity.addPoint(min,0); opacity.addPoint(min+span*.2,0); opacity.addPoint(min+span*.45,.12); opacity.addPoint(max,.72);
    actor.getProperty().setRGBTransferFunction(0,color);actor.getProperty().setScalarOpacity(0,opacity);actor.getProperty().setShade(true);actor.getProperty().setAmbient(.25);actor.getProperty().setDiffuse(.75);
    generic.getRenderer().addVolume(actor);generic.getRenderer().resetCamera();generic.getRenderWindow().render(); api.current={generic,actor};
  };
  useEffect(()=>{apply(syntheticVolume());return()=>api.current?.generic.delete();},[]);
  useEffect(()=>{const actor=api.current?.actor;if(!actor)return; const property=actor.getProperty();property.setShade(preset!=="lung");property.setAmbient(preset==="bone"?.12:.32);property.setDiffuse(preset==="bone"?.9:.65);api.current?.generic.getRenderWindow().render();},[preset]);
  const open=async(file:File)=>{try{const image=niftiToVtk(await file.arrayBuffer());apply(image);setStatus(`${file.name} · ${image.getDimensions().join(" × ")} voxels`);}catch(error){setStatus(error instanceof Error?error.message:"לא ניתן לקרוא את הקובץ");}};
  return <main className="volume-workbench" dir="rtl"><aside><div className="medical-panel-title"><Box/><span><strong>תחנת נפח תלת־ממדית</strong><small>vtk.js · עיבוד מקומי בלבד</small></span></div><label className="volume-upload"><FileUp/><span>פתח קובץ NIfTI</span><small>.nii · .nii.gz</small><input type="file" accept=".nii,.nii.gz,.gz" onChange={(event)=>{const file=event.target.files?.[0];if(file)void open(file);}}/></label><div className="volume-presets"><strong>חלון צפיפות</strong>{([['soft','רקמה רכה'],['bone','עצם'],['lung','ריאה']] as const).map(([id,label])=><button className={preset===id?"is-active":""} key={id} onClick={()=>setPreset(id)}>{label}</button>)}</div><button className="volume-reset" onClick={()=>{apply(syntheticVolume());setStatus("דגימת נפח לימודית מקומית");}}><RotateCcw/> חזור לדגימה</button><div className="volume-safe"><ShieldCheck/><p><strong>פרטי ובטוח</strong>הקובץ לא עולה לענן. DICOM יתווסף רק עם מפענח מאובטח שעובר ביקורת תלויות.</p></div></aside><section><header><div><small>רינדור מדעי מתקדם</small><h1>חקירת נפח רפואי</h1><p>{status}</p></div><span><Cpu/> האצה באמצעות GPU</span></header><div className="volume-canvas" ref={container} aria-label="תצוגת נפח רפואי תלת־ממדית"/><footer>גררו לסיבוב · גלגלת לזום · לחצן ימני להזזה · לשימוש לימודי בלבד</footer></section></main>;
}
