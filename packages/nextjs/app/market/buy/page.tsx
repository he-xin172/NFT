"use client";

import { useEffect, useState } from "react";
import { NFTCardOnSale } from "../../myNFTs/_components/NFTCardOnSale";
import { useScaffoldContract, useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";
import { getMetadataFromIPFS } from "~~/utils/simpleNFT/ipfs-fetch";
import { NFTMetaData } from "~~/utils/simpleNFT/nftsMetadata";
import { formatEther } from "viem";

export interface OnSaleCollectible extends Partial<NFTMetaData> {
  tokenId: string;
  price: string;
  seller: string;
  isListed: boolean;
  tokenURI: string;
}

export const Market = () => {
  const [onSaleCollectibles, setOnSaleCollectibles] = useState<OnSaleCollectible[]>([]); // NFT 数据
  const [allCollectiblesLoading, setAllCollectiblesLoading] = useState(false); // 加载状态
  const [minPrice, setMinPrice] = useState<string>(""); // 最低价格
  const [maxPrice, setMaxPrice] = useState<string>(""); // 最高价格
  const [filterAttributes, setFilterAttributes] = useState<{ [key: string]: string | number }>({}); // 属性筛选
  const [currentPage, setCurrentPage] = useState(1); // 当前页
  const [pageSize] = useState(3); // 每页展示数量
  const [selectedBackgroundColor, setSelectedBackgroundColor] = useState<string>(""); // 选择的背景颜色
  const [selectedStamina, setSelectedStamina] = useState<number | string>(""); // 选择的 Stamina 值

  // 获取合约实例
  const { data: yourCollectibleContract } = useScaffoldContract({
    contractName: "YourCollectible",
  });

  // 调用合约函数获取所有上架的 NFT
  const { data: onSaleNfts } = useScaffoldReadContract({
    contractName: "YourCollectible",
    functionName: "getAllListedNfts",
    watch: true,
  });

  // 获取上架的 NFT
  const fetchListedNfts = async (): Promise<void> => {
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

      // 解析价格范围
      const parsedMinPrice = parseFloat(minPrice);
      const parsedMaxPrice = parseFloat(maxPrice);

      // 应用筛选条件，确保价格是数字
      const filteredNfts = fetchedNfts.filter((nft) => {
        // 价格匹配
        const isPriceMatch =
          (isNaN(parsedMinPrice) || parseFloat(nft.price) >= parsedMinPrice) &&
          (isNaN(parsedMaxPrice) || parseFloat(nft.price) <= parsedMaxPrice);

        // 属性匹配，特别是Stamina
        const isAttributesMatch = Object.keys(filterAttributes).every((trait) => {
          const attribute = nft.attributes?.find((attr) => attr.trait_type === trait);
          if (attribute) {
            // 对Stamina进行类型转换和匹配
            if (trait === "Stamina") {
              return Number(attribute.value) === Number(filterAttributes[trait]); // 确保比较为数字
            }
            return attribute.value === filterAttributes[trait];  // 比较其他属性值
          }
          return true; // 如果找不到该属性，默认匹配
        });

        // 确保价格和属性都符合筛选条件
        return isPriceMatch && isAttributesMatch;
      });

      // 分页
      const startIndex = (currentPage - 1) * pageSize;
      const paginatedNfts = filteredNfts.slice(startIndex, startIndex + pageSize);

      setOnSaleCollectibles(paginatedNfts);
    } catch (err) {
      console.error("Error fetching listed NFTs:", err);
      notification.error("Error fetching listed NFTs.");
    } finally {
      setAllCollectiblesLoading(false);
    }
  };

  useEffect(() => {
    if (!onSaleNfts || !yourCollectibleContract) return;
    fetchListedNfts();
  }, [onSaleNfts, minPrice, maxPrice, filterAttributes, currentPage]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    fetchListedNfts(); // 切换页码后重新加载数据
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>, type: "min" | "max") => {
    if (type === "min") {
      setMinPrice(e.target.value); // 更新最低价格
    } else {
      setMaxPrice(e.target.value); // 更新最高价格
    }
  };

  const handleAttributeFilterChange = (trait: string, value: string | number) => {
    setFilterAttributes((prev) => ({
      ...prev,
      [trait]: value,
    }));
  };

  const handleFilterButtonClick = () => {
    fetchListedNfts(); // 点击筛选按钮时加载数据
  };

  // 设置背景颜色选择
  const handleBackgroundColorChange = (color: string) => {
    setSelectedBackgroundColor(color);
    handleAttributeFilterChange("BackgroundColor", color); // 更新筛选条件
  };

  // 设置Stamina值选择
  const handleStaminaChange = (value: string | number) => {
    setSelectedStamina(value);
    handleAttributeFilterChange("Stamina", value); // 更新筛选条件
  };

  if (allCollectiblesLoading)
    return (
      <div className="flex justify-center items-center mt-10">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );

  return (
    <>
      {/* 主容器，左右两边的布局 */}
      <div className="flex justify-between my-4 px-5 gap-5">
        {/* 左侧NFT展示区 */}
        <div className="flex-1 flex flex-wrap gap-4 my-8 justify-center w-[300px] ">
          {onSaleCollectibles.length === 0 ? (
            <div className="flex justify-center items-center mt-8">
              <div className="text-2xl text-primary-content">No NFTs found</div>
            </div>
          ) : (
            onSaleCollectibles.map((nft) => (
              <div key={nft.tokenId} className="flex flex-col items-center w-[300px] ">
                <NFTCardOnSale nft={nft} />
              </div>
            ))
          )}
        </div>

        {/* 右侧筛选和分页区域 */}
        <div className="flex flex-col gap-2 w-[300px]">
          {/* 价格范围筛选 */}
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="最低价格"
              value={minPrice}
              onChange={(e) => handlePriceChange(e, "min")}
              className="input input-bordered w-[90px]"
            />
            <span className="text-lg">—</span>
            <input
              type="number"
              placeholder="最高价格"
              value={maxPrice}
              onChange={(e) => handlePriceChange(e, "max")}
              className="input input-bordered w-[90px]"
            />
          </div>

          {/* 属性筛选 */}
          <div className="mt-4">
            <div>
              <label htmlFor="backgroundColor" className="block">背景颜色</label>
              <select
                id="backgroundColor"
                className="input input-bordered w-full"
                value={selectedBackgroundColor}
                onChange={(e) => handleBackgroundColorChange(e.target.value)}
              >
                <option value="">选择背景颜色</option>
                
                <option value="blue">蓝色</option>
                <option value="green">绿色</option>
                <option value="pink">粉色</option>
                <option value="black">黑色</option>
                <option value="orange">橙色</option>
              </select>
            </div>
            <div>
              <label htmlFor="stamina" className="block">Stamina值</label>
              <select
                id="stamina"
                className="input input-bordered w-full"
                value={selectedStamina}
                onChange={(e) => handleStaminaChange(e.target.value)}
              >
                <option value="">选择Stamina值</option>
                <option value={6}>6</option>
                <option value={9}>9</option>
                <option value={15}>15</option>
                <option value={22}>22</option>
                <option value={38}>38</option>
                <option value={42}>42</option>
              </select>
            </div>
          </div>

          {/* 筛选按钮 */}
          <button
            onClick={handleFilterButtonClick}
            className="btn w-full h-[52px] mt-4"
          >
            筛选
          </button>
        </div>
      </div>

      {/* 分页按钮，放在NFT卡片底部左右两边 */}
      <div className="flex justify-between my-4 px-5">
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="btn w-[150px] h-[50px]"
        >
          上一页
        </button>
        <button
          onClick={() => handlePageChange(currentPage + 1)}
          className="btn w-[150px] h-[50px]"
        >
          下一页
        </button>
      </div>
    </>
  );
};

export default Market;
