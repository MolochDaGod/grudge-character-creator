// Offline smoke test for resolveEquipment / resolveAnimationPack.
// Extracts the pure helpers from worker/index.js and runs them on
// a synthetic equipped-state to verify the prefab response shape.
import fs from "node:fs";

const src = fs.readFileSync("worker/index.js", "utf8");

const start = src.indexOf("const BONE_CONTAINERS");
const end = src.indexOf("async function getPrefab(env, uuid)");
if (start < 0 || end < 0) {
  console.error("Could not locate helper block in worker/index.js");
  process.exit(1);
}
const block = src.slice(start, end);

const factory = new Function(
  block + "return { resolveEquipment, resolveAnimationPack, BONE_CONTAINERS };",
);
const { resolveEquipment, resolveAnimationPack } = factory();

const equipped = {
  body: "A",
  arms: "B",
  legs: "A",
  sword: "A",
  shield: "A",
  bag: true,
};

const slots = [
  { slot: "body",   variant: "A",        mesh_name: "WK_Units_Body_A",  slot_group: "armor",    bone_container: null },
  { slot: "body",   variant: "B",        mesh_name: "WK_Units_Body_B",  slot_group: "armor",    bone_container: null },
  { slot: "arms",   variant: "B",        mesh_name: "WK_Units_Arms_B",  slot_group: "armor",    bone_container: null },
  { slot: "legs",   variant: "A",        mesh_name: "WK_Units_Legs_A",  slot_group: "armor",    bone_container: null },
  { slot: "sword",  variant: "A",        mesh_name: "WK_Units_sword_A", slot_group: "weapon_r", bone_container: "R_hand_container" },
  { slot: "shield", variant: "A",        mesh_name: "WK_Units_shield_A",slot_group: "shield",   bone_container: "L_shield_container" },
  { slot: "bag",    variant: "_default", mesh_name: "WK_Xtra_bag",      slot_group: "utility",  bone_container: "Bone_bag" },
];

const animPacks = [
  {
    pack_key: "pro_sword_shield",
    name: "1H Sword + Shield",
    r2_base_url: "https://assets.grudge-studio.com/anims/pro_sword_shield/",
    files: '["sword and shield idle.fbx","draw sword 1.fbx","sheath sword 1.fbx"]',
    extra: "{}",
  },
];

const resolved = resolveEquipment(equipped, slots);
const pack = resolveAnimationPack(equipped, animPacks);

const expectVisible = [
  "WK_Units_Body_A",
  "WK_Units_Arms_B",
  "WK_Units_Legs_A",
  "WK_Units_sword_A",
  "WK_Units_shield_A",
  "WK_Xtra_bag",
];

const visibleOk =
  resolved.visibleMeshes.length === expectVisible.length &&
  expectVisible.every((m) => resolved.visibleMeshes.includes(m));
const attachOk =
  resolved.attachments.find((a) => a.slot === "sword")?.bone === "R_hand_container" &&
  resolved.attachments.find((a) => a.slot === "shield")?.bone === "L_shield_container" &&
  resolved.attachments.find((a) => a.slot === "bag")?.bone === "Bone_bag";
const packOk =
  pack?.key === "pro_sword_shield" &&
  pack.specials.idle?.endsWith("sword and shield idle.fbx") &&
  pack.weaponSlot === "sword" &&
  pack.bone === "R_hand_container";

console.log("visibleMeshes:", resolved.visibleMeshes);
console.log("attachments:", resolved.attachments);
console.log("animationPack:", pack);
console.log("\nresults:", { visibleOk, attachOk, packOk });

if (!visibleOk || !attachOk || !packOk) {
  console.error("FAIL");
  process.exit(1);
}
console.log("PASS");
