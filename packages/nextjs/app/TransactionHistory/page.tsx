"use client";

import type { NextPage } from "next";
import { Address } from "~~/components/scaffold-eth";
import { useScaffoldEventHistory } from "~~/hooks/scaffold-eth";
import { format } from "date-fns";
import { formatEther } from "viem";
import { error } from "console";
const TransactionHistory: NextPage = () => {
  const { data: purchaseEvents, isLoading , error } = useScaffoldEventHistory({
    contractName: "YourCollectible",
    eventName: "NftPurchased", 
    fromBlock: 0n,
    //如果用tokenid过滤：
    //filter: {  tokenId: BigInt(5),},
    blockData: true, //获取区块数据以获取时间戳
  });

  if (isLoading)
    return (
      <div className="flex justify-center items-center mt-10">
        <span className="loading loading-spinner loading-xl">正在加载,请稍等. . . . </span>
      </div>
    );

    if (error)
      return (
        <div className="flex justify-center items-center mt-10">
         出错了。。。
        </div>
      );
  

  return (
    <>
      <div className="flex items-center flex-col flex-grow pt-10">
        <div className="px-5">
          <h1 className="text-center mb-8">
            <span className="block text-4xl font-bold">All Transfers Events</span>
          </h1>
        </div>
        <div className="overflow-x-auto shadow-lg">
          <table className="table table-zebra w-full">
            <thead>
              <tr>
                <th className="bg-primary">Token Id</th>
                <th className="bg-primary">Buyer</th>
                <th className="bg-primary">Seller</th>
                <th className="bg-primary">Price</th>
                <th className="bg-primary">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {!purchaseEvents || purchaseEvents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center">
                    未找到交易记录
                  </td>
                </tr>
              ) : (
                purchaseEvents?.map((event, index) => {
                  const tokenId = event.args?.tokenId?.toString() ?? "N/A";  //安全的访问tokenid
                  const buyer = event.args?.buyer ?? "N/A";
                  const seller = event.args?.seller ?? "N/A";
                  const priceInWei = event.args?.price ?? 0n;
                  const priceInEth = formatEther(priceInWei); // wei 转换 ETH
                  const blockTimestamp = event.block?.timestamp;
                  const timestamp = blockTimestamp
                  ? format(new Date(Number(blockTimestamp) * 1000), "yyyy-MM-dd HH:mm:ss")
                  : "N/A";

                  return (
                    <tr key={index}>
                      <td className="text-center">{tokenId}</td> 
                      <td>
                        <Address address={buyer as `0x${string}` | undefined} />
                      </td>
                      <td>
                        <Address address={seller as `0x${string}` | undefined} />
                      </td>
                      <td>{priceInEth} ETH</td>
                      <td>{timestamp}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

export default TransactionHistory;
