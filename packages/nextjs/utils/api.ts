const fetchFromApi = ({
    path,
    method,
    body,
  }: {
    path: string;
    method: string;
    body?: object;
  }) =>
    fetch(path, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
      .then((response) => response.json())
      .catch((error) => console.error('Error:', error));
  
  export const saveNFTToDB = (data: object) => {
    return fetchFromApi({
      path: '/api/nft/data', // 确保路径与 API 路由一致
      method: 'POST',
      body: { data },
    });
  };
  