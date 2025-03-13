"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";

const market: React.FC = () => {
  const { isConnected, isConnecting } = useAccount();

  return (
    <div className="flex flex-col items-center justify-center bg-gray-40 py-8">  {/* 减少上下内边距 */}
      <header className="text-center mb-6">  {/* 减少标题和描述的间距 */}
        <h1 className="text-4xl font-bold mb-2">NFT市场</h1> {/* 调整标题大小和间距 */}
        <p className="text-lg text-gray-600">Explore, buy, and auction your NFTs</p>
      </header>

      <div className="flex flex-wrap justify-center gap-6 mb-6">  {/* 减少按钮间距 */}
        <Link href="/market/buy" passHref>
          <div className="btn btn-primary w-64 h-28 text-center flex flex-col justify-center items-center text-lg font-semibold">
            <span>NFT购买</span>
          </div>
        </Link>

        <Link href="/market/auction" passHref>
          <div className="btn btn-secondary w-64 h-28 text-center flex flex-col justify-center items-center text-lg font-semibold">
            <span>NFT拍卖</span>
          </div>
        </Link>

        <Link href="/market/mysteryBox" passHref>
          <div className="btn btn-secondary w-64 h-28 text-center flex flex-col justify-center items-center text-lg font-semibold">
            <span>NFT盲盒</span>
          </div>
        </Link>
      </div>

      {!isConnected && !isConnecting && (
        <div className="mt-4">  {/* 减少连接按钮与其它内容的间距 */}
          <RainbowKitCustomConnectButton />
        </div>
      )}
    </div>
  );
};

export default market;
