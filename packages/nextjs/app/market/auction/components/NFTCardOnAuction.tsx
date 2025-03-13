import { useState, useEffect } from "react";
import { AuctionCollectible } from "../page";
import { Address } from "~~/components/scaffold-eth";
import { useScaffoldWriteContract, useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { parseEther, formatEther } from "viem";
import { useAccount } from "wagmi"; // 用于获取当前用户的地址

const formatAmount = (amount: string | bigint) => `${amount} ETH`;

export const NFTCardOnAuction = ({ nft }: { nft: AuctionCollectible }) => {
  const { writeContractAsync } = useScaffoldWriteContract("YourCollectible");
  const { address: userAddress } = useAccount(); // 获取当前用户地址
  const [bidAmount, setBidAmount] = useState("");
  const [bidHistory, setBidHistory] = useState<{ bidder: string; amount: string; timestamp: string }[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0); // 记录剩余时间
  const [isAuctionOwner, setIsAuctionOwner] = useState(false); // 是否为拍卖的拥有者
  const [previousHighestBid, setPreviousHighestBid] = useState(nft.highestBid); // 保存上一次的最高出价
  const [extendedTimeMessage, setExtendedTimeMessage] = useState(""); // 拍卖时间延长的提示消息
  const [auctionEnded, setAuctionEnded] = useState(false); // 记录拍卖是否已结束

  const { data: bidHistoryData } = useScaffoldReadContract({
    contractName: "YourCollectible",
    functionName: "getBidHistory",
    args: [BigInt(nft.tokenId)],
    watch: true,
  });

  const { data: auctionOwnerData } = useScaffoldReadContract({
    contractName: "YourCollectible",  // 合约名称
    functionName: "getAuctionOwner",  // 调用合约中的getAuctionOwner方法
    args: [BigInt(nft.tokenId)],     // 传入NFT的tokenId
    watch: true,                      // 自动监听数据变化
  });
  
  useEffect(() => {
    if (auctionOwnerData && userAddress) {
      const auctionOwner = auctionOwnerData.toLowerCase();
      const user = userAddress.toLowerCase();
      setIsAuctionOwner(auctionOwner === user);
    }
  }, [auctionOwnerData, userAddress]);
  
  useEffect(() => {
    if (showHistory && bidHistoryData) {
      setBidHistory(
        (bidHistoryData as any[]).map(bid => ({
          bidder: bid.bidder,
          amount: bid.amount.toString(),
          timestamp: bid.timestamp.toString(),
        }))
      );
      setLoadingHistory(false);
    }

    if (nft.auctionEndTime) {
      let endTime = new Date(nft.auctionEndTime).getTime() / 1000;

      if (isNaN(endTime)) {
        console.error("Invalid auctionEndTime:", nft.auctionEndTime);
        return;
      }

      const currentTime = Math.floor(Date.now() / 1000);
      if (endTime <= currentTime) {
        nft.isAuctionActive = false; // 拍卖结束
        setTimeLeft(0);
      }

      const interval = setInterval(() => {
        const currentTime = Math.floor(Date.now() / 1000);
        const timeDifference = endTime - currentTime;

        if (timeDifference <= 0) {
          setTimeLeft(0);
          clearInterval(interval);
          nft.isAuctionActive = false; // 拍卖结束
          if (isAuctionOwner && !auctionEnded) {
            endAuction();  // 如果拍卖拥有者并且拍卖还未结束，调用结束拍卖
          }
        } else {
          setTimeLeft(timeDifference);

          // 检查是否有新的出价并延长拍卖时间
          if (timeDifference <= 10 && nft.highestBid !== previousHighestBid) {
            extendAuctionTime();
            setPreviousHighestBid(nft.highestBid); // 更新上次的最高出价
          }
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [nft.auctionEndTime, bidHistoryData, auctionOwnerData, showHistory, userAddress, nft.highestBid, previousHighestBid, isAuctionOwner, auctionEnded]);

  // 自动结束拍卖的方法
  const endAuction = async () => {
    if (auctionEnded) return; // 如果拍卖已结束，直接跳过
    try {
      await writeContractAsync({
        functionName: "endAuction",
        args: [BigInt(nft.tokenId)],
      });
      alert("拍卖已结束！");
      nft.isAuctionActive = false; // 更新拍卖状态
      setAuctionEnded(true); // 标记拍卖已结束
    } catch (err) {
      console.error("Error ending auction:", err);
      alert("结束拍卖失败，请重试。");
    }
  };

  const formatTimeLeft = (time: number) => {
    if (isNaN(time)) return "Invalid time";
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const seconds = time % 60;
    return `${hours}h ${minutes}m ${seconds}s`;
  };

  const placeBid = async () => {
    const bidAmountInETH = parseFloat(bidAmount);

    if (isNaN(bidAmountInETH) || bidAmountInETH <= 0) {
      alert("请输入有效的出价金额。");
      return;
    }

    if (bidAmountInETH < parseFloat(nft.startingPrice)) {
      alert(`出价不能低于起始价格: ${nft.startingPrice} ETH`);
      return;
    }

    try {
      await writeContractAsync({
        functionName: "placeBid",
        args: [BigInt(nft.tokenId)],
        value: parseEther(bidAmount),
      });
      setBidAmount(""); // 清空输入框
    } catch (err) {
      console.error("Error placing bid:", err);
      alert("出价失败，请重试。");
    }
  };

  const stopAuction = async () => {
    // 只有在拍卖还在进行时，才允许提前结束
    if (timeLeft > 0) {
      const confirmed = window.confirm("确认提前结束拍卖？");
  
      if (!confirmed) return;
  
      try {
        await writeContractAsync({
          functionName: "stopAuctionWithBids",
          args: [BigInt(nft.tokenId)],
        });
        alert("拍卖已结束！");
        nft.isAuctionActive = false; // 更新拍卖状态
        setAuctionEnded(true); // 标记拍卖已结束
      } catch (err) {
        console.error("Error stopping auction:", err);
        alert("结束拍卖失败，请重试。");
      }
    } else {
      alert("拍卖已经结束，无法提前结束！");
    }
  };
  

  // 延长拍卖时间
  const extendAuctionTime = async () => {
    try {
      await writeContractAsync({
        functionName: "setAuctionTimeExtension",
        args: [BigInt(nft.tokenId)],
      });
      setExtendedTimeMessage("拍卖时间已延长1分钟！");
      setTimeout(() => setExtendedTimeMessage(""), 5000); // 5秒后清除提示信息
    } catch (err) {
      console.error("Error extending auction time:", err);
      alert("延长拍卖时间失败，请重试。");
    }
  };

  return (
    <div className="flex flex-row space-x-4 p-4">
      {/* 左侧NFT卡片 */}
      <div className="card bg-base-100 shadow-lg w-[300px] shadow-secondary">
        <figure className="relative">
          <img src={nft.image} alt="NFT Image" className="h-56 w-full object-cover" />
          <figcaption className="glass absolute bottom-4 left-4 p-4 w-25 rounded-xl">
            <span className="text-white"># {nft.tokenId}</span>
          </figcaption>
        </figure>
        <div className="card-body space-y-2">
          <h2 className="text-center text-xl font-semibold w-full">{nft.name || `Token #${nft.tokenId}`}</h2>
          <p className="w-full text-center">{nft.description || "No description available."}</p>
          <div className="w-full text-left">
            <span>起始价格: {formatAmount(nft.startingPrice)}</span>
          </div>
          <div className="w-full text-left">
            <span>当前最高出价: {formatAmount(nft.highestBid)}</span>
          </div>
          <div className="w-full text-left">
            <span>最高出价者: </span>
            {nft.highestBidder && /^0x[0-9a-fA-F]{40}$/.test(nft.highestBidder) ? (
              <Address address={nft.highestBidder as `0x${string}`} />
            ) : (
              "无"
            )}
          </div>
          <div className="w-full text-left text-lg font-semibold">
            <span>拍卖状态: {nft.isAuctionActive ? "进行中" : "已结束"}</span>
          </div>
          <div className="w-full text-left">
            <span>剩余时间: {formatTimeLeft(timeLeft)}</span>
          </div>
          {extendedTimeMessage && (
            <div className="text-green-500 text-center mt-2">
              {extendedTimeMessage}
            </div>
          )}
          {nft.isAuctionActive && isAuctionOwner && (
            <div className="mt-4 w-full">
              <button className="btn btn-danger btn-md w-full" onClick={stopAuction}>
                提前结束拍卖
              </button>
            </div>
          )}
          {nft.isAuctionActive && (
            <div className="mt-4 w-full space-y-2">
              <input
                type="number"
                className="input input-bordered w-full mb-2 text-sm"
                placeholder="输入出价 (ETH)"
                value={bidAmount}
                onChange={e => setBidAmount(e.target.value)}
              />
              <button
                className="btn btn-secondary btn-md w-full"
                onClick={placeBid}
                disabled={!bidAmount || parseFloat(bidAmount) <= 0 || parseFloat(bidAmount) < parseFloat(nft.startingPrice)}
              >
                出价
              </button>
            </div>
          )}
          <button
            className="btn btn-primary btn-md w-full mt-4"
            onClick={() => setShowHistory(!showHistory)}
          >
            {showHistory ? "隐藏竞拍历史" : "查看竞拍历史"}
          </button>
        </div>
      </div>
      {/* 右侧出价历史 */}
      {showHistory && (
        <div className="flex-1 bg-white p-4 rounded-lg shadow-md h-full overflow-auto max-w-[600px]">
          <h3 className="text-xl font-semibold mb-4">竞拍历史</h3>
          {loadingHistory ? (
            <div>加载中...</div>
          ) : (
            <table className="table-auto w-full text-left border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-200">
                  <th className="border px-4 py-2 text-sm">竞拍者</th>
                  <th className="border px-4 py-2 text-sm">竞拍值 (ETH)</th>
                  <th className="border px-4 py-2 text-sm">竞拍时间</th>
                </tr>
              </thead>
              <tbody>
                {bidHistory.map((bid, index) => (
                  <tr key={index} className="bg-white hover:bg-gray-50">
                    <td className="border px-4 py-2 text-sm">
                      {bid.bidder && /^0x[0-9a-fA-F]{40}$/.test(bid.bidder) ? (
                        <Address address={bid.bidder as `0x${string}`} />
                      ) : (
                        "匿名用户"
                      )}
                    </td>
                    <td className="border px-4 py-2 text-sm">
                      {formatEther(BigInt(bid.amount))} ETH
                    </td>
                    <td className="border px-4 py-2 text-sm">
                      {new Date(Number(bid.timestamp) * 1000).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};
