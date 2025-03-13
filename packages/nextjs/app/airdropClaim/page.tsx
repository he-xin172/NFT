"use client";
import { useState } from "react";
import { useAccount } from "wagmi"; // 使用 wagmi 获取钱包地址
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth"; // 使用 Scaffold-ETH 提供的 hook

const AirdropClaimPage = () => {
  const { address: connectedAddress } = useAccount(); // 获取连接的用户地址
  const [proof, setProof] = useState<string[]>([]); // 存储 Merkle Proof
  const [tokenId, setTokenId] = useState<number | null>(null); // 用户选择的 Token ID
  const { writeContractAsync } = useScaffoldWriteContract("YourCollectible"); // 获取写合约的 hook

  // 获取 Merkle Proof
  const getMerkleProof = async () => {
    if (!connectedAddress || !tokenId) {
      alert("请输入有效的地址和 Token ID");
      return;
    }

    try {
      // 从后端获取 Proof 数据
      const response = await fetch(
        `http://localhost:3001/getMerkleProofs?address=${connectedAddress}&tokenId=${tokenId}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        alert(errorData.error || "无法获取 Merkle Proof");
        return;
      }

      const { proof, leafHash } = await response.json();
      if (proof.length === 0) {
        alert("该地址不在空投名单中");
      } else {
        // 解析 proof 字符串
        const parsedProof = JSON.parse(proof); // 解析 proof 字符串为 JSON 数组
        setProof(parsedProof); // 设置 proof 数据
      }
    } catch (error) {
      console.error("获取 Merkle Proof 失败", error);
      alert("获取 Proof 时出错，请重试");
    }
  };

  // 调用合约领取空投
  const claim = async () => {
    if (proof.length === 0) {
      alert("请先获取有效的 Merkle Proof");
      return;
    }

    try {
      const formattedProof: readonly `0x${string}`[] = proof.map((p) => `0x${p.slice(2)}`) as readonly `0x${string}`[];

      console.log('Formatted Proof:', formattedProof);
      console.log('Token ID:', tokenId);

      // 调用合约
      const tokenIdBigInt = BigInt(tokenId!);
      const tx = await writeContractAsync({
        functionName: "claimNFT",
        args: [formattedProof, tokenIdBigInt]
      });

      console.log('Transaction Sent:', tx);
      alert("空投领取成功！");
    } catch (error) {
      console.error("领取失败", error);
      alert("领取失败，请重试");
    }
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", width: "100%", minHeight: "auto" }}>
      <div style={{ padding: "20px", maxWidth: "900px", margin: "0 auto", fontFamily: "Arial, sans-serif", width: "100%" }}>
        <h1 style={{ textAlign: "center", color: "#333" }}>空投领取</h1>
        <p style={{ textAlign: "center", color: "#666" }}>已连接钱包：{connectedAddress}</p>

        {/* 领取空投部分 */}
        <div style={{ marginBottom: "20px" }}>
          <h3>请输入您的 Token ID 以领取空投</h3>
          <div style={{ display: "flex", alignItems: "center", marginBottom: "10px" }}>
            <input
              type="number"
              value={tokenId ?? ""}
              placeholder="请输入 Token ID"
              onChange={(e) => setTokenId(Number(e.target.value))}
              style={{
                marginRight: "10px",
                padding: "12px",
                flex: "1",
                border: "1px solid #ddd",
                borderRadius: "8px",
                fontSize: "14px",
              }}
            />
            <button
              onClick={getMerkleProof}
              style={{
                padding: "12px 20px",
                backgroundColor: "#007BFF",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
              }}
            >
              获取证明
            </button>
          </div>

          {/* 显示获取到的 Merkle Proof */}
          {proof.length > 0 && (
            <div style={{ marginTop: "20px" }}>
              <h4>获取到的 Merkle Proof：</h4>
              <pre style={{ background: "#f4f4f4", padding: "10px", borderRadius: "8px" }}>
                {JSON.stringify(proof, null, 2)}
              </pre>
            </div>
          )}

          {/* 领取空投按钮 */}
          {proof.length > 0 && (
            <div style={{ marginTop: "20px" }}>
              <button
                onClick={claim}
                style={{
                  padding: "12px 20px",
                  backgroundColor: "#28A745",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                }}
              >
                领取空投
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AirdropClaimPage;
