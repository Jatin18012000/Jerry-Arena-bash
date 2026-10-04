import {
  ACESFilmicToneMapping,
  Color,
  Fog,
  PCFShadowMap,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three';
import { createDefaultLighting } from './Lighting';
import { resolveViewport, type Viewport } from './viewport';

export interface RenderContextOptions {
  background?: number;
  fov?: number;
  near?: number;
  far?: number;
}

/**
 * Owns the WebGL renderer, root scene and main camera, and keeps them sized to the
 * container element. Contains no gameplay logic.
 */
export class RenderContext {
  readonly renderer: WebGLRenderer;
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  private readonly container: HTMLElement;
  private readonly resizeObserver: ResizeObserver | null;
  private viewportState: Viewport;

  constructor(container: HTMLElement, options: RenderContextOptions = {}) {
    this.container = container;
    const background = options.background ?? 0x0b0814;

    this.renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFShadowMap;
    this.renderer.domElement.classList.add('game-canvas');
    container.appendChild(this.renderer.domElement);

    this.scene = new Scene();
    this.scene.name = 'engine.root';
    this.scene.background = new Color(background);
    this.scene.fog = new Fog(background, 20, 60);

    this.camera = new PerspectiveCamera(options.fov ?? 45, 1, options.near ?? 0.1, options.far ?? 200);
    this.camera.name = 'engine.camera.main';
    this.camera.position.set(0, 2.2, 8);
    this.camera.lookAt(0, 1, 0);

    createDefaultLighting(this.scene);

    this.viewportState = resolveViewport(1, 1);
    this.resize();

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(container);
    } else {
      this.resizeObserver = null;
      window.addEventListener('resize', this.resize);
    }
  }

  get viewport(): Viewport {
    return this.viewportState;
  }

  readonly resize = (): void => {
    const viewport = resolveViewport(
      this.container.clientWidth,
      this.container.clientHeight,
      window.devicePixelRatio,
    );
    this.viewportState = viewport;
    this.renderer.setPixelRatio(viewport.pixelRatio);
    this.renderer.setSize(viewport.width, viewport.height, false);
    this.camera.aspect = viewport.aspect;
    this.camera.updateProjectionMatrix();
  };

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.resizeObserver?.disconnect();
    if (!this.resizeObserver) window.removeEventListener('resize', this.resize);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
