const fetchFromApi = ({ path, method, body }: { path: string; method: string; body?: object }) =>
  fetch(path, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })
    .then(response => response.json())
    .catch(error => console.error("发生错误:", error));

export const addToIPFS = (yourJSON: object) => fetchFromApi({ path: "/api/ipfs/add", method: "Post", body: yourJSON });

// // export const getMetadataFromIPFS = (ipfsHash: string) =>
// //   fetchFromApi({ path: "/api/ipfs/get-metadata", method: "Post", body: { ipfsHash } });

export const getMetadataFromIPFS = async (tokenURI: string) => {
  console.log(`正在从 tokenURI 获取数据: ${tokenURI}`); 
  try {
    const response = await fetch(tokenURI);
    console.log("响应状态:", response.status); 
    if (!response.ok) {
      const errorText = await response.text(); 
      throw new Error(`HTTP 错误！状态: ${response.status}, 错误信息: ${errorText}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("获取元数据时发生错误:", error);
    throw error;
  }
};
