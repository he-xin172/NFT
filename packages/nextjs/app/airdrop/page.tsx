"use client";
import { useState } from "react";
import { MerkleTree } from "merkletreejs";
import { isAddress } from "viem"; // 使用 wagmi 的地址验证函数
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { soliditySha3 } from "web3-utils";
import { notification } from "~~/utils/scaffold-eth";
import { addToIPFS } from "~~/utils/simpleNFT/ipfs-fetch";
import nftsMetadata from "~~/utils/simpleNFT/nftsMetadata";

const MerkleTreePage = () => {
  //使用钩子获取合约中的多个状态变量
  const [addresses, setAddresses] = useState<string[]>([]); // 地址列表
  const [newAddress, setNewAddress] = useState<string>("");  // 输入的地址
  const [startTokenId, setStartTokenId] = useState<number | null>(null);  // 起始 Token ID
  const [merkleRoot, setMerkleRoot] = useState<string | null>(null);  // Merkle Root
  const [proofs, setProofs] = useState<Record<string, string[]> | null>(null);  // Proofs
  const [leaves, setLeaves] = useState<string[]>([]);  // Merkle Tree Leaves
  const [step, setStep] = useState<number>(1);  // 当前步骤
  const [mintedNFTs, setMintedNFTs] = useState<{ tokenId: number, uri: string }[]>([]); // 存储已铸造的NFT信息
  const { writeContractAsync } = useScaffoldWriteContract("YourCollectible");

  // 添加地址到地址列表
  const addAddress = () => {
    if (isAddress(newAddress)) {
      setAddresses([...addresses, newAddress]);
      setNewAddress("");
    } else {
      alert("请输入有效的以太坊地址");
    }
  };

  // 获取当前TokenID计数器
  const { data: tokenIdCounter } = useScaffoldReadContract({
    contractName: "YourCollectible",
    functionName: "tokenIdCounter",
    watch: true,
  });

  const [batchSize, setBatchSize] = useState<number | string>(''); // 设置为string以便控制输入为空

  // 批量铸造NFT的函数
  const handleMintBatch = async () => {
    if (tokenIdCounter === undefined) return;

    const tokenIdCounterNumber = Number(tokenIdCounter);
    const notificationId = notification.loading("Uploading to IPFS");

    try {
      const uris: string[] = [];
      const feeNumerator = BigInt(500);  // 版税比例 5%

      // 限制最大铸造数量
      const batchSizeNumber = Number(batchSize);
      if (batchSizeNumber <= 0 || batchSizeNumber > 20) {
        alert("批量铸造的数量必须为 1 到 20 之间的数字！");
        return;
      }

      const uploadedItems = await Promise.all(
        Array.from({ length: batchSizeNumber }).map(async (_, i) => {  // 使用batchSizeNumber来确保正确转换为数字
          const currentTokenMetaData = nftsMetadata[(tokenIdCounterNumber + i) % nftsMetadata.length];
          const uploadedItem = await addToIPFS(currentTokenMetaData);
          return uploadedItem.IpfsHash;  // 获取上传后的 IPFS URI
        })
      );
      uris.push(...uploadedItems);

      notification.remove(notificationId);
      notification.success("Metadata uploaded to IPFS");

      // 铸造NFT并更新铸造的NFT信息
      await writeContractAsync({
        functionName: "mintAirdropBatch",
        args: [uris, feeNumerator],
      });

      // 更新已铸造的NFT列表
      const mintedNFTs = uploadedItems.map((uri, i) => ({
        tokenId: tokenIdCounterNumber + i,
        uri: `https://gateway.pinata.cloud/ipfs/${uri}`,
      }));
      console.log("Minted NFTs:", mintedNFTs);
      setMintedNFTs([...mintedNFTs]);
    } catch (error) {
      notification.remove(notificationId);
      console.error(error);
      notification.error("Error minting batch NFT");
    }
  };

  // 生成 Merkle Tree 和 Merkle Root
  const generateMerkleTree = async () => {
    if (addresses.length === 0) {
      alert("地址列表为空，无法生成 Merkle Tree");
      return;
    }
    if (startTokenId === null) {
      alert("请指定开始的 Token ID");
      return;
    }
    //生成 Merkle Tree 的 叶子节点
    const generatedLeaves = addresses.map((addr, index) => {
      const tokenId = startTokenId + index;
      const leaf = soliditySha3(
        { type: "address", value: addr },
        { type: "uint256", value: tokenId }
      );
      return leaf;
    });
    setLeaves(generatedLeaves.filter((leaf): leaf is string => leaf !== null));

    // 创建 Merkle Tree
    const tree = new MerkleTree(generatedLeaves, soliditySha3, { sortPairs: true });
    const root = tree.getHexRoot();
    setMerkleRoot(root);

    // 将 Merkle Root 存储到合约
    await writeContractAsync({
      functionName: "setMerkleRoot",
      args: [root as `0x${string}`],
    });

    // 生成 Proofs
    const generatedProofs: Record<string, string[]> = {};
    addresses.forEach((addr, index) => {
      const tokenId = startTokenId + index;
      const leaf = soliditySha3(
        { type: "address", value: addr },
        { type: "uint256", value: tokenId }
      ) as string;
      const proof = tree.getHexProof(leaf);
      generatedProofs[`${addr}-${tokenId}`] = proof;
    });
    setProofs(generatedProofs);
    setStep(4); // 设置为结果展示步骤
  };

  const sendProofsToBackend = async (proofs: Record<string, string[]>) => {
    try {
      console.log("发送到后端的 Proofs 数据:", proofs);  // 打印 Proof 数据
  
      const response = await fetch("http://localhost:3001/saveMerkleProof", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ proofs }),
      });
  
      if (!response.ok) {
        const errorData = await response.json();
        console.error("Backend error:", errorData);
        throw new Error(errorData.message || "无法将 Proof 存储到后端");
      }
  
      const result = await response.json();
      console.log("响应结果:", result);
      alert("Proofs 存储成功！");
    } catch (error) {
      console.error("存储 Proof 失败:", error);
      alert("存储 Proof 时出错，请重试！");
    }
  };
  

  const reset = () => {
    setAddresses([]);
    setNewAddress("");
    setStartTokenId(null);
    setMerkleRoot(null);
    setProofs(null);
    setLeaves([]);
    setMintedNFTs([]);  // 重置已铸造的NFT
    setStep(1);
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", width: "100%", minHeight: "auto" }}>
      <div style={{ padding: "20px", maxWidth: "900px", margin: "0 auto", fontFamily: "Arial, sans-serif", width: "100%" }}>
        <h1 style={{ textAlign: "center", color: "#333" }}>NFT 批量铸造与 Merkle Tree 生成器</h1>
        <p style={{ textAlign: "center", color: "#666" }}>步骤 {step}/5</p>

        {/* 卡片样式和步进 */}
        <div style={{ display: "flex", gap: "20px", justifyContent: "center", marginBottom: "20px" }}>
          {[1, 2, 3, 4, 5].map((cardStep) => (
            <div
              key={cardStep}
              onClick={() => setStep(cardStep)}
              style={{
                padding: "20px",
                backgroundColor: step === cardStep ? "#f1f1f1" : "#e6e6e6",
                borderRadius: "12px",
                cursor: "pointer",
                transition: "all 0.3s ease",
                opacity: step === cardStep ? 1 : 0.5,
                boxShadow: step === cardStep ? "0 4px 12px rgba(0, 0, 0, 0.1)" : "none",
                transform: step === cardStep ? "scale(1.05)" : "scale(1)",
              }}
            >
              <h3 style={{ textAlign: "center", color: "#333" }}>
                {cardStep === 1 && "批量铸造NFT"}
                {cardStep === 2 && "添加空投接收的地址"}
                {cardStep === 3 && "输入起始 Token ID"}
                {cardStep === 4 && "查看 Merkle Tree 结果"}
                {cardStep === 5 && "完成"}
              </h3>
            </div>
          ))}
        </div>

        {/* Step 1 - 批量铸造NFT */}
        {step === 1 && (
          <div style={{ marginBottom: "20px" }}>
            <h3>1. 批量铸造NFT</h3>
            <input
              type="number"
              value={batchSize}
              onChange={(e) => setBatchSize(e.target.value)}
              placeholder="请输入批量铸造数量"
              style={{
                padding: "8px 12px",
                marginRight: "10px",
                borderRadius: "8px",
                border: "1px solid #ccc",
              }}
            />
            <button
              onClick={handleMintBatch}
              style={{
                padding: "12px 20px",
                backgroundColor: "#4CAF50",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
              }}
            >
              批量铸造
            </button>

            <div style={{ marginTop: "20px" }}>
              <h4>已铸造的NFT</h4>
              <ul>
                {mintedNFTs.map((nft, index) => (
                  <li key={index}>
                    <p>Token ID: {nft.tokenId}</p>
                    <p>URI: <a href={nft.uri} target="_blank" rel="noopener noreferrer">{nft.uri}</a></p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Step 2 - 添加接收空投的地址 */}
        {step === 2 && (
          <div style={{ marginBottom: "20px" }}>
            <h3>2. 添加接收空投的地址</h3>
            <input
              type="text"
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
              placeholder="请输入地址"
              style={{
                padding: "8px 12px",
                marginRight: "10px",
                borderRadius: "8px",
                border: "1px solid #ccc",
              }}
            />
            <button
              onClick={addAddress}
              style={{
                padding: "12px 20px",
                backgroundColor: "#4CAF50",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
              }}
            >
              添加地址
            </button>
            <div style={{ marginTop: "20px" }}>
              <h4>当前地址列表</h4>
              <ul>
                {addresses.map((address, index) => (
                  <li key={index}>{address}</li>
                ))}
              </ul>
            </div>
            <div style={{ marginTop: "20px" }}>
              <button
                onClick={() => setStep(3)}
                disabled={addresses.length === 0}  // 禁用按钮，直到有地址
                style={{
                  padding: "12px 20px",
                  backgroundColor: "#007BFF",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                }}
              >
                下一步
              </button>
            </div>
          </div>
        )}

        {/* Step 3 - 输入起始 Token ID */}
        {step === 3 && (
          <div style={{ marginBottom: "20px" }}>
            <h3>3. 输入起始 Token ID</h3>
            <input
              type="number"
              value={startTokenId || ""}
              onChange={(e) => setStartTokenId(Number(e.target.value))}
              placeholder="请输入起始 Token ID"
              style={{
                padding: "8px 12px",
                marginRight: "10px",
                borderRadius: "8px",
                border: "1px solid #ccc",
              }}
            />
            <div style={{ marginTop: "20px" }}>
              <button
                onClick={generateMerkleTree}
                disabled={startTokenId === null}  // 禁用按钮，直到指定了 Token ID
                style={{
                  padding: "12px 20px",
                  backgroundColor: "#4CAF50",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                }}
              >
                生成 Merkle Tree
              </button>
            </div>
          </div>
        )}

        {/* Step 4 - 查看 Merkle Root 和 Proofs */}
        {step === 4 && (
          <div style={{ marginBottom: "20px" }}>
            <h3>4. 查看 Merkle Tree 结果</h3>
            {merkleRoot && <p>Merkle Root: {merkleRoot}</p>}

            {proofs && (
              <div>
                <h4>生成的 Proofs:</h4>
                <pre>{JSON.stringify(proofs, null, 2)}</pre>
              </div>
            )}

            <div style={{ marginTop: "20px" }}>
              <button
                onClick={() => proofs && sendProofsToBackend(proofs)}  // 只有在 proofs 存在时才调用
                style={{
                  padding: "12px 20px",
                  backgroundColor: "#4CAF50",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                }}
              >
                将 Proofs 保存到后端
              </button>
            </div>
          </div>
        )}

        {/* Step 5 - 完成 */}
        {step === 5 && (
          <div style={{ textAlign: "center" }}>
            <h3>完成！</h3>
            <p>成功生成了 NFT 和 Merkle Tree，Proof 已保存到后端。</p>
            <button
              onClick={reset}
              style={{
                padding: "12px 20px",
                backgroundColor: "#FF5733",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
              }}
            >
              重置
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MerkleTreePage;
