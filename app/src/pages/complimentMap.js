// 6项面部分析维度的夸赞话术映射
// 字段名对应 analyze.ts report 中的 key，兜底句覆盖未枚举值
// 注意：key 必须与 analyze.ts defaults 和 DeepSeek prompt 输出完全一致

// 脸型 — analyze.ts enum: 鹅蛋脸, 圆脸, 方脸, 长脸, 心形脸, 菱形脸, 梨形脸
export const faceShapeCompliments = {
  '鹅蛋脸': '最显气质的脸型之一',
  '圆脸': '自带亲和力，减龄感拉满',
  '方脸': '轮廓分明，气场感十足',
  '长脸': '纵向比例优越，显成熟知性',
  '心形脸': '上庭饱满，自带甜美氛围',
  '菱形脸': '骨相立体，很适合高级妆造',
  '梨形脸': '下颌线条柔和，气质温婉',
};

// 肤质 — analyze.ts enum: 干性, 油性, 混合肌, 中性, 敏感肌
export const skinTypeCompliments = {
  '干性': '水光肌的养成潜力股',
  '油性': '出油旺盛，更抗老呢',
  '混合肌': 'T区与U区分布均匀，很好打理',
  '中性': '标准好肤质，基础护理就能保持',
  '敏感肌': '皮肤屏障细腻，选对护肤品很省心',
};

// 眉形 — analyze.ts enum: 一字眉, 柳叶眉, 剑眉, 弯眉, 平眉, 粗眉, 细眉
export const eyebrowShapeCompliments = {
  '一字眉': '干净利落，自带少年感',
  '柳叶眉': '温柔又古典，很有东方韵味',
  '剑眉': '英气十足，气场两米八',
  '弯眉': '柔和自然，显年轻显温柔',
  '平眉': '减龄又甜美，韩系气质满满',
  '粗眉': '毛流感强，五官更有存在感',
  '细眉': '精致秀气，复古优雅',
};

// 眼型 — analyze.ts enum: 杏眼, 丹凤眼, 圆眼, 桃花眼, 狐狸眼, 下垂眼, 深邃眼
export const eyeShapeCompliments = {
  '杏眼': '眼睛圆润有神，像颗熟透的杏子',
  '桃花眼': '眼尾微翘，眼神自带故事感',
  '丹凤眼': '东方经典眼型，极具辨识度',
  '圆眼': '眼睛圆圆亮亮，显得很灵动',
  '狐狸眼': '眼型妩媚，自带迷人魅惑感',
  '下垂眼': '无辜感满满，显得温柔又治愈',
  '深邃眼': '轮廓立体，适合浓妆也能驾驭淡妆',
};

// 三庭五眼 — analyze.ts enum: 比例均衡型, 上庭偏长型, 中庭偏长型, 下庭偏长型, 五眼偏宽型, 五眼偏窄型
export const threeFiveRatioCompliments = {
  '比例均衡型': '三庭五眼比例均衡，很上镜',
  '上庭偏长型': '额头饱满，显聪慧气质',
  '中庭偏长型': '中庭舒展，显成熟稳重',
  '下庭偏长型': '下巴线条好看，显精致',
  '五眼偏宽型': '眼距适中，表情灵动有亲和力',
  '五眼偏窄型': '五官紧凑，精致耐看',
};

// 五官对称度 — analyze.ts enum: 高对称度, 中等对称度, 自然不对称（带个性）
export const symmetryCompliments = {
  '高对称度': '五官端正，平衡感非常好',
  '中等对称度': '整体匀称，是很耐看的脸型',
  '自然不对称（带个性）': '左右各有特色，生动自然有个人风格',
};

// 兜底通用夸赞，适用于所有未枚举的未知值
export const DEFAULT_COMPLIMENT = '很有辨识度的一项特征';

// 6项维度顺序（与 RESULT_ITEMS 一致）
const COMPLIMENT_MAPS = [
  faceShapeCompliments,
  skinTypeCompliments,
  eyebrowShapeCompliments,
  eyeShapeCompliments,
  threeFiveRatioCompliments,
  symmetryCompliments,
];

const COMPLIMENT_KEYS = [
  'faceShape',
  'skinType',
  'eyebrowShape',
  'eyeShape',
  'threeFiveRatio',
  'symmetry',
];

// 统一查询入口：传 key 和结论值，返回夸赞短句
// 未命中时返回兜底句，不报错不留空
export function getCompliment(key, value) {
  const idx = COMPLIMENT_KEYS.indexOf(key);
  if (idx === -1) return DEFAULT_COMPLIMENT;
  const map = COMPLIMENT_MAPS[idx];
  return map?.[value] ?? DEFAULT_COMPLIMENT;
}