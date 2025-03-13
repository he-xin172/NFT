import { useState, useEffect } from "react";
import { Collectible } from "./MyHoldings";
import { Address, AddressInput } from "~~/components/scaffold-eth";
import { useScaffoldWriteContract, useScaffoldReadContract, useScaffoldContract } from "~~/hooks/scaffold-eth";
import { parseEther, formatEther } from "viem";
import { notification } from "~~/utils/scaffold-eth";
import RarityCalculator from "./RarityCalculator"; // 引入 RarityCalculator 组件

export const NFTCard = ({ nft }: { nft: Collectible }) => {
  const [transferToAddress, setTransferToAddress] = useState("");
  const [isListed, setIsListed] = useState(false);
  const [price, setPrice] = useState<string>(""); // 上架价格（ETH）
  const [isAuctionModalOpen, setIsAuctionModalOpen] = useState(false); // 控制拍卖弹窗显示
  const [isListingModalOpen, setIsListingModalOpen] = useState(false); // 控制上架弹窗
  const [auctionPrice, setAuctionPrice] = useState<string>(""); // 拍卖起始价格（ETH）
  const [auctionDuration, setAuctionDuration] = useState<number>(0); // 拍卖持续时间（秒）
  const [rarityScore, setRarityScore] = useState<number | null>(null);
  const [rarityLevel, setRarityLevel] = useState<string>("");
  const [suggestedPrice, setSuggestedPrice] = useState<string>(""); // 存储建议价格

  const handleRarityScoreCalculated = (score: number, level: string) => {
    setRarityScore(score);
    setRarityLevel(level);
    // 根据稀有度分数给出建议价格
    if (level === "传奇") {
      setSuggestedPrice("7");
    } else if (level === "史诗") {
      setSuggestedPrice("5");
    } else if (level === "稀有") {
      setSuggestedPrice("3");
    } else {
      setSuggestedPrice("1");
    }
  };

  const { writeContractAsync } = useScaffoldWriteContract("YourCollectible");
  const { data: yourCollectibleContract } = useScaffoldContract({
    contractName: "YourCollectible",
  });
  const { data: nftItem } = useScaffoldReadContract({
    contractName: "YourCollectible",
    functionName: "getNftItem",
    args: [BigInt(nft.id.toString())],
    watch: true,
  });

  useEffect(() => {
    if (nftItem) {
      setIsListed(nftItem.isListed as boolean);
      setPrice(BigInt(nftItem.price).toString());
    } else {
      setIsListed(false);
      setPrice("");
    }
  }, [nftItem]);

  const fetchRoyaltyInfo = async (tokenId: string, price: string) => {
    if (!yourCollectibleContract) return { royaltyReceiver: "", royaltyPercentage: "0", royaltyAmount: "0" };

    try {
      // 获取版税信息
      const royaltyInfo = await yourCollectibleContract.read.royaltyInfo([BigInt(tokenId), parseEther(price)]);
      const royaltyReceiver = royaltyInfo[0];
      const royaltyPercentage = royaltyInfo[1];  // 通常是按千分之一表示，如 500 为 5%

      // 判断版税接收者是否是卖家
      const isSeller = royaltyReceiver.toLowerCase() === nft.owner.toLowerCase();
      let royaltyAmountETH = "0"; // 默认版税金额为 0

      // 如果不是卖家，计算版税金额
      if (!isSeller) {
        const royaltyAmountWei = BigInt(price) * BigInt(royaltyPercentage); 
        royaltyAmountETH = formatEther(royaltyAmountWei); // 转换为 ETH
      }

      return { royaltyReceiver, royaltyPercentage: royaltyPercentage.toString(), royaltyAmount: royaltyAmountETH };
    } catch (error) {
      console.error("Error fetching royalty info:", error);
      return { royaltyReceiver: "", royaltyPercentage: "0", royaltyAmount: "0" };
    }
  };

  const handleListNFT = async () => {
    console.log("上架 NFT:", nft.id);
    console.log("价格:", price);

    if (!price || isNaN(Number(price)) || Number(price) <= 0) {
      alert("请输入有效的价格（ETH）");
      return;
    }

    const priceWei = parseEther(price);
    console.log("价格 (wei):", priceWei);

    try {
      // 获取版税信息
      const { royaltyReceiver, royaltyPercentage, royaltyAmount } = await fetchRoyaltyInfo(nft.id.toString(), price);

      console.log("版税信息:", { royaltyReceiver, royaltyPercentage, royaltyAmount });
      console.log("版税金额:", royaltyAmount); // 版税金额已经是 ETH 单位

      if (parseFloat(royaltyAmount) > 0) {
        const message = `版税提醒：售出时将收取 ${royaltyAmount} ETH 作为版税，接收者：${royaltyReceiver}`;
        const userConfirmed = window.confirm(message);
        if (!userConfirmed) {
          console.log("用户取消上架");
          return;
        } else {
          console.log("用户确认上架");
        }
      } else {
        console.log("版税金额为 0，无需提示");
      }
      const listingPrice = await yourCollectibleContract?.read.calculateListingFee([BigInt(priceWei)]);
      console.log("上架费用 (wei):", listingPrice);
      await writeContractAsync({
        functionName: "placeNftOnSale",
        args: [BigInt(nft.id.toString()), priceWei],
        value: listingPrice,
      });
      notification.success("NFT 已成功上架");
    } catch (err) {
      console.error("Error calling placeNftOnSale function", err);
      notification.error("上架失败，请重试");
    }
  };

  const handleUnlistNFT = async () => {
    console.log("下架 NFT:", nft.id);
    try {
      await writeContractAsync({
        functionName: "unlistNft",
        args: [BigInt(nft.id.toString())],
      });
    } catch (err) {
      console.error("Error calling unlistNft function");
    }
  };

  // 处理拍卖相关逻辑
  const handleCreateAuction = async () => {
    console.log("创建拍卖 NFT:", nft.id);
    console.log("拍卖起始价格:", auctionPrice);
    console.log("拍卖持续时间:", auctionDuration);
    if (!auctionPrice || isNaN(Number(auctionPrice)) || Number(auctionPrice) <= 0) {
      alert("请输入有效的拍卖起始价格（ETH）");
      return;
    }
    if (auctionDuration <= 0) {
      alert("请输入有效的拍卖持续时间（秒）");
      return;
    }
    const auctionPriceWei = parseEther(auctionPrice);
    try {
      await writeContractAsync({
        functionName: "startAuction",
        args: [
          BigInt(nft.id.toString()), // NFT ID
          auctionPriceWei, // 拍卖起始价格
          BigInt(auctionDuration), // 拍卖持续时间
        ],
      });

      console.log("拍卖创建成功");
      notification.success("拍卖已成功创建");
      setIsAuctionModalOpen(false); // 关闭弹窗
    } catch (err) {
      console.error("Error calling createAuction function", err);
      notification.error("创建拍卖失败，请重试");
    }
  };

  return (
    <div className="card card-compact bg-base-100 shadow-lg w-[300px] shadow-secondary">
      <figure className="relative">
        <img src={nft.image} alt="NFT Image" className="h-60 min-w-full" />
        <figcaption className="glass absolute bottom-4 left-4 p-4 w-25 rounded-xl">
          <span className="text-white"># {nft.id}</span>
        </figcaption>
      </figure>
      <div className="card-body space-y-3">
        <div className="flex items-center justify-center">
          <p className="text-xl p-0 m-0 font-semibold">{nft.name}</p>
          <div className="flex flex-wrap space-x-2 mt-1">
            {nft.attributes?.map((attr, index) => (
              <span key={index} className="badge badge-primary py-3">
                {attr.value}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-col justify-center mt-1">
          <p className="my-0 text-lg">{nft.description}</p>
        </div>
        <div className="flex space-x-3 mt-1 items-center">
          <span className="text-lg font-semibold">Owner : </span>
          <Address address={nft.owner as `0x${string}`} />
        </div>
        <div className="card-actions justify-start">
            <div className="mt-2 flex space-x-4">
              <span className="text-lg font-semibold mb-1">稀有度: {rarityScore !== null ? rarityScore.toFixed(2) : "未计算"}
              </span>
              <span className="text-lg font-semibold mb-1">稀有度等级: {rarityLevel || "未计算"}
              </span>
            </div>
            {/* 自动计算稀有度并传递结果 */}
            <RarityCalculator
              attributes={nft.attributes || []}
              onCalculateRarity={handleRarityScoreCalculated}
            />
        </div>
        <div className="flex flex-col my-2 space-y-3">
          <span className="text-lg font-semibold mb-1">Transfer To: </span>
          <AddressInput
            value={transferToAddress}
            placeholder="receiver address"
            onChange={(newValue) => setTransferToAddress(newValue)}
          />
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              writeContractAsync({
                functionName: "transferFrom",
                args: [nft.owner as `0x${string}`, transferToAddress as `0x${string}`, BigInt(nft.id.toString())],
              });
            }}
          >
            Send
          </button>
        </div>
          {!isListed && (
            <div className="flex items-center my-2 space-x-3">
              <button
                className="btn btn-danger btn-sm w-full mt-3"
                onClick={() => setIsListingModalOpen(true)} 
              >
                上架
              </button>
            </div>
            )}
          {isListed && (
            <div className="flex items-center my-2 space-x-3">
              <span className="text-lg font-semibold">Price(ETH):{price}</span>
              <button
                className="btn btn-primary btn-sm px-4 py-1"
                onClick={handleUnlistNFT}
              >
                下架
              </button>
            </div>
          )}
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setIsAuctionModalOpen(true)}
          >
            新建拍卖
          </button>
          <button
            className="btn btn-danger btn-sm mt-3"
            onClick={() => writeContractAsync({ functionName: "burn", args: [BigInt(nft.id.toString())] })}
          >
            销毁 NFT
          </button>
        </div>

        {/* 上架弹窗 */}
    {isListingModalOpen && (
      <div className="fixed top-0 left-0 w-full h-full bg-gray-900 bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-lg p-6 w-96">
          <h2 className="text-xl font-bold mb-4">上架确认</h2>
          <div className="space-y-3">
            <div>
              <label className="block font-semibold mb-1">根据该NFT稀有度建议价格 (ETH):</label>
              <span className="text-lg font-semibold">{suggestedPrice} ETH</span>
              <p className="my-2">请确认你的上架价格：</p>
              <input
                type="text"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="input input-bordered w-full"
                placeholder="价格"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end space-x-3">
            <button
              className="btn btn-primary"
              onClick={handleListNFT}
            >
              上架
            </button>
            <button
              className="btn btn-outline"
              onClick={() => setIsListingModalOpen(false)}
            >
              取消
            </button>
          </div>
        </div>
      </div>
    )}

    {/* 拍卖弹窗 */}
    {isAuctionModalOpen && (
      <div className="fixed top-0 left-0 w-full h-full bg-gray-900 bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-lg p-6 w-96">
          <h2 className="text-xl font-bold mb-4">拍卖确认</h2>
          <div className="space-y-3">
            <div>
              <label className="block font-semibold mb-1">拍卖起始价格 (ETH):</label>
              <input
                type="text"
                value={auctionPrice}
                onChange={(e) => setAuctionPrice(e.target.value)}
                className="input input-bordered w-full"
                placeholder="拍卖起始价格"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">拍卖持续时间 (秒):</label>
              <input
                type="number"
                value={auctionDuration}
                onChange={(e) => setAuctionDuration(Number(e.target.value))}
                className="input input-bordered w-full"
                placeholder="持续时间"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end space-x-3">
            <button
              className="btn btn-primary"
              onClick={handleCreateAuction}
            >
              创建拍卖
            </button>
            <button
              className="btn btn-outline"
              onClick={() => setIsAuctionModalOpen(false)}
            >
              取消
            </button>
          </div>
        </div>
      </div>
    )}
  </div>
)};