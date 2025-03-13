"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";
import { formatEther } from "viem";

const MyRoyaltyEarnings = () => {
  const { address: connectedAddress, isConnected, isConnecting } = useAccount();
  const [royaltyEarnings, setRoyaltyEarnings] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 使用 useScaffoldReadContract Hook
  const { data: earnings, error } = useScaffoldReadContract({
    contractName: "YourCollectible",
    functionName: "checkRoyaltyEarnings",
    args: [connectedAddress], // 传入当前地址
    watch: true, // 如果需要实时更新可以设为 true
  });

  useEffect(() => {
    const fetchRoyaltyEarnings = async () => {
      if (!connectedAddress) return;

      setLoading(true);
      try {
        console.log("Fetching royalty earnings for address:", connectedAddress);
        
        // 检查 earnings 是否可用
        if (earnings !== undefined) {
          console.log("Earnings fetched from contract:", earnings);

          // 使用 formatEther 将获取的收益从 wei 转换为 ETH
          const earningsInEth = formatEther(BigInt(earnings)); // 确保传入的是 BigInt
          console.log("Earnings in ETH:", earningsInEth);

          setRoyaltyEarnings(earningsInEth);
        } else {
          console.warn("No earnings data returned from the contract.");
          setRoyaltyEarnings(null); // 如果没有收益，则将其设置为 null
        }
      } catch (error) {
        console.error("Error fetching royalty earnings:", error);
        notification.error("Error fetching royalty earnings.");
      } finally {
        setLoading(false);
      }
    };

    if (isConnected) {
      fetchRoyaltyEarnings();
    }
  }, [isConnected, connectedAddress, earnings]); // 添加 earnings 作为依赖项

  return (
    <div className="flex flex-col items-center pt-10">
      <h1 className="text-2xl font-bold mb-4">My Royalty Earnings</h1>
      <div className="flex justify-center">
        {!isConnected || isConnecting ? (
          <RainbowKitCustomConnectButton />
        ) : loading ? (
          <span className="loading loading-spinner loading-lg"></span>
        ) : (
          <div className="text-xl">
            {royaltyEarnings !== null ? (
              <span>Your Royalty Earnings: {royaltyEarnings} ETH</span>
            ) : (
              <span>No earnings available.</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyRoyaltyEarnings;
