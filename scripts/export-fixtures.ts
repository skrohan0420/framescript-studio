import { newProject } from "../shared/project";
import { initialWorkflow } from "../shared/workflow";
import { composeProject } from "../shared/composition";
import { threeStarter } from "../shared/three-runtime";
export function exportFixture(kind: string, duration: number, edited = false) {
  const p = newProject();
  p.settings = { ...p.settings, width: 3840, height: 2160, duration, fps: 60 };
  p.html = '<canvas id="scene" width="3840" height="2160"></canvas>';
  p.css =
    "body{background:#101321}canvas{display:block;width:100%;height:100%}";
  p.js = `const c=document.querySelector('canvas'),ctx=c.getContext('2d');const backdrop=document.createElement('canvas');backdrop.width=3840;backdrop.height=2160;const bg=backdrop.getContext('2d');const g=bg.createRadialGradient(1920,1080,0,1920,1080,1800);g.addColorStop(0,'#24457a');g.addColorStop(1,'#101321');bg.fillStyle=g;bg.fillRect(0,0,3840,2160);window.renderFrame=t=>{ctx.drawImage(backdrop,0,0);for(let i=0;i<300;i++){const a=i*2.39996+t*.5,r=40+Math.sqrt(i)*95;ctx.fillStyle=i%3?'#84caff':'#ffcd84';ctx.beginPath();ctx.arc(1920+Math.cos(a)*r,1080+Math.sin(a)*r*.55,3+i%7,0,Math.PI*2);ctx.fill()}ctx.fillStyle='white';ctx.font='bold 140px Arial';ctx.fillText('4K · 60 fps',120+Math.sin(t)*100,300)};`;
  if (kind === "three") {
    p.js = threeStarter.match(/<script>([\s\S]*?)<\/script>/)![1];
    p.js = p.js.replace(
      "subject.add(body); view.scene.add(subject);",
      `subject.add(body); view.scene.add(subject);const instances=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.06,1),new THREE.MeshStandardMaterial({color:0x82caff,roughness:.45}),300);const matrix=new THREE.Matrix4();for(let i=0;i<300;i++){const a=i*2.39996,r=1.6+Math.sqrt(i)*.05;matrix.makeTranslation(Math.cos(a)*r,Math.sin(a)*r*.6,Math.sin(i)*.4);instances.setMatrixAt(i,matrix);}view.scene.add(instances);`,
    );
  }
  if (kind === "mixed") {
    p.workflow = initialWorkflow(p);
    p.workflow.scenes[0].duration = duration / 2;
    p.workflow.scenes[0].html += '<div id="label">Canvas + HTML</div>';
    p.workflow.scenes[0].css +=
      "#label{position:absolute;left:120px;bottom:100px;font:90px Arial;color:white;text-shadow:0 5px 12px #000}";
    p.workflow.scenes.push({
      ...p.workflow.scenes[0],
      id: "scene-2",
      title: "Second scene",
      html: '<div id="diagram"><div></div><div></div><div></div></div>',
      css: "body{background:#101321;display:grid;place-items:center}#diagram{display:flex;gap:100px}#diagram div{width:400px;height:400px;background:#2ac6b5;border-radius:40px;box-shadow:0 20px 60px #0008;animation:turn 2s ease-in-out infinite alternate}@keyframes turn{to{transform:rotate(30deg) scale(.85)}}",
      js: "",
    });
    if (edited) p.workflow.scenes[1].css += "#diagram div{background:#e3b262}";
    return composeProject(p);
  }
  return p;
}
