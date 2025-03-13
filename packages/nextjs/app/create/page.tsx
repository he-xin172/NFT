"use client";

import { useState } from "react";
import { MyHoldings } from "../myNFTs/_components";
import type { NextPage } from "next";
import { useAccount } from "wagmi";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useScaffoldWriteContract, useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";
import { addToIPFS } from "~~/utils/simpleNFT/ipfs-fetch";
import axios from "axios";

const CreateNFT: NextPage = () => {
  const { address: connectedAddress, isConnected, isConnecting } = useAccount();
  const { writeContractAsync } = useScaffoldWriteContract("YourCollectible");

  // 读取合约中的 tokenIdCounter
  const { data: tokenIdCounter } = useScaffoldReadContract({
    contractName: "YourCollectible",
    functionName: "tokenIdCounter",
    watch: true,
  });

  // 定义状态变量
  const [nftExternalUrl, setNftExternalUrl] = useState("");
  const [nftName, setNftName] = useState("");
  const [nftDescription, setNftDescription] = useState("");
  const [nftImage, setNftImage] = useState<File | null>(null);
  const [attributes, setAttributes] = useState([{ trait_type: "", value: "" }]);
  const [royaltyFeeNumerator, setRoyaltyFeeNumerator] = useState(500); // 默认版税为5%

  // 处理铸造 NFT 的逻辑
  const handleMintItem = async () => {
    if (!nftName || !nftDescription || !nftImage || !tokenIdCounter) return;

    // 验证版税比例是否合规
    if (royaltyFeeNumerator > 1000) {
      notification.error("版税比例不可以超过1000（10%），一般为500（5%）");
      return;
    }

    const notificationId = notification.loading("上传到IPFS");

    try {
      // 构建 NFT 元数据
      const metadata = {
        description: nftDescription,
        external_url: nftExternalUrl,
        image: await uploadImageToIPFS(nftImage),
        name: nftName,
        attributes,
      };

      // 上传元数据到 IPFS
      const uploadedItem = await addToIPFS(metadata);

      if (!uploadedItem || !uploadedItem.IpfsHash) {
        throw new Error("IPFS upload failed");
      }
      notification.remove(notificationId);
      notification.success("Metadata uploaded to IPFS");

      // 调用合约铸造 NFT
      const tokenId = Number(tokenIdCounter) + 1; // 使用合约中的 tokenIdCounter 生成新 tokenId

      await writeContractAsync({
        functionName: "mintItem",
        args: [
          connectedAddress,          // NFT 接收者地址
          uploadedItem.IpfsHash,     // NFT URI
          connectedAddress,          // 版税接收者地址
          BigInt(royaltyFeeNumerator) // 将版税比例转换为 bigint
        ],
      });

      notification.success("NFT minted successfully");

      // 将 NFT 数据存储到数据库
      const price = null; // 价格为空，代表未设置价格
      const sellerAddress = connectedAddress;

      // 将 NFT 信息发送到后端
      await axios.post('http://localhost:3001/saveNFT', {
        tokenId: tokenId, // 使用从合约读取的 tokenId
        price: price,
        sellerAddress: sellerAddress,
        tokenUri: uploadedItem.IpfsHash, // 从 IPFS 返回的 tokenUri
        isListed: false,  // 设置是否上架
        isAuction: false // 设置是否拍卖
      });

    } catch (error) {
      notification.remove(notificationId);
      notification.error("Error minting NFT: " + error);
      console.error(error);
    }
  };

  // 处理图片文件选择
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setNftImage(file);
    }
  };

  // 处理 NFT 属性的变更
  const handleAttributeChange = (index: number, field: string, value: string) => {
    const updatedAttributes = attributes.map((attribute, i) =>
      i === index ? { ...attribute, [field]: value } : attribute
    );
    setAttributes(updatedAttributes);
  };

  // 添加新的属性输入框
  const handleAddAttribute = () => {
    setAttributes([...attributes, { trait_type: "", value: "" }]);
  };

  return (
    <div className="flex flex-col items-center pt-10">
      <h1 className="text-4xl font-bold mb-8">Create NFT</h1>
      <div className="flex flex-col space-y-4 w-full max-w-md">
        <input
          type="text"
          placeholder="NFT Name"
          value={nftName}
          onChange={(e) => setNftName(e.target.value)}
          className="input"
        />
        <textarea
          placeholder="NFT Description"
          value={nftDescription}
          onChange={(e) => setNftDescription(e.target.value)}
          className="textarea"
        />
        <input
          type="text"
          placeholder="External URL"
          value={nftExternalUrl}
          onChange={(e) => setNftExternalUrl(e.target.value)}
          className="input"
        />
        <input
          type="file"
          placeholder="NFT Image"
          onChange={handleImageChange}
          accept="image/*"
          className="file-input"
        />

        {/* 版税输入框 */}
        <input
          type="number"
          placeholder="Royalty Fee (一般为500，即5%)"
          value={royaltyFeeNumerator}
          onChange={(e) => setRoyaltyFeeNumerator(Number(e.target.value))}
          className="input"
        />

        {attributes.map((attribute, index) => (
          <div key={index} className="flex space-x-2">
            <input
              type="text"
              placeholder="Trait Type"
              value={attribute.trait_type}
              onChange={(e) =>
                handleAttributeChange(index, "trait_type", e.target.value)
              }
              className="input"
            />
            <input
              type="text"
              placeholder="Value"
              value={attribute.value}
              onChange={(e) =>
                handleAttributeChange(index, "value", e.target.value)
              }
              className="input"
            />
          </div>
        ))}
        <button onClick={handleAddAttribute} className="btn btn-secondary">
          Add Attribute
        </button>
      </div>

      <div className="flex justify-center mt-5">
        {!isConnected || isConnecting ? (
          <RainbowKitCustomConnectButton />
        ) : (
          <button className="btn btn-secondary" onClick={handleMintItem}>
            Mint NFT
          </button>
        )}
      </div>

      <div className="flex justify-center mt-4">
        <a href="http://localhost:3000/myNFTs" className="btn btn-primary">
          返回 My NFTs
        </a>
      </div>
      <MyHoldings />
    </div>
  );
};

// 上传图片到 IPFS 的函数
const uploadImageToIPFS = async (file: File) => {
  const pinataJWT = process.env.NEXT_PUBLIC_PINATA_JWT;

  if (!pinataJWT) {
    throw new Error("NEXT_PUBLIC_PINATA_JWT 未在环境变量中设置！");
  }

  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${pinataJWT}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP 错误! 状态 : ${response.status}, 信息: ${errorText}`);
  }

  const result = await response.json();
  return `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`;
};

export default CreateNFT;
