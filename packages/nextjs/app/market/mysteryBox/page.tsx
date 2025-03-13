"use client";

import { useState, useEffect } from "react";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { MysteryBoxCard } from "./components/MysteryBoxCard"; // 引入盲盒卡片组件

const MysteryBoxPage = () => {
  const { data: allBoxesData, error: allBoxesError } = useScaffoldReadContract({
    contractName: "YourCollectible", // 使用 YourCollectible 合约
    functionName: "getAllBoxesInfo", // 获取所有盲盒信息的方法
    watch: true,
  });

  const [boxes, setBoxes] = useState<any[]>([]); // 存储盲盒信息
  const [loading, setLoading] = useState<boolean>(true); // 加载状态
  const [error, setError] = useState<string>(""); // 错误信息

  // 错误处理
  useEffect(() => {
    if (allBoxesError) {
      console.error("Error fetching boxes:", allBoxesError);
      setError("加载盲盒信息失败，请稍后重试");
      setLoading(false);
    }
  }, [allBoxesError]);

  // 数据处理
  useEffect(() => {
    if (allBoxesData) {
      const validBoxes = (allBoxesData as Array<{
        boxId: bigint;
        price: bigint;
        owner: string;
        tokenIds: readonly bigint[];
        isPurchased: boolean;
      }> )
        .filter((box) => box.boxId && box.price && box.tokenIds && Array.isArray(box.tokenIds) && !box.isPurchased) // 过滤掉已购买的盲盒
        .map((box) => ({
          boxId: box.boxId.toString(), // 转换为字符串
          price: BigInt(box.price), // 转换为数字
          owner: box.owner,
          tokenIds: box.tokenIds.map((tokenId) => tokenId.toString()),
          isPurchased: box.isPurchased,
        }));

      setBoxes(validBoxes);
      setLoading(false);
    }
  }, [allBoxesData]);

  // 加载中状态
  if (loading) {
    return <div>加载盲盒数据...</div>;
  }

  return (
    <div className="flex justify-center items-center min-h-screen p-4">
      {/* 使用 Flexbox 实现横向排列 */}
      <div className="flex flex-wrap justify-center gap-4">
        {error && <div className="text-error">{error}</div>}
        {boxes.length > 0 ? (
          boxes.map((box) => (
            <MysteryBoxCard key={box.boxId} box={box} />
          ))
        ) : (
          <div>没有盲盒可供展示</div>
        )}
      </div>
    </div>
  );
};

export default MysteryBoxPage;
