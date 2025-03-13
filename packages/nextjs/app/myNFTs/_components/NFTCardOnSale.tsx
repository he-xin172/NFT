import { useState, useEffect } from "react";
import { OnSaleCollectible } from "../../market/buy/page";
import { Address } from "~~/components/scaffold-eth";
import { useScaffoldWriteContract, useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { parseEther, formatEther } from "viem"; // 确保引入了formatEther

export const NFTCardOnSale = ({ nft }: { nft: OnSaleCollectible }) => {
  const { writeContractAsync } = useScaffoldWriteContract("YourCollectible");
  const priceInWei = parseEther(nft.price.toString());

  interface Trade {
    seller: `0x${string}`;
    buyer: `0x${string}`;
    price: bigint;
    timestamp: bigint;
  }

  const [tradeHistory, setTradeHistory] = useState<Trade[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isFavorite, setIsFavorite] = useState<boolean>(false); // 本地状态存储收藏状态
  const [isReporting, setIsReporting] = useState(false); // 举报状态
  const [reportReason, setReportReason] = useState(""); // 举报原因

  const { data: tradeHistoryData } = useScaffoldReadContract({
    contractName: "YourCollectible",
    functionName: "getTradeHistory",
    args: [BigInt(nft.tokenId)],
    watch: true,
  });

  // 获取NFT的收藏状态
  const { data: contractIsFavorite, isLoading: isFavoriteLoading } = useScaffoldReadContract({
    contractName: "YourCollectible",
    functionName: "isFavorite",
    args: [BigInt(nft.tokenId)],
    watch: true,
  });

  useEffect(() => {
    // 如果合约返回的收藏状态有效，更新本地状态
    if (contractIsFavorite !== undefined) {
      setIsFavorite(contractIsFavorite);
    }
  }, [contractIsFavorite]);

  useEffect(() => {
    if (showHistory && tradeHistoryData) {
      setTradeHistory([...(tradeHistoryData as Trade[])]);
      setLoadingHistory(false);
    }
  }, [showHistory, tradeHistoryData]);

  // 发送请求到后端添加收藏
  const addToFavorites = async () => {
    try {
      const response = await fetch("http://localhost:3001/addToFavorites", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userAddress: nft.seller, 
          nftTokenId: nft.tokenId,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setIsFavorite(true); // 更新本地状态为已收藏
        alert("添加收藏成功！");
      } else {
        alert(`添加收藏失败: ${data.error || "未知错误"}`);
      }
    } catch (error) {
      console.error("Error adding to favorites:", error);
      alert("添加收藏失败，请重试！");
    }
  };

  // 发送请求到后端移除收藏
  const removeFromFavorites = async () => {
    try {
      const response = await fetch("http://localhost:3001/removeFromFavorites", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userAddress: nft.seller, 
          nftTokenId: nft.tokenId,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setIsFavorite(false); // 更新本地状态为未收藏
        alert("移除收藏成功！");
      } else {
        alert(`移除收藏失败: ${data.error || "未知错误"}`);
      }
    } catch (error) {
      console.error("Error removing from favorites:", error);
      alert("移除收藏失败，请重试！");
    }
  };

  // 切换收藏状态
  const toggleFavorite = () => {
    if (isFavorite) {
      removeFromFavorites(); // 如果已收藏，调用移除收藏的API
    } else {
      addToFavorites(); // 如果未收藏，调用添加收藏的API
    }
  };

  // 举报NFT
  const reportNFT = async () => {
    if (!reportReason.trim()) {
      alert("请填写举报原因！");
      return;
    }

    setIsReporting(true);
    try {
      const response = await fetch("http://localhost:3001/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userAddress: nft.seller, 
          nftTokenId: nft.tokenId,
          reason: reportReason,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        alert("举报成功！感谢您的反馈！");
      } else {
        alert(`举报失败: ${data.error || "未知错误"}`);
      }

      setIsReporting(false);
    } catch (err) {
      console.error("Error reporting NFT:", err);
      alert("举报失败，请重试！");
      setIsReporting(false);
    }
  };

  return (
    <div className="flex flex-row space-x-4 p-4">
      {/* 左侧NFT卡片 */}
      <div className="card bg-base-100 shadow-lg w-[300px] shadow-secondary">
        <figure className="relative">
          <img
            src={nft.image}
            alt="NFT Image"
            className="h-60 w-full object-cover"
            onError={() => console.error("Failed to load image:", nft.image)}
          />
          <figcaption className="glass absolute bottom-4 left-4 p-4 w-25 rounded-xl">
            <span className="text-white"># {nft.tokenId}</span>
          </figcaption>
        </figure>
        <div className="card-body space-y-3">
          <div className="text-center">
            <p className="text-2xl font-semibold">{nft.name}</p>
            <div className="flex flex-wrap justify-center space-x-2 mt-1">
              {nft.attributes?.map((attr, index) => (
                <span key={index} className="badge badge-primary py-3">
                  {attr.value}
                </span>
              ))}
            </div>
          </div>
          <p className="text-center text-lg">{nft.description}</p>
          <div className="flex space-x-3 items-center justify-center">
            <span className="text-lg font-semibold">Owner:</span>
            <Address address={nft.seller as `0x${string}`} />
          </div>
          <div className="text-center text-lg font-semibold">Price: {nft.price} ETH</div>
          <div className="card-actions justify-center">
            <button
              className="btn btn-secondary btn-md px-8 tracking-wide"
              onClick={() => {
                try {
                  writeContractAsync({
                    functionName: "purchaseNft",
                    args: [BigInt(nft.tokenId.toString())],
                    value: priceInWei,
                  });
                } catch (err) {
                  console.error("Error calling purchaseNft function");
                }
              }}
            >
              购买
            </button>
            <button
              className="btn btn-primary btn-md px-8 tracking-wide"
              onClick={() => {
                setShowHistory(!showHistory);
                setLoadingHistory(true);
              }}
            >
              {showHistory ? "隐藏交易历史" : "查看交易历史"}
            </button>
            <button
              className={`btn ${isFavorite ? "btn-accent" : "btn-secondary"} btn-md px-8 tracking-wide`}
              onClick={toggleFavorite}
            >
              {isFavorite ? "取消收藏" : "添加收藏"}
            </button>
            <button
              className="btn btn-warning btn-md px-8 tracking-wide"
              onClick={() => setIsReporting(true)}
            >
              举报
            </button>
          </div>
        </div>
      </div>

      {/* 右侧交易历史 */}
      {showHistory && (
        <div className="flex-1 bg-white p-4 rounded-lg shadow-md h-full overflow-auto max-w-[500px]">
          <h3 className="text-xl font-semibold mb-4">交易历史</h3>
          {loadingHistory ? (
            <div>加载中...</div>
          ) : (
            <table className="table-auto w-full text-left border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-200">
                  <th className="border px-4 py-2 ">卖家</th>
                  <th className="border px-4 py-2 ">买家</th>
                  <th className="border px-4 py-2 ">价格 (ETH)</th>
                  <th className="border px-4 py-2 ">时间</th>
                </tr>
              </thead>
              <tbody>
                {tradeHistory.map((trade, index) => (
                  <tr key={index} className="bg-white hover:bg-gray-50">
                    <td className="border px-4 py-2 ">
                      <Address address={trade.seller} />
                    </td>
                    <td className="border px-4 py-2 ">
                      <Address address={trade.buyer} />
                    </td>
                    <td className="border px-4 py-2 ">{formatEther(trade.price)} ETH</td> {/* 转换为 ETH */}
                    <td className="border px-4 py-2 ">{new Date(Number(trade.timestamp) * 1000).toLocaleString()}</td> {/* 格式化时间 */}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      {/* 举报弹窗 */}
      {isReporting && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h2 className="text-xl font-semibold">举报NFT</h2>
            <textarea
              className="textarea textarea-bordered w-full my-4"
              placeholder="请输入举报原因"
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
            />
            <div className="modal-action">
              <button className="btn" onClick={() => setIsReporting(false)}>
                取消
              </button>
              <button className="btn btn-error" onClick={reportNFT}>
                提交举报
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
