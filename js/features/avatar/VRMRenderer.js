/***************************************************************************************************
 *  VRMRenderer.js
 *  -----------------------------------------------------------------------------------------------
 *  ・Three.js を利用して VRM アバターを描画／操作するユーティリティ・クラス。
 *  ・アプリ側からは **getVRMRenderer()** を介してシングルトンを取得して利用します。
 *  ・Phaser とは別レイヤー（#three‑container）に WebGLCanvas を生成しているため、
 *    ポーズやアニメーションをいつでもオーバーレイ表示できます。
 *
 *  主な機能
 *  --------
 *  ✔  VRM の lazy‑loading／単一生成
 *  ✔  カメラ・モデルの位置／回転／スケールを “なめらか補間” で変更
 *  ✔  プリセットポーズ（normal / pointLeft / pointRight / banzai）
 *  ✔  口パク＋首振りの簡易アニメーション
 *  ✔  SpringBone を任意で停止（disablePhysics = true）
 *
 *  使い方（抜粋）
 *  -------------
 *    const renderer = await getVRMRenderer();     // ← 非同期取得
 *    renderer.setVisible(true);                  // 表示
 *    renderer.setPose('pointRight');             // 指さしポーズへ移行
 *    await renderer.waitForTransitionEnd();      // 補間完了を待機
 *    renderer.startHeadAnimation();              // 首振り開始
 *    :
 ***************************************************************************************************/

import * as THREE                 from 'three';
import { GLTFLoader }             from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls }          from 'three/addons/controls/OrbitControls.js';
import { VRMLoaderPlugin,
         VRMUtils }               from '@pixiv/three-vrm';

/* --------------------------------------------------------------------------
   シングルトン生成用ラッパー
   -------------------------------------------------------------------------- */
let _vrmRendererInstance = null;

/**
 * getVRMRenderer()
 * ----------------------------------------------------------------------------
 * 非同期で VRMRenderer のシングルトンを返します。
 * 1回目呼び出し時のみ VRM をロードし、以後は同一インスタンスを返却。
 */
export async function getVRMRenderer () {
  if (!_vrmRendererInstance) {
    _vrmRendererInstance = new VRMRenderer(
      'three-container',          // Three.js Canvas を差し込む DOM id
      'assets/vrm/model01.vrm',    // 読み込む VRM ファイル
    );
    await _vrmRendererInstance.waitForVRMLoad();  // 完全ロード待機
  }
  return _vrmRendererInstance;
}

/* --------------------------------------------------------------------------
   VRMRenderer 本体
   -------------------------------------------------------------------------- */
export class VRMRenderer {
  /**
   * @param {string} containerId ― Three.js 用 canvas を埋め込む DOM 要素 id
   * @param {string} vrmPath     ― 読み込む VRM ファイルパス
   */
  constructor (containerId, vrmPath) {
    /* 初期プロパティ ------------------------------------------------------ */
    this.container        = document.getElementById(containerId);
    this.vrmPath          = vrmPath;
    this.currentVrm       = null;    // GLTF / VRM Object
    this.humanoid         = null;    // VRMHumanoid 汎用 API
    this.vrmLoaded        = false;   // ロード完了フラグ
    this.disablePhysics   = false;   // true=SpringBone停止

    /* pose / camera / transform 補間用の状態 ----------------------------- */
    this.currentPose      = 'normal';
    this.targetPose       = 'normal';

    this.currentCamPos    = new THREE.Vector3(0, 3, -4);
    this.targetCamPos     = this.currentCamPos.clone();

    this.modelPositionCurrent = new THREE.Vector3();
    this.modelPositionTarget  = new THREE.Vector3();
    this.modelRotationCurrent = new THREE.Euler();
    this.modelRotationTarget  = new THREE.Euler();
    this.modelScaleCurrent    = new THREE.Vector3(1, 1, 1);
    this.modelScaleTarget     = new THREE.Vector3(1, 1, 1);

    /* アニメーション関連 -------------------------------------------------- */
    this.clock              = new THREE.Clock();
    this.enableHeadAnimation = false;

    /* Three.js 初期化 → VRM 読み込み → アニメーションループ開始 ----------- */
    this.#initThree();
    this.#loadVRM();
    this.#animate();
  }

  /* =========================================================================
     Three.js 初期化
     ========================================================================= */
  #initThree () {
    /* WebGLRenderer ------------------------------------------------------- */
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.container.appendChild(this.renderer.domElement);

    /* Scene / Camera ------------------------------------------------------ */
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      30, window.innerWidth / window.innerHeight, 0.1, 20,
    );
    this.camera.position.copy(this.currentCamPos);
    this.camera.lookAt(0, 1, 0);

    /* OrbitControls（マウス操作は off）---------------------------------- */
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.screenSpacePanning = true;
    this.controls.target.set(0, 1.2, 0);
    this.controls.update();

    /* 環境光 / 平行光 ----------------------------------------------------- */
    this.scene.add(new THREE.AmbientLight(0xffffff, 2));
    const dir = new THREE.DirectionalLight(0xffffff, 1.5);
    dir.position.set(-0.5, 1, -1).normalize();
    this.scene.add(dir);

    /* Resize 対応 --------------------------------------------------------- */
    window.addEventListener('resize', () => this.#onWindowResize());
  }

  /* =========================================================================
     VRM 読み込み
     ========================================================================= */
  #loadVRM () {
    /* 返値は Promise だが ctor 内で完了待ちはしない --------------- */
    const loader = new GLTFLoader();
    loader.register(p => new VRMLoaderPlugin(p));

    loader.load(this.vrmPath, gltf => {
      const vrm = gltf.userData.vrm;

      /* 不要頂点・ジョイント削除でパフォーマンスアップ ------------- */
      VRMUtils.removeUnnecessaryVertices(gltf.scene);
      VRMUtils.removeUnnecessaryJoints (gltf.scene);

      /* フラスタムカリングを無効化（常に描画）----------------------- */
      vrm.scene.traverse(o => { o.frustumCulled = false; });

      /* シーン追加 & 初期不可視 --------------------------------------- */
      this.scene.add(vrm.scene);
      vrm.scene.visible = false;

      this.currentVrm = vrm;
      this.humanoid   = vrm.humanoid;
      this.vrmLoaded  = true;
    });
  }

  /** VRM 完全ロードを待機 */
  async waitForVRMLoad () {
    while (!this.vrmLoaded) {
      await new Promise(r => setTimeout(r, 100));
    }
  }

  /* =========================================================================
     外部 API : 表示 / Transform / Pose 操作
     ========================================================================= */
  setVisible           (v)          { if (this.currentVrm) this.currentVrm.scene.visible = v; }
  setModelPosition     (x,y,z)      { this.#applyNowAndTarget('position', x,y,z); }
  setModelRotation     (x,y,z)      { this.#applyNowAndTarget('rotation', x,y,z); }
  setModelScale        (x,y,z)      { this.#applyNowAndTarget('scale'   , x,y,z); }
  moveModelTo          (x,y,z)      { this.modelPositionTarget.set(x,y,z); }
  rotateModelTo        (x,y,z)      { this.modelRotationTarget.set(x,y,z); }
  scaleModelTo         (x,y,z)      { this.modelScaleTarget.set(x,y,z);   }
  startHeadAnimation   ()           { this.enableHeadAnimation = true;    }
  stopHeadAnimation    ()           { this.enableHeadAnimation = false;   }

  /** pose を徐々に変更（カメラ補間付） */
  setPose (name, moveCam = true) {
    if (!VRMRenderer.poses[name] || !this.humanoid) return;
    this.targetPose = name;

    /* 首方向だけは即反映（待つと不自然なため） */
    const head = this.humanoid.getNormalizedBoneNode('head');
    Object.assign(head.rotation, VRMRenderer.poses[name].head);

    /* カメラターゲット更新 */
    if (moveCam) this.targetCamPos.copy(VRMRenderer.poses[name].camera);
  }

  /** pose を即時適用（補間なし） */
  setPoseImmediate (name, moveCam = true) {
    if (!VRMRenderer.poses[name] || !this.humanoid) return;
    this.currentPose = this.targetPose = name;

    /* ボーン即時適用 */
    const bones = VRMRenderer.poses[name].bones;
    Object.entries(bones).forEach(([bn, rot]) => {
      const node = this.humanoid.getNormalizedBoneNode(bn);
      if (node) node.rotation.set(rot.x, rot.y, rot.z);
    });

    /* 首・カメラも即反映 */
    const head = this.humanoid.getNormalizedBoneNode('head');
    Object.assign(head.rotation, VRMRenderer.poses[name].head);
    if (moveCam) {
      this.camera.position.copy(VRMRenderer.poses[name].camera);
      this.currentCamPos.copy(this.camera.position);
      this.targetCamPos .copy(this.camera.position);
    }
  }

  /** pose / transform 補間が完了するまで Promise で待つ */
  waitForTransitionEnd () {
    return new Promise(res => {
      const id = setInterval(() => {
        if (!this.#isTransitioning()) {
          clearInterval(id);
          res();
        }
      }, 50);
    });
  }

  /* =========================================================================
     内部ユーティリティ
     ========================================================================= */
  #applyNowAndTarget (type, x, y, z) {
    if (!this.currentVrm) return;
    const cur   = this[`model${type[0].toUpperCase()+type.slice(1)}Current`];
    const target= this[`model${type[0].toUpperCase()+type.slice(1)}Target`];

    if (type === 'rotation') {
      this.currentVrm.scene.rotation.set(x,y,z);
      cur.set(x,y,z);  target.set(x,y,z);
    } else {
      this.currentVrm.scene[type].set(x,y,z);
      cur.set(x,y,z);  target.set(x,y,z);
    }
  }

  #isTransitioning () {
    if (!this.currentVrm || !this.humanoid) {
      return false;
    }

    /* 位置・回転・スケール差分 + pose 差分で判定 */
    const epsilon = 1e-3;

    const posDiff = this.modelPositionCurrent.distanceTo(this.modelPositionTarget);
    const scaleDiff = this.modelScaleCurrent.distanceTo(this.modelScaleTarget);

    const rotDiffX = Math.abs(this.modelRotationCurrent.x - this.modelRotationTarget.x);
    const rotDiffY = Math.abs(this.modelRotationCurrent.y - this.modelRotationTarget.y);
    const rotDiffZ = Math.abs(this.modelRotationCurrent.z - this.modelRotationTarget.z);
    const rotDiff = rotDiffX + rotDiffY + rotDiffZ;

    const isTransforming = posDiff > epsilon || scaleDiff > epsilon || rotDiff > epsilon;
    const isPosing = this.currentPose !== this.targetPose;
    return isTransforming || isPosing;
  }

  /* =========================================================================
     毎フレーム更新
     ========================================================================= */
  #animate() {
    requestAnimationFrame(() => this.#animate());

    const rawDt  = this.clock ? this.clock.getDelta() : 0.016; // デフォルト60fps相当
    const deltaTime = Math.min(rawDt, 0.05); // 50ms以下に制限
  
    if (!this.currentVrm || !this.humanoid) return;

    // カメラ補間
    this.currentCamPos.lerp(this.targetCamPos, deltaTime * 3.0);
    this.camera.position.copy(this.currentCamPos);
    this.camera.lookAt(0, 1.0, 0);

    // ポーズ補間（ボーン回転補間）
    const targetBoneSet = VRMRenderer.poses[this.targetPose]?.bones || {};
    for (const [boneName, tRot] of Object.entries(targetBoneSet)) {
      const boneNode = this.humanoid.getNormalizedBoneNode(boneName);
      if (!boneNode) continue;

      boneNode.rotation.x = THREE.MathUtils.lerp(boneNode.rotation.x, tRot.x, 5.0 * deltaTime);
      boneNode.rotation.y = THREE.MathUtils.lerp(boneNode.rotation.y, tRot.y, 5.0 * deltaTime);
      boneNode.rotation.z = THREE.MathUtils.lerp(boneNode.rotation.z, tRot.z, 5.0 * deltaTime);
    }

    // 首振り & 口パクアニメーション
    if (this.enableHeadAnimation) {
      const head = this.humanoid.getNormalizedBoneNode('head');
      if (head) {
        const t = this.clock.getElapsedTime();
        head.rotation.x += 0.02 * Math.sin(t * 3.0) * deltaTime * 30;

        const mouth = Math.abs(Math.sin(t * 2.5));
        if (this.currentVrm.expressionManager?.setValue) {
          this.currentVrm.expressionManager.setValue('aa', mouth);
        } else if (this.currentVrm.blendShapeProxy?.setValue) {
          this.currentVrm.blendShapeProxy.setValue('aa', mouth);
        }
      }
    }

    // モデルの Transform 補間（位置・回転・スケール）
    this.modelPositionCurrent.lerp(this.modelPositionTarget, deltaTime * 3.0);
    this.modelScaleCurrent.lerp(this.modelScaleTarget, deltaTime * 3.0);

    this.modelRotationCurrent.x = THREE.MathUtils.lerp(
      this.modelRotationCurrent.x, this.modelRotationTarget.x, deltaTime * 3.0);
    this.modelRotationCurrent.y = THREE.MathUtils.lerp(
      this.modelRotationCurrent.y, this.modelRotationTarget.y, deltaTime * 3.0);
    this.modelRotationCurrent.z = THREE.MathUtils.lerp(
      this.modelRotationCurrent.z, this.modelRotationTarget.z, deltaTime * 3.0);

    this.currentVrm.scene.position.copy(this.modelPositionCurrent);
    this.currentVrm.scene.scale.copy(this.modelScaleCurrent);
    this.currentVrm.scene.rotation.copy(this.modelRotationCurrent);

    // Pose到達チェック（簡易）
    if (this.currentPose !== this.targetPose) {
      const threshold = 0.01;
      const boneKeys = Object.keys(targetBoneSet);
      let matchedCount = 0;

      for (const boneName of boneKeys) {
        const boneNode = this.humanoid.getNormalizedBoneNode(boneName);
        if (!boneNode) continue;

        const tRot = targetBoneSet[boneName];
        const dx = Math.abs(boneNode.rotation.x - tRot.x);
        const dy = Math.abs(boneNode.rotation.y - tRot.y);
        const dz = Math.abs(boneNode.rotation.z - tRot.z);

        if (dx < threshold && dy < threshold && dz < threshold) {
          matchedCount++;
        }
      }

      if (matchedCount === boneKeys.length) {
        this.currentPose = this.targetPose;
      }
    }

    // VRMアップデート処理
    if (this.disablePhysics) {
      this.currentVrm.lookAt?.update?.(deltaTime);
      this.currentVrm.expressionManager?.update?.(deltaTime);
    } else {
      this.currentVrm.update(deltaTime);
    }

    // シーン描画
    this.renderer.render(this.scene, this.camera);
  }

  /* =========================================================================
     Resize
     ========================================================================= */
  #onWindowResize () {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
}

/* --------------------------------------------------------------------------
   プリセットポーズ定義
   -------------------------------------------------------------------------- */
VRMRenderer.poses = Object.freeze({
  pointRight: {
    camera: { x: 0, y: 3, z: -4 },
    bones : {
      rightUpperArm: { x: 0.5, y: -0.2, z: -1.2 },
      leftUpperArm : { x: 0.0, y:  0.0, z: -0.5 },
    },
    head  : { x: 0, y:  1, z: 0 },
  },
  pointLeft: {
    camera: { x: 0, y: 3, z: -4 },
    bones : {
      leftUpperArm : { x: 0.5, y:  0.2, z: 1.2 },
      rightUpperArm: { x: 0.0, y:  0.0, z: 0.5 },
    },
    head  : { x: 0, y: -1, z: 0 },
  },
  normal: {
    camera: { x: 0, y: 3, z: -4 },
    bones : {
      rightUpperArm: { x: 0.5, y: -0.3, z: -1.2 },
      leftUpperArm : { x: 0.5, y:  0.3, z:  1.2 },
    },
    head  : { x: 0, y:  0, z: 0 },
  },
  banzai: {
    camera: { x: 0, y: 3, z: -4 },
    bones : {
      rightUpperArm: { x: 0.8, y: 0.7, z:  0.5 },
      leftUpperArm : { x: 0.8, y:-0.7, z: -0.5 },
    },
    head  : { x: 0, y: 0, z: 0 },
  },
});
