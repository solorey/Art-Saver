let create = {};

onmessage = async function(m){
  try {
    postMessage(await create[m.data.type](m.data.data));
  }
  catch (err){
    console.log(err);
    postMessage(null);
  }
}

create.gif = async function(data){
  importScripts('/lib/gif.js');

  let gif = new GIF({
    workers: 2,
    quality: 10,
    workerScript: "/lib/gif.worker.js"
  });
  
  for (let i = 0; i < data.frames.length; i++){
    gif.addFrame(data.frames[i], {delay: data.delays[i]});
  }

  gif.render();

  return new Promise((resolve, reject)=>{
    gif.on('finished', blob =>{
      resolve(blob);
    });
  });
}

create.apng = async function(data){
  importScripts('/lib/pako_deflate.js', '/lib/UPNG.js');

  let imgdata = data.frames.map(f => f.data);

  let png = UPNG.encode(imgdata, data.width, data.height, 0, data.delays);
  return new Blob([png], {type : 'image/png'});
}

create.zip = async function(data){
  importScripts("/lib/jszip.js");

  var zip = new JSZip();

  let bl = data.blobs.length;
  let npad = `${bl}`.length;
  let dpad = `${Math.max(...data.delays)}`.length;

  for (let i = 0; i < bl; i++){
    let n = `${i + 1}`.padStart(npad, "0");
    let d = `${data.delays[i]}`.padStart(dpad, "0");
    zip.file(`${n}_${d}ms.${data.exts[i]}`, data.blobs[i]);
  }

  return await zip.generateAsync({type:"blob"});
}

create.bitmaps = async function(data){
  return await Promise.all(data.blobs.map(b => createImageBitmap(b, 0, 0, data.width, data.height)));
}

// create.webm = async function(data){
//   importScripts('whammy.min.js');

//   let config = {
//     target_size: 0,
//     target_PSNR: 0.,
//     method: 6,
//     sns_strength: 50,
//     filter_strength: 20,	
//     filter_sharpness: 0,
//     filter_type: 1,
//     partitions: 0,
//     segments: 4,
//     pass: 1,
//     show_compressed: 0,
//     preprocessing: 0,
//     autofilter: 0,
//     extra_info_type: 0,
//     preset: 0
//   }

//   let workerpromises = []
//   let frames = data.frames.map((f,i) => [i,f]);
//   let dataurls = new Array(data.frames.length);

//   function postFrame(w){
//     let frame = frames.shift();
//     w.postMessage({config, index: frame[0], frame: frame[1], width: data.width, height: data.height});
//   }

//   for (let i = 0; i < data.workers; i++){
//     if (frames.length == 0){
//       break;
//     }
    
//     let w = new Worker("webp.worker.js");
//     postFrame(w);
    
//     let promise = new Promise((resolve, reject)=>{
//       w.onmessage = function(m){
//         dataurls[m.data.index] = m.data.dataurl;
//         console.log(dataurls.flat(Infinity).length, "of", data.frames.length);

//         if (frames.length > 0){
//           postFrame(w);
//         }
//         else{
//           w.terminate();
//           resolve();
//         }
//       }
//     });
//     workerpromises.push(promise);
//   }

//   await Promise.all(workerpromises);

//   let webm = new Whammy.Video();

//   for(let i = 0; i < dataurls.length; i++){
//     webm.add(dataurls[i], data.delays[i]);
//   }
  
//   return new Promise((resolve, reject)=>{
//     webm.compile(false, blob =>{
//       resolve(blob);
//     });
//   })
// }

