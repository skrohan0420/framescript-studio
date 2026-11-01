import { newProject, type Project } from "./project";
const make = (name: string, html: string, css: string, js = ""): Project => ({
  ...newProject(),
  name,
  html,
  css,
  js,
});
const center =
  "body{display:grid;place-items:center;color:#ede9ff;font-family:Arial,sans-serif}";
export const examples: Project[] = [
  { ...newProject(), name: "Bouncing ball" },
  make(
    "Animated typography",
    "<h1>MAKE IT MOVE.</h1>",
    center +
      "h1{font-size:100px;letter-spacing:-6px;animation:type 3s infinite alternate}@keyframes type{from{opacity:.1;filter:blur(15px);transform:translateY(70px)}to{opacity:1;filter:blur(0);transform:translateY(0)}}",
  ),
  make(
    "Loading spinner",
    '<div class="spinner"></div>',
    center +
      ".spinner{width:150px;height:150px;border:12px solid #ffffff15;border-top-color:#a18aff;border-radius:50%;animation:spin 1.5s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}",
  ),
  make(
    "Particle background",
    '<canvas id="particles"></canvas>',
    "canvas{width:100%;height:100%}",
    `const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d');canvas.width=1920;canvas.height=1080;window.renderFrame=t=>{ctx.clearRect(0,0,1920,1080);for(let i=0;i<100;i++){const x=(i*197+t*(20+i%30))%1920,y=(i*137+Math.sin(t+i)*40)%1080;ctx.fillStyle='hsla('+(240+i)+',80%,75%,.7)';ctx.beginPath();ctx.arc(x,y,2+i%5,0,Math.PI*2);ctx.fill();}};`,
  ),
  make(
    "Rotating solar system",
    '<div class="sun"></div>' +
      Array.from(
        { length: 8 },
        (_, i) =>
          `<div class="orbit" style="width:${200 + i * 90}px;height:${200 + i * 90}px;animation-duration:${3 + i * 2}s"><i style="background:hsl(${i * 40},70%,70%)"></i></div>`,
      ).join(""),
    center +
      ".sun{width:90px;height:90px;background:#ffd071;border-radius:50%;box-shadow:0 0 100px #ffb43b}.orbit{position:absolute;border:1px solid #ffffff18;border-radius:50%;animation:orbit linear infinite}.orbit i{position:absolute;left:50%;top:-10px;width:20px;height:20px;border-radius:50%}@keyframes orbit{to{transform:rotate(360deg)}}",
  ),
  make(
    "Glowing star",
    '<div class="star">✦</div>',
    center +
      ".star{font-size:350px;color:#ffdea0;animation:glow 2s infinite alternate}@keyframes glow{from{transform:scale(.7);text-shadow:0 0 20px #ffbd37}to{transform:scale(1.1) rotate(30deg);text-shadow:0 0 130px #ffbd37}}",
  ),
  make(
    "Moving bar chart",
    '<div class="chart">' +
      [65, 90, 45, 75, 55]
        .map(
          (n, i) => `<div style="--h:${n}%;--i:${i}"><span>${n}</span></div>`,
        )
        .join("") +
      "</div>",
    center +
      ".chart{display:flex;align-items:end;gap:35px;height:600px}.chart>div{height:var(--h);width:130px;background:linear-gradient(#b9a6ff,#6150bd);border-radius:12px 12px 0 0;transform-origin:bottom;animation:rise 3s ease-in-out infinite alternate}.chart span{display:block;text-align:center;padding:20px;font-size:36px}@keyframes rise{from{transform:scaleY(.15)}to{transform:scaleY(1)}}",
  ),
  make(
    "Logo reveal",
    '<div class="logo">F<span>FrameScript</span></div>',
    center +
      ".logo{font-size:180px;font-weight:900;color:#b6a2ff;animation:reveal 4s infinite}.logo span{font-size:60px;display:block;letter-spacing:8px}@keyframes reveal{0%{opacity:0;transform:scale(.5) rotate(-15deg);filter:blur(30px)}40%,80%{opacity:1;transform:scale(1);filter:blur(0)}100%{opacity:0}}",
  ),
  make(
    "Orbiting planets",
    '<div class="core"></div><div class="ring"><b></b></div>',
    center +
      ".core{width:180px;height:180px;border-radius:50%;background:linear-gradient(30deg,#5344a8,#c9acff)}.ring{position:absolute;width:700px;height:400px;border:2px solid #ffffff33;border-radius:50%;animation:orbit 6s linear infinite}.ring b{display:block;width:60px;height:60px;border-radius:50%;background:#ffcc8b;margin-left:90px}@keyframes orbit{to{transform:rotate(360deg)}}",
  ),
  make(
    "Image entrance and exit",
    "<img id=\"character\" src=\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Crect width='240' height='240' rx='50' fill='%23a78bfa'/%3E%3Ccircle cx='80' cy='95' r='15'/%3E%3Ccircle cx='160' cy='95' r='15'/%3E%3Cpath d='M70 150 Q120 200 170 150' fill='none' stroke='black' stroke-width='10'/%3E%3C/svg%3E\">",
    center +
      "img{width:240px;animation:entrance 5s ease-in-out infinite}@keyframes entrance{0%{transform:translateX(-1100px) rotate(-30deg);opacity:0}30%,70%{transform:translateX(0);opacity:1}100%{transform:translateX(1100px) rotate(30deg);opacity:0}}",
  ),
];
