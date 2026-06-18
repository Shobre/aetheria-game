// Turso cloud save client - calls server-side API proxy
const API='/api';

/**
 * @typedef {Object} SaveStateBlob
 * @property {string} username
 * @property {number} slot
 * @property {unknown} state
 *
 * @typedef {Object} SlotListEntry
 * @property {number} slot
 * @property {unknown} [state]
 * @property {string} [updatedAt]
 *
 * @typedef {Object} ApiResult
 * @property {boolean} [ok]
 * @property {SlotListEntry[]} [slots]
 * @property {unknown} [state]
 * @property {string} [error]
 */

/**
 * @private
 * @param {string} endpoint
 * @param {object} body
 * @returns {Promise<ApiResult>}
 */
async function apiCall(endpoint, body){
  const r = await fetch(API + endpoint, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
  return r.json();
}

/**
 * @param {string} username
 * @param {number} slot
 * @param {unknown} state
 * @returns {Promise<ApiResult>}
 */
export async function tursoSave(username, slot, state){
  return apiCall('/saves', { action:'save', username, slot, state });
}
/**
 * @param {string} username
 * @param {number} slot
 * @returns {Promise<unknown>}
 */
export async function tursoLoad(username, slot){
  const r = await apiCall('/saves', { action:'load', username, slot });
  return r.ok ? r.state : null;
}
/**
 * @param {string} username
 * @returns {Promise<SlotListEntry[]>}
 */
export async function tursoListSlots(username){
  const r = await apiCall('/saves', { action:'list', username });
  return r.slots || [];
}
/**
 * @param {string} username
 * @param {number} slot
 * @returns {Promise<ApiResult>}
 */
export async function tursoDelete(username, slot){
  return apiCall('/saves', { action:'delete', username, slot });
}
/**
 * @param {string} username
 * @param {string} hash
 * @returns {Promise<ApiResult>}
 */
export async function tursoRegister(username, hash){
  return apiCall('/auth', { action:'register', username, hash });
}
/**
 * @param {string} username
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
export async function tursoLogin(username, hash){
  const r = await apiCall('/auth', { action:'login', username, hash });
  return r.ok;
}
/** @returns {Promise<ApiResult>} */
export async function tursoInit(){
  return apiCall('/setup', {});
}
