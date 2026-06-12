// Input system: keyboard + mouse, exposes a clean state object.
export class Input {
  constructor(canvas){
    this.canvas = canvas;
    this.keys = {};            // current held keys
    this.pressed = {};         // edge-triggered this frame
    this.mouse = { x:0, y:0, worldX:0, worldY:0 };
    this.mouseDown = { left:false, right:false };
    this.mousePressed = { left:false, right:false };
    this._bind();
  }
  _bind(){
    window.addEventListener('keydown', e=>{
      const k = e.key.toLowerCase();
      if(!this.keys[k]) this.pressed[k] = true;
      this.keys[k] = true;
      if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k)) e.preventDefault();
    });
    window.addEventListener('keyup', e=>{ this.keys[e.key.toLowerCase()] = false; });

    this.canvas.addEventListener('mousemove', e=>{
      const r = this.canvas.getBoundingClientRect();
      this.mouse.x = (e.clientX - r.left) * (this.canvas.width / r.width);
      this.mouse.y = (e.clientY - r.top) * (this.canvas.height / r.height);
    });
    this.canvas.addEventListener('mousedown', e=>{
      if(e.button===0){ if(!this.mouseDown.left) this.mousePressed.left=true; this.mouseDown.left=true; }
      if(e.button===2){ if(!this.mouseDown.right) this.mousePressed.right=true; this.mouseDown.right=true; }
    });
    window.addEventListener('mouseup', e=>{
      if(e.button===0) this.mouseDown.left=false;
      if(e.button===2) this.mouseDown.right=false;
    });
    this.canvas.addEventListener('contextmenu', e=> e.preventDefault());
  }
  // movement vector from WASD
  moveVector(){
    let x=0,y=0;
    if(this.keys['w']) y-=1;
    if(this.keys['s']) y+=1;
    if(this.keys['a']) x-=1;
    if(this.keys['d']) x+=1;
    if(x&&y){ const inv=1/Math.sqrt(2); x*=inv; y*=inv; }
    return {x,y};
  }
  wasPressed(k){ return !!this.pressed[k.toLowerCase()]; }
  // call at end of each frame to clear edge triggers
  lateUpdate(){
    this.pressed = {};
    this.mousePressed = { left:false, right:false };
  }
}
