"use client";

import React, { useState } from "react";
import { MyHoldings } from "./_components";
import type { NextPage } from "next";
import { useAccount } from "wagmi";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";
import { addToIPFS } from "~~/utils/simpleNFT/ipfs-fetch";
import nftsMetadata from "~~/utils/simpleNFT/nftsMetadata";
import { parseEther } from "ethers";

const MyNFTs: NextPage = () => {
  const { address: connectedAddress, isConnected, isConnecting } = useAccount();
  const { writeContractAsync } = useScaffoldWriteContract("YourCollectible");
  const { writeContractAsync: mysteryBoxWriteAsync } = useScaffoldWriteContract("YourCollectible");

  const { data: tokenIdCounter } = useScaffoldReadContract({
    contractName: "YourCollectible",
    functionName: "tokenIdCounter",
    watch: true,
  });

  const [batchSize, setBatchSize] = useState<number | string>(''); // 设置为string以便控制输入为空
  const [airdropData, setAirdropData] = useState<{ address: string; tokenId: string }[]>([{ address: "", tokenId: "" }]);
  const [mysteryBoxPrice, setMysteryBoxPrice] = useState<string>('');  // 盲盒价格改为 string
  const [nftTokenId, setNftTokenId] = useState<string>('');  // 用来保存单个NFT TokenId
  const [activeCard, setActiveCard] = useState<string>(''); // 跟踪显示哪个卡片

  const isValidAddress = (address: string): boolean => {
    return /^0x[a-fA-F0-9]{40}$/.test(address);  // 校验地址是否合法
  };

  const handleMintItem = async () => {
    console.log("Minting item...");
    if (tokenIdCounter === undefined) return;

    const tokenIdCounterNumber = Number(tokenIdCounter);
    const currentTokenMetaData = nftsMetadata[tokenIdCounterNumber % nftsMetadata.length];
    const notificationId = notification.loading("Uploading to IPFS");

    try {
      const uploadedItem = await addToIPFS(currentTokenMetaData);
      notification.remove(notificationId);
      notification.success("Metadata uploaded to IPFS");

      await writeContractAsync({
        functionName: "mintItem",
        args: [
          connectedAddress,         // 接收者地址
          uploadedItem.IpfsHash,    // NFT的URI
          connectedAddress,         // 版税接收者
          BigInt(500)               // 版税比例，默认5%
        ],
      });
      
    } catch (error) {
      notification.remove(notificationId);
      console.error(error);
      notification.error("Error minting NFT");
    }
  };

  const handleMintBatch = async () => {
    console.log("Minting batch...");
    if (tokenIdCounter === undefined) return;

    const tokenIdCounterNumber = Number(tokenIdCounter);
    const notificationId = notification.loading("Uploading to IPFS");

    try {
      const uris: string[] = [];
      const royaltyReceiver = connectedAddress;  // 版税接收者
      const feeNumerator = BigInt(500);           // 版税比例 5%

      const uploadedItems = await Promise.all(
        Array.from({ length: Number(batchSize) }).map(async (_, i) => {  // 使用Number(batchSize)来确保正确转换为数字
          const currentTokenMetaData = nftsMetadata[(tokenIdCounterNumber + i) % nftsMetadata.length];
          const uploadedItem = await addToIPFS(currentTokenMetaData);
          return uploadedItem.IpfsHash;  // 获取上传后的 IPFS URI
        })
      );
      uris.push(...uploadedItems);

      notification.remove(notificationId);
      notification.success("Metadata uploaded to IPFS");

      await writeContractAsync({
        functionName: "mintBatch",
        args: [
          connectedAddress,         // 接收者地址
          uris,                      // 生成的 URI 数组
          royaltyReceiver,           // 版税接收者
          feeNumerator               // 版税比例
        ],
      });

    } catch (error) {
      notification.remove(notificationId);
      console.error(error);
      notification.error("Error minting batch NFT");
    }
  };

  const handleAirdropNFT = async () => {
    const validAirdropData = airdropData.filter(
      (item) => isValidAddress(item.address) && item.tokenId !== ""
    );

    if (validAirdropData.length === 0) {
      notification.error("请输入有效的接收地址和NFT ID");
      return;
    }

    try {
      for (const { address, tokenId } of validAirdropData) {
        await writeContractAsync({
          functionName: "transferFrom",
          args: [
            connectedAddress, 
            address as `0x${string}`,
            BigInt(tokenId), 
          ],
        });
      }

      notification.success("NFTs 已成功赠送");
    } catch (error) {
      console.error("Error during airdrop:", error);
      notification.error("赠送失败，请重试");
    }
  };

  const addAirdropData = () => {
    setAirdropData([...airdropData, { address: "", tokenId: "" }]);
  };

  const updateAirdropData = (index: number, field: "address" | "tokenId", value: string) => {
    const newAirdropData = [...airdropData];
    newAirdropData[index][field] = value;
    setAirdropData(newAirdropData);
  };

  const handleCreateBox = async () => {
    if (!mysteryBoxPrice || !nftTokenId) {
      notification.error("请输入盲盒价格和NFT Token ID");
      return;
    }
  
    let nftTokenIdBigInt;
    try {
      nftTokenIdBigInt = BigInt(nftTokenId.trim()); // 转换为 BigInt 类型
    } catch (error) {
      notification.error("无效的 NFT Token ID");
      return;
    }
  
    let mysteryBoxPriceBigInt;
    try {
      // 将盲盒价格（ETH）转换为 Wei
      mysteryBoxPriceBigInt = BigInt(parseEther(mysteryBoxPrice.trim())); // parseEther 会将 ETH 转换为 Wei
    } catch (error) {
      notification.error("无效的盲盒价格");
      return;
    }
  
    try {
      const loadingNotification = notification.loading("创建盲盒...");
  
      await mysteryBoxWriteAsync({
        functionName: "createBox", 
        args: [[nftTokenIdBigInt], mysteryBoxPriceBigInt], // 传入单个 NFT TokenId 和盲盒价格（已转换为 Wei）
      });
  
      notification.remove(loadingNotification);
      notification.success("盲盒创建成功");
  
      // 清空输入框数据
      setMysteryBoxPrice('');
      setNftTokenId('');
    } catch (error) {
      console.error(error);
      notification.error("创建盲盒失败");
    }
  };



  return (
    <div className="container mx-auto p-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold">My NFTs</h1>
      </div>

      <div className="flex justify-center space-x-8 mb-8">
        {!isConnected || isConnecting ? (
          <RainbowKitCustomConnectButton />
        ) : (
          <div className="space-y-8 w-full max-w-2xl">
            {/* 功能按钮 */}
            <div className="flex justify-around mb-6">
              <button
                className="btn btn-primary w-1/4"
                onClick={handleMintItem} // 直接调用铸造函数
              >
                Mint NFT
              </button>
              <button
                className="btn btn-primary w-1/4"
                onClick={() => setActiveCard(activeCard === 'mintBatch' ? '' : 'mintBatch')} // 点击当前卡片收起
              >
                批量铸造
              </button>
              <button
                className="btn btn-primary w-1/4"
                onClick={() => setActiveCard(activeCard === 'airdrop' ? '' : 'airdrop')} // 点击当前卡片收起
              >
                转赠NFT
              </button>
              <button
                className="btn btn-primary w-1/4"
                onClick={() => setActiveCard(activeCard === 'mysteryBox' ? '' : 'mysteryBox')} // 点击当前卡片收起
              >
                创建盲盒
              </button>
            </div>

            {/* 卡片内容 */}
            {activeCard === 'mintBatch' && (
              <div className="card p-6 bg-transparent text-white mt-4 rounded-lg shadow-xl">
                <input
                  type="number"
                  value={batchSize}
                  onChange={(e) => setBatchSize(e.target.value)}
                  placeholder="请输入批量铸造数量（1-20）"
                  className="input input-bordered w-full text-black mb-4"
                />
                <button className="btn btn-secondary w-full mt-4" onClick={handleMintBatch}>
                  批量铸造 NFTs
                </button>
              </div>
            )}

            {activeCard === 'airdrop' && (
              <div className="card p-6 bg-transparent text-white mt-4 rounded-lg shadow-xl">
                <div className="flex flex-col space-y-4">
                  {airdropData.map((data, index) => (
                    <div key={index} className="mb-4 flex items-center space-x-2">
                      <input
                        type="text"
                        placeholder="请输入接收NFT地址（0x...）"
                        value={data.address}
                        onChange={(e) => updateAirdropData(index, "address", e.target.value)}
                        className="input input-bordered w-full text-black"
                      />
                      <input
                        type="number"
                        placeholder="请输入NFT ID"
                        value={data.tokenId}
                        onChange={(e) => updateAirdropData(index, "tokenId", e.target.value)}
                        className="input input-bordered w-full text-black"
                      />
                    </div>
                  ))}
                  <button type="button" onClick={addAirdropData} className="btn btn-small btn-primary">添加地址和NFT ID</button>
                  <button className="btn btn-secondary w-full mt-4" onClick={handleAirdropNFT}>
                    发送NFT
                  </button>
                </div>
              </div>
            )}

            {activeCard === 'mysteryBox' && (
              <div className="card p-6 bg-transparent text-white mt-4 rounded-lg shadow-xl">
                
                <input
                  type="text"
                  value={nftTokenId}
                  onChange={(e) => setNftTokenId(e.target.value)}
                  placeholder="请输入NFT Token ID"
                  className="input input-bordered w-full text-black mb-4"
                />
                <input
                  type="text"
                  value={mysteryBoxPrice}
                  onChange={(e) => setMysteryBoxPrice(e.target.value)}  // 直接处理字符串输入
                  placeholder="请输入盲盒价格(ETH)"
                  className="input input-bordered w-full text-black mb-4"
                />
                <button onClick={handleCreateBox} className="btn btn-primary w-full">
                  创建盲盒
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <MyHoldings />
    </div>
  );
};

export default MyNFTs;
