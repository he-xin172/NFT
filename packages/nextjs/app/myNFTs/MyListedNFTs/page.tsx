"use client";

import { useEffect, useState } from "react";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";
import { formatEther } from "viem";
import { getMetadataFromIPFS } from "~~/utils/simpleNFT/ipfs-fetch";
import { NFTMetaData } from "~~/utils/simpleNFT/nftsMetadata";
import { useAccount } from "wagmi"; // 获取当前用户地址

export interface OnSaleCollectible extends Partial<NFTMetaData> {
  tokenId: string;
  price: string;
  seller: string;
  isListed: boolean;
  tokenURI: string;
}

export const MyListedNFTs = () => {
  const { address: connectedAddress } = useAccount(); // 获取当前用户地址
  const [listedNFTs, setListedNFTs] = useState<OnSaleCollectible[]>([]); // 存储已上架的NFT
  const [allCollectiblesLoading, setAllCollectiblesLoading] = useState(false); // 加载状态

  const { data: onSaleNfts } = useScaffoldReadContract({
    contractName: "YourCollectible",
    functionName: "getAllListedNfts", // 获取所有上架的NFT
    watch: true,
  });

  const { writeContractAsync } = useScaffoldWriteContract("YourCollectible");

  // 获取上架NFT并更新状态
  const fetchListedNfts = async (): Promise<void> => {
    if (!onSaleNfts) return; // 防止 onSaleNfts 为 null 或 undefined 时继续执行

    setAllCollectiblesLoading(true);
    try {
      const fetchedNfts: OnSaleCollectible[] = await Promise.all(
        (onSaleNfts || []).map(async (item: any) => {
          const tokenId: string = item.tokenId.toString();
          const priceInEth = formatEther(item.price);
          const price: string = priceInEth.toString();
          const seller: string = item.seller;
          const isListed: boolean = item.isListed;
          const tokenURI: string = item.tokenUri;

          // 通过 tokenURI 获取元数据
          let metadata: Partial<NFTMetaData> = {};
          try {
            metadata = await getMetadataFromIPFS(tokenURI);
          } catch (err) {
            console.error(`Error fetching metadata for tokenId ${tokenId}:`, err);
            notification.error(`Error fetching metadata for tokenId ${tokenId}`);
          }

          return {
            tokenId,
            price,
            seller,
            isListed,
            tokenURI,
            ...metadata,
          };
        })
      );
      // 只筛选出卖家是当前用户的NFT
      const filteredNfts = fetchedNfts.filter((nft) => nft.seller.toLowerCase() === connectedAddress?.toLowerCase());
      setListedNFTs(filteredNfts);
    } catch (err) {
      console.error("Error fetching listed NFTs:", err);
      notification.error("Error fetching listed NFTs.");
    } finally {
      setAllCollectiblesLoading(false);
    }
  };

  // useEffect，确保每当 onSaleNfts 或其他依赖变化时重新获取数据
  useEffect(() => {
    if (onSaleNfts && connectedAddress) {
      fetchListedNfts(); // 获取上架的NFT
    }
  }, [onSaleNfts, connectedAddress]);  // 依赖 onSaleNfts 和 connectedAddress

  // 下架NFT的函数
  const handleUnlistNFT = async (nftId: string) => {
    try {
      await writeContractAsync({
        functionName: "unlistNft",
        args: [BigInt(nftId)],  // 使用 nftId，这里确保传递的是字符串
      });
      // 成功下架后，更新前端列表
      setListedNFTs((prevNFTs) => prevNFTs.filter((nft) => nft.tokenId !== nftId));
      notification.success("NFT 已成功下架");
    } catch (error) {
      console.error("Error calling unlistNft function:", error);
      notification.error("下架失败，请重试");
    }
  };

  const renderAttributes = (attributes: any[]) => {
    return (
      <div className="mt-2">
        {attributes && attributes.length > 0 ? (
          attributes.map((attr: any, index: number) => (
            <div key={index} className="flex justify-between text-sm">
              <span>{attr.trait_type}:</span>
              <span className="font-semibold">{attr.value}</span>
            </div>
          ))
        ) : (
          <div className="text-sm">No attributes available</div>
        )}
      </div>
    );
  };

  if (allCollectiblesLoading)
    return (
      <div className="flex justify-center items-center mt-10">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );

  return (
    <div className="flex justify-between my-4 px-5 gap-5">
      {/* 左侧NFT展示区 */}
      <div className="flex-1 flex flex-wrap gap-4 my-8 justify-center h-auto">
        {listedNFTs.length === 0 ? (
          <div className="flex justify-center items-center mt-10">
            <div className="text-2xl text-primary-content">你还没有上架任何NFT。</div>
          </div>
        ) : (
          listedNFTs.map((nft) => (
            <div key={nft.tokenId} className="flex flex-col items-center">
              <div className="text-2xl text-primary-content">你的已上架NFT</div>
              {/* 使用调整后的卡片样式 */}
              <div className="card bg-base-100 shadow-xl w-80 h-auto">
                <figure className="relative">
                  {/* 调整图片大小与其他页面一致 */}
                  <img src={nft.image} alt={nft.name} className="h-56 w-full object-cover rounded-lg" />
                </figure>
                <div className="card-body p-4 text-center">
                  <h3 className="text-xl font-semibold">{nft.name}</h3>
                  <p className="text-sm text-gray-500 mt-2">{nft.description}</p> {/* 显示描述 */}
                  
                  {/* 显示 NFT 的属性 */}
                  {nft.attributes && renderAttributes(nft.attributes)}

                  <div className="flex justify-between items-center mt-4">
                    <span className="text-sm font-semibold">Price: {nft.price} ETH</span>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleUnlistNFT(nft.tokenId)}  // 传递 tokenId
                    >
                      下架
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default MyListedNFTs;
