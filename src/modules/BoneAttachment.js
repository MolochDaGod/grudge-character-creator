/**
 * BoneAttachment — Skeleton-aware weapon/prop attachment to character bones.
 *
 * Patterns from threejs-skills/threejs-animation (Bone Attachments section):
 * - Find bones by name across different skeleton naming conventions
 * - Attach/detach props with position/rotation offsets
 * - Support left hand, right hand, back, hip attachment points
 */

import * as THREE from 'three';

// Common bone name patterns across different skeleton rigs
const BONE_ALIASES = {
  rightHand: [
    'RightHand', 'R_hand', 'R_Hand', 'Hand_R', 'hand_r',
    'mixamorig:RightHand', 'mixamorig_RightHand',
    'R_hand_container', 'Bip01_R_Hand', 'RightHandIndex1',
  ],
  leftHand: [
    'LeftHand', 'L_hand', 'L_Hand', 'Hand_L', 'hand_l',
    'mixamorig:LeftHand', 'mixamorig_LeftHand',
    'L_hand_container', 'Bip01_L_Hand', 'LeftHandIndex1',
  ],
  rightForearm: [
    'RightForeArm', 'R_forearm', 'mixamorig:RightForeArm',
    'Bip01_R_Forearm',
  ],
  leftForearm: [
    'LeftForeArm', 'L_forearm', 'mixamorig:LeftForeArm',
    'Bip01_L_Forearm',
  ],
  spine: [
    'Spine2', 'Spine1', 'Spine', 'spine_02', 'spine_01',
    'mixamorig:Spine2', 'Bip01_Spine2',
  ],
  head: [
    'Head', 'head', 'mixamorig:Head', 'Bip01_Head',
  ],
  hips: [
    'Hips', 'hips', 'pelvis', 'mixamorig:Hips', 'Bip01_Pelvis',
  ],
};

export class BoneAttachment {
  constructor() {
    /** @type {Map<string, {bone: THREE.Bone, object: THREE.Object3D}>} active attachments */
    this.attachments = new Map();
  }

  // ── Core API ──────────────────────────────────────────────

  /**
   * Attach an object to a bone on the model.
   *
   * @param {THREE.Object3D} model - the character model (root)
   * @param {THREE.Object3D} object - weapon, shield, or prop mesh to attach
   * @param {string} slotName - one of: 'rightHand', 'leftHand', 'spine', 'head', 'hips', or a direct bone name
   * @param {object} [offset]
   * @param {THREE.Vector3} [offset.position] - local position offset
   * @param {THREE.Euler} [offset.rotation] - local rotation offset
   * @param {THREE.Vector3} [offset.scale] - local scale override
   * @returns {boolean} success
   */
  attach(model, object, slotName, offset = {}) {
    const bone = this.findBone(model, slotName);
    if (!bone) {
      console.warn(`[BoneAttachment] No bone found for slot "${slotName}"`);
      return false;
    }

    // Detach any existing attachment at this slot
    this.detach(slotName);

    // Apply offsets
    if (offset.position) object.position.copy(offset.position);
    if (offset.rotation) object.rotation.copy(offset.rotation);
    if (offset.scale) object.scale.copy(offset.scale);

    // Attach to bone
    bone.add(object);
    this.attachments.set(slotName, { bone, object });

    return true;
  }

  /**
   * Detach an object from a slot.
   * @param {string} slotName
   * @returns {THREE.Object3D|null} the detached object, or null
   */
  detach(slotName) {
    const entry = this.attachments.get(slotName);
    if (!entry) return null;

    entry.bone.remove(entry.object);
    this.attachments.delete(slotName);
    return entry.object;
  }

  /**
   * Detach all attachments.
   */
  detachAll() {
    for (const [slot] of this.attachments) {
      this.detach(slot);
    }
  }

  /**
   * Move an attached weapon from one slot to another (e.g. hand → back for sheath).
   * @param {string} fromSlot
   * @param {string} toSlot
   * @param {THREE.Object3D} model
   * @param {object} [newOffset]
   */
  transfer(fromSlot, toSlot, model, newOffset = {}) {
    const obj = this.detach(fromSlot);
    if (obj) {
      this.attach(model, obj, toSlot, newOffset);
    }
  }

  // ── Bone Finding ──────────────────────────────────────────

  /**
   * Find a bone on a model by slot name or direct bone name.
   * Searches skeleton bones first, then falls back to traversing the scene graph.
   *
   * @param {THREE.Object3D} model
   * @param {string} slotOrBoneName
   * @returns {THREE.Bone|null}
   */
  findBone(model, slotOrBoneName) {
    // Check if it's a known slot alias
    const aliases = BONE_ALIASES[slotOrBoneName];
    const namesToTry = aliases ? aliases : [slotOrBoneName];

    // Try skeleton bones first (fastest)
    let skeleton = null;
    model.traverse(child => {
      if (!skeleton && child.isSkinnedMesh && child.skeleton) {
        skeleton = child.skeleton;
      }
    });

    if (skeleton) {
      for (const name of namesToTry) {
        const bone = skeleton.bones.find(b => b.name === name);
        if (bone) return bone;
      }
      // Fuzzy match — case-insensitive partial
      for (const name of namesToTry) {
        const lower = name.toLowerCase();
        const bone = skeleton.bones.find(b => b.name.toLowerCase().includes(lower));
        if (bone) return bone;
      }
    }

    // Fallback: traverse entire scene graph
    let found = null;
    model.traverse(child => {
      if (found) return;
      for (const name of namesToTry) {
        if (child.name === name || child.name.toLowerCase().includes(name.toLowerCase())) {
          found = child;
          return;
        }
      }
    });

    return found;
  }

  /**
   * List all bone names on a model (for debugging).
   * @param {THREE.Object3D} model
   * @returns {string[]}
   */
  static listBones(model) {
    const names = [];
    model.traverse(child => {
      if (child.isBone) names.push(child.name);
    });
    return names;
  }

  /**
   * Get all currently active attachment slot names.
   * @returns {string[]}
   */
  get activeSlots() {
    return [...this.attachments.keys()];
  }
}
