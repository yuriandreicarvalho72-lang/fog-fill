// Habilidades de NPC (dossiê do prompt de fichas -> animações JB2A). Sem SDK: testado em Node.
// O mestre rola os dados na mão: aqui só há forma, alcance, quem ficou na área, os números da ficha e contadores.
import { LIB, rangedVideo, pointVideo } from "./jb2a.js";
import { V } from "./fx.js";

export const DOSSIE = "arsenal/dossie";   // metadado do token: dossiê normalizado
export const HAB_USO = "arsenal/hab-uso"; // metadado do token: { used: { nome: true }, leg: N, covil: "nome" }
export const CH_HAB = "arsenal/habilidade"; // todos: { token, at, ab, aim, seed, cell } -> cada um toca a animação

// Segunda fonte de vídeos: Boss Loot FX (pacote gratuito), arquivos com o prefixo "BLFX/" (baixados para public/jb2a/BLFX/).
export const BLFX_REPO = "boss-loot/boss-loot-assets-free";
export const BLFX_COMMIT = "ce4f413b4ee62e019433005b29bd860c7e77a678";
export const BLFX_CREDIT = "Animações: Boss Loot FX Assets (Boss Loot Team), licença própria com atribuição";
export const BLFX_LICENSE = `https://github.com/${BLFX_REPO}/blob/${BLFX_COMMIT}/LICENSE`;

export const SECOES = [["acao", "Ações"], ["bonus", "Ações bônus"], ["reacao", "Reações"], ["lendaria", "Ações lendárias"], ["covil", "Ações de covil"], ["passiva", "Passivas"]];
const FORMAS = ["alvo", "cone", "linha", "area", "aura", "si", "movimento"];

// Vídeos das habilidades (pacote gratuito do JB2A, mesmo commit do Arsenal). Gerado a partir do índice do JB2A;
// dur em ms medida com ffprobe. type: target (no alvo), melee (do atacante ao alvo), ranged (projétil),
// cone / line (saem do atacante; ox = onde o efeito começa no vídeo, span = px do comprimento), area (num ponto),
// self (no próprio token), move (deslocamento).
export const ABIL_LIB = {
  garra: { type: "target", file: "Generic/Creature/Claws_01_Regular_Red_400x400.webm", w: 400, h: 400, dur: 2000, size: 1.6 },
  mordida: { type: "target", file: "Generic/Creature/Bite_01_Regular_Red_400x400.webm", w: 400, h: 400, dur: 1033, size: 1.6 },
  pinca: { type: "target", file: "Generic/Creature/Claws_01_Regular_Red_400x400.webm", w: 400, h: 400, dur: 2000, size: 1.4 },
  soco: { type: "melee", file: "Generic/Unarmed_Attacks/Unarmed_Strike/UnarmedStrike_01_Regular_Blue_Physical01_800x600.webm", w: 800, h: 600, dur: 1033, ox: 300, span: 200 },
  arma_corte: { type: "melee", file: "Generic/Weapon_Attacks/Melee/GenericSlash01_01_Regular_Orange_800x600.webm", w: 800, h: 600, dur: 900, ox: 300, span: 200 },
  arma_impacto: { type: "melee", file: "Generic/Weapon_Attacks/Melee/Mace01_01_Regular_White_800x600.webm", w: 800, h: 600, dur: 2200, ox: 300, span: 200 },
  arma_perfuracao: { type: "melee", file: "Generic/Weapon_Attacks/Melee/Spear01_01_Regular_White_800x600.webm", w: 800, h: 600, dur: 2200, ox: 300, span: 200 },
  projetil_fogo: { type: "ranged", hit: 0.55, v: { 15: { file: "Cantrip/Fire_Bolt/FireBolt_01_Regular_Orange_15ft_1000x400.webm", w: 1000, h: 400, dur: 1533 }, 30: { file: "Cantrip/Fire_Bolt/FireBolt_01_Regular_Orange_30ft_1600x400.webm", w: 1600, h: 400, dur: 1533 }, 60: { file: "Cantrip/Fire_Bolt/FireBolt_01_Regular_Orange_60ft_2800x400.webm", w: 2800, h: 400, dur: 1700 } } },
  raio_energia: { type: "ranged", hit: 0.55, v: { 15: { file: "Generic/Energy/EnergyBeam_01_Regular_Blue_15ft_1000x400.webm", w: 1000, h: 400, dur: 4042 }, 30: { file: "Generic/Energy/EnergyBeam_01_Regular_Blue_30ft_1600x400.webm", w: 1600, h: 400, dur: 4042 }, 60: { file: "Generic/Energy/EnergyBeam_01_Regular_Blue_60ft_2800x400.webm", w: 2800, h: 400, dur: 4042 } } },
  raio_eletrico: { type: "ranged", hit: 0.55, v: { 15: { file: "1st_Level/Witch_Bolt/WitchBolt_01_Regular_Blue_15ft_1000x400.webm", w: 1000, h: 400, dur: 4000 }, 30: { file: "1st_Level/Witch_Bolt/WitchBolt_01_Regular_Blue_30ft_1600x400.webm", w: 1600, h: 400, dur: 4000 }, 60: { file: "1st_Level/Witch_Bolt/WitchBolt_01_Regular_Blue_60ft_2800x400.webm", w: 2800, h: 400, dur: 4000 } } },
  raio_luz: { type: "ranged", hit: 0.55, v: { 15: { file: "1st_Level/Guiding_Bolt/GuidingBolt_01_Regular_BlueYellow_15ft_1000x400.webm", w: 1000, h: 400, dur: 5733 }, 30: { file: "1st_Level/Guiding_Bolt/GuidingBolt_01_Regular_BlueYellow_30ft_1600x400.webm", w: 1600, h: 400, dur: 5900 }, 60: { file: "1st_Level/Guiding_Bolt/GuidingBolt_01_Regular_BlueYellow_60ft_2800x400.webm", w: 2800, h: 400, dur: 6033 } } },
  raio_sombra: { type: "ranged", hit: 0.55, v: { 15: { file: "Cantrip/Eldritch_Blast/EldritchBlast_01_Regular_Purple_15ft_1000x400.webm", w: 1000, h: 400, dur: 4367 }, 30: { file: "Cantrip/Eldritch_Blast/EldritchBlast_01_Regular_Purple_30ft_1600x400.webm", w: 1600, h: 400, dur: 4367 }, 60: { file: "Cantrip/Eldritch_Blast/EldritchBlast_01_Regular_Purple_60ft_2800x400.webm", w: 2800, h: 400, dur: 4367 } } },
  misseis: { type: "ranged", hit: 0.55, v: { 15: { file: "1st_Level/Magic_Missile/MagicMissile_01_Regular_Purple_15ft_01_1000x400.webm", w: 1000, h: 400, dur: 1867 }, 30: { file: "1st_Level/Magic_Missile/MagicMissile_01_Regular_Purple_30ft_01_1600x400.webm", w: 1600, h: 400, dur: 1867 }, 60: { file: "1st_Level/Magic_Missile/MagicMissile_01_Regular_Purple_60ft_01_2800x400.webm", w: 2800, h: 400, dur: 2033 } } },
  cone_fogo: { type: "cone", file: "Generic/Template/Cone/Breath_Weapon/BreathWeapon_Fire01_Regular_Orange_30ft_Cone_Burst_600x600.webm", w: 600, h: 600, dur: 8466, ox: 0, span: 600 },
  cone_gelo: { type: "cone", file: "Generic/Template/Cone/Breath_Weapon/BreathWeapon_Cold01_Regular_Blue_30ft_Cone_Burst_600x600.webm", w: 600, h: 600, dur: 9000, ox: 0, span: 600 },
  cone_acido: { type: "cone", file: "Generic/Template/Cone/Breath_Weapon/BreathWeapon_Poison01_Regular_Green_30ft_Cone_Burst_600x600.webm", w: 600, h: 600, dur: 9266, ox: 0, span: 600 },
  cone_veneno: { type: "cone", file: "Generic/Template/Cone/Breath_Weapon/BreathWeapon_Poison01_Regular_Green_30ft_Cone_Burst_600x600.webm", w: 600, h: 600, dur: 9266, ox: 0, span: 600 },
  cone_eletrico: { type: "cone", file: "Generic/Template/Cone/Lightning/TemplateCone5eLightning01_01_Regular_BluePurple_30ft_Loop_800x800.webm", w: 800, h: 800, dur: 2933, ox: 100, span: 600 },
  cone_vento: { type: "line", file: "2nd_Level/Gust_Of_Wind/GustOfWind_01_White_1200x200.webm", w: 1200, h: 200, dur: 4033, ox: 0, span: 1200 },
  linha_eletrica: { type: "line", file: "Generic/Template/Line/Breath_Weapon/BreathWeapon_Lightning01_Regular_Blue_30ft_Line_Burst_1200x200.webm", w: 1200, h: 200, dur: 6867, ox: 0, span: 1200 },
  linha_fogo: { type: "line", file: "Generic/Template/Line/Breath_Weapon/BreathWeapon_Fire01_Regular_Orange_30ft_Line_Burst_1200x200.webm", w: 1200, h: 200, dur: 8067, ox: 0, span: 1200 },
  linha_energia: { type: "line", file: "Generic/Template/Line/Generic/Piercing_Generic01_01_Regular_Orange_1000x400.webm", w: 1000, h: 400, dur: 500, ox: 0, span: 1000 },
  explosao_fogo: { type: "area", file: "3rd_Level/Fireball/FireballExplosion_01_Orange_800x800.webm", w: 800, h: 800, dur: 4042 },
  explosao: { type: "area", file: "Generic/Explosion/Explosion_01_Orange_400x400.webm", w: 400, h: 400, dur: 1367 },
  onda_choque: { type: "area", file: "1st_Level/Thunderwave/Thunderwave_01_Bright_Blue_Center_600x600.webm", w: 600, h: 600, dur: 1033 },
  estilhaco: { type: "area", file: "2nd_Level/Shatter/Shatter_01_Blue_400x400.webm", w: 400, h: 400, dur: 3033 },
  tempestade_raios: { type: "area", file: "3rd_Level/Call_Lightning/CallLightning_01_Blue_1000x1000.webm", w: 1000, h: 1000, dur: 4000 },
  chuva_gelo: { type: "area", file: "3rd_Level/Sleet_Storm/SleetStorm_01_Blue_800x800.webm", w: 800, h: 800, dur: 6250 },
  nevoa: { type: "area", file: "1st_Level/Fog_Cloud/FogCloud_01_White_800x800.webm", w: 800, h: 800, dur: 5042 },
  escuridao: { type: "area", file: "2nd_Level/Darkness/Darkness_01_Black_600x600.webm", w: 600, h: 600, dur: 5000 },
  teia: { type: "area", file: "2nd_Level/Web/Web_01_White_01_400x400.webm", w: 400, h: 400, dur: 3042 },
  vinhas: { type: "area", file: "1st_Level/Entangle/Entangle_01_Green_400x400.webm", w: 400, h: 400, dur: 3966 },
  lodo: { type: "area", file: "1st_Level/Grease/Grease_Dark_Brown_600x600.webm", w: 600, h: 600, dur: 10033 },
  laminas: { type: "area", file: "2nd_Level/Cloud_Of_Daggers/CloudOfDaggers_01_Light_Blue_400x400.webm", w: 400, h: 400, dur: 5000 },
  coluna_luz: { type: "area", file: "2nd_Level/Moonbeam/Moonbeam_01_Regular_Blue_400x400.webm", w: 400, h: 400, dur: 5042 },
  fenda_chao: { type: "area", file: "Generic/Impact/GroundCrackImpact_01_Regular_Orange_600x600.webm", w: 600, h: 600, dur: 5033 },
  aura_espiritos: { type: "area", file: "3rd_Level/Spirit_Guardians/SpiritGuardians_01_Light_BlueYellow_600x600.webm", w: 600, h: 600, dur: 6042 },
  aura_tentaculos: { type: "area", file: "1st_Level/Arms_Of_Hadar/ArmsOfHadar_01_Dark_Purple_500x500.webm", w: 500, h: 500, dur: 5000 },
  aura_sombra: { type: "area", file: "Generic/Template/Circle/TemplateHorrorCircle_01_Regular_Purple_800x800.webm", w: 800, h: 800, dur: 6042 },
  aura_fogo: { type: "area", file: "Generic/Fire/Eruption_01_Regular_Orange_600x600.webm", w: 600, h: 600, dur: 12042 },
  aura_eletrica: { type: "area", file: "Generic/Lightning/LightningBall_01_Regular_Blue_400x400.webm", w: 400, h: 400, dur: 2033 },
  rugido: { type: "area", file: "Generic/Template/Circle/OutPulse/OutPulse_01_Regular_BlueWhite_Burst_600x600.webm", w: 600, h: 600, dur: 2367 },
  giro: { type: "area", file: "Generic/Weapon_Attacks/Melee/GenericWhirlwind01_01_Regular_Orange_800x600.webm", w: 800, h: 600, dur: 2800 },
  cura: { type: "self", file: "Generic/Healing/HealingAbility_01_Green_400x400.webm", w: 400, h: 400, dur: 1700, size: 1.8 },
  regeneracao: { type: "self", file: "Generic/Healing/HealingAbility_02_Regular_GreenOrange_Burst_600x600.webm", w: 600, h: 600, dur: 2367, size: 2 },
  escudo: { type: "self", file: "1st_Level/Shield/Shield_01_Regular_Blue_Complete_400x400.webm", w: 400, h: 400, dur: 5933, size: 1.8 },
  bencao: { type: "self", file: "1st_Level/Bless/Bless_01_Regular_Yellow_Intro_400x400.webm", w: 400, h: 400, dur: 5000, size: 1.8 },
  marca_alvo: { type: "target", file: "1st_Level/Hunters_Mark/HuntersMark_01_Regular_Green_Pulse_200x200.webm", w: 200, h: 200, dur: 5000, size: 1.2 },
  golpe_divino: { type: "target", file: "2nd_Level/Divine_Smite/DivineSmite_01_Regular_BlueYellow_Target_400x400.webm", w: 400, h: 400, dur: 2333, size: 2 },
  teleporte: { type: "self", file: "2nd_Level/Misty_Step/MistyStep_01_Regular_Blue_400x400.webm", w: 400, h: 400, dur: 3000, size: 2 },
  fumaca: { type: "self", file: "Generic/Smoke/SmokePuff01_01_Regular_Grey_400x400.webm", w: 400, h: 400, dur: 2300, size: 2.4 },
  transformacao: { type: "self", file: "Generic/Explosion/Explosion_03_Regular_BlueYellow_400x400.webm", w: 400, h: 400, dur: 2033, size: 2.4 },
  morcegos: { type: "self", file: "Generic/Creature/BatsComplete01_01_Regular_Red_600x600.webm", w: 600, h: 600, dur: 8833, size: 3 },
  investida: { type: "move", file: "Generic/Wind/WindLines01_01_Regular_White_500x500.webm", w: 500, h: 500, dur: 5000 },
  salto: { type: "move", file: "Generic/Smoke/SmokePuff01_01_Regular_Grey_400x400.webm", w: 400, h: 400, dur: 2300 },
  rastro: { type: "move", file: "Generic/FootPrint/ShoePrint_01_Grey_200x200.webm", w: 200, h: 200, dur: 4792 },
  // natureza e fantasia (1.5.2)
  borboletas: { type: "self", file: "Generic/Butterflies/ButterfliesComplete01_01_Regular_BluePurple_600x600.webm", w: 600, h: 600, dur: 8833, size: 2.6 },
  revoada_borboletas: { type: "area", file: "Generic/Butterflies/ButterfliesOutwardBurst01_01_Regular_BluePurple_400x400.webm", w: 400, h: 400, dur: 1333 },
  borboletas_laranja: { type: "area", file: "Generic/Butterflies/Butterflies_01_Regular_Orange_Many_400x400.webm", w: 400, h: 400, dur: 6000 },
  petalas: { type: "area", file: "Generic/Nature/SwirlingLeavesOutburst_01_01_Regular_Pink_400x400.webm", w: 400, h: 400, dur: 2233 },
  folhas: { type: "self", file: "Generic/Nature/SwirlingLeavesComplete01_01_Regular_Green_400x400.webm", w: 400, h: 400, dur: 8708, size: 2.2 },
  rajada_folhas: { type: "ranged", hit: 0.6, v: { 5: { file: "Generic/Nature/SwirlingLeaves01_01_Regular_GreenOrange_05ft_600x400.webm", w: 600, h: 400, dur: 3542 }, 15: { file: "Generic/Nature/SwirlingLeaves01_01_Regular_GreenOrange_15ft_1000x400.webm", w: 1000, h: 400, dur: 4000 }, 30: { file: "Generic/Nature/SwirlingLeaves01_01_Regular_GreenOrange_30ft_1600x400.webm", w: 1600, h: 400, dur: 4542 }, 60: { file: "Generic/Nature/SwirlingLeaves01_01_Regular_GreenOrange_60ft_2800x400.webm", w: 2800, h: 400, dur: 5000 }, 90: { file: "Generic/Nature/SwirlingLeaves01_01_Regular_GreenOrange_90ft_4000x400.webm", w: 4000, h: 400, dur: 5542 } } },
  penas: { type: "area", file: "Generic/Nature/SwirlingFeathersOutburst01_01_Regular_Textured_400x400.webm", w: 400, h: 400, dur: 2333 },
  fadas: { type: "self", file: "Generic/Creature/FairiesComplete01_01_Regular_BluePurple_600x600.webm", w: 600, h: 600, dur: 8833, size: 2.6 },
  vagalumes: { type: "area", file: "Generic/Fireflies/Fireflies_01_Green_Many01_400x400.webm", w: 400, h: 400, dur: 8000 },
  plantas: { type: "area", file: "Generic/Nature/PlantGrowthRound03_01_Regular_GreenYellow_500x500.webm", w: 500, h: 500, dur: 8500 },
  espinhos: { type: "area", file: "Generic/Nature/PlantGrowthRing02_01_Regular_GreenRed_500x500.webm", w: 500, h: 500, dur: 7750 },
  // sangue
  sangue: { type: "target", file: "Generic/Liquid/LiquidSplash02_01_Regular_Red_500x500.webm", w: 500, h: 500, dur: 1133, size: 1.6 },
  jorro_sangue: { type: "target", file: "Generic/Liquid/LiquidSplashSide02_01_Regular_Red_600x600.webm", w: 600, h: 600, dur: 1033, size: 1.8, side: 0.12 },
  sangramento: { type: "target", file: "Generic/Marker/MarkerDrop_01_Regular_Red_400x400.webm", w: 400, h: 400, dur: 6042, size: 1.4 },
  chuva_sangue: { type: "area", file: "Generic/Template/Circle/TemplateDropCircle_01_Regular_Red_800x800.webm", w: 800, h: 800, dur: 6042 },
  // mente e condições
  coracoes: { type: "target", file: "Generic/Marker/MarkerHeart_01_Regular_Pink_400x400.webm", w: 400, h: 400, dur: 6042, size: 1.4 },
  encanto: { type: "area", file: "Generic/Template/Circle/TemplateHeartCircle_01_Regular_Pink_800x800.webm", w: 800, h: 800, dur: 6042 },
  caveira: { type: "target", file: "Generic/Marker/MarkerSkull_01_Regular_Purple_400x400.webm", w: 400, h: 400, dur: 6042, size: 1.4 },
  caveiras: { type: "area", file: "Generic/Template/Circle/TemplateSkullCircle_01_Regular_Purple_800x800.webm", w: 800, h: 800, dur: 6042 },
  medo: { type: "area", file: "Generic/Template/Circle/TemplateFearCircle_01_Dark_Purple_800x800.webm", w: 800, h: 800, dur: 6042 },
  marca_veneno: { type: "target", file: "Generic/Marker/MarkerPoison_01_Dark_Green_400x400.webm", w: 400, h: 400, dur: 6042, size: 1.4 },
  nuvem_veneno: { type: "area", file: "Generic/Template/Circle/TemplatePoisonCircle_01_Dark_Green_800x800.webm", w: 800, h: 800, dur: 6042 },
  atordoado: { type: "target", file: "Generic/Conditions/Dizzy_Stars/DizzyStars_01_BlueOrange_400x400.webm", w: 400, h: 400, dur: 2000, size: 1.2 },
  correntes: { type: "target", file: "Generic/Marker/MarkerChainStandard01_02_Regular_Red_Complete_400x400.webm", w: 400, h: 400, dur: 8333, size: 1.6 },
  musica: { type: "area", file: "Generic/Template/Circle/TemplateMusicNoteCircle_01_Regular_Blue_800x800.webm", w: 800, h: 800, dur: 6042 },
  notas_musicais: { type: "target", file: "Generic/Marker/MarkerMusicNote_01_Regular_Blue_400x400.webm", w: 400, h: 400, dur: 6000, size: 1.4 },
  olhos: { type: "area", file: "Generic/Eyes/Eyes_Many01_01_Dark_Green_600x600.webm", w: 600, h: 600, dur: 4958 },
  // magia, energia e elementos
  vortice: { type: "area", file: "Generic/Template/Circle/Vortex_01_Regular_Blue_600x600.webm", w: 600, h: 600, dur: 5042 },
  portal: { type: "self", file: "Generic/Portals/Portal_Bright_Yellow_H_400x400.webm", w: 400, h: 400, dur: 8042, size: 2 },
  circulo_magico: { type: "area", file: "Generic/Magic_Signs/EvocationCircleComplete_02_Regular_Red_800x800.webm", w: 800, h: 800, dur: 11042 },
  runas: { type: "area", file: "Generic/Template/Circle/TemplateRunesCircle_01_Regular_Orange_800x800.webm", w: 800, h: 800, dur: 6042 },
  poder: { type: "self", file: "Generic/On_Token/Buff/Ontoken_Buff001_001_PurpleRed_400x400.webm", w: 400, h: 400, dur: 1833, size: 2 },
  bolha: { type: "self", file: "Generic/Liquid/Bubble/BubbleComplete001_001_Blue_2x2_400x400.webm", w: 400, h: 400, dur: 5567, size: 2 },
  fogos_artificio: { type: "area", file: "Generic/Fireworks/Firework01_01_Regular_OrangeYellow_600x600.webm", w: 600, h: 600, dur: 3000 },
  lava: { type: "area", file: "Generic/Lava/Spout001/LavaSpoutComplete001_001_OrangeYellow_600x600.webm", w: 600, h: 600, dur: 6667 },
  espinhos_gelo: { type: "area", file: "Generic/Ice/IceSpikesRadialBurst_01_Regular_White_1000x1000.webm", w: 1000, h: 1000, dur: 4033 },
  respingo_agua: { type: "target", file: "Generic/Liquid/LiquidSplash01_Regular_Blue_400x400.webm", w: 400, h: 400, dur: 3542, size: 1.6 },
  cartas: { type: "ranged", hit: 0.6, v: { 15: { file: "Generic/RangedSpell/Card/ProjectileCard01_01_Regular_Blue_15ft_1000x400.webm", w: 1000, h: 400, dur: 2200 }, 30: { file: "Generic/RangedSpell/Card/ProjectileCard01_01_Regular_Blue_30ft_1600x400.webm", w: 1600, h: 400, dur: 2200 }, 60: { file: "Generic/RangedSpell/Card/ProjectileCard01_01_Regular_Blue_60ft_2800x400.webm", w: 2800, h: 400, dur: 2700 }, 90: { file: "Generic/RangedSpell/Card/ProjectileCard01_01_Regular_Blue_90ft_4000x400.webm", w: 4000, h: 400, dur: 3233 } } },
  bola_neve: { type: "ranged", hit: 0.6, v: { 5: { file: "Generic/Weapon_Attacks/Ranged/SnowballToss_01_Regular_White_05ft_600x500.webm", w: 600, h: 500, dur: 2867 }, 15: { file: "Generic/Weapon_Attacks/Ranged/SnowballToss_01_Regular_White_15ft_1000x500.webm", w: 1000, h: 500, dur: 2867 }, 30: { file: "Generic/Weapon_Attacks/Ranged/SnowballToss_01_Regular_White_30ft_1600x500.webm", w: 1600, h: 500, dur: 2867 }, 60: { file: "Generic/Weapon_Attacks/Ranged/SnowballToss_01_Regular_White_60ft_2800x500.webm", w: 2800, h: 500, dur: 3367 }, 90: { file: "Generic/Weapon_Attacks/Ranged/SnowballToss_01_Regular_White_90ft_4000x500.webm", w: 4000, h: 500, dur: 3567 } } },
  // Boss Loot FX (BLFX, pacote gratuito; licença em BLFX_LICENSE) — 1.5.3
  flecha_sangue: { type: "ranged", hit: 0.8, v: { 5: { file: "BLFX/01-weapon/arrow/Blood_Arrow_1_05ft_600x400.webm", w: 600, h: 400, dur: 533 }, 15: { file: "BLFX/01-weapon/arrow/Blood_Arrow_1_15ft_1000x400.webm", w: 1000, h: 400, dur: 533 }, 30: { file: "BLFX/01-weapon/arrow/Blood_Arrow_1_30ft_1600x400.webm", w: 1600, h: 400, dur: 700 }, 60: { file: "BLFX/01-weapon/arrow/Blood_Arrow_1_60ft_2800x400.webm", w: 2800, h: 400, dur: 867 }, 90: { file: "BLFX/01-weapon/arrow/Blood_Arrow_1_90ft_4000x400.webm", w: 4000, h: 400, dur: 1033 } } },
  flecha_arcana: { type: "ranged", hit: 0.8, v: { 5: { file: "BLFX/05-spell/homebrew/arcane/arrow/Arrow_Arcane_Shot_Blue_1_05ft_600x400.webm", w: 600, h: 400, dur: 533 }, 15: { file: "BLFX/05-spell/homebrew/arcane/arrow/Arrow_Arcane_Shot_Blue_1_15ft_1000x400.webm", w: 1000, h: 400, dur: 533 }, 30: { file: "BLFX/05-spell/homebrew/arcane/arrow/Arrow_Arcane_Shot_Blue_1_30ft_1600x400.webm", w: 1600, h: 400, dur: 700 }, 60: { file: "BLFX/05-spell/homebrew/arcane/arrow/Arrow_Arcane_Shot_Blue_1_60ft_2800x400.webm", w: 2800, h: 400, dur: 867 }, 90: { file: "BLFX/05-spell/homebrew/arcane/arrow/Arrow_Arcane_Shot_Blue_1_90ft_4000x400.webm", w: 4000, h: 400, dur: 1033 } } },
  lanca: { type: "ranged", hit: 0.45, v: { 15: { file: "BLFX/01-weapon/spear/Flintfang_Spear_RANGE_15ft_1000x400.webm", w: 1000, h: 400, dur: 2133 }, 30: { file: "BLFX/01-weapon/spear/Flintfang_Spear_RANGE_30ft_1600x400.webm", w: 1600, h: 400, dur: 2133 }, 60: { file: "BLFX/01-weapon/spear/Flintfang_Spear_RANGE_60ft_2800x400.webm", w: 2800, h: 400, dur: 2133 }, 90: { file: "BLFX/01-weapon/spear/Flintfang_Spear_RANGE_90ft_4000x400.webm", w: 4000, h: 400, dur: 2267 } } },
  rajada_ar: { type: "ranged", hit: 0.5, v: { 5: { file: "BLFX/05-spell/homebrew/air/Dust_1_Burst_1_Snipe_1_WHITE_RANGE_05ft_600x400.webm", w: 600, h: 400, dur: 1400 }, 15: { file: "BLFX/05-spell/homebrew/air/Dust_1_Burst_1_Snipe_1_WHITE_RANGE_15ft_1000x400.webm", w: 1000, h: 400, dur: 1400 }, 30: { file: "BLFX/05-spell/homebrew/air/Dust_1_Burst_1_Snipe_1_WHITE_RANGE_30ft_1600x400.webm", w: 1600, h: 400, dur: 1400 }, 60: { file: "BLFX/05-spell/homebrew/air/Dust_1_Burst_1_Snipe_1_WHITE_RANGE_60ft_2800x400.webm", w: 2800, h: 400, dur: 1400 }, 90: { file: "BLFX/05-spell/homebrew/air/Dust_1_Burst_1_Snipe_1_WHITE_RANGE_90ft_4000x400.webm", w: 4000, h: 400, dur: 1400 } } },
  raio_hipnotico: { type: "ranged", hit: 0.6, v: { 5: { file: "BLFX/05-spell/homebrew/hypnotic/Range_Intro_Beam_Hypnotic_Purple_01_05ft_600x400.webm", w: 600, h: 400, dur: 1000 }, 15: { file: "BLFX/05-spell/homebrew/hypnotic/Range_Intro_Beam_Hypnotic_Purple_01_15ft_1000x400.webm", w: 1000, h: 400, dur: 1000 }, 30: { file: "BLFX/05-spell/homebrew/hypnotic/Range_Intro_Beam_Hypnotic_Purple_01_30ft_1600x400.webm", w: 1600, h: 400, dur: 1000 }, 60: { file: "BLFX/05-spell/homebrew/hypnotic/Range_Intro_Beam_Hypnotic_Purple_01_60ft_2800x400.webm", w: 2800, h: 400, dur: 1000 }, 90: { file: "BLFX/05-spell/homebrew/hypnotic/Range_Intro_Beam_Hypnotic_Purple_01_90ft_4000x400.webm", w: 4000, h: 400, dur: 1000 } } },
  espiral_hipnotica: { type: "area", file: "BLFX/05-spell/homebrew/hypnotic/Spiral_Hypnotic_Purple_01_1200x1200.webm", w: 1200, h: 1200, dur: 3000 },
  tornado_fogo: { type: "area", file: "BLFX/05-spell/homebrew/fire/Tornado_1_Fire_Spin_Clockwise_CARTOON_LOOP_1200x1200.webm", w: 1200, h: 1200, dur: 2500 },
  chao_chamas: { type: "area", file: "BLFX/05-spell/homebrew/fire/GroundFlames_1_ORANGE_LOOP_1200x1200.webm", w: 1200, h: 1200, dur: 3033 },
  explosao_arcana: { type: "area", file: "BLFX/05-spell/homebrew/impact/Explosion_2_Radial_PURPLE_1200x1200.webm", w: 1200, h: 1200, dur: 1000 },
  explosao_sangue: { type: "area", file: "BLFX/05-spell/homebrew/shock/Blood_1_Splatter_1_1200x1200.webm", w: 1200, h: 1200, dur: 1867 },
  cratera: { type: "area", file: "BLFX/05-spell/homebrew/shock/Hole_1_Dust_1_1200x1200.webm", w: 1200, h: 1200, dur: 3033 },
  sinalizador: { type: "area", file: "BLFX/08-misc/flare/Flare_1_RED_1_1200x1200.webm", w: 1200, h: 1200, dur: 1000 },
  laminas_mecanicas: { type: "area", file: "BLFX/07-steampunk/clock/Clockwork_Blades_1_1200x1200.webm", w: 1200, h: 1200, dur: 2042 },
  mao_arcana: { type: "target", file: "BLFX/05-spell/homebrew/arcane/arm/Hand_1_Push_1_BLUE_1200x1200.webm", w: 1200, h: 1200, dur: 1700, size: 2.2 },
  moeda: { type: "target", file: "BLFX/02-equipment/coin/Coin_1_Flip_Front_GOLD_1200x1200.webm", w: 1200, h: 1200, dur: 5033, size: 3 },
  escudo_fogo: { type: "self", file: "BLFX/05-spell/homebrew/fire/FlameShield_1_ORANGE_LOOP_1200x1200.webm", w: 1200, h: 1200, dur: 633, size: 2.4 },
  engrenagens: { type: "self", file: "BLFX/07-steampunk/clock/Clockwork_Gears_1_1200x1200.webm", w: 1200, h: 1200, dur: 2042, size: 2.4 },
  corrente_puxao: { type: "line", file: "BLFX/02-equipment/chain/Chain_1_Line_1_METAL_1200x100.webm", w: 1020, h: 85, dur: 4000, ox: 0, span: 1020 },
  fenda_linha: { type: "line", file: "BLFX/05-spell/homebrew/shock/Crack_1_LINE_1_ORANGE_1200x800.webm", w: 1200, h: 800, dur: 4033, ox: 0, span: 1200 },
  muro_fogo: { type: "line", file: "BLFX/05-spell/level4/wallOfFire/Firewall_1_CARTOON_ORANGE_LOOP_1200x600.webm", w: 1200, h: 600, dur: 2800, ox: 0, span: 1200 },
};
Object.assign(LIB, Object.fromEntries(Object.entries(ABIL_LIB).map(([k, v]) => [`hab_${k}`, v])));
// visuais que já existiam no Arsenal
const ALIAS = { bala: "bullet", flecha: "arrow", raio_gelo: "frost", esfera: "plasma", arremesso: "flask" };
export const VISUAIS = [...Object.keys(ABIL_LIB), ...Object.keys(ALIAS)].sort();
const libKey = (vis) => (ALIAS[vis] ? ALIAS[vis] : ABIL_LIB[vis] ? `hab_${vis}` : customs.get(vis) || null);
export const abilFiles = () => [...new Set(Object.values(ABIL_LIB).flatMap((a) => (a.v ? Object.values(a.v).map((x) => x.file) : [a.file])))].sort();

// ---------------- efeitos próprios do mestre ----------------
// 1) Arquivos .webm no repositório: extensoes/arsenal/public/meus-efeitos/<tipo>/<nome>.webm -> visual "meu_<nome>"
//    (o build gera meus-efeitos/lista.json). 2) Link direto para um .webm, guardado na habilidade: { video: { url, tipo } }.
// Largura, altura e duração vêm do próprio vídeo no navegador (setDims), antes de tocar.
export const MEUS_LISTA = "meus-efeitos/lista.json";
const TIPO = { alvo: "target", area: "area", "em-si": "self", projetil: "ranged", linha: "line", cone: "cone" };
export const TIPOS_PROPRIOS = [["alvo", "no alvo"], ["area", "área"], ["em-si", "em si"], ["projetil", "projétil"], ["linha", "linha"], ["cone", "cone"]];
const customs = new Map(); // nome "meu_x" -> chave no LIB
const safeDecode = (u) => { try { return decodeURI(u); } catch { return u; } };
function customAsset(type, file) {
  if (type === "ranged") return { type, hit: 0.7, custom: true, v: { 30: { file, w: 0, h: 0, dur: 0 } } };
  const a = { type, file, w: 0, h: 0, dur: 0, custom: true };
  if (type === "line" || type === "cone") Object.assign(a, { ox: 0, span: 0 });
  if (type === "target") a.size = 1.6;
  if (type === "self") a.size = 2;
  return a;
}
/** Nome do visual a partir do nome do arquivo: "Chuva de Cinzas.webm" -> "meu_chuva_de_cinzas". */
export const meuNome = (arquivo) => "meu_" + String(arquivo).replace(/\.[^.]+$/, "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
/** Registra a lista do repositório: [{ nome, tipo, file }] (file relativo ao site da extensão). */
export function registerMeus(list) {
  for (const e of list || []) {
    if (!TIPO[e?.tipo] || !/^meu_[a-z0-9_]+$/.test(e?.nome || "") || !e.file) continue;
    const k = `meu:${e.nome}`;
    if (!LIB[k]) LIB[k] = customAsset(TIPO[e.tipo], `../${e.file}`);
    customs.set(e.nome, k);
  }
}
export const meusVisuais = () => [...customs.keys()].sort();
/** Chave de um link próprio (registra na primeira vez). */
export function registerLink(url, tipo) {
  if (!/^https?:\/\/\S+$/i.test(url || "") || !TIPO[tipo]) return null;
  const k = `url:${tipo}:${url}`;
  if (!LIB[k]) LIB[k] = customAsset(TIPO[tipo], safeDecode(url));
  return k;
}
/** Chave do vídeo de uma habilidade: o link próprio vence o visual. */
export const keyOf = (h) => (h?.video?.url ? registerLink(h.video.url, h.video.tipo) : libKey(h?.visual));
const dimsOf = (a) => (a?.v ? a.v[30] : a);
export const fileOfKey = (k) => dimsOf(LIB[k])?.file || null;
/** Vídeos próprios que ainda não têm tamanho/duração (a habilidade e os ataques de "faz"). */
export const pendingKeys = (ab, subs) => [...new Set([ab, ...Object.values(subs || {})].map(keyOf).filter((k) => k && LIB[k]?.custom && !dimsOf(LIB[k]).w))];
/** Tamanho e duração lidos do vídeo. */
export function setDims(k, { w, h, dur }) {
  const a = LIB[k];
  if (!a?.custom || !(w > 0) || !(h > 0)) return;
  Object.assign(dimsOf(a), { w, h, dur: dur > 0 ? dur : 3000 });
  if (a.type === "line" || a.type === "cone") a.span = w;
}
/** Troca o link próprio de uma habilidade (null = tira). Devolve o dossiê novo. */
export function setVideo(dossie, nome, video) {
  if (video && (!/^https?:\/\/\S+$/i.test(video.url || "") || !TIPO[video.tipo])) throw new Error("o link precisa começar com http(s):// e o tipo precisa ser alvo, área, em si, projétil, linha ou cone.");
  return {
    ...dossie,
    habilidades: dossie.habilidades.map((h) => {
      if (h.nome !== nome) return h;
      const n = { ...h };
      if (video) n.video = { url: video.url.trim(), tipo: video.tipo }; else delete n.video;
      return n;
    }),
  };
}

const GRUPOS = [["target", "No alvo"], ["melee", "Corpo a corpo"], ["ranged", "Projétil e raio"], ["cone", "Cone"], ["line", "Linha"], ["area", "Área"], ["self", "Em si"], ["move", "Movimento"]];
/** Visuais por grupo, para o seletor e a lista do painel: [[título, [visual...]]] */
export const visualGroups = () => [...GRUPOS.map(([t, title]) => [title, VISUAIS.filter((v) => LIB[libKey(v)]?.type === t)]), ["Meus efeitos", meusVisuais()]].filter(([, l]) => l.length);
/** Arquivo de vídeo da prévia no painel (projéteis: a versão de 30 ft). */
export function previewFile(vis) {
  const a = LIB[libKey(vis)];
  if (!a) return null;
  return a.v ? (a.v[30] || Object.values(a.v)[0]).file : a.file;
}
/** Troca o visual de uma habilidade ("" = sem vídeo). Devolve o dossiê novo. */
export function setVisual(dossie, nome, vis) {
  if (vis && !libKey(vis)) throw new Error(`visual "${vis}" não existe.`);
  return {
    ...dossie,
    habilidades: dossie.habilidades.map((h) => {
      if (h.nome !== nome) return h;
      const n = { ...h };
      if (vis) n.visual = vis; else delete n.visual;
      return n;
    }),
  };
}

// ---------------- dossiê ----------------
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const txt = (v) => (v == null ? "" : String(v).trim());
const sem = (s) => txt(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Tira o JSON de um texto colado (aceita o bloco ```json ... ``` inteiro). */
export function extractJson(raw) {
  const s = String(raw || "");
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fence ? fence[1] : s;
  const a = body.indexOf("{"), b = body.lastIndexOf("}");
  if (a < 0 || b < a) throw new Error("não achei um JSON (procure o bloco que começa com { \"dossie\": 1 ...).");
  return JSON.parse(body.slice(a, b + 1));
}

/** Confere e normaliza o dossiê. Devolve { dossie, avisos }. Lança erro se não der para usar. */
export function normalize(input) {
  const d = typeof input === "string" ? extractJson(input) : input;
  if (!d || !Array.isArray(d.habilidades)) throw new Error("o dossiê não tem a lista \"habilidades\".");
  const avisos = [];
  const habs = d.habilidades.map((h, i) => {
    const nome = txt(h.nome) || `Habilidade ${i + 1}`;
    let secao = sem(h.secao).replace("acao bonus", "bonus").replace("acoes", "acao");
    if (!SECOES.some(([k]) => k === secao)) { if (h.secao) avisos.push(`${nome}: seção "${h.secao}" desconhecida (ficou em Ações).`); secao = "acao"; }
    let forma = sem(h.forma);
    if (!FORMAS.includes(forma)) { if (h.forma) avisos.push(`${nome}: forma "${h.forma}" desconhecida (ficou "alvo").`); forma = "alvo"; }
    let visual = sem(h.visual).replace(/\s+/g, "_");
    if (!libKey(visual)) { if (h.visual) avisos.push(`${nome}: visual "${h.visual}" não existe na lista (ficou sem vídeo).`); visual = ""; }
    const uso = sem(h.uso).replace(/\s+/g, " ") || "livre";
    const out = {
      nome, secao, uso, forma, visual,
      alcance: num(h.alcance), area: num(h.area), alvos: Math.max(0, Math.round(num(h.alvos, 1))),
      ataque: h.ataque == null || h.ataque === "" ? null : num(h.ataque),
      resistencia: txt(h.resistencia) || null, metade: !!h.metade,
      dano: txt(h.dano), cura: txt(h.cura), condicao: txt(h.condicao),
      impacto: ["sangue", "faiscas", "poeira"].includes(sem(h.impacto)) ? sem(h.impacto) : "nenhum",
      cor: sem(h.cor), texto: txt(h.texto),
    };
    if (Array.isArray(h.faz) && h.faz.length) out.faz = h.faz.map(txt);
    if (h.video?.url && registerLink(txt(h.video.url), sem(h.video.tipo).replace(/\s+/g, "-"))) out.video = { url: txt(h.video.url), tipo: sem(h.video.tipo).replace(/\s+/g, "-") };
    for (const k of Object.keys(out)) if (out[k] === "" || out[k] === null || out[k] === false) delete out[k];
    return out;
  });
  const nomes = new Set(habs.map((h) => h.nome));
  for (const h of habs) for (const f of h.faz || []) if (!nomes.has(f)) avisos.push(`${h.nome}: faz "${f}", que não está no dossiê.`);
  const dossie = {
    nome: txt(d.nome) || "NPC", nd: d.nd ?? null, ca: d.ca ?? null, pv: d.pv ?? null,
    lendarias: Math.max(0, Math.round(num(d.lendarias))), covil: txt(d.covil), habilidades: habs,
  };
  return { dossie, avisos };
}

/** Custo de uma ação lendária ("custo 2" -> 2; padrão 1). */
export const legCost = (h) => (h.secao === "lendaria" ? Math.max(1, num((h.uso.match(/custo\s*(\d+)/) || [])[1], 1)) : 0);
export const isRecharge = (h) => h.uso.startsWith("recarga");
export const isPerRest = (h) => /descanso|dia/.test(h.uso);

/** Estado de uso: pode usar agora? { ok, why } */
export function canUse(h, uso, dossie) {
  const u = uso || {};
  if (h.secao === "passiva") return { ok: true, why: "" };
  if ((isRecharge(h) || isPerRest(h)) && u.used?.[h.nome]) return { ok: false, why: isRecharge(h) ? `usada (${h.uso})` : "usada (volta no descanso)" };
  if (h.secao === "lendaria") {
    const left = (dossie.lendarias || 0) - (u.leg || 0);
    if (legCost(h) > left) return { ok: false, why: `faltam ações lendárias (${left}/${dossie.lendarias})` };
  }
  return { ok: true, why: "" };
}

/** Marca o uso. Devolve { uso, aviso }. */
export function markUse(h, uso, dossie) {
  const u = { used: { ...(uso?.used || {}) }, leg: uso?.leg || 0, covil: uso?.covil || "" };
  let aviso = "";
  if (isRecharge(h) || isPerRest(h)) u.used[h.nome] = true;
  if (h.secao === "lendaria") u.leg = Math.min(dossie.lendarias || 0, u.leg + legCost(h));
  if (h.secao === "covil") { if (u.covil === h.nome) aviso = `${h.nome} foi a ação de covil da rodada passada (não pode repetir).`; u.covil = h.nome; }
  return { uso: u, aviso };
}
export const recharge = (h, uso) => { const u = { ...(uso || {}), used: { ...(uso?.used || {}) } }; delete u.used[h.nome]; return u; };
export const newRound = (uso) => ({ ...(uso || {}), leg: 0 });
export const rest = (uso) => ({ used: {}, leg: 0, covil: uso?.covil || "" });

/** Linha de números para o painel (o mestre rola na mão). */
export function numbers(h) {
  const parts = [];
  if (h.ataque != null) parts.push(`${h.ataque >= 0 ? "+" : ""}${h.ataque} para acertar`);
  if (h.resistencia) parts.push(`resistência ${h.resistencia}${h.metade ? " (metade no sucesso)" : ""}`);
  if (h.dano) parts.push(h.dano);
  if (h.cura) parts.push(`cura ${h.cura}`);
  if (h.condicao) parts.push(h.condicao);
  return parts.join(" · ");
}
export function shapeText(h) {
  const m = (v) => `${String(v).replace(".", ",")} m`;
  return {
    alvo: `${h.alvos > 1 ? `até ${h.alvos} alvos` : "1 alvo"}${h.alcance ? `, ${m(h.alcance)}` : ""}`,
    cone: `cone de ${m(h.area)}`, linha: `linha de ${m(h.area)}`, area: `raio ${m(h.area)}${h.alcance ? ` a até ${m(h.alcance)}` : ""}`,
    aura: `${m(h.area)} em volta`, si: "em si", movimento: `move até ${m(h.alcance)}`,
  }[h.forma];
}

// ---------------- geometria (px; cell = px por quadrado; mpc = metros por quadrado) ----------------
const cellsOf = (meters, mpc) => Math.max(0.25, meters / (mpc || 1.5));

/** Polígono da área (para a prévia e para saber quem está dentro). */
export function shapeOf(h, from, aim, cell, mpc, selfHalf = 0) {
  const L = cellsOf(h.area, mpc) * cell;
  if (h.forma === "cone" || h.forma === "linha") {
    const to = aim?.point || V.add(from, { x: L, y: 0 });
    const dir = V.norm(V.sub(to, from));
    const p = V.perp(dir);
    const a = V.add(from, V.mul(dir, selfHalf));
    if (h.forma === "cone") return { kind: "poly", pts: [a, V.add(V.add(a, V.mul(dir, L)), V.mul(p, L / 2)), V.add(V.add(a, V.mul(dir, L)), V.mul(p, -L / 2))], dir, from: a, len: L };
    const w = cell / 2;
    return { kind: "poly", pts: [V.add(a, V.mul(p, w)), V.add(V.add(a, V.mul(dir, L)), V.mul(p, w)), V.add(V.add(a, V.mul(dir, L)), V.mul(p, -w)), V.add(a, V.mul(p, -w))], dir, from: a, len: L };
  }
  if (h.forma === "area") return { kind: "circle", c: aim?.point || from, r: L };
  if (h.forma === "aura") return { kind: "circle", c: from, r: L + selfHalf };
  return null;
}

function inPoly(p, pts) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}
/** Tokens dentro da área: o centro, ou um ponto a meio caminho da borda do token, dentro. tokens: [{ id, at, half }] */
export function caughtIn(shape, tokens, exclude = []) {
  if (!shape) return [];
  return tokens.filter((t) => !exclude.includes(t.id)).filter((t) => {
    const k = t.half * 0.5;
    const pts = [t.at, { x: t.at.x + k, y: t.at.y }, { x: t.at.x - k, y: t.at.y }, { x: t.at.x, y: t.at.y + k }, { x: t.at.x, y: t.at.y - k }];
    if (shape.kind === "circle") return pts.some((p) => Math.hypot(p.x - shape.c.x, p.y - shape.c.y) <= shape.r);
    return pts.some((p) => inPoly(p, shape.pts));
  }).map((t) => t.id);
}

// ---------------- animação ----------------
const ang = (d) => (Math.atan2(d.y, d.x) * 180) / Math.PI;
const IMPACT = { sangue: "blood", faiscas: "sparkO", poeira: "dust1" };

/** Contorno da área piscando (todos veem onde pegou). */
function outline(shape, color, t0 = 0, life = 1.6) {
  const el = { kind: shape.kind === "circle" ? "circle" : "path", t0, t1: t0 + life, tag: "area" };
  el.frame = (t) => {
    const u = Math.min(1, Math.max(0, (t - t0) / life));
    const op = 0.5 * (1 - u);
    return shape.kind === "circle"
      ? { c: shape.c, r: shape.r, fill: color, fillOpacity: op * 0.4, stroke: color, strokeOpacity: op + 0.2, strokeWidth: 4 }
      : { pts: shape.pts, closed: true, fill: color, fillOpacity: op * 0.4, stroke: color, strokeOpacity: op + 0.2, strokeWidth: 4 };
  };
  return el;
}
const COLOR = { vermelho: "#e0453a", laranja: "#ff8a1f", amarelo: "#f5d742", verde: "#7bd23a", azul: "#4fa8ff", roxo: "#a36bff", branco: "#e8eef5", preto: "#555b66" };

/**
 * Coreografia de uma habilidade. ev = { ab, from, aim: { targets: [{ id, at, half }], point }, cell, mpc, selfHalf }.
 * has(file) = o vídeo está disponível. Devolve { elements, videos, duration }.
 */
export function buildAbility(ev, has = () => true, byName = null) {
  const { ab, from, aim = {}, cell = 150, mpc = 1.5, selfHalf = cell / 2 } = ev;
  const vids = [], els = [];
  const color = COLOR[ab.cor] || "#ff5a4a";
  const key = keyOf(ab);
  const asset = key ? LIB[key] : null;
  const targets = aim.targets || [];
  const impact = (t, at, dir) => { const k = IMPACT[ab.impacto]; if (k) vids.push(pointVideo(k, at, k === "blood" ? 1.7 : 1.2, t, cell, k === "sparkO" ? null : dir)); };

  const one = (a, t0, tgList) => {
    const A = a ? LIB[keyOf(a)] : null;
    if (!A) return 0;
    let end = t0;
    for (const tg of tgList) {
      const dir = V.norm(V.sub(tg.at, from));
      if (A.type === "ranged") {
        const v = rangedVideo(keyOf(a), V.add(from, V.mul(dir, cell * 0.3)), tg.at, cell, t0);
        vids.push(v); impact(v.hitAt, tg.at, dir); end = Math.max(end, v.t0 + v.dur);
      } else if (A.type === "melee") {
        const anchor = V.sub(tg.at, V.mul(dir, cell));
        vids.push({ file: A.file, w: A.w, h: A.h, dpi: A.span, offset: { x: A.ox, y: A.h / 2 }, position: anchor, rotation: ang(dir), t0, dur: A.dur / 1000 });
        impact(t0 + (A.dur / 1000) * 0.35, tg.at, dir); end = Math.max(end, t0 + A.dur / 1000);
      } else {
        const size = (A.size || 1.4) * Math.max(1, (tg.half * 2) / cell);
        const pv = pointVideo(keyOf(a), tg.at, size, t0, cell, A.side ? dir : null);
        if (A.side) pv.offset = { x: A.w * A.side, y: A.h / 2 }; // jorro de sangue: sai do alvo na direção do golpe
        vids.push(pv);
        impact(t0 + 0.3, tg.at, dir); end = Math.max(end, t0 + A.dur / 1000);
      }
    }
    return end;
  };

  if (ab.forma === "alvo") {
    if (ab.faz?.length && byName) {
      // Ataque Múltiplo: cada ataque de "faz" em sequência, nos alvos marcados (repete o último se faltarem alvos)
      let t = 0;
      ab.faz.forEach((n, i) => {
        const sub = byName(n) || ab;
        const tg = targets[Math.min(i, targets.length - 1)];
        if (tg) t = one(sub, t, [tg]) * 0.55 + 0.15;
      });
    } else one(ab, 0, targets);
  } else if (ab.forma === "cone" || ab.forma === "linha" || ab.forma === "area" || ab.forma === "aura") {
    const shape = shapeOf(ab, from, aim, cell, mpc, selfHalf);
    if (shape) els.push(outline(shape, color, 0.1));
    if (asset && shape) {
      if ((asset.type === "cone" || asset.type === "line") && shape.kind === "poly") {
        vids.push({ file: asset.file, w: asset.w, h: asset.h, dpi: asset.span / (shape.len / cell), offset: { x: asset.ox, y: asset.h / 2 }, position: shape.from, rotation: ang(shape.dir), t0: 0, dur: asset.dur / 1000 });
      } else if (asset.type === "ranged" && shape.kind === "poly") {
        vids.push(rangedVideo(key, shape.from, V.add(shape.from, V.mul(shape.dir, shape.len)), cell, 0));
      } else {
        const c = shape.kind === "circle" ? shape.c : V.add(shape.from, V.mul(shape.dir, shape.len / 2));
        const diam = shape.kind === "circle" ? (shape.r * 2) / cell : shape.len / cell;
        if (asset.type === "ranged") vids.push(rangedVideo(key, from, c, cell, 0));
        else vids.push(pointVideo(key, c, Math.max(1, diam), asset.type === "ranged" ? 0.5 : 0, cell));
      }
    }
  } else if (ab.forma === "si") {
    if (asset) vids.push(pointVideo(key, from, (asset.size || 1.6) * Math.max(1, (selfHalf * 2) / cell), 0, cell));
  } else if (ab.forma === "movimento") {
    const to = aim.point || from;
    const d = V.sub(to, from), len = V.len(d), dir = V.norm(d);
    if (ab.visual === "rastro" && asset) {
      const n = Math.max(1, Math.floor(len / (cell * 0.7)));
      for (let i = 0; i <= n; i++) vids.push({ ...pointVideo(key, V.add(from, V.mul(dir, (len * i) / n)), 0.6, i * 0.08, cell), rotation: ang(dir) + 90 });
    } else if (asset) {
      if (ab.visual === "investida") vids.push({ ...pointVideo(key, V.add(from, V.mul(d, 0.5)), Math.max(1.5, len / cell), 0, cell), rotation: ang(dir) });
      else vids.push(pointVideo(key, from, 1.8, 0, cell));
      vids.push(pointVideo("puff", to, 1.8, 0.35, cell));
    }
    els.push({ kind: "line", t0: 0, t1: 1.2, tag: "move", frame: (t) => ({ a: from, b: to, color, width: Math.max(2, cell / 30), opacity: 0.8 * (1 - t / 1.2) }) });
  }
  // vídeos próprios (link ou pasta meus-efeitos) não estão no ok.json; só tocam depois de ter tamanho e duração
  const ok = has ? vids.filter((v) => v.w > 0 && v.dur > 0 && (has(v.file) || /^(https?:|\.\.\/)/.test(v.file))) : []; // has = null: vídeos desligados
  const duration = Math.max(0.5, ...els.map((e) => e.t1), ...ok.map((v) => v.t0 + v.dur));
  return { elements: els, videos: ok, duration };
}
