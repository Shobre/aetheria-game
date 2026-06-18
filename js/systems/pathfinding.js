// Pathfinding polish (Sprint 6)
// Pure helpers — no DOM, no game state. Easy to unit-test in tests/run.js.
//
// Two features:
//   1. smoothPath(waypoints) — funnel / line-of-sight pull. Removes redundant
//      waypoints when the enemy can see straight through them. Cuts corners
//      instead of stair-stepping along tile centers.
//   2. FlowField — precomputed distance field from a goal tile. Enemies read
//      a unit vector to follow instead of running A* every time.
//
// TILE is inlined as 32 (matching world.js) to avoid a circular import —
// pathfinding.js is imported by world.js for smoothPath, and the only reason
// this file needed world.js was for the TILE constant.
// (If TILE ever changes, this constant must change too.)
const TILE = 32;

/**
 * @typedef {Object} Waypoint
 * @property {number} x
 * @property {number} y
 *
 * @typedef {(x1:number, y1:number, x2:number, y2:number) => boolean} HasLoS
 *
 * @typedef {Object} FlowFieldState
 * FlowField instance state.
 * @property {number}    cols
 * @property {number}    rows
 * @property {Int16Array} dist   - per-tile distance to goal; -1 = unreachable
 * @property {Float32Array} vec  - per-tile unit vector toward goal (x,y pairs)
 */

// ---- path smoothing (line-of-sight pull) ----
// Input:  array of {x, y} world-coord waypoints (tile centers), first = start
// Output: shortened array. Greedy: from waypoint 0, jump to the farthest
//         waypoint that has line-of-sight (no solid tile in the way). Repeat.
//
// This is NOT the full "funnel algorithm" (which needs a navmesh), but the
// effect on a 4-dir grid is equivalent for our purposes: enemies cut corners
// instead of stopping at every tile center. The corners it cuts are valid
// because we check line-of-sight at the world-coord level (not tile-step),
// so a tangent across a corner is allowed.
//
// `hasLoS` is injected (normally `world.hasLineOfSight`) so this stays
// pure and testable.
/**
 * @param {Waypoint[]|null|undefined} waypoints
 * @param {HasLoS} hasLoS
 * @returns {Waypoint[]|null}
 */
export function smoothPath(waypoints, hasLoS) {
  if(!waypoints || waypoints.length < 3) return waypoints ? waypoints.slice() : null;
  const out = [waypoints[0]];
  let anchor = 0;
  // from each anchor, find the farthest waypoint we can see straight to.
  while(anchor < waypoints.length - 1){
    let furthest = anchor + 1;
    for(let i = anchor + 2; i < waypoints.length; i++){
      if(hasLoS(waypoints[anchor].x, waypoints[anchor].y, waypoints[i].x, waypoints[i].y)){
        furthest = i;
      } else {
        // once LoS breaks, later waypoints are even farther so we can stop
        break;
      }
    }
    out.push(waypoints[furthest]);
    anchor = furthest;
  }
  return out;
}

// ---- flow field ----
// A flow field is a 2D grid of unit vectors pointing from each cell TOWARD
// the goal. BFS computes distances from the goal outward; the direction at
// each cell is the direction of its lowest-distance neighbour. Enemies read
// flow[tx][ty] to know which way to walk — O(1) per enemy, no per-enemy A*.
//
// Reused when many enemies chase the same player — a single BFS beats N
// parallel A* runs.
export class FlowField {
  /**
   * @param {(x:number,y:number) => boolean} blocked - tile predicate
   * @param {number} cols
   * @param {number} rows
   * @param {number} goalX  - world-coord x of the goal
   * @param {number} goalY  - world-coord y of the goal
   */
  // blocked(x, y) -> bool: tile at (x, y) is solid
  // cols, rows: grid dimensions
  // goalX, goalY: world-coord target; converted to tile coords internally
  constructor(blocked, cols, rows, goalX, goalY){
    this.cols = cols; this.rows = rows;
    this.dist = new Int16Array(cols * rows);  // -1 = unreachable
    this.vec  = new Float32Array(cols * rows * 2);  // unit vector toward goal (or 0,0)
    this.dist.fill(-1);
    const gx = Math.max(0, Math.min(cols - 1, Math.floor(goalX / TILE)));
    const gy = Math.max(0, Math.min(rows - 1, Math.floor(goalY / TILE)));
    this._bfs(blocked, gx, gy);
    this._buildVectors();
  }

  /**
   * @private
   * @param {(x:number,y:number) => boolean} blocked
   * @param {number} gx
   * @param {number} gy
   * @returns {void}
   */
  _bfs(blocked, gx, gy){
    const cols = this.cols, rows = this.rows, dist = this.dist;
    if(blocked(gx, gy)) return;  // unreachable goal
    const queue = [gx + gy * cols];
    dist[gx + gy * cols] = 0;
    let head = 0;
    while(head < queue.length){
      const ck = queue[head++];
      const cx = ck % cols, cy = (ck - cx) / cols;
      const d = dist[ck];
      for(const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const nx = cx + dx, ny = cy + dy;
        if(nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const nk = nx + ny * cols;
        if(dist[nk] !== -1) continue;
        if(blocked(nx, ny)) continue;
        dist[nk] = d + 1;
        queue.push(nk);
      }
    }
  }

  /** @private @returns {void} */
  _buildVectors(){
    const cols = this.cols, rows = this.rows, dist = this.dist, vec = this.vec;
    for(let y = 0; y < rows; y++){
      for(let x = 0; x < cols; x++){
        const k = x + y * cols;
        if(dist[k] === -1) continue;  // unreachable → no vector
        if(dist[k] === 0) continue;   // goal cell → zero vector
        // Sum the unit vectors toward all strictly-lower-distance neighbours.
        // Averaging these yields a smoother, more "diagonal-friendly" field
        // than picking the first lower neighbour in 4-dir BFS — a cell with
        // 3 lower neighbours (corner) gets a vector pointing into the open.
        let sx = 0, sy = 0, n = 0;
        for(const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
          const nx = x + dx, ny = y + dy;
          if(nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
          const nk = nx + ny * cols;
          const nd = dist[nk];
          if(nd !== -1 && nd < dist[k]){
            sx += dx; sy += dy; n++;
          }
        }
        if(n === 0) continue;
        // Normalize. If only one neighbour (corridor), the result is still
        // a unit vector pointing exactly along the corridor.
        const len = Math.hypot(sx, sy) || 1;
        vec[k*2]     = sx / len;
        vec[k*2 + 1] = sy / len;
      }
    }
  }

  // World-coord sample: returns [dx, dy] (length 0 if unreachable/goal).
  // Most callers want this rather than sampling tile-by-tile.
  /**
   * @param {number} wx  - world x
   * @param {number} wy  - world y
   * @returns {[number, number]}
   */
  sample(wx, wy){
    const tx = Math.max(0, Math.min(this.cols - 1, Math.floor(wx / TILE)));
    const ty = Math.max(0, Math.min(this.rows - 1, Math.floor(wy / TILE)));
    const k = tx + ty * this.cols;
    if(this.dist[k] === -1 || this.dist[k] === 0) return [0, 0];
    return [this.vec[k*2], this.vec[k*2 + 1]];
  }

  /**
   * @param {number} wx
   * @param {number} wy
   * @returns {boolean}
   */
  isReachable(wx, wy){
    const tx = Math.max(0, Math.min(this.cols - 1, Math.floor(wx / TILE)));
    const ty = Math.max(0, Math.min(this.rows - 1, Math.floor(wy / TILE)));
    return this.dist[tx + ty * this.cols] !== -1;
  }

  // Cheap staleness signal: distances beyond a threshold mean the goal is far.
  // Used by Game to decide whether to recompute the field this frame.
  /**
   * @param {number} wx
   * @param {number} wy
   * @returns {number} tile-distance to goal; -1 if unreachable
   */
  distance(wx, wy){
    const tx = Math.max(0, Math.min(this.cols - 1, Math.floor(wx / TILE)));
    const ty = Math.max(0, Math.min(this.rows - 1, Math.floor(wy / TILE)));
    return this.dist[tx + ty * this.cols];
  }
}
