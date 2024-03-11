// アプリケーションキャンバスの要素を取得
let el = document.getElementById("application-canvas");

// PlayCanvasアプリケーションの作成
let app = new pc.Application(el, {
  mouse: new pc.Mouse(el),
  touch: new pc.TouchDevice(el),
  keyboard: new pc.Keyboard(window),
});

// シーンの空の設定
app.scene.sky.type = pc.SKYTYPE_DOME;
app.scene.sky.node.setLocalScale(200, 200, 200);
app.scene.sky.node.setLocalPosition(0, 0, 0);
app.scene.sky.center = new pc.Vec3(0, 0.05, 0);
app.scene.exposure = 1.6;

// HDRIの適用関数
const applyHdri = (source) => {
  const skybox = pc.EnvLighting.generateSkyboxCubemap(source);
  app.scene.skybox = skybox;
  const lighting = pc.EnvLighting.generateLightingSource(source);
  const envAtlas = pc.EnvLighting.generateAtlas(lighting);
  lighting.destroy();
  app.scene.envAtlas = envAtlas;
};


app.assets.loadFromUrl("./wide-street.avif", "texture", function (err, asset) {
  if (!err) {
    applyHdri(asset.resource);
  } else {
    console.error("Failed to load HDRI:", err);
  }
});

// WebXRのサポート状況を表示
const isSupportedWebXR = app.xr.supported;
document.getElementById("webxr-supported").textContent = isSupportedWebXR ? "Supported" : "Not Supported";

// ディレクショナルライトエンティティの作成
const light = new pc.Entity("light");
light.addComponent("light");
app.root.addChild(light);
light.setEulerAngles(45, 0, 0);

// カメラエンティティの作成
let camera = new pc.Entity("camera");
camera.addComponent("camera", {});
camera.setPosition(0, 2, 3);
app.root.addChild(camera);

// アプリケーションの開始
app.start();

// WebXRの開始関数
let startXr = () => {
  if (app.xr.isAvailable(pc.XRTYPE_AR)) {
    // ARが利用可能な場合
    camera.camera.enabled = true;
    camera.camera.clearColor = new pc.Color(0, 0, 0, 0);
    app.xr.start(camera.camera, pc.XRTYPE_AR, pc.XRSPACE_LOCALFLOOR, {
      optionalFeatures: ["body-tracking"],
      anchors: true,
      meshDetection: true,
      planeDetection: true,
    });
  } else if (app.xr.isAvailable(pc.XRTYPE_VR)) {
    // VRが利用可能な場合
    app.xr.start(camera.camera, pc.XRTYPE_VR, pc.XRSPACE_LOCALFLOOR, {
      optionalFeatures: ["body-tracking"],
      anchors: true,
      meshDetection: true,
      planeDetection: true,
    });
  }
};

// startXrボタンのクリックイベントリスナー
document.getElementById("startXr").addEventListener("click", startXr);

// ボディトラッキングモジュールの作成
var ModuleBodyTracking = pc.createScript("moduleBodyTracking");

ModuleBodyTracking.prototype.initialize = function () {
  // ジョイントエンティティのマップ
  this.jointEntities = {};

  // 自分の姿勢を表示するためのエンティティを作成
  this.selfEntity = new pc.Entity("selfEntity");
  this.selfEntity.setLocalPosition(0, 0, -1); // 少し前に配置
  this.selfEntity.setLocalEulerAngles(0, 180, 0);
  app.root.addChild(this.selfEntity);

  // XRの更新イベントリスナー
  app.xr.on("update", this.xrUpdate, this);
};

ModuleBodyTracking.prototype.xrUpdate = function (frame) {
  if (frame.body) {
    const body = frame.body;
    body.forEach((xrBodySpace, idx) => {
      const jointName = xrBodySpace.jointName;
      if (!this.jointEntities[jointName]) {
        // ジョイントエンティティの作成
        const jointEntity = new pc.Entity(jointName);
        jointEntity.addComponent("render", {
          type: "sphere",
        });
        const scale = new pc.Vec3(jointName.includes("hand") ? 0.02 : 0.05, jointName.includes("hand") ? 0.02 : 0.05, jointName.includes("hand") ? 0.02 : 0.05);
        jointEntity.setLocalScale(scale);
        this.selfEntity.addChild(jointEntity);
        this.jointEntities[jointName] = jointEntity;
      }

      // ポーズの取得と適用
      const pose = frame.getPose(xrBodySpace, app.xr._referenceSpace);
      if (pose) {
        const position = new pc.Vec3(pose.transform.position.x, pose.transform.position.y, pose.transform.position.z);
        const rotation = new pc.Quat(pose.transform.orientation.x, pose.transform.orientation.y, pose.transform.orientation.z, pose.transform.orientation.w);
        this.jointEntities[jointName].setLocalPosition(position);
        this.jointEntities[jointName].setLocalRotation(rotation);
      }
    });
  }
};

// ボディトラッキングモジュールの追加
app.root.addComponent("script");
app.root.script.create("moduleBodyTracking");
