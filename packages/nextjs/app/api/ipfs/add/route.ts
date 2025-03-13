export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log("Request body:", body); // 调试用
    const data = JSON.stringify(body);
    const pinataJWT = process.env.PINATA_JWT;

    if (!pinataJWT) {
      throw new Error("PINATA_JWT 未在环境变量中设置！");
    }

    const response = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${pinataJWT}`,
        "Content-Type": "application/json",
      },
      body: data,
    });

    if (!response.ok) {
      const errorText = await response.text(); // 获取错误文本
      throw new Error(`HTTP 错误! 状态 : ${response.status}, 信息: ${errorText}`);
    }
    
    const result = await response.json();
    console.log("Pinata 返回的   :", result); // 调试用
    
    return Response.json({ IpfsHash: result.IpfsHash });
  } catch (error) {
    console.error("Error adding to IPFS", error); // 更详细的错误信息
    return Response.json({ error: "Error adding to IPFS" });
  }
}
