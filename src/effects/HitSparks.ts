import { AdditiveBlending, Group, IcosahedronGeometry, Mesh, MeshBasicMaterial } from 'three';

export type SparkKind = 'hit' | 'heavyHit' | 'block';

const STYLE: Readonly<Record<SparkKind, { color: number; size: number; life: number }>> = {
  hit: { color: 0xfff1b8, size: 0.18, life: 10 },
  heavyHit: { color: 0xffa040, size: 0.32, life: 14 },
  block: { color: 0x7fd0ff, size: 0.16, life: 9 },
};

interface Spark {
  readonly mesh: Mesh<IcosahedronGeometry, MeshBasicMaterial>;
  life: number;
  maxLife: number;
  size: number;
}

/**
 * Pooled impact flashes at hit / block points. Presentation only: spawned from simulation
 * events, ticked at the fixed step, never read back by the simulation.
 */
export class HitSparks {
  readonly group = new Group();
  private readonly geometry = new IcosahedronGeometry(1, 0);
  private readonly sparks: Spark[] = [];
  private next = 0;

  constructor(poolSize = 8) {
    this.group.name = 'effects.hitSparks';
    for (let i = 0; i < poolSize; i++) {
      const material = new MeshBasicMaterial({ transparent: true, blending: AdditiveBlending, depthWrite: false });
      const mesh = new Mesh(this.geometry, material);
      mesh.visible = false;
      this.group.add(mesh);
      this.sparks.push({ mesh, life: 0, maxLife: 1, size: 0 });
    }
  }

  get activeCount(): number {
    return this.sparks.filter((s) => s.life > 0).length;
  }

  spawn(x: number, y: number, kind: SparkKind): void {
    const spark = this.sparks[this.next]!;
    this.next = (this.next + 1) % this.sparks.length;
    const style = STYLE[kind];
    spark.life = spark.maxLife = style.life;
    spark.size = style.size;
    spark.mesh.material.color.setHex(style.color);
    spark.mesh.position.set(x, y, 0.3); // slightly towards the camera so it reads over both bodies
    spark.mesh.visible = true;
    this.apply(spark);
  }

  update(): void {
    for (const spark of this.sparks) {
      if (spark.life <= 0) continue;
      spark.life--;
      this.apply(spark);
    }
  }

  dispose(): void {
    this.geometry.dispose();
    for (const spark of this.sparks) spark.mesh.material.dispose();
    this.group.removeFromParent();
  }

  private apply(spark: Spark): void {
    const t = 1 - spark.life / spark.maxLife; // 0 → 1 over the spark's life
    spark.mesh.visible = spark.life > 0;
    spark.mesh.scale.setScalar(spark.size * (0.6 + 1.4 * t));
    spark.mesh.rotation.z = t * 1.5;
    spark.mesh.material.opacity = 1 - t;
  }
}
