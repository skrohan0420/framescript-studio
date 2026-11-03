// Serialized into the sandbox after the local Three.js bundle.
export function threeRuntime() {
  const w = window as any;
  w.FrameScript3D = {
    create(
      options: {
        canvas?: HTMLCanvasElement;
        width?: number;
        height?: number;
        background?: string;
      } = {},
    ) {
      const T = w.THREE;
      const canvas = options.canvas ?? document.createElement("canvas");
      if (!canvas.parentNode) document.body.append(canvas);
      const width = options.width ?? window.innerWidth;
      const height = options.height ?? window.innerHeight;
      const renderer = new T.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true,
      });
      renderer.setPixelRatio(1);
      renderer.setSize(width, height, false);
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.style.display = "block";
      const scene = new T.Scene();
      if (options.background)
        scene.background = new T.Color(options.background);
      const camera = new T.PerspectiveCamera(40, width / height, 0.1, 1000);
      camera.position.set(0, 0, 6);
      const dispose = () => {
        scene.traverse((object: any) => {
          object.geometry?.dispose();
          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];
          materials.forEach((material: any) => material?.dispose());
        });
        renderer.dispose();
      };
      window.addEventListener("pagehide", dispose, { once: true });
      return {
        scene,
        camera,
        renderer,
        render: () => renderer.render(scene, camera),
        dispose,
      };
    },
    progress: (t: number, start: number, duration: number) =>
      Math.max(0, Math.min(1, (t - start) / Math.max(0.0001, duration))),
    ease: (p: number) => {
      p = Math.max(0, Math.min(1, p));
      return p * p * (3 - 2 * p);
    },
    spring: (t: number, damping = 7, frequency = 12) =>
      t <= 0
        ? 0
        : 1 - Math.exp(-Math.max(0.1, damping) * t) * Math.cos(frequency * t),
  };
}

export const threeStarter = `<!doctype html><html><head><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#10121d}</style></head><body><canvas id="scene"></canvas><script>
const view = FrameScript3D.create({canvas:document.getElementById('scene'),background:'#10121d'});
const subject = new THREE.Group();
const body = new THREE.Mesh(new THREE.IcosahedronGeometry(1,1),new THREE.MeshStandardMaterial({color:0x2ac6b5,roughness:0.4,metalness:0.25}));
subject.add(body); view.scene.add(subject);
view.scene.add(new THREE.HemisphereLight(0xffffff,0x26304d,2));
const key = new THREE.DirectionalLight(0xffffff,3); key.position.set(3,4,5); view.scene.add(key);
window.renderFrame = function(t){
 t=Math.max(0,Math.min(10,t));
 subject.rotation.set(t*0.12,t*0.55,0);
 subject.position.y=Math.sin(t*1.2)*0.15;
 view.camera.position.set(Math.sin(t*0.18)*1.5,0.5,6);
 view.camera.lookAt(0,0,0); view.render();
};
</script></body></html>`;
