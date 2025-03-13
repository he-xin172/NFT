import { useState, useEffect } from "react";
import { formatEther } from "viem";
import { useScaffoldWriteContract, useScaffoldReadContract } from "~~/hooks/scaffold-eth";

// 定义盲盒相关类型
interface BoxProps {
  boxId: string;
  price: bigint;
  isPurchased: boolean;
  tokenIds: string[];
}

export const MysteryBoxCard = ({ box }: { box: BoxProps }) => {
  const { writeContractAsync } = useScaffoldWriteContract("YourCollectible");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [priceInEth, setPriceInEth] = useState<string>("");
  const [nftMetadata, setNftMetadata] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);

  // 将 tokenIds 转换为 BigInt 数组
  const tokenIdsBigInt = box.tokenIds.map((id) => BigInt(id));

  // 获取NFT信息，假设返回类型是一个对象而非函数
  const { data: nftItem, isLoading: nftItemLoading } = useScaffoldReadContract({
    contractName: "YourCollectible",
    functionName: "getNftItem",
    args: [tokenIdsBigInt[0]], // 获取第一个 tokenId 的数据
  });

  // 将 Wei 价格转换为 ETH 显示
  useEffect(() => {
    if (box.price) {
      const priceInETH = formatEther(box.price);
      setPriceInEth(priceInETH);
    }
  }, [box.price]);

  // 购买盲盒按钮的 onClick 事件
  const handlePurchase = async () => {
    if (box.isPurchased) {
      setErrorMessage("该盲盒已售出！");
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      const priceInWei = box.price;

      // 打印出价格，确保它正确
      console.log("盲盒价格 (Wei):", priceInWei.toString());

      // 调用合约并传递正确的金额（priceInWei）
      await writeContractAsync({
        functionName: "purchaseBox",
        args: [BigInt(box.boxId)], // 传递盲盒 ID，确保是 BigInt 类型
        value: priceInWei, // 传递 Wei 单位
      });

      // 获取购买盲盒的 NFT 元数据（从合约中获取对应的 tokenIds）
      const nftMetadataList = await Promise.all(
        box.tokenIds.map(async (tokenId: string) => {
          try {
            // 这里 `nftItem` 已经是一个对象，可以直接访问属性
            if (!nftItem || !nftItem.tokenUri) {
              console.error(`NFT item for tokenId ${tokenId} is missing tokenUri`);
              return null;
            }

            // 拼接 IPFS URL 前缀
            const tokenUriWithPrefix = `https://black-deliberate-penguin-271.mypinata.cloud/ipfs/${nftItem.tokenUri}`;

            console.log(`Fetching metadata for tokenId ${tokenId} from tokenUri: ${tokenUriWithPrefix}`);
            const metadataResponse = await fetch(tokenUriWithPrefix);
            if (!metadataResponse.ok) {
              throw new Error(`Failed to fetch metadata for tokenId ${tokenId}`);
            }

            return await metadataResponse.json();
          } catch (error) {
            console.error("NFT 获取元数据失败:", error);
            return null; // 失败时返回 null
          }
        })
      );

      // 过滤掉 null 元数据（如果有）
      setNftMetadata(nftMetadataList.filter((metadata) => metadata !== null));
      setShowModal(true); // 展示弹窗
      alert("购买成功！盲盒已售出！");
    } catch (err) {
      console.error("购买盲盒失败：", err);
      setErrorMessage("购买盲盒失败，请稍后再试！");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card w-64 bg-white shadow-md rounded-lg p-4">
      <img src="/盲盒.jpg" alt="?" className="w-full h-40 object-cover mb-4" />
      <div className="text-center text-lg font-semibold">
        <div>盲盒编号：{box.boxId}</div>
        <div>价格：{priceInEth} ETH</div>
      </div>
      <div className="card-body space-y-3">
        {errorMessage && <p className="text-error text-sm">{errorMessage}</p>}
        <div className="card-actions justify-center">
          <button
            className="btn btn-secondary btn-md px-8 tracking-wide"
            onClick={handlePurchase}
            disabled={box.isPurchased || loading}
          >
            {loading ? "购买中..." : box.isPurchased ? "盲盒已售完" : "购买盲盒"}
          </button>
        </div>
      </div>

      {/* 弹窗显示NFT元数据 */}
      {nftMetadata && showModal && (
        <div className="fixed top-0 left-0 right-0 bottom-0 bg-gray-800 bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-lg w-full">
            <h3 className="text-xl font-semibold mb-4">购买成功！</h3>
            {nftMetadata.map((metadata: any, index: number) => (
              <div key={index} className="mb-4">
                <img src={metadata.image} alt="NFT Image" className="w-full h-auto" />
                <p>{metadata.description}</p>
                <p><strong>名称：</strong>{metadata.name}</p>
              </div>
            ))}
            <button
              className="btn btn-primary w-full"
              onClick={() => setShowModal(false)} // 关闭弹窗
            >
              关闭
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
