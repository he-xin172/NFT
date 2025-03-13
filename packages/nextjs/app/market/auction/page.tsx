"use client";

import { useEffect, useState } from "react";
import { NFTCardOnAuction } from "./components/NFTCardOnAuction";
import { useScaffoldContract, useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";
import { getMetadataFromIPFS } from "~~/utils/simpleNFT/ipfs-fetch";
import { NFTMetaData } from "~~/utils/simpleNFT/nftsMetadata";
import { formatEther } from "viem";


export interface AuctionCollectible extends Partial<NFTMetaData> {
  tokenId: string;
  startingPrice: string;
  highestBid: string;
  highestBidder: string;
  auctionEndTime: string;
  isAuctionActive: boolean;
  tokenURI: string;
}

export const AuctionMarket = () => {
  const [auctionCollectibles, setAuctionCollectibles] = useState<AuctionCollectible[]>([]);
  const [allCollectiblesLoading, setAllCollectiblesLoading] = useState(false);

  // 获取合约实例
  const { data: yourCollectibleContract } = useScaffoldContract({
    contractName: "YourCollectible",
  });

  // 调用合约函数获取所有拍卖中的 NFT
  const { data: onAuctionNfts } = useScaffoldReadContract({
    contractName: "YourCollectible",
    functionName: "getAllAuctionedNfts",
    watch: true,
  });

  const fetchAuctionedNfts = async (): Promise<void> => {
    setAllCollectiblesLoading(true);
    try {
      const fetchedNfts: AuctionCollectible[] = await Promise.all(
        (onAuctionNfts || []).map(async (item: any) => {
          const tokenId: string = item.tokenId.toString();
          const startingPriceInEth = formatEther(item.startingPrice);
          const startingPrice: string = startingPriceInEth.toString();
          const highestBidInEth = formatEther(item.highestBid);
          const highestBid: string = highestBidInEth.toString();
          const highestBidder: string = item.highestBidder;
          const auctionEndTime: string = new Date(Number(item.auctionEndTime) * 1000).toLocaleString();
          const isAuctionActive: boolean = item.isAuctionActive;
          const tokenURI: string = await yourCollectibleContract?.read.tokenURI([BigInt(item.tokenId)]) as string;

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
            startingPrice,
            highestBid,
            highestBidder,
            auctionEndTime,
            isAuctionActive,
            tokenURI,
            ...metadata,
          };
        })
      );

      setAuctionCollectibles(fetchedNfts);
    } catch (err) {
      console.error("Error fetching auctioned NFTs:", err);
      notification.error("Error fetching auctioned NFTs.");
    } finally {
      setAllCollectiblesLoading(false);
    }
  };

  useEffect(() => {
    if (!onAuctionNfts || !yourCollectibleContract) return;
    fetchAuctionedNfts();
  }, [onAuctionNfts]);

  if (allCollectiblesLoading)
    return (
      <div className="flex justify-center items-center mt-10">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );

  return (
    <>
      {auctionCollectibles.length === 0 ? (
        <div className="flex justify-center items-center mt-10">
          <div className="text-2xl text-primary-content">No NFTs found</div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-4 my-8 px-5 justify-center">
          {auctionCollectibles.map(nft => (
            <div key={nft.tokenId} className="flex flex-col items-center">
              <NFTCardOnAuction nft={nft} />
            </div>
          ))}
        </div>
      )}
    </>
  );
};

export default AuctionMarket;
