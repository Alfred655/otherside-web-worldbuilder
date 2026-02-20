import * as THREE from "three";

const BAR_WIDTH = 1.0;
const BAR_HEIGHT = 0.08;

export class HealthBar {
  readonly group = new THREE.Group();
  private fg: THREE.Mesh;
  private fgMat: THREE.MeshBasicMaterial;

  constructor() {
    const bgGeo = new THREE.PlaneGeometry(BAR_WIDTH, BAR_HEIGHT);
    const bgMat = new THREE.MeshBasicMaterial({
      color: 0x333333,
      side: THREE.DoubleSide,
      depthTest: false,
      transparent: true,
      opacity: 0.8,
    });
    this.group.add(new THREE.Mesh(bgGeo, bgMat));

    const fgGeo = new THREE.PlaneGeometry(BAR_WIDTH, BAR_HEIGHT);
    this.fgMat = new THREE.MeshBasicMaterial({
      color: 0x44ff44,
      side: THREE.DoubleSide,
      depthTest: false,
    });
    this.fg = new THREE.Mesh(fgGeo, this.fgMat);
    this.group.add(this.fg);

    this.group.renderOrder = 999;
  }

  update(healthPercent: number, camera: THREE.Camera) {
    const p = Math.max(0, Math.min(1, healthPercent));
    this.fg.scale.x = p;
    this.fg.position.x = -(1 - p) * BAR_WIDTH / 2;

    if (p > 0.5) this.fgMat.color.setHex(0x44ff44);
    else if (p > 0.25) this.fgMat.color.setHex(0xffcc00);
    else this.fgMat.color.setHex(0xff3333);

    // billboard
    this.group.quaternion.copy(camera.quaternion);
  }

  dispose() {
    this.group.removeFromParent();
  }
}
