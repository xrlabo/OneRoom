      const channelId = 'tsukubaRoom_okawa';
      const debug = false;
      //const sora = Sora.connection("wss://sora.ikeilabsora.0am.jp/signaling", debug);
      const sora = Sora.connection("wss://u1.xr360d.net/signaling", debug);
      const bundleId = Math.random().toString(36).substring(2);
      const options = {
        multistream: true,
        bundleId: bundleId,
        signalingNotify: true,
        clientId: 'THISISREMOTE',
        dataChannelSignaling: true,
        dataChannels: [
          {
            label: "#example",
            direction: "sendrecv",
            compress: true,
          },
        ],
      }
      const screenOptions = {
        multistream: true,
        bundleId: bundleId,
        signalingNotifyMetadata: {screen:true}
      }

      //xxxxxx 翻訳テキスト用変数 xxxxxxx
      var voiceText = "";
      var transText = "";
      //xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

      let localStream;
      // canvas DOM 要素を取得する***********************************************
		  let canvas = document.getElementById('renderCanvas');
		  // Initialize Babylon.js variables.
		  let	sceneToRender;     
		  const createDefaultEngine = function (canvas) {
        return new BABYLON.Engine(canvas, true, {
				  preserveDrawingBuffer: true,
				  stencil: true
			  });
      }

      const engine = createDefaultEngine(canvas);
      //********* Create scene and create XR experience. *********************************
		  const createScene = async function() 
      {
        //  *** CAMERA  ***
        var scene = new BABYLON.Scene(engine);
        var light = new BABYLON.PointLight("Omni", new BABYLON.Vector3(0, 100, 100), scene);
        // Our built-in 'sphere' shape. Params: name, subdivs, size, scene
        var sphere = BABYLON.Mesh.CreateSphere("UIsphere", 16, 1, scene);   //UI親となる見えないオブジェクト
        var mat = new BABYLON.StandardMaterial("mat", scene);
	      mat.alpha = 0.0;
        sphere.material = mat;
        

        //pointer

        const pointerDragBehavior = new BABYLON.PointerDragBehavior({dragPlaneNormal: new BABYLON.Vector3(0,0,1)});
        sphere.addBehavior(pointerDragBehavior);

        const transTxtTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("VoiceUI");
        var rectangle = new BABYLON.GUI.Rectangle();
        //rectangle.background = "gray";
        //rectangle.color = "black";
        rectangle.thickness = 0;
        rectangle.alpha = 1;
        rectangle.width = "600px";
        rectangle.height = "100px";
        rectangle.top = "35%";
        transTxtTexture.addControl(rectangle);

        var label = new BABYLON.GUI.TextBlock();
        label.text = transText;
        label.text = "test";
        label.color = "white";
        label.resizeToFit = true;
        label.textWrapping= true;
        
        rectangle.linkWithMesh(sphere);
        rectangle.addControl(label);

        var cameraTarget = new BABYLON.Vector3(0.0, 100.0, 0.0);
        var cam_alpha = -Math.PI/2;
        var cam_beta = Math.PI / 2;
        //var cam_beta = 0;
        var cam_fov = 70 * (Math.PI / 180); 
			  var camera = new BABYLON.ArcRotateCamera("ArcRotateCamera", cam_alpha, cam_beta, 5.0, cameraTarget, scene);
			  camera.fov = cam_fov;
        camera.attachControl(canvas, true);
        
        camera.inputs.remove(camera.inputs.attached.mousewheel);
        function resetCam(){
          camera.alpha = cam_alpha;
          camera.beta = cam_beta;
          camera.fov = cam_fov;
        }



        // *** VARIABLES ***
        let numOfCliend = 0;
        var streamSpheres = {};
        var cameraData = {};
        var messageOpen = false;
        var lastAlpha = 1000;//camera.alpha;
        var shareScreenID = '';
        var screen_position = new BABYLON.Vector3(0.0, cameraTarget.y + 5.0, 10.0);
        var screen_rotation = new BABYLON.Vector3(0.0, 0.0, 0.0);
        var screen_change = false;
        var screen_radio = 1.0;
        var screen_height_radio = 1.0;
        // SORA
        const sendrecv1 = sora.sendrecv(channelId, null, options);
        const sendonly = sora.sendonly(channelId, null, screenOptions);
        
        const remoteVideoTracks = {};
        sendrecv1.on('track', (event) => {//
          const stream = event.streams[0];
          remoteVideoTracks[stream.id]=stream;
          
        });

        sendrecv1.on('notify', (event) => {
          if(event.event_type=='connection.created'){
            addVideo(event);
            event.data?.forEach(conn=>{
              addVideo(conn);
            });
          }
          else if(event.event_type=='connection.destroyed'){
            removeVideo(event);
            lastAlpha = 1000;//camera.alpha;
          }
        });

          function addVideo(conn){
            //console.log(conn);
            //console.log('client ' + conn.client_id);
            if(conn.connection_id == sendrecv1.connectionId){
              return;
            }
            
            const stream = remoteVideoTracks[conn.connection_id];
            if(!stream){
              console.error('notify', 'stream not found', conn.connection_id);
              return;
            }
            if(conn.metadata?.screen){//share screen
              addStreamVideo(conn.connection_id, stream, 'screen');
              resetCam();
            } else {
              if(conn.client_id == 'THISISREMOTE') return;
              addStreamVideo(conn.connection_id, stream, '');
              messageOpen = true;
              lastAlpha = 1000;//camera.alpha; to send view angle to LOCAL
            }
          }

          function removeVideo(conn){
            const stream = remoteVideoTracks[conn.connection_id];
            if(!stream){
              console.warn('notify', 'stream not found', conn.connection_id);
              return;
            }
            stream.getTracks().forEach(track => track.stop());
            if(conn.metadata?.screen){
              removeStreamVideo(conn.connection_id + 'screen');
              shareScreenID = '';
            } else {
              removeStreamVideo(conn.connection_id);
              messageOpen = false;
            }
            delete remoteVideoTracks[conn.connection_id];
          }

          function addStreamVideo(stream_id_, stream, screenShare = ''){//360 video
            var _sphereDiameter = 1000.0;
            var _sphereDiameterX = 1000.0;
            var stream_id = stream_id_ + screenShare;
            const remoteVideoId = 'stream-video-' + stream_id;
            var vScale = 1;
            var matAlpha = 1.0;
            if(screenShare == ''){
              streamSpheres[stream_id] = BABYLON.MeshBuilder.CreateSphere(stream_id, { diameter: _sphereDiameter, diameterX: _sphereDiameterX }, scene);
              streamSpheres[stream_id].position.x = 0;
              streamSpheres[stream_id].position.z = 0;//numOfCliend * 100.0;
              streamSpheres[stream_id].position.y = cameraTarget.y;
              streamSpheres[stream_id].rotation.y = Math.PI / 2;
              numOfCliend += 1;
            }
            else{
              var planeOpts = {
			          height: 14.4, 
			          width: 19.2, 
			          sideOrientation: BABYLON.Mesh.DOUBLESIDE
	            };
              streamSpheres[stream_id] = BABYLON.MeshBuilder.CreatePlane("plane", planeOpts, scene);
              //streamSpheres[stream_id].position = new BABYLON.Vector3(0, cameraTarget.y, 10);
              streamSpheres[stream_id].position = screen_position;
              streamSpheres[stream_id].rotation = screen_rotation;
              shareScreenID = stream_id;
              vScale = -1;
              matAlpha = 0.5;
            }
            
            const remoteVideos = document.querySelector('#stream-videos');
            if (!remoteVideos.querySelector('#' + remoteVideoId)) {
              const remoteVideo = document.createElement('video');
              remoteVideo.id = remoteVideoId;
              //remoteVideo.style.border = '1px solid red';
              remoteVideo.autoplay = true;
              remoteVideo.playsinline = true;
              remoteVideo.controls = true;
              remoteVideo.width = '640';
              remoteVideo.height = '480';
              remoteVideo.srcObject = stream;
              remoteVideos.appendChild(remoteVideo);
              streamSpheres[stream_id].material = creatVideoMat(stream_id, document.getElementById(remoteVideoId), vScale);
              streamSpheres[stream_id].material.alpha = matAlpha;//透明度
              
            }
          }

          //create video material and texture
          let creatVideoMat = (name, textureUrlOrElement, vScale) => {
              let _vmat = new BABYLON.StandardMaterial(name, scene);
              _vmat.emissiveColor = new BABYLON.Color3(1, 1, 1);
              let _vtext = new BABYLON.VideoTexture(name+"_vtext", textureUrlOrElement, scene, true, true,
                //BABYLON.VideoTexture.TRILINEAR_SAMPLINGMODE,
                //{
                //    autoPlay:false,
                //    mute:false,
                //    autoUpdateTexture:true
                //}
              );
              _vtext.vScale = vScale;
              _vmat.roughness = 1;
              _vmat.diffuseTexture = _vtext;
              _vmat.backFaceCulling = false;
				    return _vmat;
          }
        
        function removeStreamVideo(stream_id){
          const remoteVideo = document.querySelector('#stream-video-' + stream_id);
          if (remoteVideo) {
            document.querySelector('#stream-videos').removeChild(remoteVideo);
            //scene.removeMesh(streamSpheres[stream_id]);
            streamSpheres[stream_id].dispose();
            delete streamSpheres[stream_id];
          }
          
        }

        document.querySelector('#start-sendrecv1').addEventListener('click', async () => {//入室
          // sendrecv1
          
          try{
            localStream = await navigator.mediaDevices.getUserMedia({audio: {echoCancellation: false, noiseSuppression: true}, video: true});
          }
          catch(err){
            localStream = await navigator.mediaDevices.getUserMedia({audio: {echoCancellation: false, noiseSuppression: true}, video: false});
          }
          
          //localStream = await navigator.mediaDevices.getUserMedia({audio: {echoCancellation: false, noiseSuppression: true}, video: false});  //最悪VRとNotVRでリンクを分ける？
          await sendrecv1.connect(localStream);
          
        });

        

        document.querySelector('#stop-sendrecv1').addEventListener('click', async () => {//退室
          messageOpen = false;
          await sendrecv1.disconnect();
          document.querySelector('#stream-videos').srcObject = null;
          document.querySelector('#stream-videos').innerHTML = null;
          removeStreamVideo(sendrecv1.connectionId);
          for (let id in streamSpheres){
            //console.log(id);
            streamSpheres[id].dispose();
            delete streamSpheres[id];
          }
          for (let id in remoteVideoTracks){
            delete remoteVideoTracks[id];
          }
          
    
        });

        //////////
        document.querySelector('#start-sendonly').addEventListener('click', async () => {//画面共有
        // sendonly
          let mediaStream = null;
          try {
            mediaStream = await navigator.mediaDevices.getDisplayMedia({
              video: {
                cursor: "always"
              },
              audio: false
            });
          } catch (ex) {
            console.log("Error occurred", ex);
          }
          await sendonly.connect(mediaStream);
          //resetCam();
          
        });

        document.querySelector('#stop-sendonly').addEventListener('click', async () => {//画面共有の修了
          await sendonly.disconnect();
        });
        
        //**** MESSAGE ****
        sendrecv1.on('message', (event) => {
          console.log('message: ' + new TextDecoder().decode(event.data));
          var getData = new TextDecoder().decode(event.data).split(',');
          if(getData[0] == 'screen'){
            screen_change = true;
            screen_position.x = getData[1];
            screen_position.y = cameraTarget.y + parseFloat(getData[2]);
            screen_position.z = getData[3];
            screen_rotation.y = getData[4];
            screen_radio = getData[5];
            screen_height_radio = getData[6];
            
          }
          else if (getData[0] == 'subtitles'){
            transText = getData[1];
          }

        });
        
        
        //****************************** LOOP EVERY FRAME *********************************
        scene.onBeforeRenderObservable.add(() => { // Runs every frame
          if(messageOpen){
            if(true){
              //console.log(sendrecv1.connectionId);
              var value = "";
              if(xrHelper.baseExperience.state == BABYLON.WebXRState.NOT_IN_XR){
                console.log("Not IN XR");
                var angVal = camera.alpha + Math.PI/2;
                console.log(angVal);
                value = sendrecv1.connectionId+',' + angVal + "," +"true";
              }
              else{
                console.log("IN XR");
                //var dir = camera.getDirection(BABYLON.Vector3.Forward());
                let q = xrHelper.baseExperience.camera.rotationQuaternion;
                var HMD_ang = 0;
                HMD_ang = q.y * Math.PI;
                console.log(HMD_ang);
                value = sendrecv1.connectionId + "," + HMD_ang + "," +"false";
              }
              //console.log(value);
              try{
                sendrecv1.sendMessage('#example', new TextEncoder().encode(value));
                lastAlpha = camera.alpha;
              }catch(error){

              }

            }

            label.text = transText; //ローカルの翻訳字幕に反映

          }
          //sphere.getAbsolutePosition.z = 0;
          //console.log(sphere.getAbsolutePosition());
        }); 
        
        //*************************************** ANIMATION ******************************************
 		scene.registerBeforeRender(function () {//animation            
            if(shareScreenID != ''){
                if(screen_change){
                    streamSpheres[shareScreenID].position = screen_position;
                    streamSpheres[shareScreenID].rotation.y = screen_rotation.y;
                    streamSpheres[shareScreenID].scaling.x = screen_radio;
                    streamSpheres[shareScreenID].scaling.y = (screen_radio * screen_height_radio);
                    //console.log(streamSpheres[shareScreenID].position);
                    screen_change = false;
                }
            }
		});
		//**** KEYBOARD ****
        scene.onKeyboardObservable.add((kbInfo) => {
		    switch (kbInfo.type) {
			    case BABYLON.KeyboardEventTypes.KEYDOWN:
                    if(kbInfo.event.key == '+'){
                    //screen_postion.z += 0.2;
                    }
                    else if(kbInfo.event.key == '-'){
                    //screen_postion.z -= 0.2;
                    }
                    //console.log("KEY DOWN: ", kbInfo.event.key);
				    break;
			    case BABYLON.KeyboardEventTypes.KEYUP:
				    if(kbInfo.event.key == 'r'){
                        resetCam();
                    }
                    //console.log("KEY UP: ", kbInfo.event.code);
				    break;
		        }
	      });

        //**** GUI ****
        var advancedTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");
        var panel = new BABYLON.GUI.StackPanel();
        panel.width = "220px";
        panel.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
        panel.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;
        advancedTexture.addControl(panel);

        var header = new BABYLON.GUI.TextBlock();
        header.text = "ZOOM +";
        header.height = "20px";
        header.color = "white";
        panel.addControl(header); 

        var slider = new BABYLON.GUI.Slider();
        slider.minimum = 0;
        slider.maximum = cam_fov - 20 * (Math.PI / 180);
        slider.value = 0;
        slider.isVertical = true;
        slider.height = "200px";
        slider.width = "20px";
        slider.color = "red";
        slider.onValueChangedObservable.add(function(value) {
          //header.text = "Y-rotation: " + (BABYLON.Tools.ToDegrees(value) | 0) + " deg";
          camera.fov = cam_fov - slider.value;
        });
        panel.addControl(slider);    

				///xxxxxxxxxx HMD xxxxxxxxxx
				xrHelper = await scene.createDefaultXRExperienceAsync({

        });
        
        if (!xrHelper.baseExperience) {
					// XR support is unavailable.
					console.log('WebXR support is unavailable');
				}
        else {
          //xrHelper.teleportation.detach();
          xrHelper.baseExperience.onStateChangedObservable.add((state) => {
            scene.onBeforeCameraRenderObservable.add((xr_camera) => {//loop 
              ;//
            });
            

          });

				}


        
        //カメラの位置に合わせてテキスト位置移動
        if(xrHelper.baseExperience.state == BABYLON.WebXRState.NOT_IN_XR){  //XRに入っているかどうか
          sphere.position.y  = 100;   //親オブジェクトの位置を変更することでテキストの位置も変更可能
        }
        else{
          sphere.position.y  = 0;
        }
        console.log(sphere.position);

         //途中省略
        const tmpRay = new BABYLON.Ray();
        tmpRay.origin = new BABYLON.Vector3();
        tmpRay.direction = new BABYLON.Vector3();
        tmpRay.length = 100000;// rayが届く範囲を3に制限。
        var hit;
        var tmpMesh;
        ///xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
        //xrでの入力 (pointerBehaviorで事足りたので削除)
      //   xrHelper.input.onControllerAddedObservable.add((controller) => {
      //     controller.onMotionControllerInitObservable.add((motionController) => {
      //         if (motionController.handness === 'left') {

      //             const xr_ids = motionController.getComponentIds();
      //             let triggerComponent = motionController.getComponent(xr_ids[0]);//xr-standard-trigger
      //             triggerComponent.onButtonStateChangedObservable.add(() => {
      //                 if (triggerComponent.changes.pressed) {
      //                     // is it pressed?
      //                     if (triggerComponent.pressed) {
      //                         mesh = scene.meshUnderPointer;
      //                         console.log(mesh && mesh.name);
      //                         if (xrHelper.pointerSelection.getMeshUnderPointer) {
      //                             mesh = xrHelper.pointerSelection.getMeshUnderPointer(controller.uniqueId);
                                  
      //                         }
      //                         console.log(mesh && mesh.name);
      //                         if(mesh.name == "UIsphere"){
      //                           mesh && mesh.setParent(motionController.rootMesh);

      //                           controller.getWorldPointerRayToRef(tmpRay, true); // コントローラからrayを飛ばす
                          
      //                           hit = scene.pickWithRay(tmpRay);

      //                           if (hit.pickedMesh !=undefined){// rayが当たった対象をhit.pickedMeshに格納
      //                               tmpMesh = hit.pickedMesh;
      //                               console.log("name:"+hit.pickedMesh.name);
      //                               //tmpMesh.parent= controller.grip;//tmpMesh is set on inappropriate position.
      //                               tmpMesh.setParent(motionController.rootMesh);//rayが当たったmeshをコントローラの子オブジェクトにする
      //                               //console.log(sphere.position);
      //                           }
      //                         }
      //                     } else {
      //                         mesh && mesh.setParent(null);
      //                     }
      //                 }
      //             });
      //         }
      //     })
      // });

      scene.onBeforeRenderObservable.add(() => { // Runs every frame
        if(xrHelper.baseExperience.state == BABYLON.WebXRState.NOT_IN_XR){
          console.log("Not IN XR");
        }
        else{
          console.log("IN XR");
        }
        
      });

        return scene;
      } 
      // Create scene.
		  scene = createScene();
		  scene.then(function (returnedScene) {
			  sceneToRender = returnedScene;
		  });
      engine.runRenderLoop(function () {
			  if (sceneToRender) {
				  sceneToRender.render();
			  }
		  });

      

      // Handle browser resize.
		  window.addEventListener('resize', function () {
			  engine.resize();
		  });

      

      function mic_on_off_clicked() {
        if (document.getElementsByName('mic_on_off')[0].checked) {
          localStream.getAudioTracks()[0].enabled = true;
        }
        else {
          localStream.getAudioTracks()[0].enabled = false;
        }
      }
