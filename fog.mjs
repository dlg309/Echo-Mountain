// Fog is positioned relative to the moving rider. Objects stay fully clear
// for at least this many seconds at the current speed, then fade gradually.
export const CLEAR_REACTION_SECONDS=1.15;
export const DENSE_REACTION_SECONDS=2.15;
export const MAX_FOG_OPACITY=.82;
export function fogDistance(speed){return {clear:Math.max(0,speed)*CLEAR_REACTION_SECONDS,dense:Math.max(0,speed)*DENSE_REACTION_SECONDS}}
export function fogOpacity(distance,speed){const {clear,dense}=fogDistance(speed);if(dense<=clear)return 0;return MAX_FOG_OPACITY*Math.max(0,Math.min(1,(distance-clear)/(dense-clear)))}
