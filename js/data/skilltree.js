// Skill tree: nodes grant passive stat bonuses or unlock/upgrade abilities.
// Each level-up grants 1 skill point. Nodes have prereqs and max ranks.

/**
 * @typedef {Object} SkillNode
 * @property {string}   name
 * @property {string}   icon
 * @property {'combat'|'arcane'|'survival'} branch
 * @property {number}   max    - max rank
 * @property {number}   cost   - skill points per rank
 * @property {string[]} req    - prerequisite skill ids
 * @property {string}   desc
 * @property {(rank: number) => Object<string, number>} effect - returns stat bonuses at given rank
 */

/** @type {Record<string, SkillNode>} */
export const SKILLS = {
  // --- Combat branch ---
  vitality:   { name:'Vitality', icon:'❤️', branch:'combat', max:5, cost:1, req:[],
                desc:'+25 max HP per rank', effect:(r)=>({hp:25*r}) },
  might:      { name:'Might', icon:'💪', branch:'combat', max:5, cost:1, req:['vitality'],
                desc:'+3 attack per rank', effect:(r)=>({atk:3*r}) },
  toughness:  { name:'Toughness', icon:'🛡️', branch:'combat', max:5, cost:1, req:['vitality'],
                desc:'+2 defense per rank', effect:(r)=>({def:2*r}) },
  crit:       { name:'Precision', icon:'🎯', branch:'combat', max:5, cost:1, req:['might'],
                desc:'+4% crit chance per rank', effect:(r)=>({crit:4*r}) },
  berserk:    { name:'Berserker', icon:'😡', branch:'combat', max:1, cost:3, req:['might','toughness'],
                desc:'UNLOCK: deal +30% damage below 30% HP', effect:(r)=>({berserk:r}) },

  swordsmanship: { name:'Swordsmanship', icon:'⚔️', branch:'combat', max:3, cost:2, req:['crit'],
                  desc:'+10% melee ATK per rank (swords/daggers)', effect:(r)=>({meleeAtk:0.1*r}) },
  polearm:     { name:'Polearm Mastery', icon:'🔱', branch:'combat', max:3, cost:2, req:['toughness'],
                  desc:'+15% reach and +8% ATK with polearms', effect:(r)=>({polearmBonus:0.15*r}) },
  parry:       { name:'Parry Mastery', icon:'🛡️', branch:'combat', max:1, cost:3, req:['swordsmanship','polearm'],
                  desc:'UNLOCK: parry window +0.1s, parried enemies take +25% damage', effect:(r)=>({parryBonus:r}) },

  // --- Arcane branch ---
  focus:      { name:'Focus', icon:'🔮', branch:'arcane', max:5, cost:1, req:[],
                desc:'+20 max MP per rank', effect:(r)=>({mp:20*r}) },
  attune:     { name:'Attunement', icon:'⚡', branch:'arcane', max:5, cost:1, req:['focus'],
                desc:'+50% MP regen per rank', effect:(r)=>({mpregen:0.5*r}) },
  spellpower: { name:'Spell Power', icon:'🌟', branch:'arcane', max:5, cost:1, req:['focus'],
                desc:'+15% spell damage per rank', effect:(r)=>({spelldmg:0.15*r}) },
  haste:      { name:'Haste', icon:'⏱️', branch:'arcane', max:3, cost:1, req:['attune'],
                desc:'-10% cooldowns per rank', effect:(r)=>({cdr:10*r}) },
  meteor:     { name:'Meteor', icon:'☄️', branch:'arcane', max:1, cost:3, req:['spellpower','haste'],
                desc:'UNLOCK: R key — costs 40 MP, huge AoE blast', effect:(r)=>({meteor:r}) },

  // --- Survival branch ---
  swift:      { name:'Swiftness', icon:'🏃', branch:'survival', max:5, cost:1, req:[],
                desc:'+5% move speed per rank', effect:(r)=>({speed:0.05*r}) },
  endurance:  { name:'Endurance', icon:'🌀', branch:'survival', max:5, cost:1, req:['swift'],
                desc:'+15 max stamina per rank', effect:(r)=>({stam:15*r}) },
  evasion:    { name:'Evasion', icon:'💨', branch:'survival', max:3, cost:1, req:['swift'],
                desc:'+0.1s dodge i-frames per rank', effect:(r)=>({iframe:0.1*r}) },
  greed:      { name:'Greed', icon:'🪙', branch:'survival', max:5, cost:1, req:['endurance'],
                desc:'+20% gold from kills per rank', effect:(r)=>({greed:0.2*r}) },
  lifesteal:  { name:'Lifesteal', icon:'🩸', branch:'survival', max:1, cost:3, req:['evasion','greed'],
                desc:'UNLOCK: heal 8% of melee damage dealt', effect:(r)=>({lifesteal:0.08*r}) },
  archery:    { name:'Archery', icon:'🏹', branch:'survival', max:3, cost:2, req:['greed'],
                desc:'+15% ranged ATK, -10% heat per rank', effect:(r)=>({rangedAtk:0.15*r,heatReduction:0.1*r}) },
  rangedMastery:{ name:'Heat Sink', icon:'❄️', branch:'survival', max:2, cost:2, req:['archery'],
                desc:'+10 heat cap per rank', effect:(r)=>({rangedMastery:r}) },
};

export const BRANCHES = /** @type {Array<'combat'|'arcane'|'survival'>} */ (['combat','arcane','survival']);

// Aggregate all skill effects from a {skillId:rank} map into a flat bonus object.
/**
 * @param {Record<string, number>} skills
 * @returns {Object<string, number>}
 */
export function skillStats(skills){
  const out = { hp:0,mp:0,atk:0,def:0,crit:0,cdr:0,mpregen:0,spelldmg:0,
                speed:0,stam:0,iframe:0,greed:0,
                berserk:0,meteor:0,lifesteal:0,
                meleeAtk:0,rangedAtk:0,polearmBonus:0,parryBonus:0,
                rangedMastery:0,heatReduction:0 };
  for(const id in skills){
    const rank = skills[id];
    if(rank>0 && SKILLS[id]){
      const e = SKILLS[id].effect(rank);
      for(const k in e) out[k] = (out[k]||0) + e[k];
    }
  }
  return out;
}

// Can a node be ranked up? returns reason string or null if OK
/**
 * @param {string} id
 * @param {Record<string, number>} skills
 * @param {number} points
 * @returns {string|null}
 */
export function canLearn(id, skills, points){
  const node = SKILLS[id];
  if(!node) return 'unknown';
  const cur = skills[id]||0;
  if(cur>=node.max) return 'maxed';
  if(points < node.cost) return 'no points';
  for(const r of node.req){ if((skills[r]||0)<1) return 'locked: needs '+SKILLS[r].name; }
  return null;
}
