# 基于Scaffold框架的NFT交易平台

## 项目简介

本项目是一个基于Scaffold框架开发的NFT交易平台，用户可以使用MetaMask等钱包进行注册和登录，支持NFT的铸造、交易、限时拍卖、盲盒、版税等多项功能，旨在为用户提供完整的NFT交易体验。

## Project Introduction

This project is an NFT trading platform based on the Scaffold framework. Users can register and log in using wallets such as MetaMask. It supports multiple features including NFT minting, trading, timed auctions, mystery boxes, and royalty mechanisms, providing users with a comprehensive NFT trading experience.

## 核心功能 (Core Features)

| 编号 (No.) | 功能 (Feature)             | 描述 (Description)                                                                                  |
|------------|-----------------------------|----------------------------------------------------------------------------------------------------|
| 1          | 用户注册、登录 (User Authentication) | 用户可以使用MetaMask等钱包进行注册和登录。 (Users can register and log in using wallets like MetaMask.) |
| 2          | 铸造NFT (NFT Minting)        | 用户可以铸造属于自己的NFT，包括名称、描述、价格、数量、图片、时间戳等，图片上传至IPFS。 (Users can mint their own NFTs, including name, description, price, quantity, image, and timestamp, with images uploaded to IPFS.) |
| 3          | 作品上/下架 (NFT Listing/Delisting) | 用户可选择NFT是否上架或下架。 (Users can choose whether to list or delist their NFTs.)               |
| 4          | 浏览NFT (Browse NFTs)        | 用户可以浏览所有上架的NFT，支持按类别、价格等筛选、收藏、举报、翻页。 (Users can browse listed NFTs and filter them by category, price, etc., as well as collect, report, and paginate.) |
| 5          | NFT明细页面 (NFT Detail Page) | 查看NFT详细信息，包括历史交易记录。 (Users can view detailed NFT information, including transaction history.) |
| 6          | NFT交易 (NFT Trading)         | 用户可购买NFT，智能合约自动完成交易。 (Users can purchase NFTs, with transactions automatically completed via smart contracts.) |
| 7          | 版税机制 (Royalty Mechanism)  | 每次NFT转售时，部分资金分配给原始创作者。 (A portion of funds is allocated to the original creator for each NFT resale.) |
| 8          | 关联数据库 (Database Integration) | 将前端部分数据上传至数据库中。 (Front-end data is synchronized with the database.)                     |
| 9          | 限时拍卖 (Timed Auctions)     | 允许用户创建限时拍卖，其他用户可在拍卖期内出价，最终由最高出价者获得NFT。 (Users can create timed auctions where others bid, and the highest bidder wins the NFT.) |
| 10         | NFT盲盒 (Mystery Box)         | 用户可购买盲盒并获得随机NFT。 (Users can purchase mystery boxes to receive random NFTs.)                |
| 13         | 稀有度系统 (Rarity System)     | 为NFT增加稀有度属性，稀有度影响其价值，稀有度高的NFT更加珍贵，平台会根据稀有度建议上架价格。 (NFTs have rarity attributes affecting their value. The platform suggests listing prices based on rarity.) |
| 14         | NFT空投 (NFT Airdrop)         | 管理员可将NFT免费空投给指定地址，作为营销或奖励。 (Admins can airdrop NFTs to specified addresses for marketing or rewards.) |

## 技术栈 (Tech Stack)

- **前端 (Frontend)：** Scaffold-ETH, Next.js
- **智能合约 (Smart Contracts)：** Solidity
- **区块链交互 (Blockchain Interaction)：** ethers.js
- **存储 (Storage)：** IPFS (用于NFT图片上传)
- **数据库 (Database)：** MySQL

## 安装与启动 (Installation & Startup)

### 环境要求 (Prerequisites)

- Node.js (>=16.x)
- MetaMask (浏览器插件 / Browser Extension)

### 安装步骤 (Installation Steps)

1. 克隆项目 (Clone the repository):

    git clone https://github.com/he-xin172/NFT.git
    cd NFT

2. 安装依赖 (Install dependencies):

    yarn install

3. 启动本地区块链网络 (Start the local blockchain network):

    yarn chain

4. 在第二个终端窗口中，部署智能合约 (Deploy smart contracts in a second terminal window):

    cd challenge-0-simple-nft
    yarn deploy

5. 在第三个终端窗口中，启动前端 (Start the frontend in a third terminal window):

    cd challenge-0-simple-nft
    yarn start

6. 访问平台 (Access the platform):

    打开浏览器并访问 [http://localhost:3000](http://localhost:3000)。

    Open your browser and navigate to [http://localhost:3000](http://localhost:3000).
