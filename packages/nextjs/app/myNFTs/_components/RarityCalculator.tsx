import React, { useEffect } from 'react';

// 更新 Attribute 类型：value 可以是 string 或 number
interface Attribute {
  trait_type: string;
  value: string | number;
}

const rarityScores = {
  backgroundColor: {
    green: 5,
    blue: 4,
    pink: 7,
    black: 8,
    orange: 6,
  },
  eyes: {
    googly: 10,
    normal: 5,
  },
  stamina: {
    6: 1,
    15: 3,
    22: 5,
    38: 7,
    42: 8,
    99: 10,
  },
};

const attributeWeights = {
  backgroundColor: 0.3,
  eyes: 0.2,
  stamina: 0.5,
};

// 根据稀有度分数返回等级
const getRarityLevel = (score: number) => {
  if (score >= 9) return "传奇";
  if (score >= 8) return "史诗";
  if (score >= 6) return "稀有";
  return "普通";
};

// 修改 calculateRarityScore 函数，确保属性值为 string 或 number 类型都能正确处理
const calculateRarityScore = (attributes: Attribute[]) => {
  const backgroundColorAttr = attributes.find(attr => attr.trait_type === "BackgroundColor");
  const eyesAttr = attributes.find(attr => attr.trait_type === "Eyes");
  const staminaAttr = attributes.find(attr => attr.trait_type === "Stamina");

  // 确保 backgroundColorScore 为数字类型，若找不到则使用 0
  const backgroundColorValue = String(backgroundColorAttr?.value);  // 强制转换为字符串类型
  const eyesValue = String(eyesAttr?.value);  // 强制转换为字符串类型
  const staminaValue = Number(staminaAttr?.value);  // 强制转换为数字类型

  // 使用类型断言告知 TypeScript 对象的键值类型
  const backgroundColorScore = rarityScores.backgroundColor[backgroundColorValue as keyof typeof rarityScores.backgroundColor] || 0;
  const eyesScore = rarityScores.eyes[eyesValue as keyof typeof rarityScores.eyes] || 0;
  const staminaScore = rarityScores.stamina[staminaValue as keyof typeof rarityScores.stamina] || 0;

  // 计算总分
  const totalScore =
    (backgroundColorScore * attributeWeights.backgroundColor) +
    (eyesScore * attributeWeights.eyes) +
    (staminaScore * attributeWeights.stamina);

  return totalScore;
};

interface RarityCalculatorProps {
  attributes: Attribute[];
  onCalculateRarity: (score: number, level: string) => void;  // 更新回调，返回分数和等级
}

const RarityCalculator: React.FC<RarityCalculatorProps> = ({ attributes, onCalculateRarity }) => {
  useEffect(() => {
    const score = calculateRarityScore(attributes);  // 自动计算稀有度分数
    const level = getRarityLevel(score);  // 根据分数计算等级
    onCalculateRarity(score, level);  // 将分数和等级返回给父组件
  }, [attributes, onCalculateRarity]);

  return null;  // 无需显示任何内容，只做计算
};

export default RarityCalculator;
